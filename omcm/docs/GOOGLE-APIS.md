# Google Maps and Routes preparation

This build step adds opt-in integration points without changing the active
Leaflet renderer, pilot JSON schemas, optimizer or published schedules. No
Google dependency is installed. No live Google request was made during testing.
Adding keys alone does not replace the app's map or simulation routes.

## Configuration

Enable billing and the Maps JavaScript API / Routes API in your Google Cloud
project. Use separate keys with the restrictions appropriate to each API:

| Setting | File | Purpose |
| --- | --- | --- |
| `VITE_GOOGLE_MAPS_API_KEY` | gitignored `frontend/.env` | Browser-visible Maps JavaScript key. Restrict by website HTTP referrers and Maps JavaScript API. |
| `OMCM_GOOGLE_ROUTES_ENABLED=true` | gitignored `backend/.env` | Explicitly enables server route calls. Defaults to false. |
| `OMCM_GOOGLE_ROUTES_API_KEY` | gitignored `backend/.env` | Private Routes key. Restrict by Routes API and the deployed server's outbound IP where applicable. Never use a `VITE_` prefix. |

Restart Vite and the Python server after changing environment files. The examples
are in `frontend/.env.example` and `omcm/.env.example` (the latter is copied to
`backend/.env`). A browser Maps key is necessarily delivered to the browser;
application/API restrictions protect it. The server Routes key is never returned
by the API or included in the frontend bundle.

## Implemented entry points

- `frontend/src/services/googleMaps.ts`: `loadGoogleMaps()` loads the official
  SDK once, only when explicitly invoked. `loadGoogleMapsLibrary("maps")`,
  `"marker"`, and `"geometry"` delegate to the SDK's `importLibrary` function.
  Missing configuration, script failures, authentication failures during loading,
  and timeouts reject explicitly; failed loads can be retried.
- `GET /api/integrations/google`: uses existing administrator authentication and
  reports whether Routes is configured. It returns no keys and makes no Google
  request. It correctly identifies Leaflet as the current renderer and Google
  routing as inactive in the planner.
- `GET /api/routes/google?origin_id=depot&site_id=P01`: uses existing administrator
  authentication and server-owned pilot coordinates. Origins are `depot` or one
  of the existing barangay IDs; destinations are candidate IDs `P01`–`P08`.
  Unknown IDs return 422. Disabled/unconfigured Google routing and upstream
  failures return explicit 503 errors without upstream bodies or credentials.
- `frontend/src/services/googleRoutes.ts`: `requestGoogleRoute(originId, siteId,
  "google", signal)` uses the existing authenticated API transport. The renderer
  argument is checked before requesting; these results are not accepted as
  Leaflet overlays.

Routes uses the standard-library HTTPS client, a fixed official endpoint, a
15-second timeout, no redirects and a narrow field mask. It returns duration,
distance and GeoJSON LineString coordinates with provider/display metadata.
Requests use `DRIVE` and `TRAFFIC_UNAWARE`: no live traffic claim is made. Results
are not cached or written to fixtures, drafts, schedules or the optimization
matrix. The adapter does not pretend that Google honors OMCM's simulated road
closures or flood exclusions.

You can inspect the authenticated endpoint contract at the existing FastAPI
`http://127.0.0.1:8000/docs`. Enabling the flag and calling the route endpoint
makes a real Google request and can incur usage charges. The normal OMCM browser
workflow makes no such request in this build step.

## Next build step, after review

Implement an optional Google renderer using the same Laguna geometries, mask,
search/selection, heatmaps and overlays. Adapt the existing Leaflet-dependent
tracker and road-click layers before activating Google routing in the browser.
Preserve bounds, hospital visibility, approval/publication separation and the
public view. No renderer migration or optimizer/matrix change is claimed here.
Google route results displayed on a map must use a Google Map; do not put them on
the current Leaflet/OSM map. Verify billing/key restrictions with supplied
credentials, along with all map/scenario workflows, before enabling the provider.
Any later data-model or dependency change still requires user approval.

## Official references

- [Maps JavaScript API loading](https://developers.google.com/maps/documentation/javascript/load-maps-js-api)
- [Routes computeRoutes REST contract](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes)
- [Routes display and attribution policies](https://developers.google.com/maps/documentation/routes/policies)
- [Google Maps Platform key restrictions](https://developers.google.com/maps/api-security-best-practices)
