# co/core console

> ⚠️ **Unofficial demo.** A small, community-built console for the
> [co/core](https://console.cocore.dev) cooperative — an OpenAI-compatible
> network of attested Apple-Silicon Macs serving local inference. Not affiliated
> with co/core; built to show off the public API.

Sign in with your co/core API key to:

- **See your balance & stats** — credit balance, last‑24h earnings, trust level,
  your DID, and whether your agent is on the latest release.
- **Watch the network** — every model currently being served; click a row for
  per‑machine detail (chip, RAM, last‑seen, rolling 24h request/token activity)
  via the directory view, plus per‑MTok prices.
- **Chat with other agents** — streaming completions dispatched through the
  exchange to a paired provider, with an *open network* / *friends‑only* toggle
  and adjustable `temperature` / `top_p` / `max_tokens`.

Built with the App Router, Tailwind v4, and shadcn/ui (new‑york). **Auto
light/dark** following your OS. Designed to deploy to Vercel with zero
configuration.

## How auth works

co/core has no OAuth — **your `cocore-…` API key _is_ your identity** (it resolves
to your DID server‑side). "Signing in" means pasting that key. The app:

1. Validates the key against `GET /api/agent/status`.
2. Stores it in a **secure, httpOnly cookie** — it never reaches client‑side JS.
3. Proxies every co/core call through Next.js route handlers, attaching the key
   from the cookie. This keeps the key off the wire to the browser and sidesteps
   CORS.

Mint a key at [console.cocore.dev/api-keys](https://console.cocore.dev/api-keys).

## co/core endpoints used

| App route            | co/core endpoint                                   | Purpose                       |
| -------------------- | -------------------------------------------------- | ----------------------------- |
| `POST /api/auth/login` | `GET /api/agent/status`                          | Validate key, set session     |
| `GET /api/status`    | `GET /api/agent/status` + `GET /agent/version`     | Balance, stats, version check |
| `GET /api/models`    | `GET /api/v1/models?view=summary\|directory`       | Model directory (+ machines)  |
| `POST /api/chat`     | `POST /api/v1/[private/]chat/completions` (stream) | Streaming chat                |

Every documented public endpoint and the friends-only routing variant is
exercised, along with the `temperature`, `top_p`, and `max_tokens` request
parameters and the stable error codes (`model_not_found`,
`no_providers_connected`, `no_friends_available`, `no_friends_for_model`).

## Local development

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Then open the app, paste your `cocore-…` key, and you're in.

`COCORE_BASE_URL` is optional (see `.env.example`); it defaults to
`https://console.cocore.dev`.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **New Project → import the repo**. The framework preset is detected
   as Next.js; no build settings to change.
3. (Optional) set `COCORE_BASE_URL` under *Environment Variables*.
4. Deploy.

Or from the CLI:

```bash
npm i -g vercel
vercel        # follow the prompts
vercel --prod
```

The streaming chat route runs on the Node.js runtime and is marked
`force-dynamic`, so responses are piped through to the browser without buffering.

## Project layout

```
src/
  app/
    api/            # route handlers (auth, status, models, chat proxy)
    login/          # API-key sign-in
    page.tsx        # dashboard (balance + stats + network)
    chat/           # streaming chat UI
  components/
    ui/             # shadcn primitives (button, card, input, …)
    dashboard.tsx   # stats cards + model directory table
    chat.tsx        # SSE streaming chat client
    nav.tsx
    login-form.tsx
  lib/
    cocore.ts       # server-side co/core client + session cookie helpers
  middleware.ts     # routes signed-out users to /login
```
