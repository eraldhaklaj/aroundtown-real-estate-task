# Property Q&A (AI) – Test Checklist

## 1. Access & Auth
- [ ] Anonymous user can ask up to **3 questions per property**
- [ ] Anonymous user is blocked after **10 questions/day** (all properties)
- [ ] Limit hit → login wall shown ("Sign in to keep asking / contact agent")
- [ ] Logged-in user gets higher limits (see §2)
- [ ] Agent can **disable Q&A** per listing → chat hidden for that listing
- [ ] Agent testing their own listing does **not** count toward stats/limits

## 2. Rate Limiting
| Scope | Anonymous | Logged in |
|---|---|---|
| Messages / minute | 3 | 6 |
| Messages / property / day | 3–5 | 30 |
| Messages / day (all properties) | 10 | 100 |
| Concurrent streams | 1 | 1–2 |

- [ ] Limits are **per user** (anon = IP + device ID), not only global
- [ ] Token budget tracked per user, not just request count
- [ ] Global daily spend cap → feature disables gracefully when hit
- [ ] Limit hit → API returns **429** + `Retry-After`
- [ ] Limit hit → UI shows friendly message + "Contact agent" button (no raw error)
- [ ] Second message while one is streaming → blocked or queued

## 3. Length Caps
- [ ] Input capped at **500 characters** (UI counter + server enforced)
- [ ] 501+ chars sent directly to API → rejected
- [ ] Output capped at **~350 tokens**; answers are short and direct
- [ ] Thread capped at **20 turns** → "Start new chat" / "Contact agent" shown
- [ ] Only last **4–6 turns** sent to the model as history
- [ ] Attachments / images **not accepted**

## 4. Scope – Allowed
- [ ] Listing facts: price, size, rooms, floor, year, heating, parking, fees, availability
- [ ] Objective nearby facts (distances) – only if in data
- [ ] Process questions: how to book a viewing, next steps

## 5. Scope – Not Allowed
- [ ] Info not in listing → "I don't have that, ask the agent" (**no guessing**)
- [ ] No neighborhood judgments ("safe", "good for families", "quiet area")
- [ ] No ranking areas by who should live there
- [ ] Bot never asks about family, religion, origin, age, disability
- [ ] No negotiation advice ("will they accept €X?") → routes to agent
- [ ] No legal / mortgage / eligibility advice → routes to agent
- [ ] No promises on agent's behalf (discounts, dates, reservations)
- [ ] Off-topic questions (general chat, coding, other listings) → politely refused

## 6. Data & Privacy
- [ ] Model receives **public listing fields only**
- [ ] Private agent notes, seller info, minimum price never in context
- [ ] Asking for seller contact / lowest price → no leak
- [ ] Conversations logged with retention period (e.g. 90 days)
- [ ] Phone numbers / emails typed by users are masked in logs
- [ ] If agents can read Q&A on their listings → disclosed to users

## 7. UX
- [ ] "Ask the agent directly" button always visible
- [ ] Thumbs up/down on each answer
- [ ] "Not in listing" answers flagged to agent as missing info

## 8. Models
| Role | Model | Why |
|---|---|---|
| **Default** | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | Fast, cheap, plenty for grounded Q&A over one listing |
| **Fallback / hard questions** | Claude Sonnet 5 (`claude-sonnet-5`) | Better reasoning if Haiku answers are weak or long listings |
| Not recommended | Opus / Mythos tier | Overkill and costly for this use case |

- [ ] Temperature low (0–0.3) for factual answers
- [ ] Same test set run on chosen model before switching models