# FlowLens — five-minute judge demonstration

**Project:** Institutional Process Bottleneck Mining & Delay Analytics  
**Purpose:** Show how FlowLens turns event-log records into understandable process evidence and testable improvement scenarios.

## Before the judges arrive

- Start the prepared copy by double-clicking **Start-FlowLens.cmd** in `D:\mini project\FlowLens`. Keep its window open.
- Open **http://127.0.0.1:5173** and select **Campus operations · Jan–Jun 2026**. Clear filters and use the default elapsed-hour setting.
- Keep this script nearby. If the live app will not start, use the screenshots in `docs/screenshots/` and the report in `docs/sample-report.pdf` as the backup.
- Say clearly that the included campus event log is **synthetic demonstration data**, not a finding about real college staff.

## 00:00–00:35 | Opening and problem

**Show:** Overview.

**Say:** “Good morning. Our project is FlowLens, an institutional process bottleneck and delay analytics platform. A workflow may look simple on paper, but its event log can reveal how long requests wait between approvals, where rework occurs, and which cases are at risk. FlowLens turns those timestamped events into an explorable process map, delay evidence, and improvement scenarios. Today I’ll use a reproducible synthetic campus dataset.”

**Point out:** The selected dataset and overall case and delay indicators.

## 00:35–01:15 | From event log to process map

**Show:** Process map. Choose **Fee Receipt** and point to the recurring route between Office Processing and Student Correction.

**Say:** “Each row in the input is an activity for a case, with start and end times, role, department, and outcome. FlowLens validates the rows, removes exact duplicate events, and groups the remaining events into case traces. This map is mined from those traces: arrows show observed transitions, and their strength reflects frequency. The loop here makes rework visible instead of hiding it inside a single average.”

**Do:** Click a map node or transition to show its detail. Keep the interaction short.

## 01:15–01:55 | Find and explain the bottleneck

**Show:** Bottlenecks, grouped by activity.

**Say:** “A long total cycle does not tell us where time is spent. We separate queue time between activities from service time within an activity. In this dataset, Principal Approval has about 90 hours of average incoming queue time, while HOD Approval has about 43.6 hours. Percentiles help us see whether delay is typical or concentrated in a long tail.”

**Point out:** Ranking and distribution; mention that a queue ranking is evidence for investigation, not proof of cause or fault.

## 01:55–02:35 | Show a single case and delay patterns

**Show:** Case explorer. Search **BON-2026-0001**, open the case timeline. Then briefly show Delay analytics.

**Say:** “The aggregate view tells us where to look; the case timeline shows how the measurement was formed. Each segment separates waiting from observed service and places the case against its SLA. Across cases, the delay views show trends, percentiles, and time patterns. These are descriptive associations. They do not establish why a particular person or office caused a delay.”

## 02:35–03:40 | Predict risk and test a change

**Show:** Predict & simulate.

**Do:** Submit Bonafide Certificate, AI & DS, Monday, first queue 8 hours. Then run Principal Approval with a 50% queue reduction.

**Say:** “The risk model uses information available early in a case to estimate the chance of an SLA breach. For this example it reports roughly 51% risk. We also show chronological holdout results. Accuracy is about 81%, the same as the majority-class baseline, so we do not claim accuracy improvement over that baseline. Precision and recall give useful context, and these probabilities are for demonstration rather than calibrated operational decisions.”

“Now we can ask a planning question: if the Principal Approval queue were reduced by 50%, what would change while other durations stayed fixed? In this synthetic sample, the estimate moves average cycle time from about 87.7 to 69.6 hours and breach rate from 15.4% to 7.8%, with 235 fewer breached cases in the scenario. This is a what-if estimate, not a guarantee; it does not model downstream behavior changes.”

## 03:40–04:25 | Turn evidence into action

**Show:** Recommendations, then briefly show the PDF export if ready.

**Say:** “FlowLens ranks possible interventions using the observed queue evidence, estimated impact, and effort. The recommendation is a starting point for staff to review, not an automatic decision. The report packages the measured evidence so it can be discussed outside the dashboard. We avoid adding impacts across recommendations because they may affect overlapping cases.”

## 04:25–05:00 | Close with trust and takeaway

**Show:** Data & settings, then return to Overview.

**Say:** “The dataset can be replaced with a validated CSV, and administrators can configure workflow targets and ideal paths. The project includes an import audit, reproducible synthetic data, tests, documentation, and privacy-conscious pseudonyms. Our main contribution is making hidden waiting and rework measurable, then letting decision-makers inspect both the evidence and the assumptions behind a proposed change. Thank you. I’m happy to show a specific case or explain the analysis.”

## Likely judge questions

**What data does the system need?** A case ID, process, activity, start and end timestamps, role, department, and outcome. Resource is optional; the app validates imports and reports rejected or duplicate rows.

**Is the dataset real?** No. It is deterministic synthetic data designed to demonstrate known patterns. The values must not be presented as actual institutional performance.

**Does the model decide whether to approve a request?** No. It estimates early breach risk for investigation. It does not make approval decisions.

**Does the simulation promise these savings?** No. It changes the chosen queue duration in a scenario and holds other durations fixed. It is a transparent planning estimate.

**How do you know the project works?** The recorded verification includes 60 backend tests, 8 frontend tests, production build and lint checks, plus live checks of analytics endpoints and CSV/PDF exports. The project’s verification document records scope and limitations.

**What is the key takeaway?** “FlowLens converts event logs into visible process behavior, separates waiting from work, and lets people test improvement ideas against explicit evidence and assumptions.”
