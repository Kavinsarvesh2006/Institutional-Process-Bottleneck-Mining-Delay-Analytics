export interface Quality {
  accepted: number;
  rejected: number;
  duplicates: number;
  warnings: string[];
  errors: string[];
  rows: { row: number; reason: string }[];
}
export interface Dataset {
  process_types: string[];
  departments: string[];
  activities: string[];
  id: number;
  name: string;
  cases: number;
  created_at: string;
  quality: Quality;
}
export interface Settings {
  working_hours: boolean;
  anonymise: boolean;
  holidays: string[];
  weights: number[];
  ideal_paths: Record<string, string[]>;
  sla_rules: Record<string, number>;
  activity_targets: Record<string, number>;
}
export interface Filters {
  dataset_id: string;
  process_type: string;
  department: string;
  start: string;
  end: string;
}
export interface Distribution {
  mean: number;
  median: number;
  p90: number;
  variance: number;
  histogram: { range: string; count: number }[];
  box: number[];
}
export interface Bottleneck extends Distribution {
  name: string;
  count: number;
  events: number;
  service: number;
  return_rate: number;
  score: number;
  resources: { resource: string; count: number; wait: number; service: number }[];
}
export interface Graph {
  nodes: { id: string; count: number; service: number; wait: number }[];
  edges: ({ source: string; target: string; count: number } & Distribution)[];
}
export interface Trend {
  date: string;
  cycle: number | null;
  breach: number | null;
  count: number | null;
  moving: number | null;
  z_score: number;
  change: boolean;
}
export interface Breakdown {
  name: string;
  count: number;
  breach: number;
  cycle: number;
}
export interface SLA {
  eligible: number;
  open: number;
  breach_rate: number;
  avg_delay: number;
  percentiles: Record<string, number>;
  by_process: Breakdown[];
  by_department: Breakdown[];
  by_weekday: Breakdown[];
}
export interface Variant {
  process_type: string;
  sequence: string[];
  count: number;
  cycle: number;
  happy: boolean;
  fitness: number | null;
  assessed: boolean;
  skipped: string[];
  extra: string[];
  wrong_order: boolean;
}
export interface Variants {
  assessed_cases: number;
  unconfigured_processes: string[];
  variants: Variant[];
  fitness: number | null;
  conforming: number;
  deviations: Record<string, number>;
  rework_cases: number;
}
export interface Simulation {
  activity: string;
  reduction: number;
  eligible: number;
  before_cycle: number;
  after_cycle: number;
  before_breach: number;
  after_breach: number;
  saved_hours: number;
  rescued: number;
}
export interface Recommendation {
  activity: string;
  title: string;
  action: string;
  effort: string;
  evidence: string;
  saving_per_case: number;
  impact: Simulation;
  impact_30: Simulation;
}
export interface Analysis {
  empty: boolean;
  dataset: { id: number; name: string };
  overview: {
    total_cases: number;
    events: number;
    avg_cycle: number;
    breach_rate: number;
    slowest_step: string;
    rework_rate: number;
    open_cases: number;
    cycle_change: number;
    start: string;
    end: string;
    total_wait: number;
    fitness: number | null;
  };
  bottlenecks: Bottleneck[];
  sla: SLA;
  trend: Trend[];
  graph: Graph;
  variants: Variants;
  heatmap: { day: number; hour: number; count: number; wait: number }[];
  recommendations: Recommendation[];
}
export interface CaseRow {
  case_id: string;
  process_type: string;
  department: string;
  start: string;
  end: string;
  cycle: number;
  sla: number;
  status: string;
  breached: boolean;
  delay: number;
}
export interface CaseDetail {
  case_id: string;
  cycle: number;
  sla: number;
  status: string;
  breached: boolean;
  events: {
    activity: string;
    start_time: string;
    end_time: string | null;
    role: string;
    resource: string;
    outcome: string;
    wait: number;
    service: number;
    raw_wait: number;
    offset: number;
  }[];
}
export interface ModelMetrics {
  available: boolean;
  reason?: string;
  accuracy: number;
  precision: number;
  recall: number;
  baseline_accuracy: number;
  train_count: number;
  test_count: number;
  confusion_matrix: number[][];
  feature_importance: { feature: string; importance: number }[];
  note: string;
}
export interface RootCause {
  factor: string;
  value: string;
  count: number;
  breach: number;
  lift: number;
  p_value: number;
}
export interface Queue {
  series: ({ date: string } & Record<string, string | number>)[];
  roles: { role: string; peak: number; mean_queue: number; utilisation: number }[];
}
