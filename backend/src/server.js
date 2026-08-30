import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import { router as connectionsRouter } from "./routes/connections.js";
import { router as providersRouter } from "./routes/providers.js";
import { router as settingsProfilesRouter } from "./routes/settingsProfiles.js";
import { router as chatRouter } from "./routes/chat.js";
import { router as chatsRouter } from "./routes/chats.js";
import { router as charactersRouter } from "./routes/characters.js";
import { router as lorebooksRouter } from "./routes/lorebooks.js";
import { router as personasRouter } from "./routes/personas.js";

// db/db.js runs schema migrations as a side effect on import
import "./db/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url)); // backend/src

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/data/avatars", express.static(path.join(process.cwd(), "data", "avatars")));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/connections", connectionsRouter);
app.use("/api/providers", providersRouter);
app.use("/api/settings-profiles", settingsProfilesRouter);
app.use("/api/chat", chatRouter);
app.use("/api/chats", chatsRouter);
app.use("/api/characters", charactersRouter);
app.use("/api/lorebooks", lorebooksRouter);
app.use("/api/personas", personasRouter);

// Single-server mode: if the frontend has been built (npm run build in
// frontend/), serve it directly from here — same origin, same port, no dev
// proxy involved. This is what makes streaming reliable across a real LAN
// hop: Vite's dev-mode proxy is built for ordinary request/response
// traffic, not long-lived SSE connections, and a real network hop (as
// opposed to loopback on the same machine) is exactly when that shows up.
const FRONTEND_DIST = path.join(__dirname, "..", "..", "frontend", "dist");
const frontendBuilt = fs.existsSync(path.join(FRONTEND_DIST, "index.html"));

if (frontendBuilt) {
  app.use(express.static(FRONTEND_DIST));
  // Anything else that isn't an API/avatar route falls through to the app
  // shell. There's no client-side router today, but this keeps direct
  // loads/refreshes working the same way if that ever changes.
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/data")) return next();
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
} else {
  console.log(
    "No frontend build found at frontend/dist — running API-only. " +
      "Run `npm run build` in frontend/ and restart to serve the app from this same port."
  );
}

// Catch-all error handler: return JSON instead of Express's default HTML
// stack-trace page, so error messages stay short and readable wherever
// they surface on the frontend (e.g. as a "⚠ ..." message in chat) rather
// than dumping a full server stack trace into the UI.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`LLM Chat Studio backend listening on http://localhost:${PORT}`);
  if (frontendBuilt) {
    console.log(`Serving the built frontend from the same port — open http://localhost:${PORT} (or this machine's LAN IP) to use the app.`);
  }
});
