import { create } from "zustand";

const PERSONA_STORAGE_KEY = "llm-chat-studio:activePersonaId";
const SETTINGS_STORAGE_KEY = "llm-chat-studio:settingsValues";
const PINNED_STORAGE_KEY = "llm-chat-studio:pinnedByChat";
const CONTEXT_LIMITS_STORAGE_KEY = "llm-chat-studio:contextLimitsByModel";
export const DEFAULT_PINNED_WIDTH = 340;
// Used only when a provider doesn't expose a model's real context window
// (OpenAI's and Anthropic's /models endpoints don't; OpenRouter's does) —
// a reasonable, safely-conservative guess the person can freely raise.
export const DEFAULT_CONTEXT_LIMIT = 8192;

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

function loadPersistedPinned() {
  try {
    const raw = localStorage.getItem(PINNED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistPinned(pinnedByChat) {
  try {
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(pinnedByChat));
  } catch {
    // localStorage unavailable — pinned image layout just won't persist across reloads
  }
}

function loadPersistedContextLimits() {
  try {
    const raw = localStorage.getItem(CONTEXT_LIMITS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistContextLimits(byModel) {
  try {
    localStorage.setItem(CONTEXT_LIMITS_STORAGE_KEY, JSON.stringify(byModel));
  } catch {
    // localStorage unavailable — remembered per-model limits just won't persist across reloads
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
  modelContextLengths: {}, // { [modelId]: number } — only populated for providers that expose it (e.g. OpenRouter)
  setConnections: (connections) => set({ connections }),
  setActiveConnection: (id, protocol) => set({ activeConnectionId: id, activeProtocol: protocol }),
  setAvailableModels: (models) => set({ availableModels: models }),
  setModelContextLengths: (modelContextLengths) => set({ modelContextLengths: modelContextLengths || {} }),
  setActiveModel: (model) => set({ activeModel: model }),

  // Remembered per model, keyed by model id — the FIRST time a model is
  // used, this defaults to its real max context window (if the provider
  // exposes one) or a generic fallback, and is saved immediately so it's
  // "remembered" from that point on, same as it would in SillyTavern.
  // Manually lowering it later just updates this same remembered value.
  contextLimitsByModel: loadPersistedContextLimits(),
  // Resolves (and, if this model's never been seen before, seeds) the
  // context limit for `model`, applying it to settingsValues.contextLimit.
  applyContextLimitForModel: (model) =>
    set((state) => {
      if (!model) return {};
      const existing = state.contextLimitsByModel[model];
      const value = existing ?? state.modelContextLengths[model] ?? DEFAULT_CONTEXT_LIMIT;
      const contextLimitsByModel = { ...state.contextLimitsByModel, [model]: value };
      persistContextLimits(contextLimitsByModel);
      const settingsValues = { ...state.settingsValues, contextLimit: value };
      persistSettings(settingsValues);
      return { contextLimitsByModel, settingsValues };
    }),
  // Called when the person manually moves the Context Limit slider — updates
  // both the live value and this model's remembered value together.
  setContextLimitForModel: (model, value) =>
    set((state) => {
      const settingsValues = { ...state.settingsValues, contextLimit: value };
      persistSettings(settingsValues);
      if (!model) return { settingsValues };
      const contextLimitsByModel = { ...state.contextLimitsByModel, [model]: value };
      persistContextLimits(contextLimitsByModel);
      return { settingsValues, contextLimitsByModel };
    }),

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
        // Sliders only apply if the current provider supports them; the
        // global prompt fields and context limit always apply regardless
        // of provider, since none of them are provider request params.
        if (supportedKeys.has(k) || k === "systemPrompt" || k === "postHistoryInstructions" || k === "contextLimit") {
          merged[k] = v;
        }
      }
      persistSettings(merged);
      let contextLimitsByModel = state.contextLimitsByModel;
      if (state.activeModel && typeof merged.contextLimit === "number") {
        contextLimitsByModel = { ...state.contextLimitsByModel, [state.activeModel]: merged.contextLimit };
        persistContextLimits(contextLimitsByModel);
      }
      return { settingsValues: merged, contextLimitsByModel };
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

  // ---- Pinned large avatar images (left/right freeform panels) ----
  // Keyed by chatId so switching chats shows/hides the right set — pinning
  // an image in one chat has no effect on any other. Persisted to
  // localStorage so position/size survive a reload. Ordered by click time;
  // side is assigned once at pin-time (left, right, left, right...) and
  // stays fixed afterward, even if an earlier pin is later removed.
  pinnedByChat: loadPersistedPinned(),
  togglePinnedAvatar: (chatId, item) =>
    set((state) => {
      if (!chatId) return {};
      const current = state.pinnedByChat[chatId] || [];
      const exists = current.some((p) => p.key === item.key);
      let next;
      if (exists) {
        next = current.filter((p) => p.key !== item.key);
      } else {
        if (current.length >= 5) return {}; // at capacity — ignore until one is unpinned
        const side = current.length % 2 === 0 ? "left" : "right";
        // Cascade each new pin on the same side a little further down/in,
        // so freshly-pinned images don't land exactly on top of an earlier
        // one before the person has a chance to move it.
        const sameSideCount = current.filter((p) => p.side === side).length;
        const cascade = sameSideCount * 28;
        next = [
          ...current,
          { ...item, side, x: 24 + cascade, y: 24 + cascade, width: DEFAULT_PINNED_WIDTH, height: null },
        ];
      }
      const pinnedByChat = { ...state.pinnedByChat, [chatId]: next };
      persistPinned(pinnedByChat);
      return { pinnedByChat };
    }),
  updatePinnedAvatar: (chatId, key, patch) =>
    set((state) => {
      if (!chatId) return {};
      const current = state.pinnedByChat[chatId] || [];
      const next = current.map((p) => (p.key === key ? { ...p, ...patch } : p));
      const pinnedByChat = { ...state.pinnedByChat, [chatId]: next };
      persistPinned(pinnedByChat);
      return { pinnedByChat };
    }),
}));
