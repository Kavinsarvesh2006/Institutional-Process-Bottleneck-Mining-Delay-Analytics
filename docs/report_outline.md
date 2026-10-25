# College report outline — Project 34

**Title:** Institutional Process Bottleneck Mining & Delay Analytics  
**Product:** FlowLens — Campus Process Intelligence  
**Institution:** V.S.B. Engineering College, Karur · Artificial Intelligence and Data Science  
**Team:** Muthukarthigai Selvam S (922524243079), Kavin Sarvesh R (922524243117)

## Front matter

Title page, department certificate, declaration, acknowledgements, abstract, table of contents, list of figures and tables, glossary. Follow the college's actual formatting requirements; signatures and approval text must come from the institution.

## Abstract

Describe an event-log based analytical system that reconstructs campus workflows, separates queue from service time and ranks improvement opportunities. State that validation uses reproducible synthetic data with planted patterns. Report measured SLA, model and detection results with their limitations. Avoid claiming live deployment or real staff performance findings.

## Chapter 1 — Introduction

Campus approval context; opaque handoffs; need for process visibility; scope; stakeholders; five demonstration workflows; report organisation.

## Chapter 2 — Literature survey

Compare process mining, directly-follows discovery, conformance analysis, queue measurement, SLA dashboards and early-stage risk models. Use primary sources, actual publications and official library documentation. A useful foundational reference is W.M.P. van der Aalst, *Process Mining: Data Science in Action*, second edition, Springer, 2016. Do not invent publication results or citation details.

## Chapter 3 — Problem statement and objectives

Define hidden queues, rework and SLA breaches. List research questions: actual path, longest wait, breach distribution, loops, trends and highest-impact intervention. Define deliverables and boundaries: offline analytical tool, not an approval execution system.

## Chapter 4 — Requirements and feasibility

Functional requirements mapped to nine screens and API contracts; hardware/software prerequisites; offline operation; privacy considerations; limitations of local SQLite; dataset and event schema; acceptance checks.

## Chapter 5 — System design

Use `architecture.md` diagrams, database relationships, frontend routes, validation flow, cache invalidation and export design. Include screenshots of the actual built interface. Explain the distinction between event facts and recalculated case metrics.

## Chapter 6 — Implementation

Data generator and planted effects; ingestion audit; ordered event processing; business calendar; DFG/variants; scoring; SLA/trend/queue/lift; model and chronological split; simulator; rule-based recommendations; typed API integration; responsive themes.

## Chapter 7 — Testing and results

Record test commands, versions, coverage, ground-truth thresholds, detection evidence, measured endpoint timings and UI checks from `verification.md`. Include the random forest confusion matrix and majority baseline. Explain that the default model does not improve holdout accuracy over the majority baseline. Compare before/after simulator results with identical cohorts.

Suggested tables: validation cases; injected pattern vs measured effect; algorithm example calculations; API performance; prediction metrics; top queues; scenario outcomes. Suggested figures: DFG, cycle trend, percentile table, heatmap, case Gantt, dark/mobile views and exported report.

## Chapter 8 — Conclusion

Summarise working visibility, reproducible detection and actionable simulation. Separate demonstrated outcomes from unvalidated real-world impact. Cite synthetic data status clearly.

## Chapter 9 — Future scope

Institution-approved real logs; student/staff privacy controls; calendars per department; Petri-net alignment; calibrated temporal models; staffing/capacity simulation; authentication and role access; background jobs; PostgreSQL; prospective intervention study.

## References and appendices

Include verified bibliographic sources and official FastAPI, pandas, NumPy, SciPy, scikit-learn, SQLAlchemy, React Flow and Recharts documentation. Append sample CSV, API schema, setup instructions, ground truth, test evidence, team contributions and the demo script. Use actual college contribution records rather than assigning unverified work to individuals.
