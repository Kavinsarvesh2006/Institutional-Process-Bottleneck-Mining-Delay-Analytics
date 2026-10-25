# Verification record

Verified on 22 October 2026 using Windows, Python 3.12.14 and Node.js 24.14.0. This describes measured checks on the delivered application, not a claim that it has been validated against real institutional data.

## Completion update — 24 October 2026

The final source passes **60 backend tests** with **99.47% service coverage**. The D: drive copy passes **8 frontend tests**, TypeScript checking, the Vite production build and ESLint. New regression checks cover uploaded workflow selectors/settings, unconfigured conformance, custom terminal activities, repeated ideal steps, non-finite settings and the no-closed-cases SLA display. Case pagination and prediction/simulation state now reset when the dataset, filters or institution settings change.

The production build was run successfully from `D:\mini project\FlowLens\frontend`; an earlier attempt under the restricted C: workspace could not read a parent directory during configuration bundling. The final build uses the intended installed location. Backend tests emitted one upstream test-client deprecation warning plus two sandbox cache-write warnings; all assertions and coverage passed.

Live HTTP verification from the installed D: drive application passed on 24 October: health, frontend status 200, 15 analytics endpoints, prediction, simulation and both exports. The sample contains 3,200 cases; 50% Principal queue reduction avoids 235 breaches. The PDF response is 6,315 bytes and the case CSV contains 3,200 data rows. The cold overview took 0.9247 seconds for the demo dataset. Recorded timings and outcomes are in `final-runtime-check.json`; the separate 50,000-event benchmark remains documented below.

The browser interaction evidence below is from 22 October. Browser automation access was blocked by its URL policy during this completion pass, so the final visual changes were checked with server-rendered UI regression tests and the production build. A fresh interactive browser recheck is not claimed.

## Automated checks

| Check | Result |
| --- | --- |
| Backend pytest | **60 passed** |
| Service statement coverage | **99.47%** |
| Frontend Vitest | **8 passed** |
| TypeScript + Vite production build | **Passed** |
| ESLint, including no explicit `any` | **Passed** |
| Python dependency consistency (`pip check`) | **No broken requirements** |
| npm dependency audit after patch updates | **0 vulnerabilities reported** at verification time |
| Planted ground-truth detection | **5 of 5**, minimum requirement 4 |

The latest Python test run has one upstream test-client deprecation warning about future migration from httpx to httpx2. All endpoint and export assertions pass. This warning does not affect the application server.

Reproduce with `python run.py test`, `python run.py build`, and `npm run lint` in frontend. Coverage HTML is in `coverage/index.html`. Direct Python pins, a resolved Python lock and the npm lockfile are included. The audit result is a point-in-time registry check, not a security guarantee.

## Detection evidence

The ground-truth test measures data rather than comparing known labels:

1. HOD mean incoming queue exceeds 20h and ranks in the top two activities.
2. Office Clerk B mean Office Processing service / Clerk A service exceeds 2.5×.
3. Fee Receipt reworked-case proportion is between 18% and 32%.
4. More than 95% of Principal Approval starts are on Thursday and mean queue exceeds 48h.
5. May–June closed-case mean cycle exceeds January–April by at least 20%.

All five pass with seed 34. The default dataset has 3,200 cases, 14,692 accepted events, 32 removed duplicates, 110 open traces, a 15.4369% closed-case breach rate and a mean closed-case cycle of 87.7129h. Reference response data is saved in `reference-results.json`.

## API integration

Tests exercise every required analytics GET route, both prediction/simulation mutations, dataset seeding/upload, settings save, case search/pagination/detail, PDF export and CSV export. Checks include missing datasets, invalid date windows, no matching cases, range validation, malformed CSV schemas, invalid UTF-8, file row limits, duplicate events, missing/invalid dates, reversed intervals, overlapping activities, conflicting metadata and formula-like CSV values.

Settings tests verify immediate cache invalidation, changed working-hour results, stable pseudonymous labels and rejection of invalid weights, paths, holidays and SLA targets. Prediction checks validate available features, non-empty chronological holdout, both class requirements, unknown-category rejection and bounded risk probabilities.

## Performance

`backend/benchmark.py` creates an isolated temporary SQLite database with **50,411 accepted events / 11,000 cases**, then measures the cold shared snapshot followed by warm endpoints. It does not modify the demonstration dataset.

Initial measured timings on this machine:

| Endpoint | Seconds |
| --- | ---: |
| Overview, first shared snapshot (cold) | 1.6019 |
| Process graph | 0.0797 |
| Variants | 0.0034 |
| Conformance | 0.0035 |
| Activity bottlenecks | 0.1136 |
| Resource bottlenecks | 0.1534 |
| SLA breakdown | 0.0686 |
| Trend | 0.0034 |
| Heatmap | 0.0028 |
| Root-cause table | 0.2935 |
| Workload queue | 0.0520 |
| Recommendations | 0.0034 |
| Model training + holdout metrics | 0.7578 |

The final dependency-set rerun is saved as `performance.json`. All measured endpoints remained below the two-second target in the initial run. Hardware, larger numbers of unique resources, pathological trace lengths and simultaneous clients can change results. The default single-user workload is the intended scope.

## Browser checks

Verified with the real React UI against the running FastAPI service:

- All nine screens display data from the sample API.
- Process-map node drawer, ideal-path checkbox, frequency slider (0% → 100% changes four Fee Receipt transitions to one), and fit view.
- Resource ranking switch and queue/service table values.
- Delay gauge, percentile table, heatmap, queue chart and association table.
- Variant filter shows only deviations.
- Search `BON-2026-0001`; open and close its service/queue timeline using keyboard Escape.
- Prediction returns a 51.2% moderate risk for Bonafide / AI & DS / Monday / 8h first queue.
- Principal Approval simulation at 50%: 87.7h → 69.6h cycle, 15.4% → 7.8% breach, 235 avoided breaches.
- Malformed CSV uploaded through the actual browser file chooser produces a missing-column receipt without crashing or changing the active dataset.
- Light and dark mode at 1366×768; 390×844 mobile layout and navigation drawer; no page-level horizontal overflow in the mobile overview.
- Source changes followed by a fresh browser reload; no console errors during the final overview/map verification. React Flow produced a non-fatal container-size warning during screenshot resizing; the map rendered and interacted correctly afterward.

Screenshots are in `screenshots/`. Charts disable entrance animations so resizing and exported screenshots do not capture empty intermediate plots. Fonts are packaged locally and the UI has no external asset requests.

## PDF

The live endpoint returned a valid PDF, tested by header, content type and size. The included sample report was rendered with Poppler and visually inspected: two pages, readable vector charts, aligned KPI table, full recommendation evidence and page numbers. The local Poppler build reports fallback-font warnings for Symbol/ArialUnicode while rendering, but the inspected report has no missing text or clipped content.

## Scope limits

This is a complete local academic demo, not a deployed multi-user approval system. Explicit terminal activity conventions, missing-log assumptions, synthetic model validation and fixed-duration simulation limits are documented in the README and algorithms guide. No real-world accuracy, staff causation, guaranteed impact or production deployment is claimed.

## Completion update — 25 October 2026

The portable launcher now falls back to a forced child-process shutdown if graceful cleanup times out, so a child-process error is not hidden by a second cleanup traceback. Fresh verification on the prepared D: copy passed: 60 backend tests with 99.47% service coverage, 8 frontend tests, ESLint, and the TypeScript/Vite production build. Live checks returned HTTP 200 for the UI and API health endpoint; all 15 analytics endpoints, prediction, simulation, CSV export (3,200 cases), and PDF export passed. The current local demo is running at http://127.0.0.1:5173.
