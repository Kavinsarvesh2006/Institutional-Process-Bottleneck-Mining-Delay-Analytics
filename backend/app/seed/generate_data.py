"""Deterministic six-month event log with auditable planted effects."""
import json
from datetime import datetime, timedelta
from pathlib import Path
import numpy as np
import pandas as pd
from ..config import PATHS

GROUND_TRUTH = {
    'hod': 'HOD Approval has lognormal queue times, Monday and exam-week amplification.',
    'clerk': 'Office Clerk B has three times the service duration of Clerk A.',
    'rework': 'About 25% of Fee Receipt cases return to Student Correction.',
    'batch': 'Principal approvals wait for Thursday signing.',
    'trend': 'May and June arrivals have 1.7x queue delays.',
}

def generate(n: int = 3200, seed: int = 34, glitches: bool = True) -> pd.DataFrame:
    """Return realistic ordered intervals; terminal events identify completed cases."""
    rng = np.random.default_rng(seed)
    rows = []
    roles = {'Submission': 'Student', 'Staff Verification': 'Staff', 'HOD Approval': 'HOD',
             'Office Processing': 'Office', 'Principal Approval': 'Principal', 'Student Correction': 'Student', 'Issued': 'Office'}
    for i in range(n):
        process = list(PATHS)[i % 5]
        dept = str(rng.choice(['AI & DS', 'CSE', 'ECE', 'EEE', 'Mechanical']))
        day = int(rng.integers(0, 181))
        now = datetime(2026, 1, 1, 9) + timedelta(days=day, hours=float(rng.uniform(0, 7)))
        case = f'{["BON", "FEE", "LVE", "EVT", "SCH"][i % 5]}-2026-{i+1:04d}'
        path = list(PATHS[process])
        if process == 'Fee Receipt' and rng.random() < .25:
            path[2:2] = ['Student Correction', 'Office Processing']
        rejected, incomplete = rng.random() < .05, rng.random() < .03
        if rejected:
            path = path[:max(2, len(path)-1)]
        if incomplete:
            path = path[:int(rng.integers(1, len(path)))]
        for j, activity in enumerate(path):
            resource = {'Student': 'Student', 'Staff': 'Faculty '+str(rng.integers(1, 9)), 'HOD': 'HOD '+dept,
                        'Office': str(rng.choice(['Office Clerk A', 'Office Clerk B'])), 'Principal': 'Principal'}[roles[activity]]
            wait = 0 if j == 0 else float(rng.gamma(1.7, 2.2))
            if activity == 'HOD Approval':
                wait = float(rng.lognormal(3.1, .65)) * (1.9 if now.weekday() == 0 else 1)
                if 18 <= now.isocalendar().week <= 22:
                    wait *= 1.6
            if day >= 120:
                wait *= 1.7
            now += timedelta(hours=wait)
            if activity == 'Principal Approval':
                days = (3 - now.weekday()) % 7
                target = now.replace(hour=14, minute=0, second=0, microsecond=0) + timedelta(days=days)
                now = target if target >= now else target + timedelta(days=7)
            start = now
            service = float(rng.uniform(.2, 1.4))
            if activity == 'Office Processing':
                service = float(rng.uniform(1, 2)) * (3 if resource == 'Office Clerk B' else 1)
            now += timedelta(hours=service)
            outcome = 'Returned' if activity == 'Student Correction' else 'Approved'
            if rejected and j == len(path)-1 and not incomplete:
                outcome = 'Rejected'
            rows.append(dict(case_id=case, process_type=process, activity=activity, start_time=start.isoformat(),
                             end_time=now.isoformat(), role=roles[activity], department=dept, resource=resource, outcome=outcome))
        if incomplete:
            rows[-1]['end_time'] = ''
    frame = pd.DataFrame(rows)
    if glitches:
        # One percent missing ends and one percent duplicate cases, independent of open cases.
        picks = rng.choice(n, max(1, n // 100), replace=False)
        for cid in picks:
            index = frame.index[frame.case_id == frame.case_id.unique()[cid]][-1]
            frame.loc[index, 'end_time'] = ''
        frame = pd.concat([frame, frame.sample(max(1, n // 100), random_state=seed)], ignore_index=True)
    return frame

if __name__ == '__main__':
    target = Path(__file__).parent
    data = generate()
    data.to_csv(target / 'sample_events.csv', index=False)
    (target / 'ground_truth.json').write_text(json.dumps(GROUND_TRUTH, indent=2), encoding='utf-8')
    print(f'{data.case_id.nunique():,} cases | {len(data):,} events | 5 processes | January–June 2026 arrivals')
