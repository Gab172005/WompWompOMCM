# Deployment

Deploy the frontend and backend from the same revision. Local setup is described
in the [development guide](../README.md#local-setup). Deployment settings belong
to the project owner; local environment files do not configure a hosted service.

## Backend

Use `omcm/backend` as the project root with `main:app` as the FastAPI entrypoint.
Install dependencies from `requirements.txt`. The supplied `render.yaml` is an
alternative backend hosting configuration. Configure:

| Variable | Purpose |
| --- | --- |
| `OMCM_DATASET=pilot` | Retain the configured dataset; provincial planning remains province-wide |
| `OMCM_DEMO_AUTH=true` | Enable the prototype administrator account |
| `OMCM_ADMIN_USERNAME` | Administrator username |
| `OMCM_ADMIN_PASSWORD` | Administrator password, at least 12 characters |
| `OMCM_CORS_ORIGINS` | Comma-separated frontend origins, without paths |
| `DATABASE_URL` | Shared PostgreSQL connection, recommended for hosted records |
| `OMCM_DATABASE_PATH` | SQLite path when `DATABASE_URL` is absent |

Keep secret values in server environment settings. Change the default
`OMCM_CORS_ORIGIN_REGEX` when deploying under a different project/team: the
bundled preview allowlist is specific to the existing deployment. Use HTTPS for
hosted authentication and database/provider connections as appropriate.

## Persistent storage

For Vercel, connect Neon or another PostgreSQL database to the **backend** project.
Set its pooled connection string as `DATABASE_URL`, including the provider's TLS
parameters, then redeploy. Preview/test deployments should use a separate database
or branch from Production. No database key is required by the frontend.

Startup creates the repository's five tables if absent; it does not drop records.
Configured PostgreSQL errors do not fall back to SQLite. Switching databases does
not copy existing SQLite rows; back up persistent local records before switching.

Local SQLite normally persists in `backend/omcm.db`. Vercel maps relative SQLite
paths to its temporary directory: those records are unshared and can disappear
when an instance restarts. A SQLite file on persistent hosting needs a persistent
disk. Merely deploying the PostgreSQL adapter does not configure a database.

## Frontend

Use `omcm/frontend` as the project root, `npm run build` as the build command,
and `dist` as the output directory. `frontend/vercel.json` supplies SPA fallback
routing. Configure `VITE_API_URL` with the backend's stable HTTPS origin, without
`/api` or an endpoint path, then rebuild. The local Vite proxy is not a production
API server. Ensure backend CORS permits the frontend origin.

Every `VITE_` variable is delivered to the browser. Never use that prefix for an
administrator password, database connection string, or private provider key.

## Optional services

- **Gemini assistant:** set backend `OMCM_CHAT_API_KEY` and, when needed,
  `OMCM_CHAT_MODEL`. `/api/assistant/status` reports the selected model and whether
  a key is configured. Supported local commands work without an external key.
  The retained `/api/chat` adapter has its own provider/URL configuration.
- **Google Maps:** use a restricted browser key in `VITE_GOOGLE_MAPS_API_KEY`, or
  configure it in Map settings. Restrict the key by HTTP referrer and API.
  OpenStreetMap remains available without a key.
- **Google Routes:** the separate pilot adapter needs
  `OMCM_GOOGLE_ROUTES_ENABLED=true` and backend `OMCM_GOOGLE_ROUTES_API_KEY`.
  It does not supply the provincial planner's travel matrix or simulated closures.
  Calling the adapter can incur provider charges.

## Deployment checks

1. Open backend `/api/health`; confirm `status: "ok"` and `admin_configured: true`.
   For PostgreSQL, storage should report `engine: "postgresql"`, `temporary: false`.
2. Sign in and load **Plan clinics**. Generate a plan and reopen it after reload.
3. Publish a visit, then verify its date, hours, services, and markers in a fresh
   Public View browser. Private draft results must remain absent there.
4. Restart/redeploy the backend. Confirm the saved plan and schedule still exist.
5. Check phone layouts and optional assistant/map services if enabled.

## Troubleshooting

- **Sign-in unavailable:** inspect `admin_configuration.issues` in `/api/health`.
  Set the missing backend values and redeploy; do not publish credential values.
- **Connection/CORS error:** check `VITE_API_URL`, allowed origins, and whether
  a deployment-specific backend URL redirects to a hosting login page.
- **Dependency bundle too large:** use the supplied Linux `xgboost-cpu` dependency;
  installing the GPU distribution adds packages the application does not use.
- **Records disappear:** check the storage configuration. Scratch SQLite and
  browser snapshots are not shared durable storage.

See the provider's official [Vercel storage](https://vercel.com/docs/storage)
and [environment variable](https://vercel.com/docs/environment-variables) guides,
and [Neon pooling](https://neon.com/docs/connect/connection-pooling).
