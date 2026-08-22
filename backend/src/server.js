import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";

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

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`LLM Chat Studio backend listening on http://localhost:${PORT}`);
});
