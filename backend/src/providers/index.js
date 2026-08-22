import * as openaiCompatible from "./openaiCompatible.js";
import * as anthropicNative from "./anthropic.js";
import { resolvePreset } from "./presets.js";
import { ALL_SETTINGS, schemaForProtocol } from "./schemas.js";

const ADAPTERS = {
  "openai-compatible": openaiCompatible,
  "anthropic-native": anthropicNative,
};

// Builds the runtime profile object adapters expect, from a stored
// connection_profiles row (+ decrypted key).
export function buildProfile(row, apiKey, protocolOverride) {
  const preset = resolvePreset(row.provider_type);
  const protocol = protocolOverride || preset.protocol;
  return {
    protocol,
    baseUrl: row.base_url || preset.defaultBaseUrl,
    authHeader: preset.authHeader,
    authPrefix: preset.authPrefix,
    extraHeaders: row.extra_headers_json ? JSON.parse(row.extra_headers_json) : undefined,
  };
}

export function getAdapter(protocol) {
  const adapter = ADAPTERS[protocol];
  if (!adapter) throw new Error(`Unknown provider protocol: ${protocol}`);
  return adapter;
}

// Strips settings down to whatever keys the current protocol actually
// supports, so a settings profile built for one provider "gracefully
// ignores" fields the connected provider/protocol doesn't have.
export function buildRequestSettings(protocol, rawSettings = {}) {
  const supported = new Set(schemaForProtocol(protocol).map((s) => s.key));
  const out = {};
  for (const [key, value] of Object.entries(rawSettings)) {
    if (supported.has(key) && value !== null && value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

export { schemaForProtocol, ALL_SETTINGS };
