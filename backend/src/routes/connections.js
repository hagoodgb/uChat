import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "../db/db.js";
import { encryptSecret, decryptSecret, maskSecret } from "../utils/crypto.js";
import { resolvePreset, PROVIDER_PRESETS } from "../providers/presets.js";
import { buildProfile, getAdapter } from "../providers/index.js";

export const router = Router();

function toPublic(row) {
  const key = row.api_key_encrypted ? decryptSecret(row.api_key_encrypted) : null;
  return {
    id: row.id,
    name: row.name,
    providerType: row.provider_type,
    baseUrl: row.base_url,
    extraHeaders: row.extra_headers_json ? JSON.parse(row.extra_headers_json) : null,
    apiKeyMasked: key ? maskSecret(key) : null,
    hasApiKey: !!key,
    lastConnectedModel: row.last_connected_model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get("/presets", (req, res) => {
  res.json(PROVIDER_PRESETS);
});

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM connection_profiles ORDER BY updated_at DESC").all();
  res.json(rows.map(toPublic));
});

router.post("/", (req, res) => {
  const { name, providerType, baseUrl, apiKey, extraHeaders, protocol } = req.body;
  if (!name || !providerType) {
    return res.status(400).json({ error: "name and providerType are required" });
  }
  const id = nanoid();
  db.prepare(
    `INSERT INTO connection_profiles (id, name, provider_type, base_url, api_key_encrypted, extra_headers_json)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    name,
    providerType,
    baseUrl || resolvePreset(providerType).defaultBaseUrl,
    apiKey ? encryptSecret(apiKey) : null,
    extraHeaders ? JSON.stringify(extraHeaders) : null
  );
  const row = db.prepare("SELECT * FROM connection_profiles WHERE id = ?").get(id);
  res.status(201).json(toPublic(row));
});

router.put("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM connection_profiles WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  const { name, baseUrl, apiKey, extraHeaders, lastConnectedModel } = req.body;
  db.prepare(
    `UPDATE connection_profiles SET
       name = COALESCE(?, name),
       base_url = COALESCE(?, base_url),
       api_key_encrypted = CASE WHEN ? IS NOT NULL THEN ? ELSE api_key_encrypted END,
       extra_headers_json = COALESCE(?, extra_headers_json),
       last_connected_model = COALESCE(?, last_connected_model),
       updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    name ?? null,
    baseUrl ?? null,
    apiKey ?? null,
    apiKey ? encryptSecret(apiKey) : null,
    extraHeaders ? JSON.stringify(extraHeaders) : null,
    lastConnectedModel ?? null,
    req.params.id
  );
  const updated = db.prepare("SELECT * FROM connection_profiles WHERE id = ?").get(req.params.id);
  res.json(toPublic(updated));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM connection_profiles WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

router.post("/:id/test", async (req, res) => {
  const row = db.prepare("SELECT * FROM connection_profiles WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  try {
    const apiKey = row.api_key_encrypted ? decryptSecret(row.api_key_encrypted) : null;
    const profile = buildProfile(row, apiKey);
    const adapter = getAdapter(profile.protocol);
    const result = await adapter.testConnection(profile, apiKey);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// "Connect" = verify + fetch the live model list for the dropdown.
router.post("/:id/connect", async (req, res) => {
  const row = db.prepare("SELECT * FROM connection_profiles WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  try {
    const apiKey = row.api_key_encrypted ? decryptSecret(row.api_key_encrypted) : null;
    const profile = buildProfile(row, apiKey);
    const adapter = getAdapter(profile.protocol);
    const { models, contextLengths } = await adapter.listModels(profile, apiKey);
    res.json({
      ok: true,
      protocol: profile.protocol,
      models,
      contextLengths,
      lastConnectedModel: row.last_connected_model,
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

router.get("/:id/models", async (req, res) => {
  const row = db.prepare("SELECT * FROM connection_profiles WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  try {
    const apiKey = row.api_key_encrypted ? decryptSecret(row.api_key_encrypted) : null;
    const profile = buildProfile(row, apiKey);
    const adapter = getAdapter(profile.protocol);
    const { models, contextLengths } = await adapter.listModels(profile, apiKey);
    res.json({ models, contextLengths });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
