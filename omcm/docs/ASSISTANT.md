# Gemini app assistant

Use **Planning help** or the floating **Ask OMCM** button. The assistant stays
open across routes and retains its conversation until **New conversation** or
a page reload. It works in Public View as well as Admin View.

The current configured model is `gemini-3.8-flash`, selected after Google's API
rejected `gemini-2.5-flash` for the supplied account. The key was accepted; the
older model is unavailable to new users. No API key is shipped to the browser.

## Run

Run the frontend and Python backend using the project README. Common commands
and data lookups run directly in the browser. Generated answers use the backend,
including when planning is in browser demo mode.

The server loads nonempty values from `backend/.env`, then fills missing/empty
values from `omcm/.env`. Existing nonempty process variables take precedence.
This allows a project-level key to work despite empty backend placeholders.

```dotenv
OMCM_CHAT_API_KEY=your-server-side-key
OMCM_CHAT_MODEL=gemini-3.8-flash
```

`GEMINI_API_KEY` and `GOOGLE_API_KEY` are accepted key alternatives. Restart the
backend after changing environment configuration. `OMCM_CHAT_PROVIDER` and
`OMCM_CHAT_URL` belong to the older pilot explanation endpoint; the new app
assistant uses the native Gemini API and does not need a custom URL.

`GET /api/assistant/status` reports only model name and whether a key exists.
`POST /api/assistant` handles the conversation. Vite's existing `/api` proxy
forwards requests locally. Deployed frontends must set `VITE_API_URL` to the
backend and configure backend CORS for their frontend origin.

## Examples

- “Show Los Baños and the three nearest mapped hospitals.”
- “Which five barangays have the highest healthcare need?”
- “Why does the selected barangay have this score?”
- “Show the population density map and hide fixed clinics.”
- “Open clinic planning with four available clinics.”
- “Open the 30-day simulation and suggest locations for three clinics.”
- “Apply those simulation suggestions.”
- “Pause the simulation and explain the reached results.”
- “Show tomorrow's approved schedule.”
- “Open analytics.”

The assistant can answer questions in English or Filipino. Questions about the
app's records use the same computed data and state as the interface. Repeated
barangay names require municipality disambiguation. Facility proximity means
straight-line distance, not travel time or confirmed availability.

## How actions work

Complete, unambiguous common requests use a local intent handler and the same
validated app tools, without a Gemini round trip. This covers greetings, opening
pages, selecting named places, nearby facilities, score/population details,
rankings, layer toggles, clinic counts, simulation controls and public schedules.
It reads current data rather than caching stale answers. Repeated place names
ask for clarification. Compound, negative or explanatory requests that do not
match a complete supported intent go to Gemini without partially changing the UI.

For other requests, Gemini calls named functions through the same browser-side
allowlist. Successful action-only requests finish from the tool results without
paying for another model call merely to confirm them. Questions needing a generated
explanation still return results to Gemini. Current-turn tool signatures and call
IDs are preserved; completed turns are compacted to the last four question/answer
pairs, omitting old tool payloads and limiting prior history to about 12 KB.
Gemini uses low thinking effort, a 1024-token response budget, and instructions
to keep ordinary answers under 100 words and batch independent tool calls.
Unknown functions, arbitrary URLs, invalid counts, dates, IDs, and unreached
simulation days remain rejected. Local answers are labeled “App data · instant”.

Functions: `search_places`, `get_place_details`, `rank_places`,
`find_facilities`, `get_app_state`, `navigate`, `select_place`, `configure_map`,
`configure_plan`, `configure_simulation`, and `show_schedule`.

Admin actions still require the existing administrator sign-in. Public users
can ask questions, search public records, select communities, toggle facility
layers and view published schedules. The assistant cannot authenticate itself,
approve/publish schedules, delete records, run code or browse external URLs.
Recommendations remain drafts until the user requests application in the
practice simulator. Clinic-count changes restart simulation runs as in the UI.

The new assistant endpoint does not mutate server schedules or planning data.
The older `/api/chat` pilot explanation endpoint remains available separately.

## Reliability and verification

The Stop button cancels the browser request and prevents later tool execution;
already completed actions stay listed. Closing/reopening the widget preserves
history. Errors and quota failures are shown explicitly rather than replaced
with canned responses presented as Gemini output. An in-flight provider request
may finish on the server after the browser stops waiting.

Before the fast handler, a live Gemini greeting took about 83 seconds during
development. Greetings and common commands no longer depend on provider latency.
The browser regression measured six common commands at 31–174 ms with zero Gemini
requests; a model-selected action used one request instead of two. These timings
measure the local test environment, not a latency guarantee on all devices.

For generated explanations, the backend allows 100 seconds for each
provider round trip; the browser allows 110 seconds. Complex requests can
require several round trips. The widget remains usable and offers Stop.
One transient HTTP 500/502/503/504 provider failure is retried within the same
100-second budget. Quota and credential errors are not automatically retried.

The speed update was checked with the assistant browser regression (including
zero provider calls for common commands, one for a model-selected action, and
normal generated-answer/error handling), the expanded frontend unit suite,
all 11 assistant backend tests, lint and production build. Tests also verify
that short commands preserve permissions, name disambiguation and conversational
context, and do not partially execute compound or explanatory requests.

```sh
cd omcm/frontend
npm test
npm run test:assistant
npm run test:hni
npm run test:simulation
npm run lint
npm run build
cd ../backend
.venv/bin/python -m pytest ../tests/backend -q
```

The assistant browser regression uses controlled provider responses and real
app data/tools. It checks lookup, follow-up, automatic navigation, clinic-count
changes, simulation drafts, public schedules, history across route changes,
mobile layout and provider errors. Unit tests cover validation, permissions,
scoring consistency, reached-only results, cancellation, signatures, environment
loading and credential-safe provider errors. Live API checks are separate and
use the local server key without printing it.

Initial integration validation: all 89 frontend unit tests, all 50 backend
tests (including 11 assistant-specific tests), the assistant browser regression,
the simulation browser regression, lint and production build passed. The
production JavaScript artifacts were checked and did not contain the configured
API key. A live Gemini 3.8 browser conversation successfully called `navigate`,
opened `/simulator`, retained the chat, returned the tool result to Gemini,
and displayed its final answer. Both provider round trips returned HTTP 200.

The existing hospital/HNI browser suite currently stops at its expectation of
one `.forest-land-marker`. The current forest component removed that marker
in commit `2f84fbf` and uses a polygon hover interaction instead. That stale
expectation, and the later permanent forest label expectation, predate this
assistant change. Forest behavior was left unchanged.
