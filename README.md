# uChat

A self-hosted, SillyTavern-inspired chat client: connect to any OpenAI-compatible
or Anthropic-native API, build character cards with lorebooks, play as your own
persona, and run solo or group roleplay chats with per-character models.

## What's here

- **backend/** — Node/Express + SQLite. Owns API keys (encrypted at rest),
  proxies requests to whichever provider you connect, and assembles prompts
  per-character so cards never bleed into each other.
- **frontend/** — React + Vite + Tailwind. Top icon bar opens overlay menus
  for Connections, Settings, Characters, Personas, Group Chat, and History.

## Setup

Requires Node.js 18+.

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env
# generate an encryption key and paste it into .env as ENCRYPTION_KEY:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm run dev        # http://localhost:8787

# 2. Frontend (separate terminal)
cd frontend
npm install
npm run dev         # http://localhost:5173
```

Open http://localhost:5173. The frontend proxies `/api` to the backend, so
both need to be running.

## Using it

1. **Connections** — add a provider (OpenAI, OpenRouter, DeepSeek, Groq, a
   local server like LM Studio, Anthropic, or a fully custom endpoint), test
   it, then Connect to pull its live model list into a dropdown. Click the
   dropdown and start typing to filter models by name; the last model you
   used on a connection is remembered and auto-selected next time.
2. **Settings** — a System Prompt and Post-History Instructions box that
   apply everywhere, plus sliders for every parameter your connected
   provider actually supports (drag, or double-click the number to type a
   value). Everything here — sliders and both prompt boxes — is remembered
   across restarts automatically, and can also be saved as a named,
   reusable settings profile.
3. **Characters** — create a card (SillyTavern-compatible fields: greeting,
   alternate greetings, example dialogue, lorebooks, etc.), or import one
   from a `.png` card or a URL. Export any card back to PNG. A character's
   "Prompt Injection" and "Post-History Injection" fields append onto the
   global Settings versions — use either, both, or neither; they combine
   automatically. Card text can use `{{char}}`/`{{user}}` and they'll resolve
   to the character's and your persona's names wherever they're used.
4. **Personas** — create who *you* play as: a name, description, and photo.
   Pick one as active and it's used (and shown, with avatar) across every
   chat; pick "None" to just be "You".
5. **Start a chat** — hover a character card and hit "Start chat" to open
   the scenario editor: use the card's default greeting, or write a custom
   scenario and either type the opening line yourself or have the model
   generate one.
6. **In chat**:
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
7. **Group Chat** — pick 2–4 characters, a response mode (automatic or
   manual), and per-character models (search-filterable, same as
   Connections). Character avatars sit above the message box at all times —
   click one to force their reply; in automatic mode the app also decides
   who responds on its own (direct address by name takes priority,
   otherwise it rotates to avoid one character dominating). Every character
   is also instructed never to speak for the user or for other characters,
   backed by actual stop sequences sent to the provider — not just a prompt
   suggestion.
8. **History** — every chat is saved and grouped by character; reload,
   rename, or delete from here.
9. **Larger images** — click any small avatar next to a message (a
   character's or your persona's) to pin a much larger version of it in the
   empty space beside the chat, up to 5 at once (fills left, right, left,
   right...). Drag a pinned image's bottom-right corner to resize it, or
   click its thumbnail again (or the X on the large image) to unpin it.

## Notes

- API keys are AES-256-GCM encrypted in the SQLite database and only ever
  sent back to the browser masked (e.g. `••••••••ab12`).
- Character cards embed their data as a `chara` tEXt chunk in the PNG, the
  same convention SillyTavern/TavernAI use, so cards are portable both ways.
- This is a local, single-user tool by design — there's no auth layer, so
  don't expose the backend port to the open internet as-is.
