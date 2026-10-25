"""Counterfactual queue reductions and evidence-led rules."""
import pandas as pd

def simulate(data: pd.DataFrame, cases: pd.DataFrame, activity: str, reduction: float) -> dict:
    """Subtract selected queue time, holding all other waits and service fixed."""
    if activity not in data.activity.unique():
        raise ValueError('Choose an activity present in the selected dataset.')
    closed = cases[cases.status.ne('Open')].copy()
    saving = data[data.activity.eq(activity)].groupby('case_id').wait.sum()*reduction/100
    closed['saving'] = closed.case_id.map(saving).fillna(0)
    closed['after'] = (closed.cycle-closed.saving).clip(lower=0)
    return {'activity':activity, 'reduction':reduction, 'eligible':len(closed),
            'before_cycle':float(closed.cycle.mean()) if len(closed) else 0,'after_cycle':float(closed.after.mean()) if len(closed) else 0,
            'before_breach':float(closed.breached.mean()*100) if len(closed) else 0,
            'after_breach':float(closed.after.gt(closed.sla).mean()*100) if len(closed) else 0,
            'saved_hours':float(closed.saving.sum()),'rescued':int((closed.breached & closed.after.le(closed.sla)).sum())}

def recommendations(data: pd.DataFrame, cases: pd.DataFrame, rankings: list[dict], settings: dict) -> list[dict]:
    """Rank actionable queues by actual simulated impact, with transparent evidence."""
    actions = {'HOD Approval': ('Delegate routine HOD approvals','Assign a deputy during exam weeks and send a reminder after 24 hours.','Medium'),
               'Principal Approval': ('Add a second signing window','Introduce a Monday signing window alongside the weekly batch.','Medium'),
               'Office Processing': ('Balance the office queue','Route new requests to the least-loaded clerk and standardise the document checklist.','Low'),
               'Student Correction': ('Validate documents at submission','Make the required-document checklist visible before a request is submitted.','Low')}
    result = []
    for row in rankings:
        if row['mean'] < 1:
            continue
        title, action, effort = actions.get(row['name'],(f'Shorten {row["name"]} queues','Introduce queue reminders and review capacity at the busiest hours.','Low'))
        impact = simulate(data,cases,row['name'],50)
        target = settings['activity_targets'].get(row['name'],24)
        result.append({'activity':row['name'],'title':title,'action':action,'effort':effort,'evidence':f'{row["mean"]:.1f}h mean queue · {row["p90"]:.1f}h p90 · {row["count"]:,} cases · {target:g}h target',
                       'saving_per_case':impact['saved_hours']/max(len(cases),1),'impact':impact,'impact_30':simulate(data,cases,row['name'],30)})
    return sorted(result,key=lambda row:row['impact']['saved_hours'],reverse=True)
