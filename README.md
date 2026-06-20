# atGPT

> ⚠️ **Unofficial.** A ChatGPT-style interface for the
> [co/core](https://console.cocore.dev) cooperative — an OpenAI-compatible
> network of attested Apple-Silicon Macs serving local inference. Not affiliated
> with co/core.

atGPT is a self-hostable, all-in-one chat app. Sign in with your co/core API key
and your conversations and preferences **sync across every device** you sign in
on. Replies stream from the distributed network; the model's hidden reasoning is
tucked into a collapsible **"Thinking"** dropdown so the answer stays clean.

- **Cross-device sync** — chats, titles, and chat settings live in a local
  SQLite database keyed on your DID, so the same key anywhere = the same account.
- **Streaming chat** — completions dispatched through the exchange with an
  *open network* / *friends-only* toggle and adjustable
  `temperature` / `top_p` / `max_tokens`.
- **Thinking dropdown** — `<think>…</think>` / harmony reasoning is captured and
  shown behind a quiet, collapsible disclosure instead of being dumped or dropped.
- **AT Personalisation** *(optional, in `/settings`)* — ingests your public
  Bluesky posts, bio, and `fm.teal.alpha.feed.play` music scrobbles, then uses
  **your own Gemini key** to condense them into a tiny profile (one cached call)
  that's injected into chat for replies that know your interests and taste.
  Toggleable; nothing is used when off.
- **Dashboard** — credit balance, last-24h earnings, trust level, your DID,
  agent version, and the live model directory (at `/dashboard`).

Built with the Next.js App Router, Tailwind v4, shadcn/ui, libsql + Drizzle.
Auto light/dark following your OS.

### How personalization stays cheap

Music taste is aggregated locally (top artists by play count) and posts are
sampled before a **single** `gemini-flash-latest` call produces a ~150-word
profile, cached and only rebuilt when enough new activity arrives. Ingestion is
incremental (newest-first, stops at the first already-seen record) and capped
(500 posts, 1500 plays). The Gemini key is stored **encrypted at rest**.

## How auth & sync work

co/core has no OAuth — **your `cocore-…` API key _is_ your identity** (it
resolves to your DID server-side). "Signing in" means pasting that key. The app:

1. Validates the key against `GET /api/agent/status`, which returns your DID.
2. Stores the key in a **secure, httpOnly cookie** — it never reaches client JS.
3. Provisions an account row keyed on your DID and sets a second **HMAC-signed**
   `atgpt_did` cookie. Sync routes trust that signed cookie (verified with
   `AUTH_SECRET`) to scope every read/write to your account — no per-request
   co/core round-trip, and a client can't forge another user's DID.

Get a key at [console.cocore.dev/account](https://console.cocore.dev/account).

## Environment

| Variable         | Required | Purpose                                                        |
| ---------------- | -------- | -------------------------------------------------------------- |
| `AUTH_SECRET`    | **yes**  | Signs the DID session cookie + encrypts stored Gemini keys. Long random string (≥16 chars). |
| `DATABASE_PATH`  | no       | SQLite file path. Default `./data/atgpt.db` (`/app/data/…` in Docker). May also be a `libsql://`/Turso URL. |
| `COCORE_BASE_URL`| no       | co/core deployment. Default `https://console.cocore.dev`.      |
| `GEMINI_API_KEY` | no       | Server-wide fallback Gemini key for personalization (handy for single-operator self-hosting). Per-account keys set in `/settings` take precedence. |

Copy `.env.example` → `.env` and generate a secret:

```bash
cp .env.example .env
echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env
```

## Local development

```bash
npm install
npm run db:migrate   # create/upgrade the SQLite schema
npm run dev          # http://localhost:3000
```

Open the app, paste your `cocore-…` key, and you're in. The database is created
under `./data/` (gitignored). Migrations also run automatically on server boot.

## Run with Docker

The whole app — server + database — runs in one container with a persistent
volume for the SQLite file.

```bash
cp .env.example .env
echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env
docker compose up --build      # http://localhost:3000
```

Your chats persist in the named `atgpt-data` volume across restarts and rebuilds.

## Database

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run db:generate` | Generate a migration from `src/db/schema.ts`. |
| `npm run db:migrate`  | Apply pending migrations.                     |

Tables: `users` (DID-keyed accounts), `conversations`, `messages` (with a
separate `reasoning` column), `settings` (per-account chat prefs + encrypted
Gemini key), `at_records` (ingested posts/plays), `ingest_state` (incremental
cursors), `at_profile` (the condensed personalization profile).

## co/core endpoints used

| App route              | co/core endpoint                                   | Purpose                       |
| ---------------------- | -------------------------------------------------- | ----------------------------- |
| `POST /api/auth/login` | `GET /api/agent/status`                            | Validate key, set session     |
| `GET /api/status`      | `GET /api/agent/status` + `GET /agent/version`     | Balance, stats, version check |
| `GET /api/models`      | `GET /api/v1/models?view=summary\|directory`       | Model directory (+ machines)  |
| `POST /api/chat`       | `POST /api/v1/[private/]chat/completions` (stream) | Streaming chat                |

## Deploying elsewhere

Docker is the simplest path (above). On serverless platforms (e.g. Vercel) the
local filesystem is ephemeral, so point `DATABASE_PATH` at a hosted
`libsql://`/Turso URL for sync to persist.

## Project layout

```
src/
  app/
    api/            # route handlers: auth, status, models, chat proxy,
                    #   conversations (sync CRUD), settings
    page.tsx        # chat (primary)
    dashboard/      # balance + stats + network
    login/
  components/
    chat-shell.tsx  # sidebar + history + the synced conversation store
    chat.tsx        # SSE streaming client + thinking dropdown
    dashboard.tsx
  db/
    schema.ts       # Drizzle schema (users, conversations, messages, settings)
    index.ts        # libsql client
    migrate.ts      # boot-time migrator
  hooks/
    use-conversations.ts  # server-backed, synced conversation history
  lib/
    cocore.ts       # co/core client + key cookie
    session.ts      # HMAC-signed DID cookie (sync auth)
    store.ts        # DID-scoped data access (conversations + settings)
    sanitize.ts     # splits answer vs. hidden reasoning
  instrumentation.ts  # runs migrations on startup
  middleware.ts       # routes signed-out users to /login
```
