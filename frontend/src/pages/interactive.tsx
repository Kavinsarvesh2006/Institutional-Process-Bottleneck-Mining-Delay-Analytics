import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  Upload,
  Database,
  Check,
  FlaskConical,
  ShieldCheck,
  Info,
  Save,
  FileSpreadsheet,
  RotateCcw,
  CalendarDays,
  LockKeyhole,
  Download,
} from 'lucide-react';
import { useAnalysis, useApp, useEndpoint, request, post, queryString, number, hours, useCohortKey, selectedDataset } from '../api';
import { Guard, PageTitle, Panel, Badge, Busy, ErrorNotice } from '../components/ui';
import { Bars } from '../components/charts';
import type { Analysis, ModelMetrics, Quality, Settings, Simulation } from '../types';

export function PredictSimulate() {
  const query = useAnalysis();
  const cohort = useCohortKey();
  return <Guard query={query}>{(data) => <PredictionContent key={cohort} data={data} />}</Guard>;
}
function PredictionContent({ data }: { data: Analysis }) {
  const { filters, datasets } = useApp();
  const activeDataset = selectedDataset(datasets, filters.dataset_id);
  const metrics = useEndpoint<ModelMetrics>('/predict/metrics');
  const [process, setProcess] = useState(
    filters.process_type || activeDataset?.process_types[0] || data.sla.by_process[0]?.name || '',
  );
  const [department, setDepartment] = useState(activeDataset?.departments[0] || data.sla.by_department[0]?.name || '');
  const [weekday, setWeekday] = useState(0);
  const [wait, setWait] = useState(8);
  const [risk, setRisk] = useState<{ probability: number; risk: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [activity, setActivity] = useState(data.bottlenecks[0]?.name ?? 'HOD Approval');
  const [reduction, setReduction] = useState(50);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [simPending, setSimPending] = useState(false);
  const [simError, setSimError] = useState<Error | null>(null);
  async function predict() {
    setPending(true);
    try {
      setRisk(
        await post('/predict?' + queryString(filters), {
          process_type: process,
          department,
          weekday,
          first_wait: wait,
        }),
      );
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setPending(false);
    }
  }
  async function simulate() {
    setSimPending(true);
    try {
      setSimulation(await post('/simulate?' + queryString(filters), { activity, reduction }));
      setSimError(null);
    } catch (e) {
      setSimError(e as Error);
    } finally {
      setSimPending(false);
    }
  }
  return (
    <>
      <PageTitle
        index="07"
        title="Look one step ahead"
        description="Estimate a request’s risk. Test the impact of a better queue."
      />
      <div className="two-col interactive-grid">
        <Panel
          title="Will this request be delayed?"
          eyebrow="EARLY-STAGE RISK MODEL"
          extra={
            <span className="section-icon">
              <FlaskConical size={19} />
            </span>
          }
        >
          <p className="body-copy">
            Use only what you know after the first two activities. The model has no access to later approvals
            or the final cycle time.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void predict();
            }}
          >
            <div className="form-grid">
              <label>
                Workflow
                <select
                  value={process}
                  onChange={(e) => {
                    setProcess(e.target.value);
                    setRisk(null);
                  }}
                >
                  {(activeDataset?.process_types ?? data.sla.by_process.map((p) => p.name)).map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label>
                Department
                <select
                  value={department}
                  onChange={(e) => {
                    setDepartment(e.target.value);
                    setRisk(null);
                  }}
                >
                  {(activeDataset?.departments ?? data.sla.by_department.map((d) => d.name)).map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label>
                Arrival weekday
                <select
                  value={weekday}
                  onChange={(e) => {
                    setWeekday(Number(e.target.value));
                    setRisk(null);
                  }}
                >
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(
                    (d, i) => (
                      <option value={i} key={d}>
                        {d}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Queue before second activity (hours)
                <input
                  type="number"
                  min="0"
                  max="8760"
                  step="0.1"
                  required
                  value={wait}
                  onChange={(e) => {
                    setWait(Number(e.target.value));
                    setRisk(null);
                  }}
                />
              </label>
            </div>
            <button className="primary full-width" disabled={pending || !metrics.data?.available}>
              <Busy busy={pending}>
                Estimate delay risk <ArrowUpRight size={15} />
              </Busy>
            </button>
          </form>
          <ErrorNotice error={error ?? metrics.error} />
          {metrics.data && !metrics.data.available && (
            <div className="inline-error">{metrics.data.reason}</div>
          )}
          {risk ? (
            <div className={'risk-result ' + risk.risk.toLowerCase()}>
              <span>ESTIMATED SLA BREACH PROBABILITY</span>
              <div>
                <strong>
                  {(risk.probability * 100).toFixed(1)}
                  <small>%</small>
                </strong>
                <Badge tone={risk.risk === 'High' ? 'orange' : 'teal'}>{risk.risk} risk</Badge>
              </div>
              <div className="risk-track">
                <span style={{ width: risk.probability * 100 + '%' }} />
              </div>
              <p>
                Prioritise a review when risk is high. This result is an estimate from the selected dataset.
              </p>
            </div>
          ) : (
            <div className="prediction-empty">
              <ShieldCheck size={25} />
              <p>Your risk estimate will appear here.</p>
            </div>
          )}
        </Panel>
        <Panel
          title="What if the queue moved faster?"
          eyebrow="COUNTERFACTUAL WORKBENCH"
          extra={
            <span className="section-icon teal">
              <RotateCcw size={19} />
            </span>
          }
        >
          <p className="body-copy">
            Choose an activity and reduce its incoming waiting time. All other queue and service durations
            stay fixed.
          </p>
          <label className="field-label">
            Target activity
            <select
              value={activity}
              onChange={(e) => {
                setActivity(e.target.value);
                setSimulation(null);
              }}
            >
              {data.bottlenecks.map((b) => (
                <option key={b.name}>{b.name}</option>
              ))}
            </select>
          </label>
          <div className="simulation-slider">
            <div>
              <span>Queue reduction</span>
              <strong>
                {reduction}
                <small>%</small>
              </strong>
            </div>
            <input
              aria-label="Queue reduction percentage"
              type="range"
              min="0"
              max="100"
              value={reduction}
              onChange={(e) => {
                setReduction(Number(e.target.value));
                setSimulation(null);
              }}
            />
            <div className="slider-labels">
              <span>No change</span>
              <span>Queue eliminated</span>
            </div>
          </div>
          <button
            className="primary full-width teal-button"
            disabled={simPending}
            onClick={() => void simulate()}
          >
            <Busy busy={simPending}>
              Run the scenario <ArrowRight size={15} />
            </Busy>
          </button>
          <ErrorNotice error={simError} />
          {simulation ? (
            <>
              <div className="simulation-results">
                <div>
                  <small>MEAN CYCLE</small>
                  <span>
                    {hours(simulation.before_cycle)} <ArrowRight size={13} />
                  </span>
                  <strong>{hours(simulation.after_cycle)}</strong>
                </div>
                <div>
                  <small>SLA BREACH RATE</small>
                  <span>
                    {simulation.before_breach.toFixed(1)}% <ArrowRight size={13} />
                  </span>
                  <strong>{simulation.after_breach.toFixed(1)}%</strong>
                </div>
              </div>
              <div className="simulation-impact">
                <Check size={18} />
                <span>
                  <b>{number(simulation.saved_hours)} hours</b> saved across {number(simulation.eligible)}{' '}
                  closed cases
                  <br />
                  {simulation.rescued} requests move within their SLA
                </span>
              </div>
            </>
          ) : (
            <div className="prediction-empty">
              <RotateCcw size={25} />
              <p>Run a scenario to compare before and after.</p>
            </div>
          )}
        </Panel>
      </div>
      <Panel
        title="How much should you trust the model?"
        eyebrow="CHRONOLOGICAL HOLDOUT · FIRST 80% TRAIN / LATER 20% TEST"
        extra={<Badge>Random forest · fixed seed 34</Badge>}
      >
        {metrics.isLoading ? (
          <div className="skeleton" />
        ) : metrics.data?.available ? (
          <>
            <div className="model-metrics">
              {[
                ['Accuracy', metrics.data.accuracy],
                ['Precision', metrics.data.precision],
                ['Recall', metrics.data.recall],
                ['Majority baseline', metrics.data.baseline_accuracy],
              ].map(([name, value]) => (
                <div key={name}>
                  <span>{name}</span>
                  <strong>
                    {(Number(value) * 100).toFixed(1)}
                    <small>%</small>
                  </strong>
                </div>
              ))}
            </div>
            <div className="two-col">
              <div>
                <h4>Feature importance · share</h4>
                <Bars
                  data={metrics.data.feature_importance}
                  nameKey="feature"
                  valueKey="importance"
                  unit=""
                  horizontal
                  height={205}
                />
              </div>
              <div className="model-details">
                <h4>Validation record</h4>
                <p>
                  {number(metrics.data.train_count)} training cases · {number(metrics.data.test_count)} test
                  cases
                </p>
                <table className="confusion-table">
                  <thead>
                    <tr>
                      <th>Actual / predicted</th>
                      <th>Within SLA</th>
                      <th>Breached</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Within SLA</td>
                      <td>{metrics.data.confusion_matrix[0][0]}</td>
                      <td>{metrics.data.confusion_matrix[0][1]}</td>
                    </tr>
                    <tr>
                      <td>Breached</td>
                      <td>{metrics.data.confusion_matrix[1][0]}</td>
                      <td>{metrics.data.confusion_matrix[1][1]}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="panel-note">{metrics.data.note}</p>
              </div>
            </div>
          </>
        ) : (
          <p className="panel-note">{metrics.data?.reason ?? 'Model metrics could not be loaded.'}</p>
        )}
      </Panel>
      <div className="method-note">
        <Info size={18} />
        <p>
          Predictions use the whole selected dataset, independent of the dashboard’s process/date filters.
          Simulation uses the current filtered cohort. Neither model is a capacity planning guarantee.
        </p>
      </div>
    </>
  );
}

export function SettingsPage() {
  const { settings } = useApp();
  return (
    <>
      <PageTitle
        index="09"
        title="Make the data yours"
        description="Bring in an event log. Define the rules that reflect your institution."
      />
      {settings ? <SettingsContent initial={settings} /> : <div className="skeleton" />}
    </>
  );
}
function SettingsContent({ initial }: { initial: Settings }) {
  const client = useQueryClient();
  const { datasets, notify, setFilters, filters } = useApp();
  const activeDataset = selectedDataset(datasets, filters.dataset_id);
  const [draft, setDraft] = useState<Settings>(initial);
  const processNames = [...new Set([...Object.keys(draft.sla_rules), ...Object.keys(draft.ideal_paths), ...(activeDataset?.process_types ?? [])])];
  const activityNames = [...new Set([...Object.keys(draft.activity_targets), ...(activeDataset?.activities ?? [])])];
  const [holidays, setHolidays] = useState(initial.holidays.join('\n'));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const result = await request<{ dataset_id: number | null; quality: Quality }>('/datasets/upload', {
        method: 'POST',
        body: form,
      });
      setQuality(result.quality);
      setError(null);
      if (result.dataset_id) {
        setFilters({
          ...filters,
          dataset_id: String(result.dataset_id),
          start: '',
          end: '',
          department: '',
          process_type: '',
        });
        await client.invalidateQueries();
        notify(`${number(result.quality.accepted)} validated events imported.`);
      }
    } catch (e) {
      setError(e as Error);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }
  async function seed() {
    setUploading(true);
    try {
      const result = await post<{ dataset_id: number; quality: Quality }>('/datasets/seed', {});
      setFilters({
        ...filters,
        dataset_id: String(result.dataset_id),
        start: '',
        end: '',
        department: '',
        process_type: '',
      });
      setQuality(result.quality);
      await client.invalidateQueries();
      notify('Six months of sample workflows are ready.');
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setUploading(false);
    }
  }
  async function save() {
    setSaving(true);
    try {
      const result = await request<Settings>('/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          sla_rules: Object.fromEntries(processNames.map((name) => [name, draft.sla_rules[name] ?? 120])),
          activity_targets: Object.fromEntries(activityNames.map((name) => [name, draft.activity_targets[name] ?? 24])),
          ideal_paths: Object.fromEntries(Object.entries(draft.ideal_paths).filter(([, path]) => path.some((step) => step.trim()))),
          holidays: holidays
            .split(/[\n,]/)
            .map((v) => v.trim())
            .filter(Boolean),
        }),
      });
      setDraft(result);
      await client.invalidateQueries();
      notify('Institution settings saved. Analytics have been recalculated.');
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setSaving(false);
    }
  }
  function template() {
    const content =
      'case_id,process_type,activity,start_time,end_time,role,department,resource,outcome\nDEMO-001,Fee Receipt,Submission,2026-06-01 09:00,2026-06-01 09:15,Student,AI & DS,Student,Approved\nDEMO-001,Fee Receipt,Office Processing,2026-06-01 11:00,2026-06-01 12:00,Office,AI & DS,Office Clerk A,Approved\nDEMO-001,Fee Receipt,Issued,2026-06-01 12:30,2026-06-01 12:40,Office,AI & DS,Office Clerk A,Approved\n';
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'flowlens-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="two-col">
        <Panel title="Your event log, in focus" eyebrow="IMPORT DATA" extra={<FileSpreadsheet size={20} />}>
          <div
            className={'drop-zone ' + (drag ? 'dragging' : '')}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              if (!uploading && e.dataTransfer.files[0]) void upload(e.dataTransfer.files[0]);
            }}
          >
            <span className="upload-icon">
              <Upload size={27} />
            </span>
            <h3>Drop your CSV here</h3>
            <p>UTF-8 · up to 25 MB · 100,000 event rows</p>
            <button className="primary" disabled={uploading} onClick={() => fileRef.current?.click()}>
              <Busy busy={uploading}>
                Browse files <ArrowUpRight size={14} />
              </Busy>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label="Upload event log CSV"
              onChange={(e) => {
                if (e.target.files?.[0]) void upload(e.target.files[0]);
              }}
            />
          </div>
          <div className="upload-help">
            <p>
              Required: case_id, process_type, activity, start_time, end_time, role, department, outcome.
              Resource is optional.
            </p>
            <button className="text-button" onClick={template}>
              <Download size={14} />
              Download CSV template
            </button>
          </div>
          <ErrorNotice error={error} />
        </Panel>
        <Panel title="Start with a campus in motion" eyebrow="BUILT-IN DEMONSTRATION">
          <div className="sample-card">
            <div className="sample-icon">
              <Database size={30} />
              <Badge tone="teal">DETERMINISTIC · SEED 34</Badge>
            </div>
            <h2>
              Six months.
              <br />
              3,200 request stories.
            </h2>
            <p>
              Five workflows with HOD queues, weekly signing batches, rework loops and deliberately planted
              delays.
            </p>
            <button className="button" disabled={uploading} onClick={() => void seed()}>
              <Database size={15} />
              Load sample dataset <ArrowRight size={14} />
            </button>
          </div>
          <p className="panel-note">Synthetic data only. Loading again reuses the same dataset.</p>
        </Panel>
      </div>
      {quality && (
        <Panel title="Data-quality receipt" eyebrow="IMPORT AUDIT">
          <div className="quality-summary">
            <span>
              <b>{number(quality.accepted)}</b>accepted
            </span>
            <span>
              <b>{number(quality.rejected)}</b>rejected
            </span>
            <span>
              <b>{number(quality.duplicates)}</b>duplicates removed
            </span>
          </div>
          {quality.errors.map((message) => (
            <div className="inline-error" key={message}>
              {message}
            </div>
          ))}
          {quality.warnings.map((message) => (
            <p className="warning-note" key={message}>
              <Info size={15} />
              {message}
            </p>
          ))}
          {quality.rows.length > 0 && (
            <details>
              <summary>Row-level validation reasons ({quality.rows.length})</summary>
              <div className="audit-rows">
                {quality.rows.map((r, i) => (
                  <div key={i}>
                    <span className="mono">Row {r.row}</span>
                    {r.reason}
                  </div>
                ))}
              </div>
            </details>
          )}
        </Panel>
      )}
      <Panel title="Dataset register" eyebrow="PERSISTENT LOCAL STORAGE">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dataset</th>
                <th>Cases</th>
                <th>Accepted events</th>
                <th>Quality notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {datasets.map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong>{d.name}</strong>
                    <small className="block">
                      Imported {new Date(d.created_at).toLocaleDateString('en-GB')}
                    </small>
                  </td>
                  <td className="mono">{number(d.cases)}</td>
                  <td className="mono">{number(d.quality.accepted)}</td>
                  <td>
                    {d.quality.warnings.length} warnings · {d.quality.rejected} rejected
                  </td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => {
                        setFilters({
                          ...filters,
                          dataset_id: String(d.id),
                          start: '',
                          end: '',
                          process_type: '',
                          department: '',
                        });
                        setQuality(d.quality);
                        notify('Dataset selected.');
                      }}
                    >
                      Select <ArrowUpRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {datasets.length === 0 && (
            <p className="empty-mini">No datasets yet. Import a CSV or load the sample.</p>
          )}
        </div>
      </Panel>
      <div className="settings-heading">
        <div>
          <div className="eyebrow">INSTITUTION CONFIGURATION</div>
          <h2>Your rules. Your definition of flow.</h2>
        </div>
        <button className="primary" disabled={saving} onClick={() => void save()}>
          <Busy busy={saving}>
            <Save size={15} />
            Save all settings
          </Busy>
        </button>
      </div>
      <div className="two-col">
        <Panel title="Calendar & privacy" eyebrow="CLOCK AND IDENTITY">
          <label className="toggle-row">
            <span>
              <CalendarDays size={18} />
              <span>
                <strong>Working-hours queue clock</strong>
                <small>09:00–17:00, Monday–Saturday; exclude holidays</small>
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={draft.working_hours}
              onChange={(e) => setDraft({ ...draft, working_hours: e.target.checked })}
            />
          </label>
          <p className="panel-note">
            Only queue time changes. Service time stays elapsed; the adjusted cycle is elapsed cycle minus
            excluded queue hours. SLA rules use this selected clock.
          </p>
          <label className="toggle-row">
            <span>
              <LockKeyhole size={18} />
              <span>
                <strong>Anonymise resource labels</strong>
                <small>Stable SHA-256 pseudonyms in analytics and timelines</small>
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={draft.anonymise}
              onChange={(e) => setDraft({ ...draft, anonymise: e.target.checked })}
            />
          </label>
          <label className="field-label">
            Institution holidays · one ISO date per line
            <textarea
              rows={4}
              placeholder="2026-01-26"
              value={holidays}
              onChange={(e) => setHolidays(e.target.value)}
            />
          </label>
          <p className="panel-note">
            Raw uploaded data remains in the local database. Pseudonyms protect display labels; they do not
            encrypt stored data.
          </p>
        </Panel>
        <Panel title="What makes a bottleneck?" eyebrow="ADJUSTABLE SCORE WEIGHTS">
          {['Mean queue', 'P90 queue', 'Case volume', 'Variance'].map((label, i) => (
            <label className="weight-slider" key={label}>
              <span>
                {label}
                <b>
                  {draft.weights[i].toFixed(2)}{' '}
                  <small>
                    ({((draft.weights[i] / (draft.weights.reduce((a, b) => a + b, 0) || 1)) * 100).toFixed(0)}
                    %)
                  </small>
                </b>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step=".05"
                value={draft.weights[i]}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    weights: draft.weights.map((w, j) => (j === i ? Number(e.target.value) : w)),
                  })
                }
              />
            </label>
          ))}
          <div className="method-note">
            <Info size={17} />
            <p>
              Components are min-max normalised within a ranking. Weights are divided by their sum before
              scoring; at least one must be positive.
            </p>
          </div>
        </Panel>
      </div>
      <Panel
        title="SLA targets & ideal sequences"
        eyebrow="DEFINE WHAT GOOD LOOKS LIKE"
        extra={<Badge>Hours in selected queue clock</Badge>}
      >
        <div className="sla-editor">
          <p className="panel-note">Uploaded workflows appear here automatically. New workflows use a 120-hour SLA and 24-hour queue target until you edit them. Enter an ideal sequence to assess conformance; its final activity marks completion. A blank sequence stays unconfigured.</p>
          {processNames.map((process) => (
            <div className="sla-edit-row" key={process}>
              <label>
                <strong>{process}</strong>
                <span>Case SLA · hours</span>
                <input
                  type="number"
                  min="1"
                  max="8760"
                  value={draft.sla_rules[process] ?? 120}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      sla_rules: { ...draft.sla_rules, [process]: Number(e.target.value) },
                    })
                  }
                />
              </label>
              <label>
                <span>Ideal sequence · separate steps with &gt;</span>
                <input
                  value={(draft.ideal_paths[process] ?? []).join(' > ')}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      ideal_paths: {
                        ...draft.ideal_paths,
                        [process]: e.target.value.split('>').map((v) => v.trim()),
                      },
                    })
                  }
                />
              </label>
            </div>
          ))}
        </div>
        <h4>Activity queue targets · hours</h4>
        <div className="form-grid activity-targets">
          {activityNames.map((name) => (
            <label key={name}>
              {name}
              <input
                type="number"
                min=".1"
                step=".1"
                value={draft.activity_targets[name] ?? 24}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    activity_targets: { ...draft.activity_targets, [name]: Number(e.target.value) },
                  })
                }
              />
            </label>
          ))}
        </div>
        <div className="save-footer">
          <span>Changes take effect together when you save.</span>
          <button className="primary" disabled={saving} onClick={() => void save()}>
            <Busy busy={saving}>
              <Save size={15} />
              Save all settings
            </Busy>
          </button>
        </div>
      </Panel>
    </>
  );
}
