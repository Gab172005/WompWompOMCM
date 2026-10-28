# Using OMCM

OMCM supports mobile clinic planning in Laguna. A **barangay** is a local
community within a city or municipality; an **LGU** is a local government unit.

## Explore the map

Search for a municipality or barangay, then choose a result to open its details.
Use **Map details** to show or hide hospitals, fixed clinics, and mobile clinics.
The legend explains colors and symbols. **Map settings** selects OpenStreetMap
or an optionally configured Google Maps basemap.

On phones, details appear in a bottom sheet. Tap its handle or swipe it to change
its height; close it to return to the map. On a keyboard, `/` focuses search when
you are not typing. Tab moves between controls and shows their focus indicator.

## Public View

Public View lists nearby facilities and published clinic visits. **Clinics today**
uses the Philippine date; choose another announced date to see upcoming visits.
Open a visit's details for its location, hours, services, and planned service area.

An empty schedule means no visit has been published for that date. Hospital
listings remain available. Distances are straight-line estimates, and source bed
counts do not show current availability. Emergency revisions appear as notices.

## Plan and publish clinics

1. Choose **Admin View** and sign in with the account configured by the deployment owner.
2. Open **Plan clinics**. Set the fleet size, daily appointment capacity, and travel limit.
3. Optionally select flood restrictions or exclude modeled connections.
4. Generate recommendations and review locations, capacity, and estimated demand.
5. Approve a date, operating hours, and services to publish a visit.

Generating recommendations saves a private plan; it does not publish a schedule.
Under **Saved plans & deployments**, **Plans** reopens saved allocations with
their settings. **Deployments** shows published dates and their recorded locations
on the map. Reviewing a plan never changes a published visit.

Normal booking covers tomorrow through seven days from today. The demand model
forecasts the next day; later bookings reuse that estimate and need local review.
An old forecast must be regenerated before publication. Same-day or replacement
arrangements require an emergency override, a public notice of at least ten
non-whitespace characters, and explicit confirmation.

Flood options select 25-year or 100-year mapped screening layers. These mean
approximately 4% or 1% annual probability, not a countdown or a water depth.
They exclude flagged candidate locations and model connections. Blue outlines
identify screened barangays, not exact inundation boundaries. The travel limit
caps estimated patient travel to a proposed clinic; it is not a healthcare-need
weight or a live traffic estimate.

## Compare clinic scenarios

Open **30-day simulation** to compare three scenarios on one shared clock:

| Scenario | What changes |
| --- | --- |
| No intervention | Simulated illness pressure increases without clinic service. |
| Manual | Your selected clinics reduce estimated need in their host communities and reachable neighbors. |
| Optimized | The backend proposes multiple clinic locations using the same capacity and service rules as Manual. |

Use **Play** or **Next day** to advance. Playback pauses at weekly decision
windows starting on Days 1, 8, 15, and 22. The timeline reviews reached days;
placements remain until replaced. Read **Scenario activity** and comparison
results alongside the map. Draft markers distinguish proposed from applied clinics.

**Return to Day 1** rewinds the view without deleting history. **Reset simulation**
asks for confirmation, clears all three practice runs, and returns them to Day 1.
It retains fleet size, conditions, selected scenario, map metric, and speed.
Neither action changes published schedules. Simulation runs do not survive reload.

Lower HNI means less modeled need. More areas reached alone does not guarantee a
lower overall score: population, existing need, distance, and capacity also matter.
Optimization is compared with the supplied feasible manual plan on the selected
day. A plan can perform differently on later days as demand changes.

## Assistant

**Ask OMCM** finds places, explains displayed information, and opens supported
map tools. Administrator-only information requires Admin View. The assistant
cannot sign in or publish a schedule for you.

Closing the assistant preserves its current conversation and unfinished message;
changing identity/view or starting a new conversation clears them. Enter sends a
message on desktop; Shift + Enter adds a line break. Optional external responses
need server configuration; supported local commands work without a provider key.
