// {{user}} -> active persona's name (or "User" if none set)
// {{char}} -> the character's own name
// Used when seeding greeting text directly into a chat (the "use default
// greeting" flow bypasses the completion routes entirely, posting the
// card's firstMes/alternateGreetings text as-is) so the person never sees
// literal "{{user}}"/"{{char}}" in their chat. AI-generated replies are
// resolved server-side instead, in promptBuilder.js.
export function replaceMacros(text, { charName, personaName } = {}) {
  if (!text) return text;
  return text.replaceAll("{{char}}", charName || "").replaceAll("{{user}}", personaName || "User");
}
