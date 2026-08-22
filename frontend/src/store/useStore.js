import { create } from "zustand";

const PERSONA_STORAGE_KEY = "llm-chat-studio:activePersonaId";
const SETTINGS_STORAGE_KEY = "llm-chat-studio:settingsValues";

function loadPersistedSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistSettings(values) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(values));
  } catch {
    // localStorage unavailable — settings just won't persist across reloads
  }
}

export const useStore = create((set, get) => ({
  // ---- Overlay visibility ----
  activeOverlay: null, // 'connections' | 'settings' | 'characters' | 'group' | 'history' | 'personas' | null
  openOverlay: (name) => set({ activeOverlay: name }),
  closeOverlay: () => set({ activeOverlay: null }),

  // ---- Active connection/model ----
  connections: [],
  activeConnectionId: null,
  activeProtocol: null, // 'openai-compatible' | 'anthropic-native'
  availableModels: [],
  activeModel: null,
  setConnections: (connections) => set({ connections }),
  setActiveConnection: (id, protocol) => set({ activeConnectionId: id, activeProtocol: protocol }),
  setAvailableModels: (models) => set({ availableModels: models }),
  setActiveModel: (model) => set({ activeModel: model }),

  // ---- Settings ----
  settingsSchema: [], // filtered to active protocol
  // systemPrompt/postHistoryInstructions live in here too (keys always
  // present) but are NOT part of settingsSchema — they're fixed fields
  // shown regardless of provider, so schema reseeding must never drop them.
  // Restored from localStorage on load and re-persisted on every change, so
  // whatever was last in effect (typed values or an applied profile) is
  // still there next time the app opens, without needing to reload a
  // profile manually.
  settingsValues: { systemPrompt: "", postHistoryInstructions: "", ...loadPersistedSettings() },
  settingsProfiles: [],
  setSettingsSchema: (schema) =>
    set((state) => {
      const values = {
        systemPrompt: state.settingsValues.systemPrompt ?? "",
        postHistoryInstructions: state.settingsValues.postHistoryInstructions ?? "",
      };
      for (const s of schema) {
        values[s.key] = state.settingsValues[s.key] ?? s.default;
      }
      persistSettings(values);
      return { settingsSchema: schema, settingsValues: values };
    }),
  setSettingValue: (key, value) =>
    set((state) => {
      const settingsValues = { ...state.settingsValues, [key]: value };
      persistSettings(settingsValues);
      return { settingsValues };
    }),
  applySettingsProfile: (profile) =>
    set((state) => {
      const supportedKeys = new Set(state.settingsSchema.map((s) => s.key));
      const merged = { ...state.settingsValues };
      for (const [k, v] of Object.entries(profile.settings)) {
        // Sliders only apply if the current provider supports them; the two
        // global prompt fields always apply regardless of provider.
        if (supportedKeys.has(k) || k === "systemPrompt" || k === "postHistoryInstructions") {
          merged[k] = v;
        }
      }
      persistSettings(merged);
      return { settingsValues: merged };
    }),
  setSettingsProfiles: (settingsProfiles) => set({ settingsProfiles }),

  // ---- Active chat ----
  activeChatId: null,
  messages: [],
  setActiveChatId: (id) => set({ activeChatId: id }),
  setMessages: (messages) => set({ messages }),
  appendMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  updateLastMessage: (updater) =>
    set((state) => {
      if (state.messages.length === 0) return {};
      const msgs = [...state.messages];
      msgs[msgs.length - 1] = updater(msgs[msgs.length - 1]);
      return { messages: msgs };
    }),
  updateMessageAt: (index, updater) =>
    set((state) => {
      if (index < 0 || index >= state.messages.length) return {};
      const msgs = [...state.messages];
      msgs[index] = updater(msgs[index]);
      return { messages: msgs };
    }),
  removeMessageAt: (index) =>
    set((state) => ({ messages: state.messages.filter((_, i) => i !== index) })),

  chats: [],
  setChats: (chats) => set({ chats }),

  // ---- Characters ----
  characters: [],
  setCharacters: (characters) => set({ characters }),
  lorebooks: [],
  setLorebooks: (lorebooks) => set({ lorebooks }),

  // ---- Personas (who the user is playing as) ----
  personas: [],
  setPersonas: (personas) => set({ personas }),
  activePersonaId: (() => {
    try {
      return localStorage.getItem(PERSONA_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  })(),
  setActivePersonaId: (id) => {
    try {
      if (id) localStorage.setItem(PERSONA_STORAGE_KEY, id);
      else localStorage.removeItem(PERSONA_STORAGE_KEY);
    } catch {
      // localStorage unavailable — active persona just won't persist across reloads
    }
    set({ activePersonaId: id });
  },

  // Metadata for the currently active chat (kind/characterIds/scenario/etc)
  // so ChatWindow knows whether to call the plain or character-aware
  // endpoint, and group chat knows its model map/response mode.
  activeChatMeta: null,
  setActiveChatMeta: (meta) => set({ activeChatMeta: meta }),
  updateActiveChatMeta: (patch) =>
    set((state) => ({ activeChatMeta: state.activeChatMeta ? { ...state.activeChatMeta, ...patch } : patch })),

  // ---- Pinned large avatar images (left/right side rails) ----
  // Ordered by click time; even indices render in the left rail, odd in the
  // right, so clicks fill left-right-left-right... up to 5 total (4 group
  // members + 1 persona).
  pinnedAvatars: [], // [{ key, name, avatarUrl }]
  togglePinnedAvatar: (item) =>
    set((state) => {
      const exists = state.pinnedAvatars.some((p) => p.key === item.key);
      if (exists) return { pinnedAvatars: state.pinnedAvatars.filter((p) => p.key !== item.key) };
      if (state.pinnedAvatars.length >= 5) return {}; // at capacity — ignore until one is unpinned
      return { pinnedAvatars: [...state.pinnedAvatars, item] };
    }),
}));
