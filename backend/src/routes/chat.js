import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "../db/db.js";
import { decryptSecret } from "../utils/crypto.js";
import { buildProfile, getAdapter, buildRequestSettings } from "../providers/index.js";
import {
  scanLorebook,
  buildCharacterPrompt,
  computeStopSequences,
  reshapeHistoryForCharacter,
  replaceMacros,
} from "../lib/promptBuilder.js";

export const router = Router();

function loadCharacter(id) {
  const row = db.prepare("SELECT * FROM characters WHERE id = ?").get(id);
  if (!row) return null;
  return { id: row.id, name: row.name, avatarPath: row.avatar_path, ...JSON.parse(row.data_json) };
}

function loadPersona(id) {
  if (!id) return null;
  const row = db.prepare("SELECT * FROM personas WHERE id = ?").get(id);
  if (!row) return null;
  const data = JSON.parse(row.data_json);
  return { id: row.id, name: row.name, description: data.description || "" };
}

function loadAttachedLorebooks(characterId) {
  const rows = db
    .prepare(
      `SELECT l.* FROM lorebooks l JOIN character_lorebooks cl ON cl.lorebook_id = l.id WHERE cl.character_id = ?`
    )
    .all(characterId);
  return rows.map((r) => JSON.parse(r.book_json));
}

// Loads raw chat history (with speaker names + message ids) so per-character
// reshaping can label "other speaker" turns, and continue/reroll can locate
// a specific message within it.
function loadHistoryWithSpeakers(chatId) {
  const rows = db.prepare("SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC").all(chatId);
  const nameCache = new Map();
  const nameFor = (characterId) => {
    if (!characterId) return null;
    if (!nameCache.has(characterId)) {
      const c = db.prepare("SELECT name FROM characters WHERE id = ?").get(characterId);
      nameCache.set(characterId, c?.name || "Character");
    }
    return nameCache.get(characterId);
  };
  return rows.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    characterId: m.character_id,
    speakerName: nameFor(m.character_id),
  }));
}

// Pulls the two global prompt fields out of the generic settings object
// (they travel alongside temperature/top_p/etc from the Settings menu but
// aren't provider params) for prompt assembly. What's left goes through the
// normal per-protocol settings filter untouched.
function extractGlobalPrompt(settings = {}) {
  const { systemPrompt, postHistoryInstructions, ...rest } = settings;
  return {
    globalSystemPrompt: systemPrompt || "",
    globalPostHistoryInstructions: postHistoryInstructions || "",
    rest,
  };
}

// Persists a completion result:
//  - normally: inserts a new message (variants = [full])
//  - continuing: appends new text onto the ACTIVE variant's text (same row,
//    same variant slot — extending what's on screen, not creating an
//    alternative)
//  - rerolling: pushes a brand new variant onto the existing row and makes
//    it active, keeping every earlier attempt around to swipe back to —
//    the row's position in the chat never changes since nothing is
//    inserted/deleted, just appended to variants_json
function saveAssistantMessage({ chatId, characterId, continueMessageId, rerollMessageId, messageId, full }) {
  if (!chatId) return { messageId: null, content: full, variantIndex: 0, variantCount: 1 };

  if (continueMessageId) {
    const row = db
      .prepare("SELECT content, variants_json, active_variant_index FROM messages WHERE id = ?")
      .get(continueMessageId);
    const variants = row?.variants_json ? JSON.parse(row.variants_json) : [row?.content || ""];
    const idx = row?.active_variant_index ?? 0;
    variants[idx] = (variants[idx] || "") + full;
    const merged = variants[idx];
    db.prepare("UPDATE messages SET content = ?, variants_json = ? WHERE id = ?").run(
      merged,
      JSON.stringify(variants),
      continueMessageId
    );
    db.prepare("UPDATE chats SET updated_at = datetime('now') WHERE id = ?").run(chatId);
    return { messageId: continueMessageId, content: merged, variantIndex: idx, variantCount: variants.length };
  }

  if (rerollMessageId) {
    const row = db.prepare("SELECT content, variants_json FROM messages WHERE id = ?").get(rerollMessageId);
    const variants = row?.variants_json ? JSON.parse(row.variants_json) : [row?.content || ""];
    variants.push(full);
    const newIdx = variants.length - 1;
    db.prepare("UPDATE messages SET content = ?, variants_json = ?, active_variant_index = ? WHERE id = ?").run(
      full,
      JSON.stringify(variants),
      newIdx,
      rerollMessageId
    );
    db.prepare("UPDATE chats SET updated_at = datetime('now') WHERE id = ?").run(chatId);
    return { messageId: rerollMessageId, content: full, variantIndex: newIdx, variantCount: variants.length };
  }

  // Use the client-generated id if one was supplied, so the frontend already
  // knows the real id even if generation gets stopped before the response
  // can round-trip back (see /completion and /character-completion below).
  const newId = messageId || nanoid();
  db.prepare(
    `INSERT INTO messages (id, chat_id, role, character_id, content) VALUES (?, ?, 'assistant', ?, ?)`
  ).run(newId, chatId, characterId || null, full);
  db.prepare("UPDATE chats SET updated_at = datetime('now') WHERE id = ?").run(chatId);
  return { messageId: newId, content: full, variantIndex: 0, variantCount: 1 };
}

// Streams a single, character-less completion via Server-Sent Events.
// body: { connectionId, model, messages, settings, chatId?, characterId?,
//         continueMessageId?, rerollMessageId?, messageId? }
router.post("/completion", async (req, res) => {
  const {
    connectionId,
    model,
    messages,
    settings,
    chatId,
    characterId,
    continueMessageId,
    rerollMessageId,
    messageId,
  } = req.body;

  const row = db.prepare("SELECT * FROM connection_profiles WHERE id = ?").get(connectionId);
  if (!row) return res.status(404).json({ error: "connection not found" });
  if (!model) return res.status(400).json({ error: "model is required" });
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages must be a non-empty array" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const controller = new AbortController();
  // Listen on the *response* socket, not the request — req's readable
  // stream closes almost instantly once its small JSON body is parsed,
  // which would abort the outbound provider call before it can respond.
  res.on("close", () => controller.abort());

  // Accumulated here (not just read from the adapter's return value) so that
  // if generation is stopped early — by the person clicking Stop, or a
  // provider hiccup — whatever text already streamed in still gets saved
  // instead of thrown away.
  let full = "";

  try {
    const { globalSystemPrompt, globalPostHistoryInstructions, rest } = extractGlobalPrompt(settings);
    const finalMessages = [...messages];
    // Continuing must end in the assistant's own partial turn so the
    // provider treats it as an extension, not a fresh instruction — so skip
    // injecting fresh prompt scaffolding in that case.
    if (!continueMessageId) {
      if (globalSystemPrompt) finalMessages.unshift({ role: "system", content: globalSystemPrompt });
      if (globalPostHistoryInstructions) finalMessages.push({ role: "system", content: globalPostHistoryInstructions });
    }

    const apiKey = row.api_key_encrypted ? decryptSecret(row.api_key_encrypted) : null;
    const profile = buildProfile(row, apiKey);
    const adapter = getAdapter(profile.protocol);
    const runtimeSettings = buildRequestSettings(profile.protocol, rest);

    await adapter.streamChat({
      profile,
      apiKey,
      model,
      messages: finalMessages,
      settings: runtimeSettings,
      signal: controller.signal,
      onToken: (delta) => {
        full += delta;
        res.write(`data: ${JSON.stringify({ type: "delta", content: delta })}\n\n`);
      },
    });

    const saved = saveAssistantMessage({ chatId, characterId, continueMessageId, rerollMessageId, messageId, full });
    res.write(`data: ${JSON.stringify({ type: "done", ...saved })}\n\n`);
    res.end();
  } catch (err) {
    if (full) {
      // Stopped early (or the provider dropped) but we still got something —
      // save it and report a normal completion rather than an error.
      const saved = saveAssistantMessage({ chatId, characterId, continueMessageId, rerollMessageId, messageId, full });
      res.write(`data: ${JSON.stringify({ type: "done", ...saved, stopped: true })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
    }
    res.end();
  }
});

// Character-aware completion: assembles the system prompt from ONLY this
// character's card + scenario + its own lorebooks (plus the global prompt
// fields from Settings and the active persona), reshapes shared chat
// history into a plain user/assistant view from its point of view (other
// speakers folded into labelled "user" turns), and streams the reply.
// body: { connectionId, model, settings, chatId, characterId, scenarioOverride,
//         generateGreeting?, continueMessageId?, rerollMessageId?, messageId?, personaId? }
router.post("/character-completion", async (req, res) => {
  const {
    connectionId,
    model,
    settings,
    chatId,
    characterId,
    scenarioOverride,
    generateGreeting,
    continueMessageId,
    rerollMessageId,
    messageId,
    personaId,
  } = req.body;

  const connRow = db.prepare("SELECT * FROM connection_profiles WHERE id = ?").get(connectionId);
  if (!connRow) return res.status(404).json({ error: "connection not found" });
  const character = loadCharacter(characterId);
  if (!character) return res.status(404).json({ error: "character not found" });
  if (!model) return res.status(400).json({ error: "model is required" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const controller = new AbortController();
  res.on("close", () => controller.abort());

  let full = "";

  try {
    let history = chatId ? loadHistoryWithSpeakers(chatId) : [];
    if (continueMessageId) {
      const idx = history.findIndex((m) => m.id === continueMessageId);
      if (idx !== -1) history = history.slice(0, idx + 1);
    } else if (rerollMessageId) {
      // Regenerate in place: use only what came BEFORE the message being
      // rerolled — not the exclude-nothing default (which would let the
      // character "see" messages that, chronologically, came after it) and
      // not messages after it either. The reply itself gets saved back into
      // this same row so its position in the chat never changes.
      const idx = history.findIndex((m) => m.id === rerollMessageId);
      if (idx !== -1) history = history.slice(0, idx);
    }

    const persona = loadPersona(personaId);
    const chatRow = chatId ? db.prepare("SELECT character_ids_json FROM chats WHERE id = ?").get(chatId) : null;
    const otherCharacterNames = chatRow
      ? JSON.parse(chatRow.character_ids_json || "[]")
          .filter((id) => id !== characterId)
          .map((id) => db.prepare("SELECT name FROM characters WHERE id = ?").get(id)?.name)
          .filter(Boolean)
      : [];

    const recentText = history.slice(-6).map((m) => m.content).join("\n") + "\n" + (scenarioOverride || "");
    const books = loadAttachedLorebooks(characterId);
    const lorebookEntries = books.flatMap((b) => scanLorebook(b, recentText));

    const { globalSystemPrompt, globalPostHistoryInstructions, rest } = extractGlobalPrompt(settings);
    const { systemPrompt, postHistoryMessage } = buildCharacterPrompt({
      character,
      scenarioOverride,
      lorebookEntries,
      globalSystemPrompt,
      globalPostHistoryInstructions,
      personaName: persona?.name,
      personaDescription: persona?.description,
      otherCharacterNames,
    });

    const reshaped = reshapeHistoryForCharacter(history, character, persona?.name);
    const finalMessages = [{ role: "system", content: systemPrompt }, ...reshaped];

    if (!continueMessageId) {
      // Same reasoning as /completion: continuation must end in the
      // assistant's own partial turn, so skip appending fresh instructions.
      if (postHistoryMessage) finalMessages.push({ role: "system", content: postHistoryMessage });
      if (generateGreeting || finalMessages.length === 1) {
        finalMessages.push({
          role: "user",
          content: "Begin the roleplay now with an opening message that fits the scenario.",
        });
      }
    }

    const stopSequences = computeStopSequences({ personaName: persona?.name, otherCharacterNames });

    const apiKey = connRow.api_key_encrypted ? decryptSecret(connRow.api_key_encrypted) : null;
    const profile = buildProfile(connRow, apiKey);
    const adapter = getAdapter(profile.protocol);
    const runtimeSettings = buildRequestSettings(profile.protocol, rest);

    await adapter.streamChat({
      profile,
      apiKey,
      model,
      messages: finalMessages,
      settings: runtimeSettings,
      stopSequences,
      signal: controller.signal,
      onToken: (delta) => {
        full += delta;
        res.write(`data: ${JSON.stringify({ type: "delta", content: delta })}\n\n`);
      },
    });

    // Safety net in case the model itself ever emits a literal {{char}}/
    // {{user}} token — resolve it the same way card fields are resolved.
    full = replaceMacros(full, { charName: character.name, personaName: persona?.name });

    const saved = saveAssistantMessage({ chatId, characterId, continueMessageId, rerollMessageId, messageId, full });
    res.write(`data: ${JSON.stringify({ type: "done", ...saved, characterId })}\n\n`);
    res.end();
  } catch (err) {
    if (full) {
      full = replaceMacros(full, { charName: character.name, personaName: loadPersona(personaId)?.name });
      const saved = saveAssistantMessage({ chatId, characterId, continueMessageId, rerollMessageId, messageId, full });
      res.write(`data: ${JSON.stringify({ type: "done", ...saved, characterId, stopped: true })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
    }
    res.end();
  }
});
