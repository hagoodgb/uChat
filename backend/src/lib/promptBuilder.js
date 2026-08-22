// Turns a character card (+ global settings-level prompt, scenario override,
// lorebook entries, and persona info) into a system prompt and a trailing
// "post-history" instruction message, and reshapes raw chat history into the
// simple user/assistant alternation every provider expects — from ONE
// character's point of view. This is the seam group chat reuses: each
// character gets its own call built from only its own card/system prompt/
// scenario, with every other speaker folded into labelled "user" turns, so
// cards never bleed into each other.

const approxTokens = (text) => Math.ceil((text || "").length / 4);

// {{user}} -> the active persona's name (or "User" if none is set)
// {{char}} -> the character's own name
// Applied to card fields at prompt-build time (never baked permanently into
// the stored card) and to actual chat message text at save time, so the
// card stays portable/reusable while what's shown and sent is resolved.
export function replaceMacros(text, { charName, personaName } = {}) {
  if (!text) return text;
  return text.replaceAll("{{char}}", charName || "").replaceAll("{{user}}", personaName || "User");
}

export function scanLorebook(book, recentText) {
  if (!book || !Array.isArray(book.entries)) return [];
  const haystack = recentText.toLowerCase();
  const budget = book.token_budget || 500;

  const matched = book.entries
    .filter((e) => e.enabled !== false)
    .filter((e) => {
      if (e.constant) return true;
      const keys = e.keys || [];
      if (keys.length === 0) return false;
      return keys.some((k) => {
        const key = e.case_sensitive ? k : k.toLowerCase();
        const hay = e.case_sensitive ? recentText : haystack;
        return key && hay.includes(key);
      });
    })
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || (a.insertion_order ?? 0) - (b.insertion_order ?? 0));

  const out = [];
  let used = 0;
  for (const entry of matched) {
    const cost = approxTokens(entry.content);
    if (used + cost > budget) continue;
    out.push(entry);
    used += cost;
  }
  return out;
}

// Builds both halves of the prompt from ONE character's point of view:
//  - systemPrompt: identity + card fields + global "System Prompt" (Settings)
//    + card's "Prompt Injection" (character editor's systemPrompt field)
//  - postHistoryMessage: global "Post-History Instructions" (Settings) +
//    card's "Post-History Injection" + the anti-impersonation reinforcement,
//    inserted as a message AFTER the chat history (closest to generation,
//    where behavioral constraints are most effective) rather than baked
//    into the system prompt at the top.
//
// Either the global (Settings) fields or the card fields can be left blank —
// whatever's present gets combined, so the user can build the prompt from
// either place, or both, interchangeably.
export function buildCharacterPrompt({
  character,
  scenarioOverride,
  lorebookEntries = [],
  globalSystemPrompt = "",
  globalPostHistoryInstructions = "",
  personaName,
  personaDescription,
  otherCharacterNames = [],
}) {
  const macroCtx = { charName: character.name, personaName };
  const mx = (text) => replaceMacros(text, macroCtx);

  const systemParts = [];

  if (globalSystemPrompt) systemParts.push(mx(globalSystemPrompt));
  if (character.systemPrompt) systemParts.push(mx(character.systemPrompt)); // "Prompt Injection"

  systemParts.push(`You are ${character.name}.`);
  if (character.description) systemParts.push(`Description: ${mx(character.description)}`);
  if (character.personality) systemParts.push(`Personality: ${mx(character.personality)}`);

  const scenario = scenarioOverride ?? character.scenario;
  if (scenario) systemParts.push(`Scenario: ${mx(scenario)}`);

  if (personaName) {
    systemParts.push(
      `You are talking to ${personaName}${personaDescription ? `: ${mx(personaDescription)}` : "."}`
    );
  }

  if (lorebookEntries.length > 0) {
    const loreText = lorebookEntries.map((e) => mx(e.content)).join("\n");
    systemParts.push(`Relevant world info:\n${loreText}`);
  }

  if (character.mesExample) {
    systemParts.push(`Example dialogue for tone/style reference:\n${mx(character.mesExample)}`);
  }

  const postHistoryParts = [];
  if (globalPostHistoryInstructions) postHistoryParts.push(mx(globalPostHistoryInstructions));
  if (character.postHistoryInstructions) postHistoryParts.push(mx(character.postHistoryInstructions)); // "Post-History Injection"

  // Always-on turn-taking guardrail: reinforced here, right before
  // generation, since that's where behavioral constraints hold best.
  const guardParts = [`Stay strictly in character as ${character.name} and respond only as ${character.name}.`];
  guardParts.push(
    personaName
      ? `Never write dialogue, actions, or narration for ${personaName} (the user) — only for yourself.`
      : `Never write dialogue, actions, or narration for the user — only for yourself.`
  );
  if (otherCharacterNames.length > 0) {
    guardParts.push(
      `Never write dialogue, actions, or narration for ${otherCharacterNames.join(", ")} — only for yourself. Respond once, then stop; do not continue the scene for anyone else.`
    );
  }
  postHistoryParts.push(guardParts.join(" "));

  return {
    systemPrompt: systemParts.join("\n\n"),
    postHistoryMessage: postHistoryParts.join("\n\n"),
  };
}

// Stop sequences so the model is cut off if it starts impersonating someone
// else by writing a new "Name:" line. Cheap, provider-supported safety net
// alongside the prompt-level instruction above.
export function computeStopSequences({ personaName, otherCharacterNames = [] }) {
  const names = [...otherCharacterNames];
  names.push(personaName || "User");
  return [...new Set(names)].map((n) => `\n${n}:`);
}

// history: [{ role: 'user'|'assistant', content, characterId, speakerName, id }]
// Reshapes into [{role:'user'|'assistant', content}] from `character`'s POV.
// User turns get labelled with the persona's name (if set) so the character
// knows who it's addressing.
export function reshapeHistoryForCharacter(history, character, personaName) {
  return history.map((m) => {
    if (m.role === "user") {
      return { role: "user", content: personaName ? `${personaName}: ${m.content}` : m.content };
    }
    if (m.characterId === character.id) return { role: "assistant", content: m.content };
    // another character's line, folded into a labelled "user" turn
    const label = m.speakerName || "Other";
    return { role: "user", content: `${label}: ${m.content}` };
  });
}
