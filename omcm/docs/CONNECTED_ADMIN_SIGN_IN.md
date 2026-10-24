# Connected sign-in clarification

Date: 2026-10-24. Branch: `fix/connected-admin-sign-in`.
Based on the completed optimizer branch at `ca9933d`.

The sign-in dialog always displayed the browser demo credential hint, even in
connected mode. In the reported local setup, the username matched the hint but
the backend password differed. Backend rejection was correct; the public form
was misleading. No configured password was changed or exposed by this fix.

## Exact changed files

Paths are relative to `omcm/`.

| File | Logic changed |
| --- | --- |
| `frontend/src/features/auth/AdminLoginModal.tsx` | Show the credential hint and Fill button only in explicit browser demo mode. Connected mode explains that the configured workspace account is required. Distinguish rejected credentials (401) from unavailable verification. Preserve mandatory backend verification. |
| `frontend/src/services/api.ts` | Preserve HTTP status in `BackendApiError`, allowing sign-in to distinguish a wrong password from backend/network failures. No API schema or authentication mechanism changes. |
| `frontend/scripts/optimization-browser.mjs` | Require the demo shortcut to be absent in connected mode; explicitly submit incorrect example values and verify backend rejection before the existing successful optimizer flow. |
| `tests/frontend/adminLogin.test.tsx` | Add six regressions for connected hint visibility, explicit-demo filling/sign-in, backend verification of example values, 401 vs network/503 errors, cleared rejected credentials and verified identity. |
| `docs/CONNECTED_ADMIN_SIGN_IN.md` | Document the cause, exact file inventory, verification and browser review. |

## Verification

- Frontend lint and production build passed; 85 frontend tests passed.
- Backend pytest regression suite passed: 46 tests.
- Connected optimizer browser suite passed: incorrect credentials reject, configured
  credentials succeed, then actual backend optimization/publication works.
- Existing hospital/HNI browser suite passed and verifies that explicit demo sign-in still works.
- The existing local backend `.env` credentials were verified against the running API with a 200 response; no password was changed or printed.

## Browser review

Open `http://127.0.0.1:5173/` and select Admin View. In connected mode the dialog
shows **Connected administrator sign-in** and no demo autofill. For local
development, use `OMCM_ADMIN_USERNAME` and `OMCM_ADMIN_PASSWORD` from the existing
gitignored `backend/.env`. The dialog never displays those server credentials.
Explicit `VITE_DEMO_MODE=true` retains the browser rehearsal shortcut; the
optimizer still requires an authenticated backend request.
