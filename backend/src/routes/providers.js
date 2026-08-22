import { Router } from "express";
import { db } from "../db/db.js";
import { resolvePreset } from "../providers/presets.js";
import { schemaForProtocol } from "../providers/index.js";

export const router = Router();

// Settings schema for a *connection profile* — resolves its protocol,
// then returns only the sliders that protocol supports.
router.get("/settings-schema/:connectionId", (req, res) => {
  const row = db
    .prepare("SELECT * FROM connection_profiles WHERE id = ?")
    .get(req.params.connectionId);
  if (!row) return res.status(404).json({ error: "not found" });
  const preset = resolvePreset(row.provider_type);
  res.json({ protocol: preset.protocol, schema: schemaForProtocol(preset.protocol) });
});
