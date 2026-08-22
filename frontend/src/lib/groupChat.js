// Decides which character(s) should respond automatically to the latest
// message, and in what order. Runs client-side — no extra model call, so
// it's instant and free. Two passes:
//
// 1. Direct address: if the message @mentions or names a character, that
//    character (or characters, in the order named) responds.
// 2. Otherwise: pick one character at random, weighted away from whoever
//    spoke most recently, so the same character doesn't dominate and not
//    everyone talks every turn.

function firstName(fullName) {
  return fullName.trim().split(/\s+/)[0].toLowerCase();
}

export function selectRespondingCharacters(characters, lastUserText, recentMessages = []) {
  if (characters.length === 0) return [];
  const text = lastUserText.toLowerCase();

  const mentioned = characters.filter(
    (c) => text.includes(c.name.toLowerCase()) || text.includes(firstName(c.name))
  );
  if (mentioned.length > 0) return mentioned.map((c) => c.id);

  // Avoid the same character responding twice in a row when nobody was
  // directly addressed.
  const lastSpeakerId = [...recentMessages]
    .reverse()
    .find((m) => m.role === "assistant" && m.characterId)?.characterId;

  const candidates = characters.filter((c) => c.id !== lastSpeakerId);
  const pool = candidates.length > 0 ? candidates : characters;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return pick ? [pick.id] : [];
}
