"""SLA metrics, time-series diagnostics, root-cause associations and queue load."""
import numpy as np
import pandas as pd
from scipy.stats import chi2_contingency

def case_metrics(data: pd.DataFrame, settings: dict) -> pd.DataFrame:
    """Create one row per case; observed open intervals are never imputed closed."""
    group = data.groupby('case_id', sort=False)
    cases = group.agg(process_type=('process_type','first'), department=('department','first'), start=('start_time','min'),
                      end=('end_time','max'), cycle_service=('service','sum'), wait=('wait','sum'),raw_wait=('raw_wait','sum'),
                      missing=('end_time',lambda s: s.isna().any()), last=('activity','last'), outcome=('outcome','last')).reset_index()
    terminals = cases.process_type.map({name: path[-1] for name, path in settings['ideal_paths'].items() if path}).fillna('Issued')
    cases['status'] = np.where(cases.missing | (~cases['last'].eq(terminals) & ~cases.outcome.eq('Rejected')), 'Open', np.where(cases.outcome.eq('Rejected'),'Rejected','Completed'))
    cases['cycle'] = (cases.end-cases.start).dt.total_seconds().div(3600).clip(lower=0).fillna(0)
    # Calendar toggle changes queue components; service is observed elapsed work.
    if settings['working_hours']:
        cases['cycle'] = cases.cycle - cases.raw_wait + cases.wait
    cases['sla'] = cases.process_type.map(settings['sla_rules']).fillna(120)
    cases['breached'] = cases.cycle.gt(cases.sla) & cases.status.ne('Open')
    cases['delay'] = (cases.cycle-cases.sla).clip(lower=0)
    cases['weekday'] = cases.start.dt.day_name()
    return cases

def sla(cases: pd.DataFrame) -> dict:
    """Completed and rejected cases are eligible; open cases are reported separately."""
    closed = cases[cases.status.ne('Open')]
    def aggregate(column: str) -> list[dict]:
        """Return comparable SLA rates by a factor."""
        return [{'name': str(name), 'count': len(group), 'breach': float(group.breached.mean()*100), 'cycle': float(group.cycle.mean())}
                for name, group in closed.groupby(column)]
    return {'eligible': len(closed), 'open': int(cases.status.eq('Open').sum()), 'breach_rate': float(closed.breached.mean()*100) if len(closed) else 0,
            'avg_delay': float(closed.loc[closed.breached,'delay'].mean()) if closed.breached.any() else 0,
            'percentiles': {f'p{q}': float(closed.cycle.quantile(q/100)) if len(closed) else 0 for q in [50,75,90,95]},
            'by_process': aggregate('process_type'), 'by_department': aggregate('department'), 'by_weekday': aggregate('weekday')}

def trend(cases: pd.DataFrame) -> list[dict]:
    """Arrival-cohort daily means and trailing seven-day mean with z-score flags."""
    closed = cases[cases.status.ne('Open')].copy()
    if closed.empty:
        return []
    closed['date'] = closed.start.dt.floor('D')
    daily = closed.groupby('date').agg(cycle=('cycle','mean'),breach=('breached','mean'), count=('case_id','size')).resample('D').asfreq()
    daily['moving'] = daily.cycle.rolling(7,min_periods=1).mean()
    prior = daily.cycle.shift(1).rolling(21,min_periods=10)
    daily['z_score'] = ((daily.cycle-prior.mean())/prior.std().replace(0,np.nan)).fillna(0)
    daily['change'] = daily.z_score.abs().gt(2.5)
    daily['breach'] *= 100
    daily['date'] = daily.index.strftime('%Y-%m-%d')
    return daily.reset_index(drop=True).replace({np.nan: None}).to_dict('records')

def heatmap(data: pd.DataFrame) -> list[dict]:
    """Arrivals at activities by weekday and hour; color encodes queue hours."""
    frame = data.assign(day=data.start_time.dt.dayofweek,hour=data.start_time.dt.hour)
    grouped = frame.groupby(['day','hour']).agg(count=('case_id','size'),wait=('wait','mean'))
    return [{'day':day,'hour':hour,'count':int(grouped.loc[(day,hour),'count']) if (day,hour) in grouped.index else 0,
             'wait':float(grouped.loc[(day,hour),'wait']) if (day,hour) in grouped.index else 0} for day in range(7) for hour in range(24)]

def root_causes(data: pd.DataFrame, cases: pd.DataFrame) -> list[dict]:
    """Case-presence lift and chi-square association; these do not imply causality."""
    eligible = cases[cases.status.ne('Open')]
    baseline = eligible.breached.mean()
    if not len(eligible) or baseline == 0:
        return []
    rows = []
    events = data.merge(eligible[['case_id','breached']],on='case_id')
    factors = {key: events[['case_id',key,'breached']].drop_duplicates(['case_id',key]) for key in ['role','resource']}
    factors.update({key: eligible[['case_id',key,'breached']] for key in ['department','process_type','weekday']})
    for factor, frame in factors.items():
        for value, group in frame.groupby(factor):
            ids = group.case_id.unique()
            yes = eligible.case_id.isin(ids)
            table = pd.crosstab(yes, eligible.breached).reindex(index=[False,True],columns=[False,True],fill_value=0)
            pvalue = float(chi2_contingency(table,correction=True).pvalue) if (table.sum(axis=0)>0).all() and (table.sum(axis=1)>0).all() else 1.
            if len(group) >= 10:
                rows.append({'factor':factor,'value':str(value),'count':len(group),'breach':float(group.breached.mean()*100),'lift':float(group.breached.mean()/baseline),'p_value':pvalue})
    return sorted(rows,key=lambda row:row['lift'],reverse=True)

def queue(data: pd.DataFrame) -> dict:
    """Exact queued requests at daily noon snapshots, using a sweep-line search."""
    if data.empty:
        return {'series':[], 'roles':[]}
    times = pd.date_range(data.start_time.min().floor('D'),data.start_time.max().ceil('D'),freq='D')+pd.Timedelta(hours=12)
    series = [{'date':stamp.strftime('%Y-%m-%d')} for stamp in times]
    roles = []
    for role, group in data.groupby('role'):
        waiting = group[group.previous_end.notna() & group.start_time.gt(group.previous_end)]
        starts = np.sort(waiting.previous_end.values)
        ends = np.sort(waiting.start_time.values)
        counts = np.searchsorted(starts,times.values,side='right')-np.searchsorted(ends,times.values,side='right')
        for row,count in zip(series,counts):
            row[role] = int(count)
        roles.append({'role':role,'peak':int(counts.max()),'mean_queue':float(counts.mean()),
                      'utilisation':float(group.service.sum()/max((data.start_time.max()-data.start_time.min()).total_seconds()/3600,1)/max(group.resource.nunique(),1)*100)})
    return {'series':series,'roles':roles}
