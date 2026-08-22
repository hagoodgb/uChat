import { Router } from "express";
import multer from "multer";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { db } from "../db/db.js";
import { toCardV2, fromCard, embedCardInPng, extractCardFromPng } from "../utils/pngCard.js";
import { generatePlaceholderAvatar } from "../utils/placeholderAvatar.js";

export const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const AVATAR_DIR = path.join(process.cwd(), "data", "avatars");

function toPublic(row) {
  const data = JSON.parse(row.data_json);
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_path ? `/data/avatars/${row.avatar_path}` : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...data,
  };
}

function saveCharacterRow(id, fields, avatarFilename) {
  const now = new Date().toISOString();
  const data = { ...fields };
  delete data.id;
  delete data.avatarUrl;
  const exists = db.prepare("SELECT id FROM characters WHERE id = ?").get(id);
  if (exists) {
    db.prepare(
      `UPDATE characters SET name = ?, data_json = ?, avatar_path = COALESCE(?, avatar_path), updated_at = datetime('now') WHERE id = ?`
    ).run(fields.name, JSON.stringify(data), avatarFilename || null, id);
  } else {
    db.prepare(
      `INSERT INTO characters (id, name, data_json, avatar_path) VALUES (?, ?, ?, ?)`
    ).run(id, fields.name, JSON.stringify(data), avatarFilename || null);
  }
}

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM characters ORDER BY updated_at DESC").all();
  res.json(rows.map(toPublic));
});

router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM characters WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(toPublic(row));
});

// Create/update a character from plain form fields (the in-app editor).
router.post("/", (req, res) => {
  const fields = req.body;
  if (!fields.name) return res.status(400).json({ error: "name is required" });
  const id = nanoid();

  // No avatar uploaded yet — generate a placeholder so cards always render.
  const filename = `${id}.png`;
  fs.writeFileSync(path.join(AVATAR_DIR, filename), generatePlaceholderAvatar(fields.name));

  saveCharacterRow(id, fields, filename);
  res.status(201).json(toPublic(db.prepare("SELECT * FROM characters WHERE id = ?").get(id)));
});

router.put("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM characters WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  const existing = JSON.parse(row.data_json);
  const merged = { ...existing, name: row.name, ...req.body };
  saveCharacterRow(req.params.id, merged, null);
  res.json(toPublic(db.prepare("SELECT * FROM characters WHERE id = ?").get(req.params.id)));
});

router.delete("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM characters WHERE id = ?").get(req.params.id);
  if (row?.avatar_path) {
    fs.rm(path.join(AVATAR_DIR, row.avatar_path), { force: true }, () => {});
  }
  db.prepare("DELETE FROM characters WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

router.post("/:id/avatar", upload.single("avatar"), (req, res) => {
  const row = db.prepare("SELECT * FROM characters WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  if (!req.file) return res.status(400).json({ error: "no file uploaded" });
  const filename = `${req.params.id}.png`;
  fs.writeFileSync(path.join(AVATAR_DIR, filename), req.file.buffer);
  db.prepare("UPDATE characters SET avatar_path = ?, updated_at = datetime('now') WHERE id = ?").run(
    filename,
    req.params.id
  );
  res.json(toPublic(db.prepare("SELECT * FROM characters WHERE id = ?").get(req.params.id)));
});

// Import a character card from an uploaded PNG (SillyTavern-style embed).
router.post("/import-png", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no file uploaded" });
  try {
    const cardRaw = extractCardFromPng(req.file.buffer);
    if (!cardRaw) return res.status(400).json({ error: "No character data found embedded in this PNG." });
    const fields = fromCard(cardRaw);
    const id = nanoid();
    const filename = `${id}.png`;
    fs.writeFileSync(path.join(AVATAR_DIR, filename), req.file.buffer);
    saveCharacterRow(id, fields, filename);
    res.status(201).json(toPublic(db.prepare("SELECT * FROM characters WHERE id = ?").get(id)));
  } catch (err) {
    res.status(500).json({ error: `Failed to import card: ${err.message}` });
  }
});

// Import a character card from a URL — either a raw JSON card or a PNG
// with an embedded card (e.g. a chub.ai / janitorai-style direct link).
router.post("/import-url", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "url is required" });
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fetch failed: HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    const buffer = Buffer.from(await response.arrayBuffer());

    let fields, avatarBuffer;
    if (contentType.includes("png") || buffer.slice(0, 8).toString("hex") === "89504e470d0a1a0a") {
      const cardRaw = extractCardFromPng(buffer);
      if (!cardRaw) return res.status(400).json({ error: "No character data found embedded in this PNG." });
      fields = fromCard(cardRaw);
      avatarBuffer = buffer;
    } else {
      const json = JSON.parse(buffer.toString("utf8"));
      fields = fromCard(json);
    }

    const id = nanoid();
    const filename = `${id}.png`;
    fs.writeFileSync(
      path.join(AVATAR_DIR, filename),
      avatarBuffer || generatePlaceholderAvatar(fields.name)
    );
    saveCharacterRow(id, fields, filename);
    res.status(201).json(toPublic(db.prepare("SELECT * FROM characters WHERE id = ?").get(id)));
  } catch (err) {
    res.status(500).json({ error: `Failed to import from URL: ${err.message}` });
  }
});

// Export a character as a SillyTavern-compatible PNG card.
router.get("/:id/export-png", (req, res) => {
  const row = db.prepare("SELECT * FROM characters WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  const fields = { id: row.id, ...JSON.parse(row.data_json), name: row.name };
  const card = toCardV2(fields);

  const basePngPath = row.avatar_path
    ? path.join(AVATAR_DIR, row.avatar_path)
    : null;
  const basePng =
    basePngPath && fs.existsSync(basePngPath)
      ? fs.readFileSync(basePngPath)
      : generatePlaceholderAvatar(row.name);

  const outPng = embedCardInPng(basePng, card);
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Content-Disposition", `attachment; filename="${row.name.replace(/[^a-z0-9]/gi, "_")}.png"`);
  res.send(outPng);
});

// Export as plain JSON card (V2 spec) for tools that don't want a PNG.
router.get("/:id/export-json", (req, res) => {
  const row = db.prepare("SELECT * FROM characters WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  const fields = { id: row.id, ...JSON.parse(row.data_json), name: row.name };
  res.json(toCardV2(fields));
});
