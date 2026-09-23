# Property Q&A (AI) – Test Checklist

## 1. Access & Auth
- [x] Anonymous user can ask up to **3 questions per property**
- [x] Anonymous user is blocked after **10 questions/day** (all properties)
- [x] Limit hit → login wall shown ("Sign in to keep asking / contact agent")
- [x] Logged-in user gets higher limits (see §2)
- [x] Agent can **disable Q&A** per listing → chat hidden for that listing
- [x] Agent testing their own listing does **not** count toward stats/limits

## 2. Rate Limiting
| Scope | Anonymous | Logged in |
|---|---|---|
| Messages / minute | 3 | 6 |
| Messages / property / day | 3–5 | 30 |
| Messages / day (all properties) | 10 | 100 |
| Concurrent streams | 1 | 1–2 |

- [x] Limits are **per user** (anon = IP + device ID), not only global (device ID = signed `a` cookie; both buckets checked)
- [x] Token budget tracked per user, not just request count
- [x] Global daily spend cap → feature disables gracefully when hit (`AI_DAILY_SPEND_CAP_USD`; returns 503 `unavailable` + `Retry-After`, chat points to the agent)
- [x] Limit hit → API returns **429** + `Retry-After`
- [x] Limit hit → UI shows friendly message + "Contact agent" button (no raw error)
- [x] Second message while one is streaming → blocked or queued (blocked: UI disables send; server returns 429 `busy`)

## 3. Length Caps
- [x] Input capped at **500 characters** (UI counter + server enforced)
- [x] 501+ chars sent directly to API → rejected
- [x] Output capped at **~350 tokens**; answers are short and direct
- [x] Thread capped at **20 turns** → "Start new chat" / "Contact agent" shown (client-side; server per-property daily caps bound it too)
- [x] Only last **4–6 turns** sent to the model as history (4 question/answer pairs, max 8 messages server-enforced)
- [x] Attachments / images **not accepted** (strict schemas: text only, unknown fields → 400)

## 4. Scope – Allowed
- [x] Listing facts: price, size, rooms, floor, year, heating, parking, fees, availability
- [x] Objective nearby facts (distances) – only if in data
- [x] Process questions: how to book a viewing, next steps

## 5. Scope – Not Allowed
- [x] Info not in listing → "I don't have that, ask the agent" (**no guessing**)
- [x] No neighborhood judgments ("safe", "good for families", "quiet area")
- [x] No ranking areas by who should live there
- [x] Bot never asks about family, religion, origin, age, disability
- [x] No negotiation advice ("will they accept €X?") → routes to agent
- [x] No legal / mortgage / eligibility advice → routes to agent
- [x] No promises on agent's behalf (discounts, dates, reservations)
- [x] Off-topic questions (general chat, coding, other listings) → politely refused

## 6. Data & Privacy
- [x] Model receives **public listing fields only**
- [x] Private agent notes, seller info, minimum price never in context
- [x] Asking for seller contact / lowest price → no leak
- [x] Conversations logged with retention period (e.g. 90 days) (in memory for the demo; hourly purge)
- [x] Phone numbers / emails typed by users are masked in logs
- [x] If agents can read Q&A on their listings → disclosed to users

## 7. UX
- [x] "Ask the agent directly" button always visible
- [x] Thumbs up/down on each answer
- [x] "Not in listing" answers flagged to agent as missing info (agent-only "Agent tools" card on the listing page)

## 8. Models
| Role | Model | Why |
|---|---|---|
| **Default** | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | Fast, cheap, plenty for grounded Q&A over one listing |
| **Fallback / hard questions** | Claude Sonnet 5 (`claude-sonnet-5`) | Better reasoning if Haiku answers are weak or long listings |
| Not recommended | Opus / Mythos tier | Overkill and costly for this use case |

- [x] Temperature low (0–0.3) for factual answers (Haiku 0.2; Sonnet 5 doesn't accept sampling params)
- [x] Same test set run on chosen model before switching models (`npm run eval -w server -- <model>`; Haiku 4.5 and Sonnet 5 both 14/14)