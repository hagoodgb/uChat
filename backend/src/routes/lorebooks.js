import { Router } from "express";
import { nanoid } from "nanoid";
import fetch from "node-fetch";
import { db } from "../db/db.js";

export const router = Router();

export function toPublic(row) {
  return { id: row.id, name: row.name, ...JSON.parse(row.book_json), createdAt: row.created_at, updatedAt: row.updated_at };
}

function defaultBook(overrides = {}) {
  return {
    description: "",
    scan_depth: 4,
    token_budget: 500,
    recursive_scanning: false,
    entries: [],
    ...overrides,
  };
}

// SillyTavern world info sometimes nests entries as an object keyed by id
// rather than an array, and sometimes wraps the whole thing as a
// `character_book` (the same shape embedded in V2 character cards) —
// normalize any of these into our flat { entries: [...] } shape.
export function normalizeBook(raw) {
  const book = raw?.entries || raw?.character_book ? raw.character_book || raw : raw;
  const entries = Array.isArray(book.entries) ? book.entries : Object.values(book.entries || {});
  return defaultBook({ ...book, entries });
}

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM lorebooks ORDER BY updated_at DESC").all();
  res.json(rows.map(toPublic));
});

router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM lorebooks WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(toPublic(row));
});

router.post("/", (req, res) => {
  const { name, ...rest } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const id = nanoid();
  db.prepare("INSERT INTO lorebooks (id, name, book_json) VALUES (?, ?, ?)").run(
    id,
    name,
    JSON.stringify(defaultBook(rest))
  );
  res.status(201).json(toPublic(db.prepare("SELECT * FROM lorebooks WHERE id = ?").get(id)));
});

router.put("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM lorebooks WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  const existing = JSON.parse(row.book_json);
  const { name, ...rest } = req.body;
  db.prepare("UPDATE lorebooks SET name = COALESCE(?, name), book_json = ?, updated_at = datetime('now') WHERE id = ?").run(
    name ?? row.name,
    JSON.stringify({ ...existing, ...rest }),
    req.params.id
  );
  res.json(toPublic(db.prepare("SELECT * FROM lorebooks WHERE id = ?").get(req.params.id)));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM lorebooks WHERE id = ?").run(req.params.id);
  db.prepare("DELETE FROM character_lorebooks WHERE lorebook_id = ?").run(req.params.id);
  res.status(204).end();
});

// Import a standalone SillyTavern World Info / lorebook JSON file.
router.post("/import-json", (req, res) => {
  const { name, book } = req.body;
  if (!name || !book) return res.status(400).json({ error: "name and book are required" });
  const id = nanoid();
  db.prepare("INSERT INTO lorebooks (id, name, book_json) VALUES (?, ?, ?)").run(
    id,
    name,
    JSON.stringify(normalizeBook(book))
  );
  res.status(201).json(toPublic(db.prepare("SELECT * FROM lorebooks WHERE id = ?").get(id)));
});

// Import a lorebook/world-info JSON file directly from a URL.
router.post("/import-url", async (req, res) => {
  const { url, name } = req.body;
  if (!url) return res.status(400).json({ error: "url is required" });
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fetch failed: HTTP ${response.status}`);
    const raw = await response.json();
    const book = normalizeBook(raw);
    const id = nanoid();
    const bookName = name || raw.name || "Imported lorebook";
    db.prepare("INSERT INTO lorebooks (id, name, book_json) VALUES (?, ?, ?)").run(
      id,
      bookName,
      JSON.stringify(book)
    );
    res.status(201).json(toPublic(db.prepare("SELECT * FROM lorebooks WHERE id = ?").get(id)));
  } catch (err) {
    res.status(500).json({ error: `Failed to import from URL: ${err.message}` });
  }
});

// Attach / detach a lorebook to a character (a character can have several;
// a lorebook can be reused across characters or imported directly into a chat).
router.post("/:id/attach/:characterId", (req, res) => {
  db.prepare(
    "INSERT OR IGNORE INTO character_lorebooks (character_id, lorebook_id) VALUES (?, ?)"
  ).run(req.params.characterId, req.params.id);
  res.status(204).end();
});

router.delete("/:id/attach/:characterId", (req, res) => {
  db.prepare(
    "DELETE FROM character_lorebooks WHERE character_id = ? AND lorebook_id = ?"
  ).run(req.params.characterId, req.params.id);
  res.status(204).end();
});

router.get("/for-character/:characterId", (req, res) => {
  const rows = db
    .prepare(
      `SELECT l.* FROM lorebooks l
       JOIN character_lorebooks cl ON cl.lorebook_id = l.id
       WHERE cl.character_id = ?`
    )
    .all(req.params.characterId);
  res.json(rows.map(toPublic));
});

// Attach / detach a lorebook directly to a CHAT — applies regardless of
// which character responds, on top of whatever each character's own
// lorebooks already contribute.
router.post("/:id/attach-chat/:chatId", (req, res) => {
  db.prepare("INSERT OR IGNORE INTO chat_lorebooks (chat_id, lorebook_id) VALUES (?, ?)").run(
    req.params.chatId,
    req.params.id
  );
  res.status(204).end();
});

router.delete("/:id/attach-chat/:chatId", (req, res) => {
  db.prepare("DELETE FROM chat_lorebooks WHERE chat_id = ? AND lorebook_id = ?").run(
    req.params.chatId,
    req.params.id
  );
  res.status(204).end();
});

router.get("/for-chat/:chatId", (req, res) => {
  const rows = db
    .prepare(
      `SELECT l.* FROM lorebooks l
       JOIN chat_lorebooks cl ON cl.lorebook_id = l.id
       WHERE cl.chat_id = ?`
    )
    .all(req.params.chatId);
  res.json(rows.map(toPublic));
});
