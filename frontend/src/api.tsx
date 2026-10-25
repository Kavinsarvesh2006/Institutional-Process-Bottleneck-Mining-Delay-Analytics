import { createContext, useContext, useState, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Analysis, Dataset, Filters, Settings } from './types';

export function queryString(filters: Filters): string {
  return new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '')).toString();
}
export function selectedDataset(datasets: Dataset[], id: string): Dataset | undefined {
  return id ? datasets.find((dataset) => String(dataset.id) === id) : datasets[0];
}
export function cohortIdentity(filters: Filters, dataset: Dataset | undefined, settings: Settings | undefined): string {
  return JSON.stringify([filters, dataset?.id, settings]);
}
export function useCohortKey(): string {
  const { filters, datasets, settings } = useApp();
  return cohortIdentity(filters, selectedDataset(datasets, filters.dataset_id), settings);
}
export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch('/api' + path, options);
  if (!response.ok) {
    const body = (await response
      .json()
      .catch(() => ({ detail: 'The server could not complete this request.' }))) as { detail: unknown };
    throw new Error(typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail));
  }
  return response.json() as Promise<T>;
}
export function post<T>(path: string, payload: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
const initial: Filters = { dataset_id: '', process_type: '', department: '', start: '', end: '' };
interface AppContext {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  notify: (message: string) => void;
  datasets: Dataset[];
  settings: Settings | undefined;
}
const Context = createContext<AppContext | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState(initial);
  const [toast, setToast] = useState('');
  const datasets = useQuery({ queryKey: ['datasets'], queryFn: () => request<Dataset[]>('/datasets') });
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => request<Settings>('/settings') });
  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 5500);
  }
  return (
    <Context.Provider
      value={{ filters, setFilters, notify, datasets: datasets.data ?? [], settings: settings.data }}
    >
      {children}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button aria-label="Dismiss notification" onClick={() => setToast('')}>
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export function useApp() {
  const context = useContext(Context);
  if (!context) throw new Error('Application provider missing');
  return context;
}
export function useAnalysis() {
  const { filters } = useApp();
  return useQuery({
    queryKey: ['analysis', filters],
    queryFn: () => request<Analysis>('/analysis?' + queryString(filters)),
  });
}
export function useEndpoint<T>(path: string) {
  const { filters } = useApp();
  return useQuery({
    queryKey: [path, filters],
    queryFn: () => request<T>(path + (path.includes('?') ? '&' : '?') + queryString(filters)),
  });
}
export const number = (n: number, digits = 0) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits }).format(n);
export const hours = (n: number) => `${number(n, 1)}h`;
export function severity(n: number): string {
  return n >= 48 ? '#dc2626' : n >= 24 ? '#ea580c' : n >= 12 ? '#f59e0b' : '#14b8a6';
}
