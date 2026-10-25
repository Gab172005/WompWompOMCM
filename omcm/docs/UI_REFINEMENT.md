# Map workspace UI refinement

Branch: `layout/maps-workspace-refinement`, based on the completed simulation
HNI correction. This pass refines the active map workspace; it does not change
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
