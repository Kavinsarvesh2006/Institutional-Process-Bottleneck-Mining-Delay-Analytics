import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Database, RefreshCw, AlertCircle, LoaderCircle, Download } from 'lucide-react';
import { useApp, post, queryString, number } from '../api';
import type { Analysis } from '../types';
export function Panel({
  title,
  eyebrow,
  extra,
  children,
  className = '',
}: {
  title: string;
  eyebrow?: string;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={'panel ' + className}>
      <div className="panel-head">
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h3>{title}</h3>
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}
export function PageTitle({
  index,
  title,
  description,
  children,
}: {
  index: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">
          WORKFLOW OBSERVATORY <span>/ {index}</span>
        </div>
        <h1>
          {title}
          <span className="title-dot">.</span>
        </h1>
        <p>{description}</p>
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={'badge ' + tone}>{children}</span>;
}
export function LoadState({ loading, error }: { loading: boolean; error: Error | null }) {
  const { notify, setFilters, filters } = useApp();
  const client = useQueryClient();
  async function seed() {
    try {
      const response = await post<{ dataset_id: number }>('/datasets/seed', {});
      setFilters({
        ...filters,
        dataset_id: String(response.dataset_id),
        start: '',
        end: '',
        process_type: '',
        department: '',
      });
      await client.invalidateQueries();
      notify('Sample data loaded. Your observatory is ready.');
    } catch (e) {
      notify((e as Error).message);
    }
  }
  if (loading)
    return (
      <div className="skeleton-grid" aria-label="Loading analytics">
        <div className="skeleton hero" />
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton wide" />
      </div>
    );
  return (
    <div className="empty-state">
      <div className="empty-icon">
        {error?.message.includes('Load a sample') ? <Database size={36} /> : <AlertCircle size={36} />}
      </div>
      <h2>
        {error?.message.includes('Load a sample')
          ? 'Give your workflows a closer look'
          : 'No analysis to show'}
      </h2>
      <p>{error?.message ?? 'Choose a dataset to begin.'}</p>
      <div className="flex">
        <button className="primary" onClick={seed}>
          <Database size={16} />
          Load sample data
        </button>
        <button
          className="button"
          onClick={() => {
            setFilters({ ...filters, process_type: '', department: '', start: '', end: '' });
            void client.invalidateQueries();
          }}
        >
          <RefreshCw size={15} />
          Reset filters
        </button>
      </div>
    </div>
  );
}
export function Guard({
  query,
  children,
}: {
  query: { isLoading: boolean; error: Error | null; data: Analysis | undefined };
  children: (data: Analysis) => ReactNode;
}) {
  return query.data ? children(query.data) : <LoadState loading={query.isLoading} error={query.error} />;
}
export function ExportButton({ format = 'report' }: { format?: 'report' | 'csv' }) {
  const { filters, notify } = useApp();
  async function download() {
    try {
      const response = await fetch('/api/export/' + format + '?' + queryString(filters));
      if (!response.ok) throw new Error('Export failed. Load a dataset first.');
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `flowlens-${format}.${format === 'csv' ? 'csv' : 'pdf'}`;
      anchor.click();
      URL.revokeObjectURL(url);
      notify('Your export is ready.');
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <button className="button" onClick={download}>
      <Download size={15} />
      {format === 'csv' ? 'Export CSV' : 'Export report'}
    </button>
  );
}
export function Metric({
  label,
  value,
  unit,
  detail,
  icon,
  tone = 'indigo',
}: {
  label: string;
  value: string;
  unit?: string;
  detail: ReactNode;
  icon: ReactNode;
  tone?: string;
}) {
  return (
    <div className={'metric ' + tone}>
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <div className="metric-value">
        {value}
        <small>{unit}</small>
      </div>
      <div className="metric-detail">{detail}</div>
    </div>
  );
}
export function ErrorNotice({ error }: { error: Error | null }) {
  return error ? (
    <div className="inline-error" role="alert">
      <AlertCircle size={16} />
      {error.message}
    </div>
  ) : null;
}
export function Busy({ busy, children }: { busy: boolean; children: ReactNode }) {
  return <>{busy ? <LoaderCircle size={16} className="spin" /> : children}</>;
}
export function SmallStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="small-stat">
      <span>{label}</span>
      <strong>{number(value, 1)}</strong>
      <ArrowUpRight size={16} />
    </div>
  );
}
