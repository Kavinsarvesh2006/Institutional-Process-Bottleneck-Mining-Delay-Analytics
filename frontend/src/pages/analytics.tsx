import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowRight,
  Files,
  Clock3,
  ShieldAlert,
  GitBranch,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  Repeat2,
  Info,
  Target,
  SlidersHorizontal,
} from 'lucide-react';
import { useAnalysis, useEndpoint, useApp, number, hours, severity, request, queryString, useCohortKey } from '../api';
import { Panel, PageTitle, Metric, Guard, Badge, ExportButton, ErrorNotice } from '../components/ui';
import { TrendChart, Bars, QueueChart } from '../components/charts';
import type { Analysis, Bottleneck, RootCause, Queue, CaseRow, CaseDetail } from '../types';

export function Overview() {
  const query = useAnalysis();
  return <Guard query={query}>{(data) => <OverviewContent data={data} />}</Guard>;
}
function OverviewContent({ data }: { data: Analysis }) {
  const o = data.overview;
  return (
    <>
      <PageTitle
        index="01"
        title="Operations overview"
        description="A clearer picture of how your institution moves."
      >
        <ExportButton />
      </PageTitle>
      <div className="overview-banner">
        <div className="banner-copy">
          <div className="banner-eyebrow">
            <span className="status-dot" />
            THE BIG PICTURE
          </div>
          <h2>
            Good processes leave a trail.
            <br />
            <span>Great institutions learn from it.</span>
          </h2>
          <p>
            {number(o.events)} events. {new Set(data.variants.variants.map((v) => v.process_type)).size} workflows. One place to find the wait.
          </p>
          <Link to="/process">
            Explore your process map <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="banner-visual" aria-hidden="true">
          <div className="orbit-line one" />
          <div className="orbit-line two" />
          <div className="orbit-node node-a">
            <Files size={20} />
          </div>
          <div className="orbit-node node-b">
            <CheckCircle2 size={22} />
          </div>
          <div className="orbit-node node-c">
            <Clock3 size={21} />
          </div>
          <div className="orbit-core">
            <GitBranch size={30} />
          </div>
          <div className="visual-caption">FROM EVENTS TO EVIDENCE</div>
        </div>
        <div className="banner-period">
          <span>ANALYSIS WINDOW</span>
          <strong>
            {new Date(o.start + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}{' '}
            —{' '}
            {new Date(o.end + 'T00:00:00').toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </strong>
          <small>Based on case arrival date</small>
          <div className="banner-data-tag">
            <span className="status-dot" />
            {data.dataset.name.includes('Campus operations')
              ? 'Synthetic demonstration data'
              : 'Imported event log'}
          </div>
        </div>
      </div>
      <div className="metrics-grid">
        <Metric
          label="Total requests"
          value={number(o.total_cases)}
          detail={
            <>
              <span className="teal-text">{number(o.events)}</span> observed activity events
            </>
          }
          icon={<Files size={17} />}
        />
        <Metric
          label="Average cycle time"
          value={number(o.avg_cycle, 1)}
          unit="hrs"
          tone="teal"
          detail={
            <>
              <span className={o.cycle_change > 0 ? 'orange-text' : 'teal-text'}>
                {o.cycle_change > 0 ? '↗' : '↘'} {Math.abs(o.cycle_change).toFixed(1)}%
              </span>{' '}
              vs first half of period
            </>
          }
          icon={<Clock3 size={17} />}
        />
        <Metric
          label="SLA breach rate"
          value={data.sla.eligible ? number(o.breach_rate, 1) : 'N/A'}
          unit={data.sla.eligible ? '%' : ''}
          tone="orange"
          detail={
            <>
              <span className="orange-text">{number(data.sla.eligible)}</span> closed cases assessed
            </>
          }
          icon={<ShieldAlert size={17} />}
        />
        <Metric
          label="Process conformance"
          value={o.fitness === null ? 'N/A' : number(o.fitness, 1)}
          unit={o.fitness === null ? '' : '%'}
          tone="purple"
          detail={
            <>
              <span className="teal-text">{number(data.variants.conforming)}</span> follow the ideal path
            </>
          }
          icon={<GitBranch size={17} />}
        />
      </div>
      <div className="overview-grid">
        <Panel
          title="The rhythm of your workflows"
          eyebrow="CYCLE TIME TREND"
          extra={
            <div className="chart-key">
              <span />
              7-day average <i />
              Daily mean
            </div>
          }
        >
          <TrendChart data={data.trend} />
          <div className="chart-foot">
            <span>Elapsed cycle time · hours</span>
            <span className="change-key">
              <i />
              Rolling change-point flag
            </span>
          </div>
        </Panel>
        <Panel
          title="Where time stands still"
          eyebrow="PRIORITY QUEUES"
          extra={
            <Link className="icon-link" to="/bottlenecks" aria-label="All bottlenecks">
              <ArrowUpRight size={19} />
            </Link>
          }
        >
          <div className="bottleneck-list">
            {data.bottlenecks.slice(0, 3).map((b, i) => (
              <Link to="/bottlenecks" className="bottleneck-summary" key={b.name}>
                <span className="rank-number">0{i + 1}</span>
                <div>
                  <strong>{b.name}</strong>
                  <small>{number(b.count)} requests · mean wait</small>
                  <div className="track">
                    <span style={{ width: Math.max(b.score, 3) + '%', background: severity(b.mean) }} />
                  </div>
                </div>
                <span className="wait-number">
                  {hours(b.mean)}
                  <ArrowUpRight size={13} />
                </span>
              </Link>
            ))}
          </div>
          <div className="insight-note">
            <LightbulbIcon />
            <p>Start with the largest queue. A small change here can move the whole process.</p>
          </div>
        </Panel>
      </div>
      <div className="overview-bottom">
        <Panel
          title="Different workflows. Different delays."
          eyebrow="SLA BREACH BY PROCESS"
          extra={<Badge>Closed cases only</Badge>}
        >
          <Bars data={data.sla.by_process} height={218} />
        </Panel>
        <Panel title="Behind the headline numbers" eyebrow="PROCESS HEALTH">
          <div className="health-row">
            <span className="health-icon">
              <Repeat2 size={19} />
            </span>
            <div>
              <strong>Requests that come back</strong>
              <p>Repeated activities within a case</p>
            </div>
            <b>
              {number(o.rework_rate, 1)}
              <small>%</small>
            </b>
          </div>
          <div className="health-row">
            <span className="health-icon amber">
              <Clock3 size={19} />
            </span>
            <div>
              <strong>Still in progress</strong>
              <p>Open or incomplete request traces</p>
            </div>
            <b>{number(o.open_cases)}</b>
          </div>
          <Link to="/recommendations" className="action-card">
            <span>
              <small>TURN EVIDENCE INTO ACTION</small>
              <strong>Your next improvement starts here.</strong>
            </span>
            <ArrowRight size={20} />
          </Link>
        </Panel>
      </div>
    </>
  );
}
function LightbulbIcon() {
  return <Info size={17} />;
}

export function Bottlenecks() {
  const query = useAnalysis();
  const [dimension, setDimension] = useState('activity');
  return (
    <Guard query={query}>
      {(data) => <BottleneckContent data={data} dimension={dimension} setDimension={setDimension} />}
    </Guard>
  );
}
function BottleneckContent({
  data,
  dimension,
  setDimension,
}: {
  data: Analysis;
  dimension: string;
  setDimension: (d: string) => void;
}) {
  const { settings } = useApp();
  const [selected, setSelected] = useState<Bottleneck | null>(null);
  const ranking = useEndpoint<Bottleneck[]>('/bottlenecks?dimension=' + dimension);
  function change(value: string) {
    setDimension(value);
    setSelected(null);
  }
  const rows = dimension === 'activity' ? data.bottlenecks : (ranking.data ?? []);
  const error = ranking.error;
  return (
    <>
      <PageTitle
        index="03"
        title="Find the friction"
        description="Rank the queues that deserve your attention first."
      >
        <ExportButton format="csv" />
      </PageTitle>
      <div className="formula-strip">
        <span className="formula-icon">
          <SlidersHorizontal size={20} />
        </span>
        <div>
          <strong>A score you can explain</strong>
          <p>
            {(settings?.weights ?? [0.4, 0.25, 0.2, 0.15])
              .map(
                (w, i) =>
                  `${(w / (settings?.weights.reduce((a, b) => a + b, 0) || 1)).toFixed(2)} × norm(${['mean wait', 'p90 wait', 'volume', 'variance'][i]})`,
              )
              .join(' + ')}
          </p>
        </div>
        <Link to="/settings">
          Adjust weights <ArrowUpRight size={14} />
        </Link>
      </div>
      <Panel
        title="Bottleneck ranking"
        eyebrow="HIGHER SCORE · HIGHER PRIORITY"
        extra={
          <select aria-label="Rank by" value={dimension} onChange={(e) => void change(e.target.value)}>
            {['activity', 'edge', 'role', 'resource'].map((v) => (
              <option key={v} value={v}>
                By {v}
              </option>
            ))}
          </select>
        }
      >
        <ErrorNotice error={error} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank / {dimension}</th>
                <th>Priority score</th>
                <th>Mean queue</th>
                <th>P90 queue</th>
                <th>Service</th>
                <th>Cases</th>
                <th>Returned</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((b, i) => (
                <tr
                  key={b.name}
                  onClick={() => setSelected(b)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setSelected(b);
                  }}
                  className="clickable"
                >
                  <td>
                    <span className="row-rank">{String(i + 1).padStart(2, '0')}</span>
                    <strong>{b.name}</strong>
                  </td>
                  <td>
                    <div className="score-cell">
                      <div className="track">
                        <span style={{ width: b.score + '%', background: severity(b.mean) }} />
                      </div>
                      <b>{b.score.toFixed(1)}</b>
                    </div>
                  </td>
                  <td className="mono">{hours(b.mean)}</td>
                  <td className="mono">{hours(b.p90)}</td>
                  <td className="mono">{hours(b.service)}</td>
                  <td className="mono">{number(b.count)}</td>
                  <td>{b.return_rate.toFixed(1)}%</td>
                  <td>
                    <ArrowUpRight size={15} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-caption">
          Queue time belongs to the receiving step. Click a row to inspect its distribution.
        </div>
      </Panel>
      {selected && (
        <DetailDrawer title={selected.name} onClose={() => setSelected(null)}>
          <div className="drawer-stats">
            <div>
              <small>MEAN QUEUE</small>
              <strong>{hours(selected.mean)}</strong>
            </div>
            <div>
              <small>90TH PERCENTILE</small>
              <strong>{hours(selected.p90)}</strong>
            </div>
          </div>
          <h4>Waiting-time distribution · hours</h4>
          <Bars data={selected.histogram} nameKey="range" valueKey="count" unit="" height={230} />
          <h4>Five-number box summary · hours</h4>
          <div className="box-summary">
            {selected.box.map((n, i) => (
              <div key={i}>
                <small>{['Min', 'Q1', 'Median', 'Q3', 'Max'][i]}</small>
                <b>{n.toFixed(1)}</b>
              </div>
            ))}
          </div>
          <div className="boxplot">
            <div className="box-whisker" />
            <div
              className="box-range"
              style={{
                left: (selected.box[1] / (selected.box[4] || 1)) * 100 + '%',
                width: ((selected.box[3] - selected.box[1]) / (selected.box[4] || 1)) * 100 + '%',
              }}
            />
            <span style={{ left: (selected.box[2] / (selected.box[4] || 1)) * 100 + '%' }} />
          </div>
          <h4>Resource comparison · service hours</h4>
          <Bars
            data={selected.resources.slice(0, 8)}
            nameKey="resource"
            valueKey="service"
            unit="h"
            horizontal
            height={260}
          />
        </DetailDrawer>
      )}
    </>
  );
}
export function DetailDrawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    function handle(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = panel.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]),a[href],input,select,textarea,[tabindex="0"]',
      );
      if (!items?.length) {
        event.preventDefault();
        return;
      }
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === panel.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handle);
    return () => {
      document.removeEventListener('keydown', handle);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <section
        ref={panel}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="drawer-head">
          <div>
            <div className="eyebrow">EVIDENCE INSPECTOR</div>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" aria-label="Close details" onClick={onClose}>
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function Delays() {
  const query = useAnalysis();
  const root = useEndpoint<RootCause[]>('/delays/root-cause');
  const queue = useEndpoint<Queue>('/workload/queue');
  return (
    <Guard query={query}>
      {(data) => (
        <>
          <PageTitle
            index="04"
            title="Read the delay"
            description="Understand the timing, pressure and patterns behind each breach."
          >
            <ExportButton />
          </PageTitle>
          <div className="delay-top">
            <Panel title="SLA compliance" eyebrow="CLOSED REQUESTS">
              <div className="gauge-wrap">
                <div
                  className="gauge"
                  style={{
                    background: `conic-gradient(#14b8a6 ${data.sla.eligible ? (100 - data.sla.breach_rate) * 3.6 : 0}deg, var(--line) 0deg)`,
                  }}
                >
                  <div>
                    <strong>
                      {data.sla.eligible ? (100 - data.sla.breach_rate).toFixed(1) : 'N/A'}
                      {data.sla.eligible > 0 && <small>%</small>}
                    </strong>
                    <span>{data.sla.eligible ? 'within target' : 'no closed cases'}</span>
                  </div>
                </div>
                <div className="gauge-meta">
                  <b>{number(data.sla.eligible)}</b>
                  <span>eligible requests</span>
                  <p>
                    {hours(data.sla.avg_delay)} mean overshoot
                    <br />
                    {data.sla.open} open cases excluded
                  </p>
                </div>
              </div>
            </Panel>
            <Panel title="The long tail" eyebrow="CYCLE-TIME PERCENTILES · HOURS">
              <div className="percentiles">
                {Object.entries(data.sla.percentiles).map(([name, value]) => (
                  <div key={name}>
                    <small>{name.toUpperCase()}</small>
                    <strong>
                      {number(value, 1)}
                      <em>h</em>
                    </strong>
                    <span>
                      {name === 'p50'
                        ? 'Half of cases'
                        : name === 'p75'
                          ? 'Three in four'
                          : name === 'p90'
                            ? 'Nine in ten'
                            : '95% of cases'}
                    </span>
                  </div>
                ))}
              </div>
              <p className="panel-note">
                A widening gap between P50 and P95 means a small group waits much longer.
              </p>
            </Panel>
          </div>
          <Panel
            title="Pressure across the week"
            eyebrow="MEAN QUEUE · HOURS"
            extra={
              <div className="heatmap-legend">
                Lower <span /> Higher
              </div>
            }
          >
            <div className="heatmap">
              <div className="heatmap-header">
                <span />
                {Array.from({ length: 24 }, (_, hour) => (
                  <span key={hour}>{hour % 3 === 0 ? String(hour).padStart(2, '0') : ''}</span>
                ))}
              </div>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                <div className="heatmap-row" key={day}>
                  <span>{day}</span>
                  {data.heatmap
                    .filter((cell) => cell.day === index)
                    .map((cell) => (
                      <div
                        key={cell.hour}
                        tabIndex={0}
                        title={`${day} ${cell.hour}:00 · ${cell.count} arrivals · ${hours(cell.wait)} mean wait`}
                        aria-label={`${day} ${cell.hour}:00: ${cell.count} arrivals, ${hours(cell.wait)} mean wait`}
                        style={{
                          background: cell.count ? severity(cell.wait) : 'var(--heat-empty)',
                          opacity: cell.count ? 0.35 + Math.min(cell.wait / 80, 0.65) : 1,
                        }}
                      />
                    ))}
                </div>
              ))}
            </div>
            <div className="chart-foot">
              <span>Activity start hour · hover or focus a cell for evidence</span>
              <span>Monday–Sunday</span>
            </div>
          </Panel>
          <div className="two-col">
            <Panel title="Cycle time over the arrival cohort" eyebrow="TREND & CHANGE FLAGS">
              <TrendChart data={data.trend} />
            </Panel>
            <Panel title="Breach rate by department" eyebrow="SLA · PERCENT">
              <Bars data={data.sla.by_department} />
            </Panel>
          </div>
          <Panel title="The queue, over time" eyebrow="REQUESTS WAITING AT DAILY NOON SNAPSHOTS">
            <ErrorNotice error={queue.error} />
            {queue.isLoading ? (
              <div className="skeleton" />
            ) : (
              queue.data && (
                <>
                  <QueueChart
                    data={queue.data.series}
                    roles={queue.data.roles.filter((r) => r.peak > 0).map((r) => r.role)}
                  />
                  <div className="queue-summary">
                    {queue.data.roles
                      .filter((r) => r.peak > 0)
                      .map((r) => (
                        <div key={r.role}>
                          <span>{r.role}</span>
                          <b>{r.peak} peak</b>
                          <small>{r.utilisation.toFixed(1)}% utilisation proxy</small>
                        </div>
                      ))}
                  </div>
                </>
              )
            )}
          </Panel>
          <Panel
            title="Signals worth investigating"
            eyebrow="BREACH ASSOCIATION · NOT CAUSATION"
            extra={<Badge>Minimum 10 cases</Badge>}
          >
            <ErrorNotice error={root.error} />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Factor</th>
                    <th>Observed group</th>
                    <th>Cases</th>
                    <th>Breach rate</th>
                    <th>Lift</th>
                    <th>Chi-square p</th>
                  </tr>
                </thead>
                <tbody>
                  {root.data?.slice(0, 12).map((r) => (
                    <tr key={r.factor + r.value}>
                      <td>{r.factor.replace('_', ' ')}</td>
                      <td>
                        <strong>{r.value}</strong>
                      </td>
                      <td>{number(r.count)}</td>
                      <td>{r.breach.toFixed(1)}%</td>
                      <td>
                        <Badge tone={r.lift > 1.2 ? 'orange' : 'teal'}>{r.lift.toFixed(2)}×</Badge>
                      </td>
                      <td className="mono">{r.p_value < 0.001 ? '< 0.001' : r.p_value.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-caption">
              Lift = group breach rate ÷ overall breach rate. Unadjusted p-values are exploratory; correlated
              factors can overlap.
            </div>
          </Panel>
        </>
      )}
    </Guard>
  );
}

export function VariantPage() {
  const query = useAnalysis();
  const [onlyDeviations, setOnlyDeviations] = useState(false);
  return (
    <Guard query={query}>
      {(data) => (
        <>
          <PageTitle
            index="05"
            title="The paths people take"
            description="Compare what actually happens with the process you designed."
          />
          <div className="variant-summary">
            <div>
              <Target size={24} />
              <span>
                Alignment fitness
                <strong>
                  {data.variants.fitness === null ? 'N/A' : data.variants.fitness.toFixed(1)}
                  {data.variants.fitness !== null && <small>%</small>}
                </strong>
              </span>
            </div>
            <div>
              <CheckCircle2 size={24} />
              <span>
                Ideal-path cases<strong>{number(data.variants.conforming)}</strong>
              </span>
            </div>
            <div>
              <GitBranch size={24} />
              <span>
                Unique variants<strong>{data.variants.variants.length}</strong>
              </span>
            </div>
            <div>
              <Repeat2 size={24} />
              <span>
                Cases with rework<strong>{number(data.variants.rework_cases)}</strong>
              </span>
            </div>
          </div>
          {data.variants.unconfigured_processes.length > 0 && <p className="method-note">Conformance is not assessed for {data.variants.unconfigured_processes.join(', ')}. Define their ideal sequences in Data & settings. Fitness uses {number(data.variants.assessed_cases)} configured cases.</p>}
          <div className="deviation-strip">
            {Object.entries(data.variants.deviations).map(([name, count]) => (
              <span key={name}>
                {name.replace('_', ' ')} <b>{number(count)}</b>
              </span>
            ))}
            <small>Counts may overlap within a case.</small>
          </div>
          <Panel
            title="Discovered variants"
            eyebrow="EXACT ACTIVITY SEQUENCES"
            extra={
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={onlyDeviations}
                  onChange={(e) => setOnlyDeviations(e.target.checked)}
                />
                Deviations only
              </label>
            }
          >
            <div className="variant-list">
              {data.variants.variants
                .filter((v) => !onlyDeviations || (v.assessed && !v.happy))
                .map((v, i) => (
                  <article className="variant-row" key={v.process_type + v.sequence.join('|')}>
                    <div className="variant-top">
                      <span className="row-rank">V{String(i + 1).padStart(2, '0')}</span>
                      <strong>{v.process_type}</strong>
                      <Badge tone={v.happy ? 'teal' : 'orange'}>{!v.assessed ? 'Not configured' : v.happy ? 'Ideal path' : 'Deviation'}</Badge>
                      <span className="variant-numbers">
                        {number(v.count)} cases <i /> {hours(v.cycle)} mean <i /> {v.fitness === null ? 'N/A' : `${v.fitness.toFixed(0)}%`}
                        fitness
                      </span>
                    </div>
                    <div className="path-chips">
                      {v.sequence.map((activity, j) => (
                        <span className="chip-pair" key={j}>
                          <span className={'path-chip ' + (v.extra.includes(activity) ? 'deviation' : '')}>
                            {activity}
                          </span>
                          {j < v.sequence.length - 1 && <ArrowRight size={12} />}
                        </span>
                      ))}
                    </div>
                    {!v.happy && (
                      <div className="variant-reason">
                        {v.skipped.length > 0 && `Missing: ${v.skipped.join(', ')}. `}
                        {v.extra.length > 0 && `Extra/repeated: ${[...new Set(v.extra)].join(', ')}. `}
                        {v.wrong_order && 'Activities occur in the wrong order.'}
                      </div>
                    )}
                  </article>
                ))}
            </div>
          </Panel>
        </>
      )}
    </Guard>
  );
}

export function Cases() {
  const cohort = useCohortKey();
  return <CasesContent key={cohort} />;
}
function CasesContent() {
  const query = useAnalysis();
  const { filters } = useApp();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const {
    data: rows,
    error,
    isLoading,
  } = useEndpoint<{ items: CaseRow[]; total: number; page: number }>(
    `/cases?search=${encodeURIComponent(search)}&page=${page}&x=`,
  );
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [detailError, setDetailError] = useState<Error | null>(null);
  async function inspect(id: string) {
    try {
      setDetail(await request<CaseDetail>('/cases/' + encodeURIComponent(id) + '?' + queryString(filters)));
      setDetailError(null);
    } catch (e) {
      setDetailError(e as Error);
    }
  }
  return (
    <Guard query={query}>
      {() => (
        <>
          <PageTitle
            index="06"
            title="Follow a request"
            description="Every handoff, every queue, every decision — in one timeline."
          >
            <ExportButton format="csv" />
          </PageTitle>
          <Panel
            title="Case explorer"
            eyebrow="THE REQUEST REGISTER"
            extra={
              <label className="search-input">
                <Search size={15} />
                <input
                  placeholder="Search request ID…"
                  aria-label="Search case ID"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
            }
          >
            <ErrorNotice error={error ?? detailError} />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Request ID</th>
                    <th>Workflow</th>
                    <th>Department</th>
                    <th>Arrived</th>
                    <th>Cycle</th>
                    <th>SLA</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows?.items.map((row) => (
                    <tr
                      key={row.case_id}
                      className="clickable"
                      tabIndex={0}
                      onClick={() => void inspect(row.case_id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void inspect(row.case_id);
                      }}
                    >
                      <td className="mono">
                        <strong>{row.case_id}</strong>
                      </td>
                      <td>{row.process_type}</td>
                      <td>{row.department}</td>
                      <td>
                        {new Date(row.start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="mono">{hours(row.cycle)}</td>
                      <td className="mono">{row.sla}h</td>
                      <td>
                        <Badge
                          tone={
                            row.status === 'Open'
                              ? 'amber'
                              : row.breached
                                ? 'orange'
                                : row.status === 'Rejected'
                                  ? 'neutral'
                                  : 'teal'
                          }
                        >
                          {row.status === 'Open' ? 'Open' : row.breached ? 'SLA breached' : row.status}
                        </Badge>
                      </td>
                      <td>
                        <ArrowUpRight size={14} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {isLoading && <div className="table-caption">Loading requests…</div>}
              {rows?.total === 0 && <div className="empty-mini">No request IDs match this search.</div>}
            </div>
            <div className="pagination">
              <span>
                {number(rows?.total ?? 0)} requests · page {page} of{' '}
                {Math.max(1, Math.ceil((rows?.total ?? 0) / 20))}
              </span>
              <div className="flex">
                <button
                  className="icon-button"
                  aria-label="Previous page"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Next page"
                  disabled={page * 20 >= (rows?.total ?? 0)}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          </Panel>
          {detail && (
            <DetailDrawer title={detail.case_id} onClose={() => setDetail(null)}>
              <div className="drawer-stats">
                <div>
                  <small>OBSERVED CYCLE</small>
                  <strong>{hours(detail.cycle)}</strong>
                </div>
                <div>
                  <small>SLA TARGET</small>
                  <strong>{hours(detail.sla)}</strong>
                </div>
              </div>
              <Badge tone={detail.breached ? 'orange' : 'teal'}>
                {detail.status}
                {detail.breached ? ' · SLA breached' : ''}
              </Badge>
              <p className="panel-note">
                Timeline queues use the selected clock; service stays elapsed. Hatched sections are queues.
              </p>
              <div className="case-timeline">
                {detail.events.map((event, i) => {
                  const total = Math.max(
                    detail.events[detail.events.length - 1].offset +
                      detail.events[detail.events.length - 1].service,
                    1,
                  );
                  const beyond = event.offset + event.service > detail.sla;
                  return (
                    <div className="timeline-row" key={i}>
                      <div className="timeline-label">
                        <span className={'timeline-step ' + (beyond ? 'late' : '')}>{i + 1}</span>
                        <div>
                          <strong>{event.activity}</strong>
                          <small>
                            {event.resource} · {event.outcome}
                          </small>
                        </div>
                      </div>
                      <div className="gantt-track">
                        <span
                          className="gantt-sla"
                          style={{ left: Math.min((detail.sla / total) * 100, 100) + '%' }}
                          title="SLA deadline"
                        />
                        <span
                          className="gantt-wait"
                          style={{
                            left: Math.max(((event.offset - event.wait) / total) * 100, 0) + '%',
                            width: (event.wait / total) * 100 + '%',
                          }}
                        />
                        <span
                          className={'gantt-service ' + (beyond ? 'late' : '')}
                          style={{
                            left: (event.offset / total) * 100 + '%',
                            width: Math.max((event.service / total) * 100, 0.7) + '%',
                          }}
                        />
                      </div>
                      <div className="timeline-times">
                        <span>
                          {hours(event.wait)} queue · {hours(event.service)} service
                        </span>
                        <span>
                          {event.end_time
                            ? new Date(event.start_time).toLocaleString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Unfinished interval'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </DetailDrawer>
          )}
        </>
      )}
    </Guard>
  );
}

export function Recommendations() {
  const query = useAnalysis();
  return (
    <Guard query={query}>
      {(data) => (
        <>
          <PageTitle
            index="08"
            title="Make the next move"
            description="Prioritised improvements, grounded in the evidence you already have."
          >
            <ExportButton />
          </PageTitle>
          <div className="recommendation-intro">
            <span className="intro-icon">
              <Target size={26} />
            </span>
            <div>
              <h3>Better flow starts with one focused change.</h3>
              <p>
                Actions are ranked by simulated hours saved. Each estimate reduces the selected queue by 50%
                while keeping the rest of the process fixed.
              </p>
            </div>
            <Badge tone="teal">{data.recommendations.length} opportunities</Badge>
          </div>
          <div className="recommendation-list">
            {data.recommendations.map((r, i) => (
              <article key={r.activity} className="recommendation-card">
                <span className="recommendation-rank">{String(i + 1).padStart(2, '0')}</span>
                <div className="recommendation-main">
                  <div className="flex">
                    <Badge tone={i === 0 ? 'orange' : 'teal'}>
                      {i === 0 ? 'Highest impact' : 'Improvement'}
                    </Badge>
                    <span className="effort">{r.effort} effort</span>
                  </div>
                  <h2>{r.title}</h2>
                  <p>{r.action}</p>
                  <div className="evidence">
                    <Info size={14} />
                    {r.evidence}
                  </div>
                  <Link to="/bottlenecks">
                    Inspect the evidence <ArrowUpRight size={14} />
                  </Link>
                </div>
                <div className="recommendation-impact">
                  <small>50% QUEUE REDUCTION</small>
                  <strong>
                    {number(r.impact.saved_hours)}
                    <span>hours saved</span>
                  </strong>
                  <div>{r.impact.rescued} breaches avoided</div>
                  <span className="impact-secondary">
                    30% reduction → {number(r.impact_30.saved_hours)}h saved
                  </span>
                  <Link to="/predict">
                    Try a scenario <ArrowRight size={14} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
          <div className="method-note">
            <Info size={18} />
            <p>
              These are queue-reduction scenarios, not guaranteed savings. Service time, incoming demand and
              downstream capacity stay fixed. Validate an intervention with a pilot before changing policy.
            </p>
          </div>
        </>
      )}
    </Guard>
  );
}
