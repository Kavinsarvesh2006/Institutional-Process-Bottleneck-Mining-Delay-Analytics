# Algorithms, examples and limits

All durations are hours. Activities are ordered stably by `(case_id, start_time)`. Equal start times preserve upload order. Logs should describe sequential workflows; overlaps are reported and negative queue gaps are clamped, rather than treated as negative delays.

## 1. Service, waiting and cycle time

For activity `i`: `service_i = max(0, end_i - start_i)`.

For the next observed activity: `wait_i = max(0, start_i - end_(i-1))`. The first activity has zero incoming wait. A missing previous end creates an unknown gap, represented as zero for aggregation with a quality warning; the case remains open and is excluded from closed-case SLA rates. This is not an inferred completion time.

`cycle = last observed end - first start`. For sequential closed traces, cycle approximately equals total service plus total waiting. Open case cycles are observed lower bounds, not final durations. They are visible in the case register but excluded from the mean closed-case cycle KPI.

Example: submission 09–10, office 13–14, issue 16–17 → service 3h, queue 3+2=5h, cycle 8h. Calling the office interval a 4h wait would incorrectly include its own service.

Complexity: sorting `O(E log E)` for E events, followed by `O(E)` vectorised shifts.

## 2. Working-hours queue clock

Calendar: 09:00–17:00 Monday–Saturday. Sundays and configured ISO-date holidays contribute zero queue time. A cumulative business clock uses NumPy business-day counts plus a clipped in-day time offset. Queue = cumulative(start next) − cumulative(end prior).

Example: Saturday 24 January 2026 16:00 to Tuesday 27 January 10:00, with Monday 26 January a holiday → Saturday 1h + Tuesday 1h = 2 business queue hours, versus 66 elapsed hours.

Service remains elapsed work duration. `adjusted cycle = elapsed cycle - raw queue + business queue`. SLA targets are compared against the selected clock; changing the clock does not automatically rewrite targets. This is a queue-calendar adjustment, not a full business-time treatment of service intervals. Complexity is `O(E)` after calendar construction.

## 3. Directly-follows graph

For each consecutive pair `(previous activity, current activity)`, group transition observations and compute count, mean, median, P90 and population variance of incoming waits. Nodes show activity event count and mean service/queue. An event count may exceed distinct cases when there is rework.

Example: waits `[1,3]` on Submission → Office give count 2, mean 2h, median 2h, interpolated P90 2.8h. The slider retains edges with `count >= maximum_edge_count × threshold/100`. It is a relative frequency threshold, **not** cumulative path coverage. It changes the map only.

Complexity: `O(E)` grouping after ordering; percentile calculations require per-group sorting, bounded by `O(E log E)`.

## 4. Variants and conformance

A variant is an exact activity tuple within one process type. Group identical tuples; report count, mean observed cycle and fitness. The configured sequence defines the happy path.

Fitness is Python SequenceMatcher alignment ratio: `100 × 2M/(len(ideal)+len(actual))`, where M is the sum of matched alignment blocks. It is a simple sequence-alignment score, not Petri-net token replay. `[A,B,C]` vs `[A,C]` has fitness 80%. `[A,B,C]` vs `[A,B,B,C]` has fitness 85.7%.

Deviation hints use multiset differences: missing occurrences, extra occurrences and wrong order for traces with the full expected step counts. Repeated steps explicitly present in the ideal sequence are valid. Counts can overlap for skipped and extra activities. Open and rejected traces are included in conformance; an incomplete trace can therefore reduce fitness. Workflows without a configured ideal path have null fitness and are labelled not assessed. Aggregate fitness weights only assessed cases, and is null if none are assessed. The API also reports assessed-case count and unconfigured process names.

Complexity: tuple creation `O(E)`; alignment worst case `O(L²)` per distinct variant of length L. Workflow traces here are short.

## 5. Weighted bottleneck score

For each activity, edge, role or resource:

`score = 100 × [0.4 N(mean wait) + 0.25 N(P90 wait) + 0.2 N(case volume) + 0.15 N(variance)]`

`N(x) = (x-min)/(max-min)` within the current dimension/filter cohort. A constant component contributes zero. The saved weights are nonnegative and divided by their sum before multiplication. At least one must be positive. Case volume means unique cases per group; distribution samples are events/transitions. Scores are relative priorities, not probabilities.

Example: normalised components `[1,.8,.5,.6]` give `100(.4+.2+.1+.09)=79`. A submission step can have a nonzero score due to volume even if its queue is zero. Recommendations additionally require mean queue ≥1h, preventing a zero-wait action.

Complexity: group summaries bounded by `O(E log E)`; score normalisation `O(G)` for G groups.

## 6. Rework and return rate

A case has rework when any activity repeats. The case-level rework rate is distinct reworked cases / all selected cases. Return rate at a grouping is distinct cases with a `Returned` event / distinct cases at that grouping. Rework is not inferred solely from a Returned label.

Example: Office → Student Correction → Office repeats Office and is a rework trace. A rejected trace without repetition is not rework. The Fee Receipt sample has approximately 25% loop insertion; all-workflow rework is around 4.7% because Fee Receipt is one fifth of the data and some rejected/open traces truncate the loop.

Complexity: `O(E)` duplicate/group operations.

## 7. SLA and delay

`breached = closed and cycle > target`; equality is compliant. `delay = max(0, cycle-target)`.

`breach rate = breached closed cases / all closed cases ×100`. Closed includes rejected terminal cases; open cases are excluded. Average delay beyond SLA averages **breached closed cases only**. P50/P75/P90/P95 summarise closed-case cycles, not just breached cases. Breakdowns use process, department, weekday, month and per-case role presence.

A configured ideal sequence defines its terminal activity. Without one, the fallback terminal is `Issued`; a final rejected outcome also closes a fully ended trace. Any missing end time keeps the case open. For an all-open cohort the API returns zero-valued summary defaults with `eligible: 0`; the UI shows SLA compliance as N/A rather than 100%.

Example: cycles `[5,8]`, target 5h → 50% breach, 3h mean overshoot, P50 6.5h. An additional open trace does not change that denominator.

Complexity: `O(C)` grouping; percentiles `O(C log C)` for C cases.

## 8. Trend and change flags

Assign closed cases to their **arrival** day. Compute daily mean cycle and seven-calendar-day trailing mean (missing days are not zeros). For each day, calculate a z-score against the previous 21 days, requiring at least 10 prior observations. Flag `|z| > 2.5`. The current day's value is excluded from its own baseline.

Example: a 120h day after a baseline mean 70h, SD 15h gives z=3.33 and is flagged. The flags are exploratory outlier indicators, not formal causal change-point estimates. Incoming-cohort trends can change with process mix.

Complexity: `O(C + D)` for D calendar days, apart from grouping/sorting.

## 9. Workload and heatmap

Incoming queue interval is `[previous_end, next_start)`. At each daily noon snapshot, count intervals that have started minus intervals already ended. Sorted starts/ends plus binary searches give exact snapshot queue counts. Open intervals without a known prior end are omitted; the system does not invent live outstanding waits past the last observed event.

Utilisation proxy = observed service hours / observed calendar span / distinct observed resources ×100. It does not account for shift rosters, part-time staffing or parallel activity. It is not operational utilisation.

The 7×24 heatmap groups activity **start** timestamps by weekday/hour and encodes mean incoming wait; tooltip shows event count. It is not the number of requests waiting during that hour.

Complexity: queue `O(E log E + R D log E)` for R roles; heatmap `O(E)`.

## 10. Root-cause hints

For each factor value (weekday, department, process, role, resource), count **case presence** once per group and compare closed-case breach rates. `lift = group breach rate / overall breach rate`. A 40% group vs 20% baseline has lift 2.0. Require ≥10 cases. A 2×2 presence/absence vs breached/compliant contingency table gives a chi-square p-value with continuity correction; degenerate tables receive p=1.

These are unadjusted, exploratory comparisons with multiple testing and confounding. A request can visit multiple roles/resources; their group memberships overlap. High lift is a prompt to investigate, not proof that a person caused the delay.

Complexity: grouping is near `O(E)`; per-value contingency evaluation is `O(F C)` for F factor values.

## 11. Early-stage risk prediction

Features available after activity two: process type, department, arrival weekday and queue before the second activity. No final cycle, future step, later wait, final resource or breached label is used as input. One-hot categories are fitted only on training cases. Unknown categories are ignored by the encoder; the API restricts form process/department to observed values.

Random forest: 100 trees, max depth 7, min leaf 8, balanced class weights, seed 34, one CPU worker. Exclude open cases and traces with fewer than two events. Sort cases by arrival: first 80% train, later 20% test. Require ≥50 eligible cases and both target classes in training.

Report accuracy, precision, recall, majority baseline, confusion matrix, training/test counts and grouped impurity feature importance. `precision=TP/(TP+FP)` and `recall=TP/(TP+FN)`. Zero division gives zero. Tree probabilities are uncalibrated vote estimates. Risk labels: low <35%, moderate 35–65%, high ≥65%.

The fixed sample's 81.1% accuracy matches its majority baseline, while recall is about 65%. This proves a functioning model pipeline, not superior predictive performance or real-world validation. A production study needs real logs, temporal backtesting, calibration and fairness analysis.

Complexity approximately `O(T C log C)` for T trees, with bounded depth.

## 12. Simulation and recommendations

For an activity with incoming queue total `W_c` in closed case c and reduction r:

`cycle'_c = max(0, cycle_c - W_c × r/100)`.

Re-evaluate `cycle' > SLA`; sum hours saved and breaches avoided. r=0 is an identity; r=100 removes only that queue and preserves all other observed durations. Example: cycle 100h, SLA 80h, selected queue 60h, r=50 → cycle 70h and one avoided breach.

Recommendations apply explicit text rules for HOD, Principal, Office and Student Correction, plus a generic queue reminder rule for other activities. Simulate 30% and 50%, then rank by **total closed-case hours saved**. Estimates are not additive across recommendations; interventions can rescue the same case. Signing batches and capacity feedback are not re-scheduled.

Complexity: `O(E+C)` per scenario, repeated once per candidate activity.
