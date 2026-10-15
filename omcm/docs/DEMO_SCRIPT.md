# Three-minute judge walkthrough

Use `http://127.0.0.1:5173/simulator`. Preflight: internet for OSM tiles; wait for
the actual roads and lake to render. No map key is required. Use the default
`pilot` dataset. For a completely independent rehearsal, set frontend
`VITE_DEMO_MODE=true` and restart Vite. For shared server publication, run both
servers and sign in with your locally configured demo administrator credentials.

## 0:00–0:35 — Explain need

“OMCM helps plan next-day mobile care in 20 Laguna barangays. These are real
boundaries and roads; the population, health and hazard inputs are synthetic.”
Click Batong Malake or another red polygon. Show PSGC, population, score
contributions and source/confidence label. Close details.

## 0:35–1:10 — Optimize and move

Click **Demo tour · 3 clinics**. The deterministic default scenario uses three
180-appointment clinics and a 15-minute modeled access threshold. Three
distinct fleet markers depart from the illustrative Timugan depot at 0, 20
and 40 simulated seconds. Routes follow bundled OSRM road geometry.

Select a clinic card. Point out remaining kilometers, ETA, progress, heading,
simulated position and independent destination. Pause, choose 5× or 20×,
resume, and drag the timeline backward. All markers and metrics agree.

## 1:10–1:55 — Stress test

Choose **Severe** flood, then **Reoptimize tomorrow**. Read the changed sites
and before/after comparison. Explain that the hatched polygons are assumed
whole-community inundation, not observed hazard extents. The day/date advances
and playback starts from the previous day's final clinic locations. A clinic
whose route is blocked stays at its previous site with a Blocked status; the
app does not invent a safe diversion. Coverage for proposed destinations assumes
arrival, and the simulator's approval link waits for the blocked routes to clear.

Set **Available clinics** to 2, reoptimize and show reduced capacity. Optional:
enable **Demo road closure**, or choose a disease-surge community and +300%.
The changed score/demand and eligibility determine results. Changing a scenario
pauses the previous run; recomputation simulates the following day. Reset returns
to that day's starting locations. Unchanged assignments stay deployed in place.
Only the explicit demo tour restarts day 1 at the depot.

## 1:55–2:25 — Explain the comparison

Show **Optimized vs population baseline** and expand unserved communities.
Both plans obey the same capacities, threshold and scenario exclusions. Priority
coverage means weighted daily appointment demand, not the whole population.
Connected optimization labels proven optimality; browser planning is a reference
heuristic and explicitly says so.

## 2:25–3:00 — Review and publish

Click **Reset scenario**, then **Reoptimize tomorrow**. If using the unauthenticated
connected tour, click **Sign in & generate approval draft**, sign in, review the
new solver result, and then **Review & approve plan**. In browser demo, local
review is immediately available.

Choose tomorrow (or another future date with no existing schedule), review hours
and services, and click **Approve deployment**. Open Public View and select that
date. Only the approved destinations and service times appear; no simulated
vehicle is shown as live GPS. Today's schedule remains unchanged. In browser
mode, explicitly say this is a local publication rehearsal on this browser.

## Recovery

- **Reset** resets vehicle time; **Reset scenario** restores prepared inputs.
- If tiles fail, use **Retry tiles** and check connectivity; boundaries and road
  fixtures still work, but do not describe a missing basemap as visible.
- A previously published date requires a separate, confirmed emergency override;
  use a fresh future date for repeated ordinary approval demonstrations.
- If the backend is absent, the banner explains browser-only mode. Reload after
  starting the backend to connect. Local plans are not copied into server storage.
- The public default is today, which should remain empty until an explicit
  authorized emergency publication. Select tomorrow to show the approved plan.
