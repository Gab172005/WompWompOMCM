# Separate Vercel frontend and backend

Frontend: https://omcm-two.vercel.app
Backend: https://womp-womp-omcm.vercel.app

## Verified failure and code fix

The backend returned HTTP 500 with `FUNCTION_INVOCATION_FAILED` at
`/api/health`, `/api/assistant/status`, and `/openapi.json`. The runtime traceback
identified `repository.initialize()` opening SQLite at a path in the deployment
filesystem. Vercel functions have a read-only deployment filesystem and writable
temporary storage under `/tmp`.

The repository now maps relative SQLite paths to `/tmp/omcm/<filename>` when
`VERCEL=1` and creates missing parent directories. An explicitly configured
absolute path is preserved. Local and persistent-server paths keep their normal
behavior. The health endpoint reports `storage.temporary`, and startup logs
identify temporary storage.

This makes the hackathon backend start successfully. Temporary SQLite is **not
durable shared storage**: plans, schedules and audit records may disappear when
a function instance restarts, and different instances do not share a database.
Use a persistent database/hosting arrangement for durable server publication.
The Gemini assistant itself does not require SQLite records to answer questions
or run the browser's app tools.

Sources: [Vercel filesystem support](https://vercel.com/docs/functions/runtimes),
[SQLite and serverless storage](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel).

## Required deployment settings

### Backend project

Root Directory: `omcm/backend`. Use the FastAPI framework and `main.py` entrypoint.
Deploy the code containing the repository fix.

Set these environment variables for the deployed environment:

```dotenv
OMCM_DATABASE_PATH=/tmp/omcm/omcm.db
OMCM_CORS_ORIGINS=https://omcm-two.vercel.app
OMCM_CHAT_MODEL=gemini-3.8-flash
OMCM_CHAT_API_KEY=<your Gemini key, stored only in the backend project>
OMCM_DATASET=pilot
OMCM_DEMO_AUTH=true
OMCM_ADMIN_USERNAME=<choose your administrator username>
OMCM_ADMIN_PASSWORD=<choose a password with at least 12 characters>
```

Sign in using the same administrator username and password configured on the
backend. These are backend-only settings; never expose the real administrator
password in a `VITE_` environment variable. The built-in browser demonstration
credentials do not configure or enable server-side administrator access.
Do not copy the `/admin` path into the CORS value: CORS uses the frontend origin.
Local `.env` files are ignored by Git and do not configure the hosted project.

The assistant now defaults to `gemini-3.8-flash` if `OMCM_CHAT_MODEL` is absent
or blank. An explicitly configured model still overrides that default. The live
backend was observed reporting `configured: true, model: "gemini-2.5-flash"`
after the database startup fix, which explains its model-unavailable error.
Replace any old `OMCM_CHAT_MODEL` value in the **backend project's Production
environment** with `gemini-3.8-flash` and redeploy that project. Setting the model
only on the frontend project or changing only a local `.env` does not update the
hosted backend. Verify the resulting model using `/api/assistant/status`.

If sign-in says it is unavailable, check `/api/health`: `admin_configured: false`
means at least one requirement is missing. `OMCM_DEMO_AUTH` must be `true`, the
username must be nonempty, and the password must contain at least 12 characters.
With incomplete settings, `/api/auth/me` deliberately returns HTTP 503. With
proper settings but no/incorrect credentials it returns HTTP 401. Set all three
values for the backend project's Production environment and redeploy before
trying the same credentials in the frontend.

The updated health endpoint includes `admin_configuration` with boolean checks
and an `issues` list naming the failed requirements. It never returns the
username, password or exact password length. The `demo_auth` flag now reflects
the actual server setting; older builds always returned `true` there, even when
authentication was disabled. Authorization and health use the same validation.
Whitespace around the flag and username is normalized; password characters are
preserved exactly. In the Vercel editor, enter `true` without wrapping quotes.

The connected sign-in form allows 15 seconds for a server response, including
startup, and distinguishes HTTP 503 (server sign-in unavailable), HTTP 401
(incorrect credentials), timeouts and connection errors. Increasing that limit
does not enable an unconfigured account: the server must still pass all three
administrator checks before it can accept credentials.

If configuration remains false after editing the settings:

1. Confirm the variables are on the backend project associated with
   `womp-womp-omcm.vercel.app`, not the frontend project.
2. Select the Production environment for each variable.
3. Redeploy the backend after saving. Existing deployments retain their previous
   environment values.
4. Read the new `admin_configuration.issues` at `/api/health` and correct only
   those fields. If the field is absent, the latest health diagnostics have not
   been deployed yet. Share only that safe status object when troubleshooting;
   keep credential values in the backend environment editor.

Redeploy the backend, then open:

- https://womp-womp-omcm.vercel.app/api/health — HTTP 200, `status: "ok"`.
- https://womp-womp-omcm.vercel.app/api/assistant/status — HTTP 200,
  `configured: true`, `model: "gemini-3.8-flash"`.

### Frontend project

Root Directory: `omcm/frontend`; build `npm run build`; output `dist`.

Set for Production (and Preview if needed), then redeploy:

```dotenv
VITE_API_URL=https://womp-womp-omcm.vercel.app
```

Use the stable backend domain above, without `/api` or an endpoint path. The app
adds `/api/assistant` itself. Vite embeds this value at build time, so editing
the setting without redeploying does not update an existing JavaScript bundle.

The inspected frontend bundle `index-CcU_Ab4M.js` was using
`https://womp-womp-omcm-zwkwgeh9l-gab-s-projects2.vercel.app/`. Requests to that
deployment-specific URL redirected to Vercel sign-in. That is an independent
cause of browser fetch/CORS errors and must be corrected in the frontend's
environment settings. Keep the Gemini key out of `VITE_` variables.

The frontend project's own `/api/assistant/status` currently returns the HTML
app shell, because its SPA rewrite serves `index.html`. This is expected with
the direct backend URL configuration above; use the backend domain for API
checks.

## Verification

`tests/backend/test_vercel_startup.py` reproduces the read-only database failure,
then confirms startup, health, assistant status, OpenAPI and schedule reads work
with Vercel scratch storage. It also verifies explicit/local paths, missing
directory creation, the temporary-storage indicator, and CORS preflight from
`https://omcm-two.vercel.app` while rejecting unrelated origins.

```sh
cd omcm/backend
.venv/bin/python -m pytest ../tests/backend -q
```

These repository changes do not modify Vercel dashboard settings or deploy
themselves. Both projects need the updated environment values and redeployment.
