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
```

Keep existing demo administrator settings if using authenticated pilot actions.
Do not copy the `/admin` path into the CORS value: CORS uses the frontend origin.
Local `.env` files are ignored by Git and do not configure the hosted project.

The backend also allows branch and deployment preview origins for the
`omcm-two` Vercel project in the `gab-s-projects2` team. This is restricted to
that project's Vercel hostnames; unrelated Vercel projects and origins remain
blocked. If the project or team changes, set `OMCM_CORS_ORIGIN_REGEX` to an
anchored regex for the new project and team. Deploy the backend code change
before testing previews. Local development should use the local backend proxy,
or explicitly include the local frontend origin in `OMCM_CORS_ORIGINS`.

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
