import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import {
  Activity,
  LayoutDashboard,
  GitFork,
  Hourglass,
  ChartNoAxesCombined,
  Route as RouteIcon,
  Search,
  FlaskConical,
  Lightbulb,
  Database,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Sun,
  Moon,
  ArrowUpRight,
  SlidersHorizontal,
  CalendarDays,
  Menu,
  GraduationCap,
  PanelLeftClose,
} from 'lucide-react';
import { useApp, selectedDataset } from './api';
import { Overview, Bottlenecks, Delays, VariantPage, Cases, Recommendations } from './pages/analytics';
import ProcessMap from './pages/ProcessMap';
import { PredictSimulate, SettingsPage } from './pages/interactive';
const navigation = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/process', label: 'Process map', icon: GitFork },
  { path: '/bottlenecks', label: 'Bottlenecks', icon: Hourglass },
  { path: '/delays', label: 'Delay analytics', icon: ChartNoAxesCombined },
  { path: '/variants', label: 'Variants & conformance', icon: RouteIcon },
  { path: '/cases', label: 'Case explorer', icon: Search },
  { path: '/predict', label: 'Predict & simulate', icon: FlaskConical },
  { path: '/recommendations', label: 'Recommendations', icon: Lightbulb },
  { path: '/settings', label: 'Data & settings', icon: Database },
];
export default function App() {
  const { filters, setFilters, datasets, settings } = useApp();
  const activeDataset = selectedDataset(datasets, filters.dataset_id);
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('flowlens-theme') === 'dark');
  const location = useLocation();
  const current = navigation.find((n) => n.path === location.pathname);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  function toggleTheme() {
    const value = !dark;
    setDark(value);
    localStorage.setItem('flowlens-theme', value ? 'dark' : 'light');
  }
  return (
    <div
      className={
        'app ' + (dark ? 'dark ' : '') + (collapsed ? 'collapsed ' : '') + (mobile ? 'mobile-open' : '')
      }
    >
      <aside className="sidebar">
        <a href="/" className="brand">
          <span className="brand-symbol">
            <Activity size={25} />
            <i />
          </span>
          <span className="brand-text">
            FlowLens<span>CAMPUS INTELLIGENCE</span>
          </span>
        </a>
        <button
          className="mobile-close icon-button"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
        >
          <PanelLeftClose />
        </button>
        <div className="sidebar-label">
          WORKSPACE <span>01</span>
        </div>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <NavLink
              to={item.path}
              key={item.path}
              end={item.path === '/'}
              onClick={() => setMobile(false)}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.path === '/delays' && <em>SLA</em>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <div className="flex">
              <span className="status-dot" />
              LOCAL WORKSPACE
            </div>
            <p>
              Your data stays
              <br />
              on your machine.
            </p>
            <span>
              Offline by design <ArrowUpRight size={12} />
            </span>
          </div>
          <div className="college">
            <span className="college-icon">
              <GraduationCap size={21} />
            </span>
            <div>
              V.S.B. Engineering College<small>AI & Data Science · Project 34</small>
            </div>
          </div>
          <button className="collapse-button" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? (
              <ChevronsRight size={17} />
            ) : (
              <>
                <ChevronsLeft size={17} />
                <span>Collapse sidebar</span>
              </>
            )}
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-shade"
          onClick={() => setMobile(false)}
          aria-label="Close navigation overlay"
        />
      )}
      <div className="main-wrap">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>{current?.label ?? 'Overview'}</strong>
          </div>
          <div className="topbar-right">
            <span className="local-status">
              <span className="status-dot" />
              Local session
            </span>
            <span className="divider" />
            <button
              className="icon-button"
              onClick={toggleTheme}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span className="avatar" title="Institution administrator">
              VS
            </span>
          </div>
        </header>
        <div className="filterbar">
          <label className="dataset-select">
            <Database size={15} />
            <select
              aria-label="Dataset"
              value={filters.dataset_id}
              onChange={(e) => setFilters({ dataset_id: e.target.value, process_type: '', department: '', start: '', end: '' })}
            >
              <option value="">{datasets.length ? 'Latest dataset' : 'No dataset loaded'}</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <ChevronDown size={13} />
          </label>
          <span className="filter-divider" />
          <label className="process-select">
            <span>Process</span>
            <select
              aria-label="Process type"
              value={filters.process_type}
              onChange={(e) => setFilters({ ...filters, process_type: e.target.value })}
            >
              <option value="">All workflows</option>
              {(activeDataset?.process_types ?? Object.keys(settings?.ideal_paths ?? {})).map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <div className="filter-end">
            <span className="clock-label">
              {settings?.working_hours ? 'Working-hour clock' : 'Elapsed-hour clock'}
            </span>
            <button
              className={'button filter-toggle ' + (showFilters ? 'selected' : '')}
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal size={14} />
              Filters{(filters.start || filters.department) && <span className="filter-active" />}
            </button>
          </div>
        </div>
        {showFilters && (
          <div className="extended-filters">
            <CalendarDays size={16} />
            <label>
              Arrivals from
              <input
                aria-label="Start date"
                type="date"
                value={filters.start}
                onChange={(e) => setFilters({ ...filters, start: e.target.value })}
              />
            </label>
            <label>
              Through
              <input
                aria-label="End date"
                type="date"
                value={filters.end}
                onChange={(e) => setFilters({ ...filters, end: e.target.value })}
              />
            </label>
            <label>
              Department
              <input
                placeholder="Exact department name"
                value={filters.department}
                onChange={(e) => setFilters({ ...filters, department: e.target.value })}
              />
            </label>
            <button
              className="text-button"
              onClick={() => setFilters({ ...filters, process_type: '', start: '', end: '', department: '' })}
            >
              Clear filters
            </button>
          </div>
        )}
        <main>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/process" element={<ProcessMap />} />
            <Route path="/bottlenecks" element={<Bottlenecks />} />
            <Route path="/delays" element={<Delays />} />
            <Route path="/variants" element={<VariantPage />} />
            <Route path="/cases" element={<Cases />} />
            <Route path="/predict" element={<PredictSimulate />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route
              path="*"
              element={
                <div className="empty-state">
                  <h1>Page not found</h1>
                  <a href="/">Return to overview</a>
                </div>
              }
            />
          </Routes>
          <footer className="page-footer">
            <span>
              FLOWLENS <i /> V.S.B. ENGINEERING COLLEGE
            </span>
            <span>Institutional Process Bottleneck Mining & Delay Analytics</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
