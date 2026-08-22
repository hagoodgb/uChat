// Presets pre-fill sensible defaults for known providers, but every field
// (base URL, headers, protocol) stays user-editable — "custom" starts blank.

export const PROVIDER_PRESETS = {
  openai: {
    label: "OpenAI",
    protocol: "openai-compatible",
    defaultBaseUrl: "https://api.openai.com/v1",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
  },
  openrouter: {
    label: "OpenRouter",
    protocol: "openai-compatible",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
  },
  deepseek: {
    label: "DeepSeek",
    protocol: "openai-compatible",
    defaultBaseUrl: "https://api.deepseek.com",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
  },
  groq: {
    label: "Groq",
    protocol: "openai-compatible",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
  },
  local: {
    label: "Local server (LM Studio / text-gen-webui / llama.cpp)",
    protocol: "openai-compatible",
    defaultBaseUrl: "http://localhost:1234/v1",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    apiKeyOptional: true,
  },
  anthropic: {
    label: "Anthropic (Claude)",
    protocol: "anthropic-native",
    defaultBaseUrl: "https://api.anthropic.com",
    authHeader: "x-api-key",
    authPrefix: "",
  },
  custom: {
    label: "Custom / manual endpoint",
    protocol: "openai-compatible", // user can flip to anthropic-native in the UI
    defaultBaseUrl: "",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
  },
};

export function resolvePreset(providerType) {
  return PROVIDER_PRESETS[providerType] || PROVIDER_PRESETS.custom;
}
