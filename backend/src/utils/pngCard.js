import extractChunks from "png-chunks-extract";
import encodeChunks from "png-chunks-encode";
import textChunk from "png-chunk-text";

// Builds a SillyTavern V2 card object from our internal character row data.
export function toCardV2(character) {
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: character.name,
      description: character.description || "",
      personality: character.personality || "",
      scenario: character.scenario || "",
      first_mes: character.firstMes || "",
      mes_example: character.mesExample || "",
      creator_notes: character.creatorNotes || "",
      system_prompt: character.systemPrompt || "",
      post_history_instructions: character.postHistoryInstructions || "",
      alternate_greetings: character.alternateGreetings || [],
      character_book: character.characterBook || undefined,
      tags: character.tags || [],
      creator: character.creator || "",
      character_version: character.characterVersion || "",
      extensions: character.extensions || {},
    },
  };
}

// Normalizes either a V1 (flat) or V2 (spec/data) card into our internal shape.
export function fromCard(raw) {
  const data = raw?.data && raw?.spec ? raw.data : raw;
  return {
    name: data.name || "Unnamed",
    description: data.description || "",
    personality: data.personality || "",
    scenario: data.scenario || "",
    firstMes: data.first_mes || data.firstMes || "",
    mesExample: data.mes_example || data.mesExample || "",
    creatorNotes: data.creator_notes || "",
    systemPrompt: data.system_prompt || "",
    postHistoryInstructions: data.post_history_instructions || "",
    alternateGreetings: data.alternate_greetings || [],
    characterBook: data.character_book || null,
    tags: data.tags || [],
    creator: data.creator || "",
    characterVersion: data.character_version || "",
    extensions: data.extensions || {},
  };
}

// Embeds a card into a PNG buffer as a base64 tEXt chunk (keyword "chara"),
// exactly how SillyTavern/TavernAI cards work, so exported cards are
// portable to and from other tools.
export function embedCardInPng(pngBuffer, cardObject) {
  const chunks = extractChunks(pngBuffer);
  // strip any existing chara/ccv3 text chunks so we don't stack duplicates
  const filtered = chunks.filter((c) => {
    if (c.name !== "tEXt") return true;
    try {
      const decoded = textChunk.decode(c.data);
      return decoded.keyword !== "chara" && decoded.keyword !== "ccv3";
    } catch {
      return true;
    }
  });
  const base64 = Buffer.from(JSON.stringify(cardObject), "utf8").toString("base64");
  const newChunk = textChunk.encode("chara", base64);
  // insert before IEND (last chunk)
  filtered.splice(filtered.length - 1, 0, newChunk);
  return Buffer.from(encodeChunks(filtered));
}

// Extracts and parses the embedded card from a PNG buffer. Returns null if
// no card data is found.
export function extractCardFromPng(pngBuffer) {
  const chunks = extractChunks(pngBuffer);
  for (const c of chunks) {
    if (c.name !== "tEXt") continue;
    try {
      const decoded = textChunk.decode(c.data);
      if (decoded.keyword === "chara" || decoded.keyword === "ccv3") {
        const json = Buffer.from(decoded.text, "base64").toString("utf8");
        return JSON.parse(json);
      }
    } catch {
      // not a card chunk, keep scanning
    }
  }
  return null;
}
