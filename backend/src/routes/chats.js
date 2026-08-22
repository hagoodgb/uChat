import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "../db/db.js";

export const router = Router();

function toPublic(row) {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    characterIds: row.character_ids_json ? JSON.parse(row.character_ids_json) : [],
    connectionId: row.connection_id,
    modelMap: row.model_map_json ? JSON.parse(row.model_map_json) : {},
    settingsProfileId: row.settings_profile_id,
    scenario: row.scenario_json ? JSON.parse(row.scenario_json) : null,
    responseMode: row.response_mode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM chats ORDER BY updated_at DESC").all();
  res.json(rows.map(toPublic));
});

router.post("/", (req, res) => {
  const {
    title,
    kind = "single",
    characterIds = [],
    connectionId,
    modelMap = {},
    settingsProfileId,
    scenario,
    responseMode = "auto",
  } = req.body;
  const id = nanoid();
  db.prepare(
    `INSERT INTO chats (id, title, kind, character_ids_json, connection_id, model_map_json, settings_profile_id, scenario_json, response_mode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    title || "New chat",
    kind,
    JSON.stringify(characterIds),
    connectionId || null,
    JSON.stringify(modelMap),
    settingsProfileId || null,
    scenario ? JSON.stringify(scenario) : null,
    responseMode
  );
  res.status(201).json(toPublic(db.prepare("SELECT * FROM chats WHERE id = ?").get(id)));
});

router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM chats WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(toPublic(row));
});

router.put("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM chats WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "not found" });
  const { title, modelMap, settingsProfileId, scenario, responseMode } = req.body;
  db.prepare(
    `UPDATE chats SET
       title = COALESCE(?, title),
       model_map_json = COALESCE(?, model_map_json),
       settings_profile_id = COALESCE(?, settings_profile_id),
       scenario_json = COALESCE(?, scenario_json),
       response_mode = COALESCE(?, response_mode),
       updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    title ?? null,
    modelMap ? JSON.stringify(modelMap) : null,
    settingsProfileId ?? null,
    scenario ? JSON.stringify(scenario) : null,
    responseMode ?? null,
    req.params.id
  );
  res.json(toPublic(db.prepare("SELECT * FROM chats WHERE id = ?").get(req.params.id)));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM chats WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

function toMessagePublic(m) {
  const variants = m.variants_json ? JSON.parse(m.variants_json) : null;
  return {
    id: m.id,
    chatId: m.chat_id,
    role: m.role,
    characterId: m.character_id,
    content: m.content,
    variantIndex: m.active_variant_index || 0,
    variantCount: variants ? variants.length : 1,
    createdAt: m.created_at,
  };
}

router.get("/:id/messages", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC")
    .all(req.params.id);
  res.json(rows.map(toMessagePublic));
});

// body: { role, content, characterId?, variants?, messageId? }
// `variants`: seed multiple alternates upfront (e.g. a character's card
// greeting + its alternate greetings), all available to swipe through
// immediately with no extra generation needed. `content` should be
// variants[0] in that case.
// `messageId`: use a caller-supplied id instead of generating one, so the
// frontend can know a message's real id up front (used when streaming, so
// Stop-mid-generation doesn't leave a message the UI can't act on yet).
router.post("/:id/messages", (req, res) => {
  const { role, content, characterId, variants, messageId } = req.body;
  if (!role || !content) return res.status(400).json({ error: "role and content required" });
  const id = messageId || nanoid();
  const variantsJson = variants && variants.length > 1 ? JSON.stringify(variants) : null;
  db.prepare(
    "INSERT INTO messages (id, chat_id, role, character_id, content, variants_json, active_variant_index) VALUES (?, ?, ?, ?, ?, ?, 0)"
  ).run(id, req.params.id, role, characterId || null, content, variantsJson);
  db.prepare("UPDATE chats SET updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.status(201).json({
    id,
    chatId: req.params.id,
    role,
    characterId,
    content,
    variantIndex: 0,
    variantCount: variants?.length || 1,
  });
});

// Edits the currently ACTIVE variant's text in place — the other variants
// (earlier rerolls, alternate greetings) are untouched and still swipeable.
router.put("/:chatId/messages/:messageId", (req, res) => {
  const { content } = req.body;
  if (typeof content !== "string") return res.status(400).json({ error: "content is required" });
  const row = db
    .prepare("SELECT * FROM messages WHERE id = ? AND chat_id = ?")
    .get(req.params.messageId, req.params.chatId);
  if (!row) return res.status(404).json({ error: "not found" });

  let variantsJson = row.variants_json;
  if (variantsJson) {
    const variants = JSON.parse(variantsJson);
    variants[row.active_variant_index] = content;
    variantsJson = JSON.stringify(variants);
  }
  db.prepare("UPDATE messages SET content = ?, variants_json = ? WHERE id = ?").run(
    content,
    variantsJson,
    req.params.messageId
  );
  res.json(toMessagePublic({ ...row, content, variants_json: variantsJson }));
});

// Swipe to a different variant (an alternate greeting, or an earlier/later
// reroll). Only this now becomes what's shown AND what feeds context to
// future messages — the others stay saved, just not active.
router.put("/:chatId/messages/:messageId/variant", (req, res) => {
  const { index } = req.body;
  const row = db
    .prepare("SELECT * FROM messages WHERE id = ? AND chat_id = ?")
    .get(req.params.messageId, req.params.chatId);
  if (!row) return res.status(404).json({ error: "not found" });
  const variants = row.variants_json ? JSON.parse(row.variants_json) : [row.content];
  if (typeof index !== "number" || index < 0 || index >= variants.length) {
    return res.status(400).json({ error: "invalid variant index" });
  }
  db.prepare("UPDATE messages SET content = ?, active_variant_index = ? WHERE id = ?").run(
    variants[index],
    index,
    req.params.messageId
  );
  res.json(toMessagePublic({ ...row, content: variants[index], active_variant_index: index }));
});

router.delete("/:chatId/messages/:messageId", (req, res) => {
  db.prepare("DELETE FROM messages WHERE id = ? AND chat_id = ?").run(
    req.params.messageId,
    req.params.chatId
  );
  res.status(204).end();
});
