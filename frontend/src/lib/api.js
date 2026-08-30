const BASE = "/api";

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Request failed: ${res.status}`);
  }
  return data;
}

export const api = {
  // Connections
  listConnections: () => req("/connections"),
  getPresets: () => req("/connections/presets"),
  createConnection: (body) => req("/connections", { method: "POST", body: JSON.stringify(body) }),
  updateConnection: (id, body) =>
    req(`/connections/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteConnection: (id) => req(`/connections/${id}`, { method: "DELETE" }),
  testConnection: (id) => req(`/connections/${id}/test`, { method: "POST" }),
  connectTo: (id) => req(`/connections/${id}/connect`, { method: "POST" }),
  getModels: (id) => req(`/connections/${id}/models`),

  // Settings schema + profiles
  getSettingsSchema: (connectionId) => req(`/providers/settings-schema/${connectionId}`),
  listSettingsProfiles: () => req("/settings-profiles"),
  createSettingsProfile: (body) =>
    req("/settings-profiles", { method: "POST", body: JSON.stringify(body) }),
  updateSettingsProfile: (id, body) =>
    req(`/settings-profiles/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteSettingsProfile: (id) => req(`/settings-profiles/${id}`, { method: "DELETE" }),

  // Chats
  listChats: () => req("/chats"),
  createChat: (body) => req("/chats", { method: "POST", body: JSON.stringify(body) }),
  getChat: (id) => req(`/chats/${id}`),
  updateChat: (id, body) => req(`/chats/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteChat: (id) => req(`/chats/${id}`, { method: "DELETE" }),
  getMessages: (chatId) => req(`/chats/${chatId}/messages`),
  postMessage: (chatId, body) =>
    req(`/chats/${chatId}/messages`, { method: "POST", body: JSON.stringify(body) }),
  updateMessage: (chatId, messageId, content) =>
    req(`/chats/${chatId}/messages/${messageId}`, { method: "PUT", body: JSON.stringify({ content }) }),
  deleteMessage: (chatId, messageId) =>
    req(`/chats/${chatId}/messages/${messageId}`, { method: "DELETE" }),
  setMessageVariant: (chatId, messageId, index) =>
    req(`/chats/${chatId}/messages/${messageId}/variant`, { method: "PUT", body: JSON.stringify({ index }) }),

  // Characters
  listCharacters: () => req("/characters"),
  getCharacter: (id) => req(`/characters/${id}`),
  createCharacter: (body) => req("/characters", { method: "POST", body: JSON.stringify(body) }),
  updateCharacter: (id, body) => req(`/characters/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteCharacter: (id) => req(`/characters/${id}`, { method: "DELETE" }),
  importCharacterUrl: (url) =>
    req("/characters/import-url", { method: "POST", body: JSON.stringify({ url }) }),
  async importCharacterPng(file) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/characters/import-png`, { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Import failed");
    return data;
  },
  async uploadAvatar(characterId, file) {
    const form = new FormData();
    form.append("avatar", file);
    const res = await fetch(`${BASE}/characters/${characterId}/avatar`, { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Upload failed");
    return data;
  },

  // Lorebooks
  listLorebooks: () => req("/lorebooks"),
  createLorebook: (body) => req("/lorebooks", { method: "POST", body: JSON.stringify(body) }),
  updateLorebook: (id, body) => req(`/lorebooks/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteLorebook: (id) => req(`/lorebooks/${id}`, { method: "DELETE" }),
  importLorebookJson: (name, book) =>
    req("/lorebooks/import-json", { method: "POST", body: JSON.stringify({ name, book }) }),
  importLorebookUrl: (url, name) =>
    req("/lorebooks/import-url", { method: "POST", body: JSON.stringify({ url, name }) }),
  attachLorebook: (lorebookId, characterId) =>
    req(`/lorebooks/${lorebookId}/attach/${characterId}`, { method: "POST" }),
  detachLorebook: (lorebookId, characterId) =>
    req(`/lorebooks/${lorebookId}/attach/${characterId}`, { method: "DELETE" }),
  lorebooksForCharacter: (characterId) => req(`/lorebooks/for-character/${characterId}`),
  attachLorebookToChat: (lorebookId, chatId) =>
    req(`/lorebooks/${lorebookId}/attach-chat/${chatId}`, { method: "POST" }),
  detachLorebookFromChat: (lorebookId, chatId) =>
    req(`/lorebooks/${lorebookId}/attach-chat/${chatId}`, { method: "DELETE" }),
  lorebooksForChat: (chatId) => req(`/lorebooks/for-chat/${chatId}`),

  // Personas
  listPersonas: () => req("/personas"),
  getPersona: (id) => req(`/personas/${id}`),
  createPersona: (body) => req("/personas", { method: "POST", body: JSON.stringify(body) }),
  updatePersona: (id, body) => req(`/personas/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deletePersona: (id) => req(`/personas/${id}`, { method: "DELETE" }),
  async uploadPersonaAvatar(personaId, file) {
    const form = new FormData();
    form.append("avatar", file);
    const res = await fetch(`${BASE}/personas/${personaId}/avatar`, { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Upload failed");
    return data;
  },
};

// Same as streamCompletion but calls the character-aware endpoint, which
// assembles the system prompt from the character's own card/scenario/
// lorebooks server-side. Used for both single character chats and, in
// group chat, one call per responding character.
export async function streamCharacterCompletion(
  {
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
  },
  { onDelta, onDone, onError, signal }
) {
  try {
    const res = await fetch(`${BASE}/chat/character-completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
      }),
      signal,
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Request failed: ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload) continue;
        const evt = JSON.parse(payload);
        if (evt.type === "delta") onDelta?.(evt.content);
        else if (evt.type === "done") onDone?.(evt);
        else if (evt.type === "error") onError?.(new Error(evt.message));
      }
    }
  } catch (err) {
    // The person clicking Stop aborts this fetch client-side, which kills
    // the read loop before the server's own "stopped but saved" SSE event
    // can arrive — so treat a client-side abort as a normal stop, not an
    // error, using whatever text already streamed in via onDelta.
    if (err.name === "AbortError") onDone?.({ stopped: true });
    else onError?.(err);
  }
}
// Streams a completion via SSE. Calls onDelta for each token, onDone with
// the full text + saved message id, onError on failure.
export async function streamCompletion(
  { connectionId, model, messages, settings, chatId, characterId, continueMessageId, rerollMessageId, messageId },
  { onDelta, onDone, onError, signal }
) {
  try {
    const res = await fetch(`${BASE}/chat/completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connectionId,
        model,
        messages,
        settings,
        chatId,
        characterId,
        continueMessageId,
        rerollMessageId,
        messageId,
      }),
      signal,
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Request failed: ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload) continue;
        const evt = JSON.parse(payload);
        if (evt.type === "delta") onDelta?.(evt.content);
        else if (evt.type === "done") onDone?.(evt);
        else if (evt.type === "error") onError?.(new Error(evt.message));
      }
    }
  } catch (err) {
    if (err.name === "AbortError") onDone?.({ stopped: true });
    else onError?.(err);
  }
}
