# How AI tooling was used

I built the whole app by prompting Claude Code in the terminal and didn't write code by hand. I started in plan mode. I gave Claude the task brief and my key decisions, answered its questions on the open choices (TypeScript, cookie-based login, a streaming chat), and approved a timeboxed plan before any code was written. Claude then built the app in small steps: it ran a background agent to create the mock listings, and it tested each step with typechecks, real API calls and a browser check. When requirements changed, I gave new instructions or a written checklist, and Claude reworked the code and tested it again. I reviewed the output myself, especially the security parts: login, access checks, error handling and how AI answers are displayed.

## Representative prompts

> "We will be making the Q&A AI feature, with proper text limiting, integration with Claude… Users hard-coded but we will be having authorization and authentication… Work fast, iterate faster."

> "Make sure we have anonymous sessions as well, so that we can have a freemium model where users can send a single message, but then they need to… login. Listings aren't gated behind proper authentication."

> "I've added a .md document for a checklist on the AI feature." (The checklist covered rate limits, answer scope, privacy and model choice. Claude implemented it and wrote a small test set to check the AI's answers.)

## One thing I would improve with more time

I would turn the small AI test set into a proper automated check that runs on every change. It would use real buyer questions, including tricky ones and prompt-injection attempts. Then answer quality would be measured every time the prompt or model changes, not just checked by eye.
