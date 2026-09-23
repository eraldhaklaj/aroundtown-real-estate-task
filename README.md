# KiezHomes: Berlin Property Assistant

A small, responsive real-estate web app. Anyone can browse mocked Berlin listings and ask an AI assistant free-text questions about a property. Answers stream in live from Claude and come only from that listing's data. It uses a **freemium** model: guests get a few free questions and then need to sign in. Agents get AI tools for their own listings.

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

Other scripts:
- `npm run typecheck` checks both workspaces.
- `npm run build` builds the client only.
- `npm run eval -w server [-- <model>]` runs the Q&A test set against the real API (see [Models](#models)).

### Access levels and demo accounts

| Who | How | Can do |
|-----|-----|--------|
| Guest | No login. Gets an anonymous session automatically (`a` cookie) | Browse all listings. **3 free AI questions per property, 10 per day**, then asked to sign in |
| Buyer | `buyer@demo.com` / `Buyer123!` (`token` cookie) | Browse, Property Q&A with higher limits |
| Agent | `agent@demo.com` / `Agent123!` (`token` cookie) | Everything above, plus on their own listings: switch Q&A on or off, see question stats and "missing info" questions, test without limits. Also the Smart listing writer |

There's no sign-up (users are hard-coded). The login page has "Use Buyer" / "Use Agent" buttons that fill in these credentials.

## What's real and what's mocked

| Part | Status |
|------|--------|
| **Property Q&A** (listing page, right-hand panel) | **Real AI.** Streams answers from Claude Haiku 4.5, falling back to Sonnet 5. This is the main feature. |
| **Smart listing writer** (agents: "Write listing") | **Real AI.** Claude Sonnet 5 returns a structured draft (title, description, features) that the agent can edit and publish. |
| Listings, photos, neighbourhood data | Mocked: 12 hard-coded Berlin listings in `server/src/data/listings.ts`. Photos are Unsplash URLs. Private seller data for 3 listings is kept separately in `privateListingData.ts`. |
| "Contact agent" | Mocked: shows the agent's contact details with `mailto:` and `tel:` links. |
| Users and auth | Two hard-coded users with bcrypt-hashed passwords. Authentication is real: signed JWTs in httpOnly cookies (`token` for users, `a` for guests), with role, ownership and quota checks on the server. |
| Persistence | In memory: agent-published listings, quotas, Q&A records and spend reset when the server restarts. |

## The Property Q&A feature

**Flow.** The browser sends `POST /api/ai/listings/:id/ask` with `{ question, history }`. It never sends listing data and never talks to Anthropic directly. On the server:
1. It validates the input.
2. It loads the listing **by id from its own store**.
3. It checks availability and limits.
4. It builds the prompt from an **allow-list of public listing fields**.
5. It streams Claude's answer back as Server-Sent Events.

If the user presses Stop or leaves the page, the upstream request is aborted. The client renders answers as **plain text** (`whitespace-pre-wrap`), never as HTML.

### Limits

These are enforced in `server/src/ai/qaLimits.ts`. Every limit hit returns **HTTP 429 with `Retry-After`** and a `code`. The chat then shows a friendly message with **Sign in** (guests) and **Contact agent** buttons instead of an error.

| Scope | Guest | Signed in |
|---|---|---|
| Questions per minute | 3 | 6 |
| Questions per property per day | 3 | 30 |
| Questions per day (all properties) | 10 | 100 |
| Concurrent streams | 1 | 2 |
| Tokens per day | 40k | 400k |

- **Guests are counted per device *and* per IP.** The device is the id in the signed `a` cookie. Both buckets must have room, so clearing cookies doesn't reset the allowance. A cookie issued on the same request doesn't count, so a client that sends no cookies gets no free questions.
- **Questions are reserved before the model is called**, so parallel requests can't overspend. A question is refunded if the AI call fails on our side.
- **Agents testing their own listing** skip limits and aren't counted in the listing's stats.
- **Global daily spend cap** (`AI_DAILY_SPEND_CAP_USD`, default $5, estimated from token usage). When it's hit, AI features pause for the rest of the UTC day (503 `unavailable`). The chat says so and points to the agent.

### Length caps

- **Input:** questions are capped at 500 characters, with a UI counter and server enforcement. Requests are strict JSON objects with plain-text content, so attachments, images or unknown fields are rejected.
- **Output:** answers are capped at **350 tokens**, and the prompt asks for about 100 words.
- **History:** only the last **4 question/answer turns** are sent as context.
- **Thread length:** after **20 questions** the chat offers "Start new chat" or "Contact agent".

### Scope

The system prompt is in `server/src/ai/prompts.ts`.
- **Allowed:** listing facts, objective nearby facts *that are in the data*, and process questions ("how do I book a viewing?" points to Contact agent).
- **If the answer isn't in the listing,** the model must say *"I don't have that information in the listing."* and refer the user to the agent. It never guesses. The server detects that sentence and flags the question for the agent.
- **Not allowed:**
  - Subjective judgments ("safe", "quiet", "good for families") or ranking areas by who should live there.
  - Asking about protected characteristics.
  - Negotiation, legal, mortgage or eligibility advice.
  - Promises on the agent's behalf.
  - Off-topic chat.
- Listing text and user messages are treated as content, not instructions.

### Data and privacy

- **What the model sees:** only allow-listed public fields. Seller name and phone, minimum price and agent notes live in a separate store that neither the public API nor the prompt builder ever reads. Only the owning agent sees them.
- **Retention:** Q&A records are kept for **90 days**. A purge job runs hourly and on every write.
- **Masking:** emails and phone numbers are masked before storing (`[email]`, `[phone]`), and failed-login logs mask the email (`s***@example.com`).
- **Disclosure:** the chat tells users that questions are stored for 90 days and shared with the listing agent.

### Models

| Role | Model | Settings |
|---|---|---|
| Default | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | `temperature: 0.2`, `max_tokens: 350` |
| Fallback | Claude Sonnet 5 (`claude-sonnet-5`) | Used if Haiku fails with a transient error before any text was sent, or for very long listings. Thinking is off so the 350 tokens go to the answer. Sonnet 5 doesn't accept `temperature`. |
| Listing writer | Claude Sonnet 5 | Structured JSON output, `effort: "low"` |

All three can be changed in `.env`. **Before switching models, run the same test set on the candidate:** `npm run eval -w server -- claude-sonnet-5`. It has 14 cases: facts, missing info, no judgments, no advice or promises, private-data leaks, off-topic and injection. Both Haiku 4.5 and Sonnet 5 currently pass 14/14.

Code: `server/src/routes/ai.ts`, `server/src/ai/*`, `client/src/components/PropertyChat.tsx`, `client/src/components/AgentQaPanel.tsx`.

## Project layout

```
server/src/
  index.ts            Express app: helmet/CSP, body limit, identify(), routes, static client in prod
  config.ts           zod-validated env (fails fast, never prints values)
  middleware/         auth (user/guest cookies, roles), error handler, rate limits
  routes/             auth, listings (incl. agent Q&A toggle + insights), ai
  ai/                 Anthropic client + model settings, prompts, Q&A limits
  data/               listings, users, private listing data, Q&A records, spend tracking
  pii.ts              email/phone masking
  validation.ts       zod schemas for every request
server/scripts/qa-eval.ts   model test set
client/src/
  pages/              Login, Listings, ListingDetail, GenerateListing, NotFound
  components/         PropertyChat, AgentQaPanel, ContactAgentButton, ImageGallery, ListingCard, Navbar, shadcn/ui
  lib/api.ts          fetch wrapper + SSE stream reader
```

Stack: React 19, Vite, Tailwind v4, shadcn/ui, React Router. Node, Express 5, TypeScript, `@anthropic-ai/sdk`, zod. Dependencies are pinned to exact versions (`.npmrc save-exact`) and locked in `package-lock.json`.

## OWASP Top 10 (2025) self-assessment

| # | Category | How this app handles it |
|---|----------|--------------------------|
| A01 | Broken Access Control | Access rules are enforced on the server for each route. Browsing is public by design. Q&A limits are tracked on the server per user, or per device and IP for guests; nothing is trusted from the client. Agent endpoints use `requireRole("agent")`. The Q&A toggle and insights also check **ownership** (`listing.agentId === user.id`), and other agents get a 404 so ownership isn't revealed. Feedback can only be given by the caller who received the answer. The role is read from the user store, never from the token. Client-side guards are UX only. |
| A02 | Security Misconfiguration | `helmet` sets security headers and a CSP (`script-src 'self'`, images only from self and Unsplash, `connect-src 'self'`). `x-powered-by` is off, JSON bodies are capped at 10 KB, the error handler never returns stack traces, and the env is validated at startup. No CORS is configured because everything is same-origin. |
| A03 | Software Supply Chain Failures | Small, well-known dependency set with exact version pins and a committed lockfile. `npm audit` reports 0 vulnerabilities. With more time: Dependabot/Renovate, `npm ci` in CI, and SRI/provenance checks. |
| A04 | Cryptographic Failures | Passwords are stored only as bcrypt hashes. JWTs are HS256-signed with a 32+ char secret from `.env` (user sessions last 2 h, guest sessions 30 days). Cookies are `httpOnly` and `SameSite=Strict`, plus `Secure` in production. Secrets live only in the git-ignored `.env`. **The Anthropic key never reaches the browser**: all AI calls go through the backend, and the built bundle has been checked for it. Private seller data is never sent to the client or the model. |
| A05 | Injection | Every body and param is validated with zod: strict objects, types, lengths, enums and an id regex. There is no SQL or shell. React escapes all output, and AI text is rendered as plain text (no `dangerouslySetInnerHTML`, no HTML-capable Markdown). **Prompt injection:** the prompt marks listing and user text as untrusted, and the model has no tools and sees only public fields of one listing. The worst a successful injection can do is change an answer's wording. The eval set includes an injection case. |
| A06 | Insecure Design | Abuse and cost controls are part of the design: the per-scope limits above, concurrent-stream caps, per-user token budgets, a global daily spend cap that pauses AI gracefully, input, output, history and thread caps, and aborting upstream streams on disconnect. Scope rules keep the assistant from judging neighbourhoods, giving legal or financial advice, or making promises, and questions it can't answer go to the agent. |
| A07 | Authentication Failures | Login is rate-limited (5 failed attempts per 15 min per IP). Wrong-email and wrong-password failures return the same generic message, and a dummy bcrypt comparison hides timing differences. Logout clears the `token` cookie, and invalid or expired tokens are cleared and treated as a guest. User and guest tokens carry a `typ` claim, so a guest token can't be replayed as a user session. With more time: MFA, refresh-token rotation, server-side session revocation. |
| A08 | Software or Data Integrity Failures | JWT verification pins `algorithms: ["HS256"]` and checks `typ`. Quota state lives on the server, not in the cookie, so replaying an old cookie can't restore free questions. The lockfile's integrity hashes pin package contents. The listing writer's output is validated against a zod schema and needs explicit agent review before publishing. |
| A09 | Security Logging and Alerting Failures | Structured JSON logs record failed logins (masked email and IP), logins, AI usage (caller, listing, model, tokens, stop reason, missing-info flag), limit hits, model fallbacks, the spend cap being reached, AI failures (error type and request id) and unhandled errors. Passwords, tokens and keys are never logged. Stored Q&A text has emails and phone numbers masked and is deleted after 90 days. With more time: ship logs to a SIEM and alert on login-failure spikes and spend anomalies. |
| A10 | Mishandling of Exceptional Conditions | A central error handler returns generic messages for 5xx and maps malformed JSON or oversized bodies to 4xx. Auth fails closed. AI errors fall back to the second model once, then fail with a friendly message and refund the question. Refusals, truncated answers (`max_tokens`) and client aborts are each handled. Invalid configuration stops startup with a clear message. |

Also: CSRF is mitigated by `SameSite=Strict` cookies plus JSON-only endpoints. `express.json` ignores form posts, so they fail validation.

## How AI tooling was used

The whole app was built by prompting **Claude Code** (Claude Opus). No code was written by hand. I made the decisions (stack, auth approach, scope, UX, the Q&A checklist in `AI_FEATURE_INSTRUCTIONS.md`) and reviewed the output, especially the security-sensitive parts. See **[docs/AI_USAGE.md](docs/AI_USAGE.md)** for the workflow and representative prompts.

## With more time

- Move quotas, Q&A records and spend tracking to Redis or a database so they survive restarts and scale across instances. Keep chat history server-side so clients can't edit earlier turns. Add real sign-up to finish the freemium funnel.
- Grow the eval set, run it in CI on every prompt or model change, and add prompt caching.
- Show which listing fields an answer came from (citations). Let agents answer "missing info" questions directly into the listing.
- Automated tests (auth/role matrix, limits, SSE parsing) and CI with `npm audit`.
