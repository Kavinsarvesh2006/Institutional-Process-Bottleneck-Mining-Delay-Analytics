"""Directly-follows discovery, sequence fitness and calendar-aware queue intervals."""
from difflib import SequenceMatcher
from collections import Counter
import numpy as np
import pandas as pd

def business_clock(values: pd.Series, holidays: list[str]) -> np.ndarray:
    """Map datetimes to cumulative 09–17 Monday–Saturday business hours."""
    dates = values.to_numpy(dtype='datetime64[D]')
    valid = ~np.isnat(dates)
    safe = np.where(valid, dates, np.datetime64('2000-01-01'))
    calendar = np.busdaycalendar(weekmask='1111110', holidays=holidays)
    days = np.busday_count(np.datetime64('2000-01-01'), safe, busdaycal=calendar)
    hours = values.dt.hour.fillna(0) + values.dt.minute.fillna(0)/60 + values.dt.second.fillna(0)/3600
    result = days*8 + np.where(np.is_busday(safe, busdaycal=calendar), np.clip(hours-9, 0, 8), 0)
    return np.where(valid, result, np.nan)

def prepare(frame: pd.DataFrame, settings: dict) -> pd.DataFrame:
    """Attach each queue gap to its receiving activity and retain raw durations."""
    data = frame.sort_values(['case_id', 'start_time'], kind='stable').copy()
    for col in ['start_time', 'end_time']:
        data[col] = pd.to_datetime(data[col], format='mixed')
    data['previous'] = data.groupby('case_id').activity.shift()
    data['previous_end'] = data.groupby('case_id').end_time.shift()
    data['service'] = (data.end_time-data.start_time).dt.total_seconds().div(3600).clip(lower=0).fillna(0)
    data['raw_wait'] = (data.start_time-data.previous_end).dt.total_seconds().div(3600).clip(lower=0).fillna(0)
    if settings['working_hours']:
        delta = business_clock(data.start_time, settings['holidays'])-business_clock(data.previous_end, settings['holidays'])
        data['wait'] = np.nan_to_num(np.maximum(delta, 0))
    else:
        data['wait'] = data.raw_wait
    return data

def stats(values: pd.Series) -> dict:
    """Distribution summary in hours, including a compact histogram and box plot."""
    counts, bounds = np.histogram(values, bins=8) if len(values) else (np.zeros(8), np.arange(9))
    return {'mean': float(values.mean()) if len(values) else 0, 'median': float(values.median()) if len(values) else 0,
            'p90': float(values.quantile(.9)) if len(values) else 0, 'variance': float(values.var(ddof=0)) if len(values) else 0,
            'histogram': [{'range': f'{bounds[i]:.0f}–{bounds[i+1]:.0f}', 'count': int(c)} for i,c in enumerate(counts)],
            'box': [float(values.quantile(q)) if len(values) else 0 for q in [0,.25,.5,.75,1]]}

def graph(data: pd.DataFrame, min_freq: float = 0) -> dict:
    """Discover edge frequencies; threshold is percent of the busiest edge."""
    edges = []
    for (source, target), group in data.dropna(subset=['previous']).groupby(['previous','activity']):
        edges.append({'source': source, 'target': target, 'count': len(group), **stats(group.wait)})
    maximum = max((e['count'] for e in edges), default=0)
    return {'nodes': [{'id': name, 'count': len(group), 'service': float(group.service.mean()), 'wait': float(group.wait.mean())}
                      for name, group in data.groupby('activity')],
            'edges': [e for e in edges if e['count'] >= maximum * min_freq / 100]}

def deviations(sequence: list[str], ideal: list[str]) -> dict:
    """Multiset step differences plus order errors; fitness uses edit alignment."""
    missing = list((Counter(ideal) - Counter(sequence)).elements())
    extra = list((Counter(sequence) - Counter(ideal)).elements())
    shared = [step for step in sequence if step in ideal]
    wrong = bool(not missing and not extra and shared != ideal)
    fitness = SequenceMatcher(None, ideal, sequence, autojunk=False).ratio()*100
    return {'fitness': fitness, 'skipped': missing, 'extra': extra, 'wrong_order': wrong}

def variants(data: pd.DataFrame, cases: pd.DataFrame, settings: dict) -> dict:
    """Group exact traces and compare each variant to its configured ideal path."""
    traces = data.groupby('case_id', sort=False).activity.agg(tuple)
    merged = cases.set_index('case_id').join(traces.rename('sequence'))
    rows = []
    for (process, sequence), group in merged.groupby(['process_type', 'sequence']):
        ideal = settings['ideal_paths'].get(process)
        diff = deviations(list(sequence), ideal) if ideal else {'fitness': None, 'skipped': [], 'extra': [], 'wrong_order': False}
        rows.append({'process_type': process, 'sequence': list(sequence), 'count': len(group),
                     'cycle': float(group.cycle.mean()), 'assessed': bool(ideal), 'happy': diff['fitness'] == 100, **diff})
    rows.sort(key=lambda row: row['count'], reverse=True)
    assessed = sum(r['count'] for r in rows if r['assessed'])
    return {'variants': rows, 'fitness': sum(r['fitness']*r['count'] for r in rows if r['assessed'])/assessed if assessed else None,
            'assessed_cases': assessed, 'unconfigured_processes': sorted({r['process_type'] for r in rows if not r['assessed']}),
            'conforming': sum(r['count'] for r in rows if r['happy']),
            'deviations': {name: sum(r['count'] for r in rows if r[name]) for name in ['skipped','extra','wrong_order']},
            'rework_cases': int(data.loc[data.duplicated(['case_id','activity']), 'case_id'].nunique())}
