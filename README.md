# KiezHomes: Berlin Property Assistant

A small, responsive real-estate web app. Anyone can browse mocked Berlin listings and ask an AI assistant free-text questions about any property ("Is this good for a family?", "How's the commute?"). Answers stream in live from Claude and are grounded in that listing's data. It uses a **freemium** model: guests get one free question, then sign in for unlimited questions. Agents also get an AI listing writer.

## Run it

Requires **Node.js 20.19+** (tested on Node 24).

```bash
cp .env.example .env      # then set ANTHROPIC_API_KEY and JWT_SECRET (32+ random chars)
npm install && npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies `/api` to Express on port 3001.

Production-like run (builds the client; Express serves it and the API on one origin with the full security headers):

```bash
npm start                 # → http://localhost:3001
```

`npm start` runs in production mode, so cookies are `Secure`. Chrome and Firefox accept them on `http://localhost`; Safari needs HTTPS.

Other scripts: `npm run typecheck` checks both workspaces, and `npm run build` builds the client only.

### Access levels and demo accounts

| Who | How | Can do |
|-----|-----|--------|
| Guest | No login. Gets an anonymous session automatically (`a` cookie) | Browse all listings, **1 free AI question**, then asked to sign in |
| Buyer | `buyer@demo.com` / `Buyer123!` (`token` cookie) | Browse, unlimited Property Q&A (rate-limited to 10 per minute) |
| Agent | `agent@demo.com` / `Agent123!` (`token` cookie) | Everything above, plus the Smart listing writer and publishing listings |

There's no sign-up (users are hard-coded). The login page has "Use Buyer" / "Use Agent" buttons that fill in these credentials.

## What's real and what's mocked

| Part | Status |
|------|--------|
| **Property Q&A** (listing page, right-hand panel) | **Real AI.** Streams answers from Claude (`claude-opus-5` by default) through the backend. This is the main feature. |
| **Smart listing writer** (agents: "Write listing") | **Real AI.** Claude returns a structured draft (title, description, features) that the agent can edit and publish. |
| Listings, photos, neighbourhood data | Mocked: 12 hard-coded Berlin listings in `server/src/data/listings.ts`. Photos are Unsplash URLs. |
| Users and auth | Two hard-coded users with bcrypt-hashed passwords. Authentication is real: signed JWTs in httpOnly cookies (`token` for users, `a` for anonymous guests), with role and quota checks on the server. |
| Persistence | In memory. Agent-published listings and guest quotas reset when the server restarts. |

## How the AI feature works

1. The browser sends `POST /api/ai/listings/:id/ask` with `{ question, history }`. **It never sends listing data or talks to Anthropic directly.**
2. The server validates the input (question 1–500 chars, at most 6 prior messages that alternate user/assistant, each ≤2000 chars) and loads the listing **by id from its own store**. It then checks access:
   - **Signed-in users** are rate-limited to 10 questions per minute.
   - **Guests** must present an existing signed `a` cookie. A cookie issued on this same request doesn't count, so a cookie-less client can't get free calls. Their one free question is reserved before the model is called, so parallel requests can't overspend it, and it's refunded if the AI call fails on our side. Guests are also limited to 5 AI requests per hour per IP, so clearing cookies doesn't buy unlimited free calls. After that the API returns `401 {"code":"login_required"}` and the chat shows a "Sign in to continue" prompt.
3. The listing is placed in the system prompt inside `<listing>` tags. The prompt tells Claude to answer only from that data, to say "the listing doesn't include that" instead of guessing, to treat listing and user text as content rather than instructions, and to keep answers short.
4. The Anthropic SDK streams the answer (`max_tokens: 2000`, `effort: "low"` for speed). The server forwards text chunks as Server-Sent Events. If the user presses Stop or leaves the page, the upstream request is aborted.
5. The client renders the answer as **plain text** (`whitespace-pre-wrap`), never as HTML.

Refusals (`stop_reason: "refusal"`) and API errors become friendly, generic messages. Details go only to the server log. Server-side refusal fallback (`fallbacks: "default"`) is enabled.

Code: `server/src/routes/ai.ts`, `server/src/ai/prompts.ts`, `client/src/components/PropertyChat.tsx`, `client/src/lib/api.ts`.

## Project layout

```
server/src/
  index.ts            Express app: helmet/CSP, body limit, identify(), routes, static client in prod
  config.ts           zod-validated env (fails fast, never prints values)
  middleware/         auth (user/guest cookies, roles), error handler, rate limits
  routes/             auth, listings, ai
  ai/                 Anthropic client + prompts
  data/               mocked users + listings, in-memory store, guest quota
  validation.ts       zod schemas for every request
client/src/
  pages/              Login, Listings, ListingDetail, GenerateListing, NotFound
  components/         PropertyChat, ImageGallery, ListingCard, Navbar, shadcn/ui
  lib/api.ts          fetch wrapper + SSE stream reader
```

Stack: React 19, Vite, Tailwind v4, shadcn/ui, React Router. Node, Express 5, TypeScript, `@anthropic-ai/sdk`, zod. Dependencies are pinned to exact versions (`.npmrc save-exact`) and locked in `package-lock.json`.

## OWASP Top 10 (2025) self-assessment

| # | Category | How this app handles it |
|---|----------|--------------------------|
| A01 | Broken Access Control | Access rules are enforced on the server for each route. Browsing is public by design. AI Q&A is quota-gated for guests (1 free question, tracked server-side against the signed `a` cookie, not trusted from the client). Agent-only endpoints (`POST /api/listings`, `/api/ai/generate-listing`) use `requireRole("agent")`. The client-side route guard and chat lock are UX only. The role is read from the user store, never from the token. The AI endpoint loads the listing by id server-side, so a client can't inject its own "listing data". |
| A02 | Security Misconfiguration | `helmet` sets security headers and a CSP (`script-src 'self'`, images only from self and Unsplash, `connect-src 'self'`). `x-powered-by` is off, JSON bodies are capped at 10 KB, the error handler never returns stack traces, and the env is validated at startup. No CORS is configured because everything is same-origin. |
| A03 | Software Supply Chain Failures | Small, well-known dependency set with exact version pins and a committed lockfile. `npm audit` reports 0 vulnerabilities. With more time: Dependabot/Renovate, `npm ci` in CI, and SRI/provenance checks. |
| A04 | Cryptographic Failures | Passwords are stored only as bcrypt hashes. JWTs are HS256-signed with a 32+ char secret from `.env` (user sessions last 2 h, guest sessions 30 days). Both cookies are `httpOnly` and `SameSite=Strict`, plus `Secure` in production. Secrets live only in the git-ignored `.env`. **The Anthropic key never reaches the browser**: all AI calls go through the backend, and the built bundle has been checked for it. |
| A05 | Injection | Every body and param is validated with zod (types, lengths, enums, id regex). There is no SQL or shell. React escapes all output, and AI text is rendered as plain text (no `dangerouslySetInnerHTML`, no HTML-capable Markdown). **Prompt injection:** listing data and user text are delimited and marked as untrusted in the system prompt, and the model has no tools or data access beyond the one listing, so a successful injection can only change the wording of an answer. |
| A06 | Insecure Design | Abuse and cost limits are part of the design: question ≤500 chars, history ≤6 messages, `max_tokens` cap, per-user AI rate limit (10/min), and upstream streams are aborted when the client disconnects. **The freemium quota is designed against bypass:** guests need an already-issued cookie, the question is reserved before the model is called (no parallel overspend), logging out doesn't reset the guest cookie, and a per-IP cap (5 per hour) limits cookie-clearing abuse. The server owns the prompt and the data. The UI warns that AI answers can be wrong. |
| A07 | Authentication Failures | Login is rate-limited (5 failed attempts per 15 min per IP). Wrong-email and wrong-password failures return the same generic message, and a dummy bcrypt comparison hides timing differences. User sessions expire after 2 h and guest sessions after 30 days. Logout clears the `token` cookie, and invalid or expired tokens are cleared and treated as a guest. User and guest tokens carry a `typ` claim, so a guest token can't be replayed as a user session. With more time: account lockout, MFA, refresh-token rotation, server-side session revocation. |
| A08 | Software or Data Integrity Failures | JWT verification pins `algorithms: ["HS256"]` (so there is no `alg: none` or algorithm confusion) and checks the `typ` claim. Guest quota state lives on the server, not in the cookie, so replaying an old cookie can't restore free questions. The lockfile's integrity hashes pin package contents. The AI listing writer's output is validated against a zod schema before use and needs explicit agent review before publishing. |
| A09 | Security Logging and Alerting Failures | Structured JSON logs record failed logins (email and IP), successful logins, AI usage (user or guest id, listing, model, token counts, stop reason), AI failures (error type and request id) and unhandled errors. Passwords, tokens, keys and prompts are never logged. With more time: ship logs to a SIEM and alert on login-failure spikes and AI cost anomalies. |
| A10 | Mishandling of Exceptional Conditions | A central error handler returns generic messages for 5xx and maps malformed JSON or oversized bodies to 4xx. Auth fails closed (any verify error means 401). AI errors, refusals, truncated streams and client aborts are each handled explicitly. Invalid configuration stops startup with a clear message. |

Also: CSRF is mitigated by `SameSite=Strict` cookies plus JSON-only endpoints. `express.json` ignores form posts, so they fail validation.

## How AI tooling was used

The whole app was built by prompting **Claude Code** (Claude Opus). No code was written by hand. I made the decisions (stack, auth approach, scope, UX) and reviewed the output, especially the security-sensitive parts. See **[docs/AI_USAGE.md](docs/AI_USAGE.md)** for the workflow and representative prompts.

## With more time

- Persist listings, guest quotas and chat history in a real database or Redis, and store conversation history server-side so the client can't edit earlier turns. Add real sign-up so the freemium funnel ends in account creation.
- Add prompt caching and an eval set (grounding and prompt-injection test cases) to measure answer quality as prompts change.
- Show which listing fields an answer came from (citations), and add image-aware Q&A over the listing photos.
- Automated tests (auth/role matrix, validation, SSE parsing) and CI with `npm audit`.
