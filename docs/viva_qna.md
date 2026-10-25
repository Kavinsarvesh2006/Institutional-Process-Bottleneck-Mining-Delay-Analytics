# 30 viva questions and answers

1. **What problem does FlowLens solve?** It makes hidden waiting in approval workflows visible by rebuilding case paths from timestamped event logs and identifying queues, rework and SLA breaches.

2. **What is process mining?** It derives evidence about real processes from recorded events. Our project implements discovery, simple conformance checking and performance analysis.

3. **What is a case?** One request from arrival to an observed terminal state, identified by a dataset-local case ID. It contains several activity events.

4. **What fields does an event require?** Case ID, process type, activity, start/end timestamps, role, department and outcome. Resource is optional. End may be missing, but this is flagged and makes the case open.

5. **How do service and waiting differ?** Service is the activity's own end minus start. Waiting is the next start minus the previous end. They answer different operational questions.

6. **Give a numerical queue example.** An office finishes at 10:00 and HOD begins at 13:00: HOD's incoming queue is 3h, regardless of how long the HOD activity itself lasts.

7. **What is a directly-follows graph?** Activities are nodes. An edge connects consecutive activities in a case, summarising transition count and incoming waiting distribution.

8. **What does the frequency slider do?** It hides edges below a percentage of the busiest edge count. It does not remove data from other screens or mean cumulative coverage of variants.

9. **What is a process variant?** An exact sequence of activity names within a process type. Grouping variants shows common paths and deviations.

10. **How is conformance fitness computed?** We use `100 × 2M/(ideal length + actual length)`, with matched alignment blocks from SequenceMatcher. It is explainable sequence alignment, not formal token replay.

11. **How do you detect rework?** We detect repeated activities within a case. Office → Student Correction → Office repeats Office; a Returned outcome alone is a separate return signal.

12. **What is the bottleneck formula?** Weighted normalised mean wait, P90 wait, volume and variance with default weights 0.4, 0.25, 0.2, 0.15. Scores are scaled to 0–100.

13. **Why normalise the components?** Hours, counts and squared hours have different units. Min-max normalisation makes them comparable within the selected ranking; a constant component contributes zero.

14. **Can users change the ranking?** Yes. Nonnegative weights are editable and normalised by their sum. Filters and the selected activity/edge/role/resource grouping also change the comparison population.

15. **Why P90 as well as the mean?** The mean summarises total burden while P90 exposes the long tail. Two queues can share a mean but differ greatly for unusually delayed requests.

16. **How is an SLA breach defined?** A closed case breaches when its cycle exceeds its configured process target. Equality is compliant. Open cases are excluded; rejected terminal cases remain eligible.

17. **How do working hours work?** Only queue gaps count 09–17 Monday–Saturday and omit holidays. Service stays elapsed. We subtract excluded queue hours from elapsed cycle and compare with targets in that chosen clock.

18. **How are invalid records handled?** Missing required columns stop import. Invalid row dates, reversed intervals and inconsistent metadata are rejected with row reasons. Exact duplicates are removed. Missing ends and overlaps are retained with warnings.

19. **What proves detection accuracy?** A fixed-seed generator plants five known effects. An independent quantitative test checks observed HOD waits, clerk service ratio, fee loops, Thursday signing and late-period deterioration, requiring at least four detections. This is synthetic detection evidence, not external validity.

20. **Why SQLite?** It is portable, transactional, offline and sufficient for a local academic workload. SQLAlchemy provides explicit indexed tables and a migration path to a server database.

21. **How do you keep analytics responsive?** Indexed dataset reads, vectorised pandas/NumPy operations, bounded raw-frame/snapshot caches, separate on-demand model caching, paginated case lists and small JSON summaries. Measured timings are documented rather than assumed.

22. **How do you identify delay trends?** Closed cases are assigned to arrival days, then daily means and a seven-day rolling average are plotted. A prior 21-day z-score above 2.5 in magnitude flags unusual days.

23. **Does high lift prove the HOD caused a delay?** No. Lift compares breach rates, and chi-square measures an association. Process mix, shared routes and other confounders can explain it. Values are exploratory and unadjusted for multiple comparisons.

24. **How is queue length computed?** Count observed incoming queue intervals active at each daily noon snapshot using sorted starts/ends. It is an exact snapshot, not the daily average or live outstanding queue beyond the last event.

25. **What model predicts SLA breaches?** A class-balanced random forest using process, department, arrival weekday and queue before activity two. It uses no final cycle or later activity information.

26. **How do you avoid data leakage?** We split by arrival chronology, train encoders only on training rows, restrict inputs to first-two-step features, and exclude open cases. Final breach is the target, never an input.

27. **Why show precision, recall and the baseline?** SLA breaches are a minority class. A majority prediction can achieve high accuracy. Our sample's 81.1% accuracy matches that baseline; precision about 50% and recall about 65% describe the tradeoff more honestly.

28. **How does simulation work?** Subtract a chosen percentage of incoming queue at one activity from each closed case, then recompute cycle and SLA. It does not model added staffing, future demand or capacity feedback, so it is a conditional estimate.

29. **Are recommendations generated by an LLM?** No. They use explicit evidence rules plus measured 30/50% queue-reduction scenarios, ranked by total hours saved. This is transparent and runs offline.

30. **What are the main limits and next steps?** Sequential event assumptions, an explicit Issued/Rejected terminal convention, uncalibrated synthetic-data ML, no causal proof, static queue simulation and no multi-user authentication. Future work includes real approved logs, formal conformance, temporal calibration, capacity simulation and secure institutional deployment.
