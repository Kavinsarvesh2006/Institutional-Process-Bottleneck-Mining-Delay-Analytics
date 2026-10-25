import { describe, it, expect, vi, afterEach } from 'vitest';
import { queryString, request, hours, number, severity } from './api';
describe('API contracts', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('preserves filters while encoding department names and ignoring empty values', () => {
    const query = queryString({
      dataset_id: '7',
      process_type: 'Fee Receipt',
      department: 'AI & DS',
      start: '',
      end: '',
    });
    expect(new URLSearchParams(query).get('department')).toBe('AI & DS');
    expect(query).not.toContain('start=');
  });
  it('reports human-readable server errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, json: async () => ({ detail: 'No cases match these filters.' }) }),
    );
    await expect(request('/overview')).rejects.toThrow('No cases match these filters.');
  });
  it('reports validation arrays without swallowing errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({
          ok: false,
          json: async () => ({ detail: [{ msg: 'positive hours required' }] }),
        }),
    );
    await expect(request('/settings')).rejects.toThrow('positive hours required');
  });
  it('returns the validated payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ total_cases: 3200 }) }),
    );
    expect(await request('/overview')).toEqual({ total_cases: 3200 });
  });
  it('formats units and keeps severity thresholds consistent', () => {
    expect(hours(24.48)).toBe('24.5h');
    expect(number(3200)).toBe('3,200');
    expect(severity(0)).toBe('#14b8a6');
    expect(severity(12)).toBe('#f59e0b');
    expect(severity(24)).toBe('#ea580c');
    expect(severity(48)).toBe('#dc2626');
  });
});
