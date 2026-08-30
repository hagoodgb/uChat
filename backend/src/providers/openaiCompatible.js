import fetch from "node-fetch";

function buildHeaders(profile, apiKey) {
  const headers = { "Content-Type": "application/json" };
  const authHeader = profile.authHeader || "Authorization";
  const authPrefix = profile.authPrefix ?? "Bearer ";
  if (apiKey) headers[authHeader] = `${authPrefix}${apiKey}`;
  if (profile.extraHeaders) Object.assign(headers, profile.extraHeaders);
  return headers;
}

export async function testConnection(profile, apiKey) {
  try {
    const res = await fetch(`${profile.baseUrl.replace(/\/$/, "")}/models`, {
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
  const res = await fetch(`${profile.baseUrl.replace(/\/$/, "")}/models`, {
    headers: buildHeaders(profile, apiKey),
  });
  if (!res.ok) throw new Error(`Failed to list models: HTTP ${res.status}`);
  const data = await res.json();
  const list = Array.isArray(data?.data) ? data.data : [];
  const models = list
    .map((m) => m.id)
    .filter(Boolean)
    .sort();
  // Providers that expose a context window per model (OpenRouter's
  // `context_length` is the common one) let the Settings menu default the
  // Context Limit slider to the actual max for whichever model is active,
  // rather than a guessed fallback.
  const contextLengths = {};
  for (const m of list) {
    if (!m.id) continue;
    const len = m.context_length ?? m.context_window ?? m.max_context_length ?? null;
    if (typeof len === "number" && len > 0) contextLengths[m.id] = len;
  }
  return { models, contextLengths };
}

// messages: [{ role: 'system'|'user'|'assistant', content: string }]
// settings: already filtered to keys this protocol supports
export async function streamChat({ profile, apiKey, model, messages, settings, stopSequences, onToken, signal }) {
  const body = { model, messages, stream: true, ...settings };
  if (stopSequences?.length) body.stop = stopSequences;

  const res = await fetch(`${profile.baseUrl.replace(/\/$/, "")}/chat/completions`, {
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
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onToken?.(delta);
        }
      } catch {
        // ignore malformed/partial SSE lines
      }
    }
  }
  return full;
}
