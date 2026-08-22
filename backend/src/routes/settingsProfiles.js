import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "../db/db.js";

export const router = Router();

function toPublic(row) {
  return {
    id: row.id,
    name: row.name,
    settings: JSON.parse(row.settings_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM settings_profiles ORDER BY updated_at DESC").all();
  res.json(rows.map(toPublic));
});

router.post("/", (req, res) => {
  const { name, settings } = req.body;
  if (!name || !settings) return res.status(400).json({ error: "name and settings required" });
  const id = nanoid();
  db.prepare("INSERT INTO settings_profiles (id, name, settings_json) VALUES (?, ?, ?)").run(
    id,
    name,
    JSON.stringify(settings)
  );
  res.status(201).json(toPublic(db.prepare("SELECT * FROM settings_profiles WHERE id = ?").get(id)));
});

router.put("/:id", (req, res) => {
  const { name, settings } = req.body;
  db.prepare(
    `UPDATE settings_profiles SET name = COALESCE(?, name), settings_json = COALESCE(?, settings_json),
     updated_at = datetime('now') WHERE id = ?`
  ).run(name ?? null, settings ? JSON.stringify(settings) : null, req.params.id);
  const row = db.prepare("SELECT * FROM settings_profiles WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(toPublic(row));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM settings_profiles WHERE id = ?").run(req.params.id);
  res.status(204).end();
});
