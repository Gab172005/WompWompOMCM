# Map workspace UI refinement

The interface retains the completed simulation HNI correction and refines the
active map workspace; it does not change
scoring, deduction formulas, model artifacts, source data, authentication,
publication policy, or backend contracts. Existing unmounted legacy pages were
left alone. All administrator tools stay on the same map.

## Design direction and audit findings

The reference is the map-first hierarchy of [Google Maps](https://blog.google/products-and-platforms/products/maps/google-maps-updates-summer-travel-2024/):
a stable search anchor, compact contextual controls and readable place sheets.
[Material typography](https://m3.material.io/styles/typography/applying-type)
and [motion guidance](https://m3.material.io/styles/motion/overview/how-it-works)
informed consistent emphasis and brief feedback. This is a custom plain-CSS
implementation using the existing React and Lucide stack, not an imported UI kit.
OMCM keeps a teal care accent, blue actions and a restrained cool-neutral surface
palette. Heatmap colors retain their existing data meaning.

| Finding | Refinement |
| --- | --- |
| Paired input labels wrapped differently, staggering control baselines | Align grid fields at their lower edge; use shared control heights and spacing. |
| Search, tools and sheets used disconnected hard-coded widths | One desktop panel-width token aligns search, sheets, tools, playback and legend; a tablet width variant preserves map space. |
| Tiny metadata and repeated headings made details hard to scan | Raise useful supporting text sizes, establish a common title/metric hierarchy, simplify public copy and remove duplicate place titles. |
| Native clinic menus exposed hundreds of options | Searchable, keyboard-accessible location picker with municipality context, selected state, unavailable-site handling, empty results and capped result rendering. |
| Dropdowns could be clipped by scrolling sheets | Portal-based positioning flips above the field, follows scrolling/resizing, observes field size and respects the visible viewport. |
| Obsolete phone clock rules could override the compact layout | Consolidate phone/tablet playback into one six-control row and verify content fits inside its card. |
| Mobile panels, playback and legend filled competing vertical bands | Bottom-docked sheets with explicit expand/reduce/collapse controls, a real tap/swipe handle, compact phone/tablet playback and contextual map controls. Short landscape windows also support reading expansion. |
| Optimized simulations showed unusable editing dropdowns | Present generated locations as a read-only proposal and one Apply action; keep Manual editable. |
| Explanatory simulation text crowded primary results | Group comparison methodology into a disclosure; preserve an explicit notice when manual comparison locations change. |
| Login had excessive spacing and no way to inspect typing | Compact scrollable dialog, predictable form rhythm, password visibility control and a proper loading indicator. Credentials are unchanged. |
| Assistant closing could target a hidden mobile launcher | Restore focus to the visible trigger that opened it; retain the conversation, Escape dismissal and drag-position clamping. |
| Motion and button states varied | Shared entrance/feedback timings, focus rings, native short selects with a consistent chevron, clearer loading icons and reduced-motion support. |

The mobile resize grip is functional: tap or swipe up to expand; swipe down to
reduce. Tool sheets can additionally collapse to their heading. Body scrolling
remains native, and a collapse does not clear clinics, stop time history or
replace the underlying map. Expanded reading sheets suppress competing mobile
map controls. Selected-place summaries take priority over the compact legend;
the Map details control remains available above the normal sheet.

## Exact changed files and logic

Paths are relative to `omcm/`. Changes refine the existing group implementation.

| File | Change |
| --- | --- |
| `frontend/src/styles/map-workspace.css` | Replace the previous shared override section with consistent tokens, typography, aligned controls, native-select chrome, disclosures, picker styling, modal layout, mobile sheet/playback/control bands and reduced-motion rules. Preserve map data colors. |
| `frontend/src/styles/assistant.css` | Match floating-card surfaces, message hierarchy, prompts, composer, buttons and responsive assistant placement to the map workspace. |
| `frontend/src/components/ui/SearchableSelect.tsx` (new) | Add a controlled searchable location picker, keyboard selection, disabled-option guards, viewport-safe portal, dismiss/reset behavior and resize/scroll observation. No free-text location is committed. |
| `frontend/src/components/ui/SearchableSelect.test.tsx` (new) | Verify accent-insensitive search, keyboard and preselected-value changes, duplicate-selection suppression, unavailable sites, dismissals and disabled state. |
| `frontend/src/components/ui/SheetHandle.tsx` (new) | Add a keyboard/tap target and pointer swipe surface for mobile sheet expansion/reduction without intercepting body scrolling. |
| `frontend/src/components/layout/AppLayout.tsx` | Add presentation-only sheet-height state, resize affordances and keyed content entrance; retain the existing map instance and panel-state navigation. |
| `frontend/src/components/layout/SidePanel.tsx` | Reuse the mobile sheet handle with the existing place-details expansion state. |
| `frontend/src/features/public/PublicSidePanel.tsx` | Add the sheet handle, remove repeated place headings and redundant search guidance, use a consistent back icon, and simplify visitor-facing empty-state copy. |
| `frontend/src/features/public/PublicVisitSummary.tsx` | Expose refresh busy state for the shared loading feedback. |
| `frontend/src/features/auth/AdminLoginModal.tsx` | Add password visibility and loading feedback; clear visibility on cancel/success without changing credentials or sign-in validation. |
| `frontend/src/features/optimization/ManualPlacement.tsx` | Replace separate search/native site controls with the shared searchable picker; retain real backend replanning and existing eligibility/duplicate-site restrictions. |
| `frontend/src/features/optimization/OptimizationPanel.tsx` | Shorten introductory copy and use a loader while the unchanged planning request is pending. |
| `frontend/src/features/simulation/SimulationPanel.tsx` | Use searchable Manual locations, remove redundant disabled optimizer editors, retain proposal Apply, and group comparison explanations while preserving changed-comparison notices. No HNI math changed. |
| `frontend/src/features/simulation/SimulationPlayback.tsx` | Add an accessible next-day icon variant for compact mobile playback, preserving timeline and busy guards. |
| `frontend/src/features/chatbot/AssistantWidget.tsx` | Restore focus to the opening control, support Escape, clamp saved positions on mount/resize and align header context. |
| `frontend/src/features/chatbot/ChatbotPanel.tsx` | Give the empty state a clearer hierarchy and add consistent message/stop icons without changing assistant actions. |
| `frontend/scripts/workspace-ui-browser.mjs` (new) | Audit real connected public visits/authentication and responsive UI, picker behavior, tap/swipe resizing, map persistence, modal, layers, assistant focus and reduced motion; capture screenshots. |
| `frontend/scripts/hospital-hni-browser.mjs` | Check selected-place/mobile sheet priority and retained search geometry instead of the former stacked legend layout. |
| `frontend/scripts/simulation-browser.mjs` | Select through the searchable UI and verify the new mobile legend/sheet/playback ordering and read-only optimized proposal. |
| `frontend/scripts/optimization-browser.mjs` | Replan through a visible picker option, use a dedicated test port and preserve diagnostics if a pending network observation fails. |
| `frontend/scripts/assistant-browser.mjs` | Reopen through the visible Planning help toolbar when simulation intentionally hides the mobile launcher. |
| `frontend/package.json` | Add `npm run test:ui`; no dependencies or libraries added. |
| `README.md` | Link to this design/change inventory. |
| `docs/UI_REFINEMENT.md` (this file) | Record audit decisions, exact file/logic changes, visual coverage and review steps. |
| `docs/VERIFICATION.md` | Record the current checks and local evidence boundaries. |

## Browser review

Run the existing backend and `npm run dev` in `frontend/`, then open
`http://127.0.0.1:5173`:

1. Search a municipality or barangay; inspect the search results, selected-place
   status, care/source disclosures and public approved-visit cards.
2. Sign in using the existing account. Inspect Plan clinics fields; generate a
   real plan, then search for a different location in a Replan site field.
3. Open 30-day simulation. Search by barangay, municipality or site identifier
   in Manual; use arrows/Enter or click a result. Optimized proposals are
   read-only until Apply and retain their existing backend HNI calculation.
4. At phone widths, tap/swipe the sheet grip, use the height/collapse controls,
   and confirm the timeline and map remain available. Expand a sheet for reading.
5. Open Planning help, type a message, close with Escape and reopen. Check focus,
   retained messages, mobile composer and viewport-bounded draggable launcher.
6. Inspect Map details, legend expansion, map settings and the sign-in dialog.
   Enable reduced motion to inspect the non-animated equivalent.

`npm run test:ui` starts isolated connected servers and writes ignored
`frontend/test-results/ui-*.png` artifacts for desktop, tablet, phone and landscape
states. It uses temporary test credentials/storage, not the configured user's
account or real public schedules. The other connected suites continue to verify
actual optimization, service deductions, publication and public refresh.

Live visual review uses Chrome/Leaflet. The optional Google renderer retains its
existing unit coverage, but no live Google key or physical mobile keyboard/device
session was used. Basemap tiles are suppressed in screenshots for deterministic
checks. This pass is local and has not been deployed or pushed.

## Planning explanations and assistant redesign

The information hierarchy follows the persistent map and contextual sheets of
Google Maps. The disclosure treatment also draws on [Carbon’s accordion guidance](https://v10.carbondesignsystem.com/components/accordion/usage/):
short summaries, aligned reading edges and trailing expansion indicators. This
is implemented with native HTML and existing CSS/Lucide, without importing a UI
library. The palette uses slate text, cool white surfaces, teal care accents and
blue actions. HNI, flood and clinic map colors keep their original meanings.

- **Explanations:** `DisclosureCard.tsx` supplies a keyboard-operable native
  disclosure with an icon, concise title, descriptive caption, optional count
  and trailing chevron. Descriptions are linked for assistive technology; focus
  stays visible inside the card boundary.
- **Clinic planning:** `OptimizationPanel.tsx` replaces one dense paragraph with
  a three-step explanation of need, prediction and allocation. Flood likelihood
  cards distinguish 4%/1% annual chances from the exclusions made by the selected
  layer. API values, form validation and constraints are unchanged.
- **Access restrictions:** `RoadExclusions.tsx` adds searchable, selected-first
  rows, explicit inclusion/exclusion feedback, empty results, a clear action and
  pagination in groups of 20. Searching never clears exclusions. The existing
  `closed_roads` IDs still reach the same backend configuration.
- **Simulation:** `SimulationResults.tsx` presents each scenario’s same-day
  metrics as a readable card instead of a wide table, and separates clinic
  history into a deployment timeline. `SimulationPanel.tsx` uses the shared
  disclosure for conditions and methodology. No metrics or deductions change.
- **Assistant:** `ChatbotPanel.tsx` puts actionable shortcuts in the scrollable
  welcome area, with different public/admin tasks. It removes repeated welcome
  text and oversized prompt buttons. The compact composer grows to 144 px,
  preserves Enter/Shift+Enter and IME handling, exposes Send/Stop labels and
  retains the existing conversation/provider pipeline. `AssistantWidget.tsx`
  sizes the sheet to the visual viewport so a mobile keyboard does not cover
  the composer; Escape and close still restore focus.
- **Shared styling:** `map-workspace.css` owns disclosure, comparison, timeline,
  search and responsive layouts. Sheet shells clip overflow without becoming
  extra scroll containers, so focusing a deep field keeps the header in place.
  Explicit grid/padding rules prevent older
  global styles from squeezing comparison labels or overlapping search icons.
  `assistant.css` consolidates the assistant skin rather than stacking another
  set of conflicting overrides. Existing reduced-motion preferences apply.
- **Identity:** `frontend/public/omcm-icon.svg` is an original mobile clinic and connecting route
  mark. `favicon-32.png` and `apple-touch-icon.png` provide raster variants;
  `frontend/index.html` links them and uses a descriptive application title.

### Additional verification

`frontend/scripts/workspace-ui-browser.mjs` checks native disclosure keyboard
activation, access search/no-match/reset behavior, expanded planning sections at
390/320 px, same-day comparison cards, public/admin assistant shortcuts, bounded
composer growth, visual-viewport keyboard geometry and icon responses. It also
retains the earlier checks for one persistent map, approval/public care,
responsive sheets, real catalog loading, playback, focus restoration and reduced
motion. Screenshots are saved in the ignored `frontend/test-results/` directory.

Reviewed sizes include desktop 1440 px, tablets 1024/768 px, phones 390/320 px and
844 × 390 landscape. Keyboard geometry is simulated through the browser’s visual
viewport; no physical iOS/Android keyboard session is claimed. Optional live
Google Maps rendering still requires a configured key.

## Public care and conversation experience

Public View follows the same restrained slate/teal surfaces and trailing-chevron
patterns as the administrator panels. Its information order is published visits,
selected-community context, clinic locations, nearby hospital evidence and visit
guidance. Source evidence stays available without wrapping every paragraph in
another heavy card. Blue remains an action/focus color rather than the default
color for explanatory text.

| Files | Behavior changed |
| --- | --- |
| `frontend/src/features/public/PublicVisitSummary.tsx` | Replace the extra-date dropdown with a scrollable date rail covering today and every actual published future date. Hide the date selector when there is no choice. Format dates in Philippine time, retain outage/stale feedback and preserve the approved-schedule store. |
| `frontend/src/features/public/PublicSidePanel.tsx` | Flatten community/hospital nesting, prioritize clinic locations, simplify empty states, add a contextual nearest-visit action and move visit guidance into a shared disclosure. |
| `frontend/src/features/public/PublicClinicCard.tsx` | Show visit location, hours and services before expandable capacity/service-area information. Label the existing dialog trigger accurately. |
| `frontend/src/features/tracking/ClinicDetails.tsx` | Refine the public visit dialog, including emergency notices, readable services and planned capacity; leave the administrator detail branch intact. |
| `frontend/src/features/chatbot/ChatbotPanel.tsx` | Ground public shortcuts in the selected community using the existing validated local tools. Preserve reading position when responses arrive, offer a latest-message action, hide empty response bubbles and allow safe user-initiated retries. Avoid automatically opening the mobile keyboard. |
| `frontend/src/features/chatbot/ChatMessage.tsx` | Separate response text from expandable map-action receipts. Add copy confirmation/failure feedback and a retry control supplied only for the latest failed turn without completed actions. |
| `frontend/src/features/chatbot/AssistantWidget.tsx` | Use the new project mark and allow the mobile sheet to receive focus without focusing its text field. Preserve close/Escape, drag and viewport behavior. |
| `frontend/src/styles/map-workspace.css` | Add the public reading hierarchy, date rail, visit dialog, clinic/service rows, responsive evidence layout and neutral supporting text. |
| `frontend/src/styles/assistant.css` | Style response tools, action receipts, error feedback, progress and latest-message controls, with mobile touch targets and reduced motion. |
| `frontend/public/omcm-icon.svg`, `favicon-32.png`, `apple-touch-icon.png`; `frontend/index.html` | Replace the generic pin mark with an original mobile-care vehicle following a connecting route. Refresh raster variants and version icon URLs. |
| `tests/frontend/publicVisits.test.tsx` | Verify selection of every published date, clinic selection and absence of planner explanations in the public card. |
| `frontend/src/features/chatbot/ChatbotPanel.test.tsx`, `ChatMessage.test.tsx` | Verify grounded public shortcuts, privacy, retry restrictions and truthful clipboard feedback. |
| `frontend/scripts/workspace-ui-browser.mjs` | Exercise public clinic cards/dialogs at desktop, phone and landscape sizes using real published test visits. |
| `frontend/scripts/assistant-browser.mjs` | Exercise delayed replies while reading older messages, jump-to-latest and recovery from a provider error. |
| `frontend/scripts/optimization-browser.mjs` | Expand the new visit-information disclosure before checking assigned service communities. |

The public action still selects the approved clinic marker and opens the existing
native visit dialog. It does not publish, route to an administrator page or show
private optimization scores. Planned appointment capacity is never described as
a live count of available slots. All schedule data and publication permissions
retain their existing backend source.

Both READMEs document the hosted demonstration credentials supplied by the
project owner. This documentation does not change backend credentials or verify
the current remote deployment. No model, HNI policy, data schema or database
migration is part of this refinement.

## Legend, scenario selection and playback

This interaction pass keeps the map, calculations and native controls intact
while making frequently used panels easier to scan.

| File | Refinement |
| --- | --- |
| `frontend/src/features/map/components/MapLegend.tsx` | Separate map symbols from data/guidance using two in-place controls. Replace the long explanation with labeled facts; format snapshot dates in Philippine time while retaining machine-readable timestamps, source tags, credit and license. Make the scroll area keyboard-focusable. Observe resized legend content so a dragged legend remains inside the viewport, and handle pointer cancellation. |
| `frontend/src/features/simulation/SimulationPanel.tsx` | Replace narrow comparison columns with aligned scenario rows, distinct icons, clear selected-map feedback and a shared reading guide. Simplify repeated scenario context. All three choices fit normal phone sheets; detailed numeric impacts remain in results and comparison details. |
| `frontend/src/features/simulation/SimulationPlayback.tsx` | Align the six controls, add week context and weekly timeline marks, style the filled track and improve range value text. Replace the long native play tooltip with a short label plus an accessible behavior description. Keep seek, playback speed, pause windows and clinic state unchanged. |
| `frontend/src/features/optimization/RoadExclusions.tsx` | Present endpoint names once with municipality context, simplify exclusion instructions, add accent-insensitive search and an excluded-only filter, and preserve existing connection IDs and exclusion callbacks. Use a set for selection lookups. |
| `frontend/src/features/optimization/RoadExclusions.test.tsx` | Verify accent-insensitive discovery, selection retention while searching, excluded-only filtering and clearing IDs/filter state. |
| `frontend/src/styles/map-workspace.css` | Refine borders, hover/focus cues, selected states, disclosure hierarchy, timeline controls, legend scrolling and mobile sizing. Expanded legends stay clear of desktop toolbar controls; phone guidance uses the available sheet width. Motion remains brief and respects reduced-motion preferences. |
| `frontend/scripts/workspace-ui-browser.mjs` | Exercise legend symbol/guidance views, source timestamp presentation, keyboard scrolling, drag/clamping/reset, minimize/restore and expanded phone layouts. Assert that all three scenario choices fit a 320 px phone sheet and playback contents stay within their own card. |

No source data, HNI percentages, clinic deductions, XGBoost artifacts, placement
objectives, backend endpoints, authentication or publication permissions change.
The public legend still omits private planning scores. All tool changes retain
the same map screen and DOM map instance.

## Transparent identity and map discovery

The original care-waypoint mark combines a medical map pin with branching
routes to two communities. The medical cross is a transparent cutout, and no
background rectangle is painted. Browser-ready variants include SVG, 32/96 px PNG, a 180 px touch icon
and a multi-resolution ICO containing 16/32/48/96 px frames. The 96 px PNG and
root ICO have stable URLs. Browser SVG/32 px/touch links use the refreshed asset
version so older icon responses can be replaced.

The site supplies its favicon files; a search engine controls its own result
presentation and cache. A newly deployed icon may appear in search only after
recrawling/processing. See [Google’s favicon guidance](https://developers.google.com/search/docs/appearance/favicon-in-search).
The icon does not require a backend or a map-provider key.

| Files | Behavior changed |
| --- | --- |
| `frontend/public/omcm-icon.svg`, `favicon-32.png`, `favicon-96.png`, `apple-touch-icon.png`, `favicon.ico`; `frontend/index.html` | Replace the painted vehicle badge with the original care-waypoint mark and transparent cross, generate raster/ICO variants and declare the browser/search icon resources. |
| `frontend/src/components/layout/MapControls.tsx` | Give Public View direct assistant access, retain administrator access in the search bar, make help buttons reflect/toggle actual assistant state and provide compact visual labels without changing accessible tool names. |
| `frontend/src/components/layout/FloatingControls.tsx` | Separate the fixed popover heading from scrollable controls, focus an active input on opening, and handle Escape locally with focus restoration. |
| `frontend/src/features/filters/HeatmapSelector.tsx` | Present native radio choices with previews generated from the same color function used by the map. Preserve the metric IDs and state contract. |
| `frontend/src/features/filters/LayerToggles.tsx` | Present independent facility checkboxes as descriptive, color-coded controls, distinguishing published public clinics from administrator drafts. |
| `frontend/src/features/filters/FilterControls.tsx` | Hide inactive baseline metric choices during simulation and direct users to its actual HNI/uncovered-need control. Keep private metrics out of Public View. |
| `frontend/src/features/municipalities/MunicipalitySearch.tsx` | Add a slash shortcut that focuses/selects search while respecting editors, modifier keys and open dialogs. |
| `frontend/src/features/chatbot/AssistantWidget.tsx`, `ChatbotPanel.tsx` | Keep unfinished input in widget memory through close/reopen, clear it on identity/view changes and new conversation, and restore the bounded textarea height. Existing message execution, cancellation and privacy controls remain. |
| `frontend/src/styles/map-workspace.css` | Fit every tool and layer chip into phone-width navigation, refine the floating layers trigger and build responsive color/facility controls with hover, checked and keyboard-focus feedback. Remove the obsolete community stripe and duplicate separators; align public facts and empty-state content on the same reading edge. Respect reduced motion. |
| `frontend/src/components/layout/MapControls.test.tsx`, `frontend/src/features/filters/FilterControls.test.tsx` | Verify assistant toggle/state feedback, metric/visibility state changes, public restrictions and simulation-context controls. |
| `frontend/src/features/chatbot/AssistantWidget.test.tsx`, `tests/frontend/searchSelection.test.tsx` | Verify draft retention/clearing and search-shortcut focus without taking typing keys from an editor. |
| `frontend/scripts/workspace-ui-browser.mjs` | Decode icon resources and check nonempty artwork with transparent backgrounds, verify tool/chip bounds at 390/320 px, use native radio keyboard changes, check public layer privacy and retain the earlier connected map workflows. |

The mobile tool row no longer hides the assistant beyond a horizontal scroll.
All five administrator layer chips remain visible. These changes reuse existing
React, plain CSS, Lucide icons, stores and authentication; they introduce no
new library, dataset, schema, score weight, model artifact or placement rule.

### Public community details

A selected community now has one place heading, an explicit **All Laguna**
action and a two-column definition list for residents and households. The
population values still come from the supplied community dataset. A single
published-visit section explains an empty date; the panel no longer repeats a
second “no clinic” message or labels an unavailable nearest clinic. While the
service is checking, it preserves the checking state instead of claiming that
no visits exist. When a published location is available, the nearest-visit
button still opens its existing approved-clinic dialog.

| Files | Behavior changed |
| --- | --- |
| `frontend/src/features/public/PublicSidePanel.tsx` | Consolidate duplicated place information, present labeled resident/household facts, clear selection through the existing store action and render nearest-clinic details only for an actual published visit. Preserve public hospital access and approval-only data. |
| `frontend/src/features/public/PublicVisitSummary.tsx` | Group the empty-date message with a calendar symbol and readable supporting copy. Retain refresh, delayed-update feedback and published-date selection. |
| `tests/frontend/publicVisits.test.tsx` | Verify Casile’s supplied facts, one truthful empty state, hospitals remaining available, selection reset and no false empty claim while service status is unknown. |
| `frontend/scripts/workspace-ui-browser.mjs` | Exercise Casile’s empty/public care panel at 1440/390/320/844 px, check heading insets, facts and overflow, and capture hospital reading layouts. |
| `../README.md` | Update the logo’s alternative text to describe the new care-waypoint identity. |

The public panel continues to use the same map instance. No additional request,
publication permission, routing, HNI calculation or model input is introduced.

## Map experience finishing pass

Work continues on `feat/omcm-maps-experience-polish`, created directly from
`aa800a2`. It includes the two previously unpushed commits (`b416f3d` and
`aa800a2`); publishing this new branch includes those changes automatically.
The earlier branch does not need a separate push or pull request.

The design retains [Google Maps’ focus on readable place information](https://blog.google/products-and-platforms/products/maps/google-maps-updates-summer-travel-2024/)
and uses [Carbon’s slider anatomy](https://www.carbondesignsystem.com/building-blocks/core/components/slider/guidelines)
as a reference for separating captions, controls and value labels. These are
custom refinements to the existing CSS and native controls, not imported design
libraries. Teal signals care and active planning tools; data-layer and selected
boundary colors keep their original meanings.

### Alignment and interaction decisions

- An inherited 15 px bottom margin on labels was shifting the speed control
  7.5 px off center. Scoped label-spacing resets remove that mismatch from
  playback, panels and layer controls without restyling the legacy pages.
- The playback caption sits above a single control row. Play, reset, slider,
  day/week output, next-day action and speed all share the same vertical center.
  Tick labels sit below the rail, and the legend leaves a visible gap above
  playback. On phones and tablets, the caption/ticks give way to larger usable
  control targets in the existing compact card.
- Playback exposes its actual playing, paused, updating or complete state.
  Seeking still revisits reached days through the existing shared store;
  advancing still uses Play or Next day and respects weekly placement windows.
- The minimized legend uses balanced padding, restrained type and an aligned
  expand action. Position reset, drag, resize clamping and map data are unchanged.
- Map settings puts the active provider first, with native radio cards for the
  existing engine choices. Optional browser-key setup moves into a disclosure.
  Existing key storage, fallback, clear and reload behavior are unchanged.
- Fleet size has an explicitly associated label/value and visible 1–5 scale, using the original native
  range and the same draft invalidation callback. Municipality rows align rank,
  community name and score in fixed columns without changing ranking math.
- Empty assistant conversations open at the top; starting a new conversation
  clears stale jump-to-latest feedback. Existing reading-position preservation
  still applies after messages arrive.
- Public visit cards, map search, form fields, hospital popups and the assistant
  share consistent reading edges, surface shapes and feedback. Noninteractive
  information is not styled as an action. Hover motion is limited to fine
  pointers; touch and keyboard focus remain usable. Reduced-motion preferences
  suppress entrance movement and hover/press transforms.
- Tablet tools show their compact labels together instead of hiding the last
  action in horizontal overflow. Desktop panel expansion remains limited to
  its intended viewport rules, preventing a selected-place summary from
  covering a sheet heading.

| File | Exact change |
| --- | --- |
| `frontend/src/features/simulation/SimulationPlayback.tsx` | Separate playback status/caption from the aligned control row; clarify the existing history-seeking behavior for assistive technology. Keep timing, seek, speed and advancement callbacks. |
| `frontend/src/features/map/components/LagunaMap.tsx` | Group actual map-provider status, replace the engine select with native radio choices and put optional key setup in a shared disclosure. Preserve map rendering and all storage/fallback behavior. |
| `frontend/src/features/optimization/ClinicCountInput.tsx` | Add a labeled output, correct singular/plural units, progress styling and a 1–5 scale to the existing range. Preserve invalidation and fleet state updates. |
| `frontend/src/features/municipalities/MunicipalityRanking.tsx` | Add section/column context and stable hooks for aligned place-name rows. Preserve ordering, shared ranks, scores and selection actions. |
| `frontend/src/styles/map-workspace.css` | Rework the playback geometry; refine minimized legend, tablet tools, map/provider surfaces, controls, rows, popups, hover/press/focus feedback and reduced-motion behavior. |
| `frontend/src/features/chatbot/ChatbotPanel.tsx` | Start empty/reset conversations at the top and reset latest-reply feedback, while retaining reading position for existing conversations. |
| `frontend/src/styles/assistant.css` | Match card elevation and header surface; refine task-icon feedback and composer/send interactions, including reduced motion. |
| `frontend/scripts/workspace-ui-browser.mjs` | Measure all six playback control centers at desktop/tablet/phone/landscape sizes, verify compact-legend alignment/gap, and exercise provider selection and optional-key disclosure across responsive dialogs; use a touch-enabled phone context to verify the public assistant and facility controls. |
| `docs/UI_REFINEMENT.md`, `docs/VERIFICATION.md` | Document inherited commits, exact file/behavior changes, design references and final checks. |

No score weight, XGBoost artifact, allocation objective, simulation deduction,
dataset, API contract, authentication setting or publication permission changes.
The public view still receives only published care information, and administrator
tools continue to open in place on the same map.

## Public-panel alignment and consistent actions

This pass follows the merged map-experience refinement (PR #11). It stays on
`feat/omcm-maps-experience-polish`; its remaining changes can be pushed together
and reviewed in a new pull request targeting `main`.

### Findings and corrections

| Active interface | Review and correction |
| --- | --- |
| Published public visits | Move the “Published visits” caption above the title/action row, so refresh aligns with the actual heading. Use explicit grid rows for the empty-state symbol, title and explanation. Override the older span rule that left the calendar/check artwork off center. Keep checking, empty, published and delayed-update states distinct. |
| Public/Admin controls | Use stable icon hit areas, distinguish sign-out feedback, and provide short hints for pointer and keyboard users. Escape dismisses a hint while retaining focus. Touch activates the existing action directly. Sign-in, view switching and sign-out handlers are unchanged. |
| Map navigation | Reuse those hints for refocus and zoom. Keep zoom-group corners rounded while allowing hints outside the group instead of clipping them. Preserve the original map/store callbacks. |
| Simulation activity/history | Replace the native “Show 25 earlier updates” triangle/text treatment with the shared compact disclosure: history icon, count, actual day range and trailing chevron. Preserve all daily rows, reverse chronological order and history calculations. |
| Optimizer evidence | Reuse compact disclosures for served communities and allocation evidence. Keep assignment counts, modeled travel, solver notes, eligibility and publishing logic unchanged. |
| Other active workflows | Recheck search and selection, layer choices, legend, planning fields, place pickers, approval, assistant, settings and public clinic dialogs through the existing connected browser suites at desktop, tablet, phone and landscape sizes. |

The shared disclosure remains native HTML: Enter/Space toggle it, and all content
stays in the existing panel’s scroll flow. No extra nested scroll area or page
navigation is introduced. Hints supplement accessible control names and do not
replace the controls themselves. Their entrance motion respects reduced-motion
preferences.

| File | Exact change |
| --- | --- |
| `frontend/src/features/public/PublicVisitSummary.tsx` | Separate the caption from the heading/action row and place the empty-state title and explanation in explicit grid cells. Preserve schedule/date/refresh state logic. |
| `frontend/src/components/ui/MapActionButton.tsx` | Add a reusable native button with pointer/focus hints, Escape dismissal and hint cleanup on activation/blur/leave. Forward existing action callbacks and accessible names. |
| `frontend/src/components/layout/MapControls.tsx` | Apply shared hints to details, role switching and sign-out; announce sign-in as a dialog action when required. Keep all existing authentication/navigation callbacks. |
| `frontend/src/components/layout/MapNavigation.tsx` | Apply left-side hints to the unchanged refocus/zoom actions. |
| `frontend/src/components/ui/DisclosureCard.tsx` | Add optional compact presentation and contextual class names to the existing native disclosure. |
| `frontend/src/features/simulation/SimulationResults.tsx` | Present earlier activity with the compact disclosure, its real count and day range. No activity/HNI calculations change. |
| `frontend/src/features/optimization/PlacementRecommendations.tsx` | Use compact evidence/community disclosures around existing backend results. |
| `frontend/src/styles/map-workspace.css` | Correct public alignment and symbol specificity, style hints and role-action feedback, prevent zoom hint clipping, and align compact disclosure/activity elements across viewports. |
| `frontend/scripts/workspace-ui-browser.mjs` | Measure public heading/symbol/text alignment, verify role/zoom hints and Escape, exercise touch sign-in and a full 30-day run with 25 earlier updates, and capture desktop/phone history layouts. |
| `../README.md` | Explain the public/admin entry points, primary map controls, simulation timeline, phone sheets and current transparent project icon. |
| `README.md` | Add the shared icon and current public care, assistant, provider, scenario/playback and history workflows. Preserve setup instructions, hosted credentials and methodology. |
| `docs/UI_REFINEMENT.md`, `docs/VERIFICATION.md` | Record exact changes, covered interactions and verification results. |

Both READMEs describe the interface people see, without development-conversation
step labels. Local links, anchors and image references are checked. The icon
files themselves are unchanged in this pass; the guides now describe the
transparent care-waypoint artwork already used by the website.
