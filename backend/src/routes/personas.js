import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { db } from "../db/db.js";
import { generatePlaceholderAvatar } from "../utils/placeholderAvatar.js";

export const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const AVATAR_DIR = path.join(process.cwd(), "data", "avatars");

function toPublic(row) {
  const data = JSON.parse(row.data_json);
  return {
    id: row.id,
    name: row.name,
    description: data.description || "",
    avatarUrl: row.avatar_path ? `/data/avatars/${row.avatar_path}` : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM personas ORDER BY updated_at DESC").all();
  res.json(rows.map(toPublic));
});

router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM personas WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(toPublic(row));
});

router.post("/", (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const id = nanoid();
  const filename = `persona-${id}.png`;
  fs.writeFileSync(path.join(AVATAR_DIR, filename), generatePlaceholderAvatar(name));
  db.prepare("INSERT INTO personas (id, name, data_json, avatar_path) VALUES (?, ?, ?, ?)").run(
    id,
    name,
    JSON.stringify({ description: description || "" }),
    filename
  );
  res.status(201).json(toPublic(db.prepare("SELECT * FROM personas WHERE id = ?").get(id)));
});

router.put("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM personas WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  const existing = JSON.parse(row.data_json);
  const { name, description } = req.body;
  db.prepare(
    "UPDATE personas SET name = COALESCE(?, name), data_json = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(name ?? row.name, JSON.stringify({ description: description ?? existing.description }), req.params.id);
  res.json(toPublic(db.prepare("SELECT * FROM personas WHERE id = ?").get(req.params.id)));
});

router.delete("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM personas WHERE id = ?").get(req.params.id);
  if (row?.avatar_path) fs.rm(path.join(AVATAR_DIR, row.avatar_path), { force: true }, () => {});
  db.prepare("DELETE FROM personas WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

router.post("/:id/avatar", upload.single("avatar"), (req, res) => {
  const row = db.prepare("SELECT * FROM personas WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  if (!req.file) return res.status(400).json({ error: "no file uploaded" });
  const filename = `persona-${req.params.id}.png`;
  fs.writeFileSync(path.join(AVATAR_DIR, filename), req.file.buffer);
  db.prepare("UPDATE personas SET avatar_path = ?, updated_at = datetime('now') WHERE id = ?").run(
    filename,
    req.params.id
  );
  res.json(toPublic(db.prepare("SELECT * FROM personas WHERE id = ?").get(req.params.id)));
});
