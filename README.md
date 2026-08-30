# uChat

A self-hosted, SillyTavern-inspired chat client: connect to any OpenAI-compatible
or Anthropic-native API, build character cards with lorebooks, play as your own
persona, and run solo or group roleplay chats with per-character models.

## What's here

- **backend/** — Node/Express + SQLite. Owns API keys (encrypted at rest),
  proxies requests to whichever provider you connect, and assembles prompts
  per-character so cards never bleed into each other.
- **frontend/** — React + Vite + Tailwind. Top icon bar opens overlay menus
  for Connections, Settings, Characters, Personas, Lorebooks, Group Chat, and
  History.

## Setup

Requires Node.js 18+. There are two ways to run this — pick based on what
you're doing.

### Recommended: single-server mode (use this for real usage, especially LAN)

One process, one port, no dev proxy in the picture. This is what you want
for actually using the app day-to-day, and it's **required** for accessing
it from a different machine on your network — more on why below.

```bash
# 1. Build the frontend
cd frontend
npm install
npm run build

# 2. Run the backend — it serves the built frontend itself
cd ../backend
npm install
cp .env.example .env
# generate an encryption key and paste it into .env as ENCRYPTION_KEY:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm start
```

Open **http://localhost:8787** — that's it, one URL, one server. To reach
it from another device on your LAN, use this machine's LAN IP instead of
`localhost` (e.g. `http://192.168.1.50:8787`) — no extra flags needed, it
already listens on all network interfaces by default.

If you change any frontend code later, re-run `npm run build` in
`frontend/` and restart the backend to pick up the new build.

### Development mode (two servers, hot-reload, localhost only)

Faster to iterate on the frontend (instant reload on save), but **only
reliable when you're on the same machine the servers are running on** —
see the note below for why.

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm run dev        # http://localhost:8787

# 2. Frontend (separate terminal)
cd frontend
npm install
npm run dev         # http://localhost:5173
```

Open http://localhost:5173. The frontend dev server proxies `/api` to the
backend, so both need to be running.

**Why dev mode breaks across a LAN:** Vite's dev proxy is built for
ordinary request/response calls, not the long-lived streaming connection
used while a model is generating a reply. On the same machine, that hop is
instant (loopback); over real WiFi/Ethernet to another device, the extra
latency is enough for the backend to think the connection dropped and
cancel the generation before it can finish. Single-server mode removes the
proxy from the picture entirely, so this doesn't come up.

## Using it

1. **Connections** — add a provider (OpenAI, OpenRouter, DeepSeek, Groq, a
   local server like LM Studio, Anthropic, or a fully custom endpoint), test
   it, then Connect to pull its live model list into a dropdown. Click the
   dropdown and start typing to filter models by name; the last model you
   used on a connection is remembered and auto-selected next time.
2. **Settings** — a System Prompt and Post-History Instructions box that
   apply everywhere, a Context Limit slider (caps how much chat history
   gets sent per request — defaults to a model's real max context window
   the first time you use it, when the provider reports one, e.g.
   OpenRouter; otherwise a safe generic default — lower it any time to
   control token usage/cost, and it's remembered per model from then on),
   plus sliders for every parameter your connected provider actually
   supports (drag, or double-click the number to type a value). Everything
   here is remembered across restarts automatically, and can also be saved
   as a named, reusable settings profile.
3. **Characters** — create a card (SillyTavern-compatible fields: greeting,
   alternate greetings, example dialogue, lorebooks, etc.), or import one
   from a `.png` card or a URL. Export any card back to PNG. A character's
   "Prompt Injection" and "Post-History Injection" fields append onto the
   global Settings versions — use either, both, or neither; they combine
   automatically. Card text can use `{{char}}`/`{{user}}` and they'll resolve
   to the character's and your persona's names wherever they're used, both
   in what's sent to the model and in what's displayed in chat.
4. **Personas** — create who *you* play as: a name, description, and photo.
   Pick one as active and it's used (and shown, with avatar) across every
   chat; pick "None" to just be "You". Each message remembers whichever
   persona was active *when it was sent* — switching personas mid-chat (e.g.
   one character leaves the scene, another takes over) never rewrites how
   earlier messages are attributed.
5. **Lorebooks** — world info that gets injected into the prompt when its
   keywords show up in recent chat. Create one from scratch, import a
   `.json` file or URL, or import a character card that already has one
   embedded — it's detected automatically and attached for you, the same
   way SillyTavern offers to bring a card's lorebook along with it.
   Attach lorebooks to a character (from its editor) or directly to a chat
   (from the scenario/setup screens, or Group Chat's manage view) — both
   apply at once, regardless of which character is replying.
6. **Start a chat** — hover a character card and hit "Start chat" to open
   the scenario editor: use the card's default greeting, or write a custom
   scenario and either type the opening line yourself or have the model
   generate one. The same scenario override is available when starting a
   group chat, too.
7. **In chat**:
   - `*actions*` render as dim italics with the asterisks themselves hidden;
     `"speech"` renders in a lighter tone. Line breaks are preserved.
   - Hover any message for small action buttons — **Edit** and **Delete**
     everywhere, plus **Continue** (extend the reply) and **Reroll**
     (regenerate in place) on AI responses.
   - Rerolling never throws away the previous attempt — every version
     (alternate greetings included) is one swipe arrow away at the bottom
     of the message, and whichever one is currently showing is what gets
     used as context for anything generated after it.
   - A Stop button next to Send cancels generation early; whatever streamed
     in before you stopped it is kept, not discarded.
   - If a scenario is active (custom or the character's own default), it's
     shown in a quiet banner at the top of the chat — not a message, just a
     reminder of the premise, handy after stepping away for a while.
8. **Group Chat** — pick 2–4 characters, a response mode (automatic or
   manual), and per-character models (search-filterable, same as
   Connections). Character avatars sit above the message box at all times —
   click one to force their reply; in automatic mode the app also decides
   who responds on its own (direct address by name takes priority,
   otherwise it rotates to avoid one character dominating). Every character
   is also instructed never to speak for the user or for other characters,
   backed by actual stop sequences sent to the provider — not just a prompt
   suggestion. You can also add or remove characters from an already-active
   chat at any time (from the Group Chat menu) without losing history — a
   solo chat becomes a group the moment a second character joins, and drops
   back to solo (avatar chips and all) the moment it's back down to one.
9. **History** — every chat is saved and grouped by character, with a
   one-line preview of its last message so chats with the same character
   are easy to tell apart at a glance; reload, rename, or delete from here.
10. **Larger images** — click any small avatar next to a message (a
    character's or your persona's) to pin a much larger version of it in the
    empty space beside the chat, up to 5 at once (fills left, right, left,
    right...). Drag a pinned image by its title bar to move it anywhere
    within its side of the screen, or drag its bottom-right corner to
    resize it freely (up to a generous max, without ever stretching or
    distorting — it scales to fit whatever size you give it). Click its
    thumbnail again (or the X on the large image) to unpin it. Pinned
    images — position, size, and all — are remembered per chat, so
    switching chats shows only what you pinned there.

## Notes

- API keys are AES-256-GCM encrypted in the SQLite database and only ever
  sent back to the browser masked (e.g. `••••••••ab12`).
- Character cards embed their data as a `chara` tEXt chunk in the PNG, the
  same convention SillyTavern/TavernAI use, so cards are portable both ways.
- This is a local, single-user tool by design — there's no auth layer, so
  don't expose the backend port to the open internet as-is.
- In single-server mode the app lives at port **8787**, not 5173 — update
  any bookmarks/shortcuts if you were previously using dev mode.
- `frontend/dist/` (the build output) and `backend/data/` (the SQLite
  database and avatars) are both generated locally and shouldn't be
  committed if you put this under version control.
