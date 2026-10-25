import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VariantPage, Delays } from './pages/analytics';
import { SettingsPage } from './pages/interactive';
import type { ReactNode } from 'react';

const fixture = vi.hoisted(() => ({
  settings: { working_hours: false, anonymise: false, holidays: [], weights: [.4, .25, .2, .15], ideal_paths: {}, sla_rules: {}, activity_targets: {} },
  filters: { dataset_id: '2', process_type: '', department: '', start: '', end: '' },
  datasets: [{ id: 2, name: 'Custom import', cases: 1, created_at: '2026-01-01', process_types: ['Scholarship Review'], departments: ['Design'], activities: ['Submission', 'Complete'], quality: { accepted: 2, rejected: 0, duplicates: 0, warnings: [], errors: [], rows: [] } }],
  analysis: {
    variants: { variants: [{ process_type: 'Scholarship Review', sequence: ['Submission', 'Complete'], count: 1, cycle: 5, happy: false, assessed: false, fitness: null, skipped: [], extra: [], wrong_order: false }], fitness: null, conforming: 0, assessed_cases: 0, unconfigured_processes: ['Scholarship Review'], deviations: { skipped: 0, extra: 0, wrong_order: 0 }, rework_cases: 0 },
    sla: { eligible: 0, open: 1, breach_rate: 0, avg_delay: 0, percentiles: { p50: 0, p75: 0, p90: 0, p95: 0 }, by_process: [], by_department: [], by_weekday: [] },
    heatmap: [], trend: [],
  },
}));

vi.mock('./api', async (original) => ({
  ...await original<typeof import('./api')>(),
  useApp: () => ({ ...fixture, notify: vi.fn(), setFilters: vi.fn() }),
  useAnalysis: () => ({ data: fixture.analysis, isLoading: false, error: null }),
  useEndpoint: () => ({ data: undefined, isLoading: false, error: null }),
}));

function render(page: ReactNode): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(<QueryClientProvider client={client}>{page}</QueryClientProvider>);
}

describe('Custom workflow presentation', () => {
  it('shows unconfigured conformance without claiming perfect fitness', () => {
    const html = render(<VariantPage />);
    expect(html).toContain('Not configured');
    expect(html).toContain('N/A');
    expect(html).toContain('Define their ideal sequences');
    expect(html).not.toContain('100.0');
  });
  it('offers SLA and ideal-path controls for a newly uploaded workflow', () => {
    const html = render(<SettingsPage />);
    expect(html).toContain('Scholarship Review');
    expect(html).toContain('Case SLA');
    expect(html).toContain('Ideal sequence');
    expect(html).toContain('Complete');
    expect(html).toContain('value="120"');
  });
  it('does not show 100 percent SLA compliance for a cohort with no closed cases', () => {
    const html = render(<Delays />);
    expect(html).toContain('no closed cases');
    expect(html).toContain('N/A');
    expect(html).not.toContain('100.0');
  });
});
