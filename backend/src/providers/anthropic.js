import fetch from "node-fetch";

const ANTHROPIC_VERSION = "2023-06-01";

function buildHeaders(profile, apiKey) {
  const headers = {
    "Content-Type": "application/json",
    "anthropic-version": ANTHROPIC_VERSION,
  };
  if (apiKey) headers["x-api-key"] = apiKey;
  if (profile.extraHeaders) Object.assign(headers, profile.extraHeaders);
  return headers;
}

// Anthropic has no /models list-with-auth-only-check quite like OpenAI's,
// but it does expose GET /v1/models for account-scoped listing.
export async function testConnection(profile, apiKey) {
  try {
    const res = await fetch(`${profile.baseUrl.replace(/\/$/, "")}/v1/models`, {
      headers: buildHeaders(profile, apiKey),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, message: `HTTP ${res.status}: ${text.slice(0, 300)}` };
    }
    const data = await res.json();
    const count = Array.isArray(data?.data) ? data.data.length : "unknown";
    return { ok: true, message: `Connected. ${count} model(s) available.` };
  } catch (err) {
    return { ok: false, message: `Connection failed: ${err.message}` };
  }
}

export async function listModels(profile, apiKey) {
  const res = await fetch(`${profile.baseUrl.replace(/\/$/, "")}/v1/models`, {
    headers: buildHeaders(profile, apiKey),
  });
  if (!res.ok) throw new Error(`Failed to list models: HTTP ${res.status}`);
  const data = await res.json();
  const list = Array.isArray(data?.data) ? data.data : [];
  return list
    .map((m) => m.id)
    .filter(Boolean)
    .sort();
}

// Anthropic wants system prompt separated from the messages array, and only
// allows user/assistant roles inside it.
function splitSystem(messages) {
  const systemParts = messages.filter((m) => m.role === "system").map((m) => m.content);
  const rest = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));
  return { system: systemParts.join("\n\n") || undefined, rest };
}

export async function streamChat({ profile, apiKey, model, messages, settings, stopSequences, onToken, signal }) {
  const { system, rest } = splitSystem(messages);
  const body = {
    model,
    messages: rest,
    stream: true,
    max_tokens: settings.max_tokens || 1024,
    ...settings,
  };
  if (system) body.system = system;
  if (stopSequences?.length) body.stop_sequences = stopSequences;

  const res = await fetch(`${profile.baseUrl.replace(/\/$/, "")}/v1/messages`, {
    method: "POST",
    headers: buildHeaders(profile, apiKey),
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  }

  let full = "";
  let buffer = "";
  for await (const chunk of res.body) {
    buffer += chunk.toString("utf8");
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      try {
        const json = JSON.parse(payload);
        if (json.type === "content_block_delta" && json.delta?.text) {
          full += json.delta.text;
          onToken?.(json.delta.text);
        }
      } catch {
        // ignore malformed/partial SSE lines
      }
    }
  }
  return full;
}
