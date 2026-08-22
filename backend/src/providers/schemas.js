// Superset of every tunable parameter this app knows about. The frontend
// asks for the schema for the *currently connected* provider protocol and
// only renders sliders for the fields that come back — this is what makes
// the settings panel "dynamically show only what's available."
//
// When a saved settings profile has keys the current provider doesn't
// support, the backend simply strips them before sending the request
// (see providers/index.js -> buildRequestSettings).

export const ALL_SETTINGS = [
  {
    key: "temperature",
    label: "Temperature",
    min: 0,
    max: 2,
    step: 0.01,
    default: 1,
    protocols: ["openai-compatible", "anthropic-native"],
    description: "Higher = more random, lower = more deterministic.",
  },
  {
    key: "top_p",
    label: "Top P",
    min: 0,
    max: 1,
    step: 0.01,
    default: 1,
    protocols: ["openai-compatible", "anthropic-native"],
    description: "Nucleus sampling cutoff.",
  },
  {
    key: "top_k",
    label: "Top K",
    min: 0,
    max: 200,
    step: 1,
    default: 0,
    protocols: ["anthropic-native", "openai-compatible"],
    description: "Restrict sampling to the K most likely tokens (0 = off).",
    optionalFor: ["openai-compatible"], // only sent if provider echoes support; harmless if ignored
  },
  {
    key: "max_tokens",
    label: "Max Tokens",
    min: 16,
    max: 8192,
    step: 16,
    default: 1024,
    protocols: ["openai-compatible", "anthropic-native"],
    description: "Maximum length of the response.",
  },
  {
    key: "frequency_penalty",
    label: "Frequency Penalty",
    min: -2,
    max: 2,
    step: 0.01,
    default: 0,
    protocols: ["openai-compatible"],
    description: "Penalize tokens proportional to how often they've appeared.",
  },
  {
    key: "presence_penalty",
    label: "Presence Penalty",
    min: -2,
    max: 2,
    step: 0.01,
    default: 0,
    protocols: ["openai-compatible"],
    description: "Penalize tokens that have appeared at all so far.",
  },
  {
    key: "repetition_penalty",
    label: "Repetition Penalty",
    min: 0.5,
    max: 2,
    step: 0.01,
    default: 1,
    protocols: ["openai-compatible"],
    description: "Common on local/open-source model servers.",
  },
];

export function schemaForProtocol(protocol) {
  return ALL_SETTINGS.filter((s) => s.protocols.includes(protocol));
}
