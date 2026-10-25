"""Transparent weighted bottleneck ranking by step, edge, role and resource."""
import numpy as np
import pandas as pd
from .process_miner import stats

def rank(data: pd.DataFrame, weights: list[float], dimension: str = 'activity') -> list[dict]:
    """Min-max normalize each score component across the selected dimension."""
    frame = data.copy()
    if dimension == 'edge':
        frame = frame[frame.previous.notna()].copy()
        frame['edge'] = frame.previous + ' → ' + frame.activity
    rows = []
    for name, group in frame.groupby(dimension):
        returning = group.loc[group.outcome.eq('Returned'), 'case_id'].nunique()
        rows.append({'name': name, 'count': int(group.case_id.nunique()), 'events': len(group),
                     'service': float(group.service.mean()), 'return_rate': returning/max(group.case_id.nunique(),1)*100,
                     'resources': group.groupby('resource').agg(count=('case_id','size'),wait=('wait','mean'),service=('service','mean')).reset_index().to_dict('records'),
                     **stats(group.wait)})
    if not rows:
        return rows
    matrix = np.array([[r['mean'],r['p90'],r['count'],r['variance']] for r in rows])
    ranges = np.ptp(matrix, axis=0)
    normalized = np.divide(matrix-matrix.min(axis=0), ranges, out=np.zeros_like(matrix), where=ranges!=0)
    scores = normalized @ (np.array(weights)/sum(weights))*100
    for row, score in zip(rows, scores):
        row['score'] = float(score)
    return sorted(rows, key=lambda row: row['score'], reverse=True)
