# KiezHomes: Berlin Property Assistant

A small, responsive web app for browsing Berlin property listings and asking an AI assistant questions about them.

## How to run it

You need Node.js 20.19 or newer.

```bash
cp .env.example .env        # then add your ANTHROPIC_API_KEY
npm install && npm run dev
```

Then open **http://localhost:5173**.

Demo accounts (both use the password `password123`):
- `buyer@demo.com` is a regular user.
- `agent@demo.com` is the listing agent and can also use the listing writer.

You can also browse and ask a few questions without signing in.

## The real AI feature

**Property Q&A.** Open any listing and ask a question in plain English, for example "What are the monthly costs?" or "How far is the U-Bahn?". The server sends the question and that listing's data to Claude (Haiku 4.5, falling back to Sonnet 5). The answer streams back word by word.

The assistant only answers from the listing. If the listing doesn't cover something, it says so and points you to the agent instead of guessing.

There is a second real AI feature for agents: the **listing writer** ("Write listing"). The agent enters a few details and Claude writes a title, description and feature list.

## What is mocked

- **Listings, photos and neighbourhood info:** 12 hard-coded Berlin listings. Photos come from Unsplash.
- **User accounts:** two hard-coded users. There is no sign-up.
- **"Contact agent":** shows fake contact details.
- **Storage:** everything is kept in memory and resets when the server restarts. That covers new listings, question limits and saved questions.

## Security: OWASP Top 10 (2025) self-assessment

**The basics:**
- **Secrets stay out of the code.** They live in a git-ignored `.env` file.
- **The AI key never reaches the browser.** All AI calls go through the backend.
- **All input is validated on the server.** Nothing from users or the AI is rendered as HTML.
- **Errors fail safe.** Users see a friendly message, never internal details.

| # | Risk | How the app handles it | With more time |
|---|------|------------------------|----------------|
| A01 | Broken Access Control | Every permission is checked on the server, not just hidden in the UI. Guests can browse and ask a few questions. Signed-in users get more. Only the agent who owns a listing can see its stats or switch its AI off. | Automated tests for every role and endpoint. |
| A02 | Security Misconfiguration | Standard security headers and a strict Content Security Policy. Request size limits. No stack traces in responses. The app refuses to start if its settings are missing. | Serve over HTTPS behind a reverse proxy. |
| A03 | Software Supply Chain Failures | A small set of well-known packages. Exact versions are locked in `package-lock.json`. `npm audit` reports no known vulnerabilities. | Automatic dependency updates and audits in CI. |
| A04 | Cryptographic Failures | Passwords are stored as bcrypt hashes, never in plain text. Sessions are signed tokens in cookies that JavaScript can't read. The secret comes from `.env`. | Secret rotation, and HTTPS everywhere. |
| A05 | Injection | Every request is checked for type and length. There is no database or shell to inject into. The AI's answers are shown as plain text. The AI is told to treat listing text and questions as data, not instructions, and it can't take actions or read other data. | A larger set of prompt-injection tests. |
| A06 | Insecure Design | AI use has limits built in: short questions (500 characters), short answers, and a cap on questions per minute, per property and per day. There is also a daily spending cap. The assistant won't give legal or financial advice, judge neighbourhoods, or make promises for the agent. | Keep chat history on the server instead of the browser. |
| A07 | Authentication Failures | Failed logins are rate-limited. The error message doesn't reveal whether the email exists. Sessions expire after 2 hours, and signing out clears the session. | Sign-up, password reset and two-factor login. |
| A08 | Software or Data Integrity Failures | Session tokens are verified with a fixed algorithm, so they can't be forged. The listing writer's output is checked before use, and the agent must review it before publishing. | Signed builds and CI checks before deploy. |
| A09 | Security Logging and Alerting Failures | Failed logins, AI usage and errors are logged. Passwords, tokens and keys are never logged. Emails and phone numbers are masked. | Send logs to a monitoring tool and alert on unusual activity. |
| A10 | Mishandling of Exceptional Conditions | One central error handler returns safe, generic messages. If the AI fails, a backup model is tried once. After that the user sees a friendly error and the question isn't counted. Cancelled answers stop the AI call. | More tests for failure cases. |

## How AI tooling was used

See [docs/AI_USAGE.md](docs/AI_USAGE.md).
