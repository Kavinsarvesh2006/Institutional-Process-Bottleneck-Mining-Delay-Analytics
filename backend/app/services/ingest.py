"""CSV validation with a row-level quality audit and atomic dataset persistence."""
from datetime import datetime, timezone
from io import StringIO
import pandas as pd
from sqlalchemy import insert
from ..database import Session
from ..models import Dataset, Event, Case

REQUIRED = ['case_id', 'process_type', 'activity', 'start_time', 'end_time', 'role', 'department', 'outcome']

def validate_csv(content: str) -> tuple[pd.DataFrame, dict]:
    """Reject invalid intervals, remove duplicates and retain missing ends as open."""
    report = {'accepted': 0, 'rejected': 0, 'duplicates': 0, 'warnings': [], 'errors': [], 'rows': []}
    try:
        frame = pd.read_csv(StringIO(content), dtype=str, keep_default_na=False)
    except (pd.errors.ParserError, pd.errors.EmptyDataError) as error:
        report['errors'] = [f'Cannot read CSV: {error}']
        return pd.DataFrame(), report
    missing = sorted(set(REQUIRED) - set(frame.columns))
    if missing:
        report['errors'] = ['Missing required columns: ' + ', '.join(missing)]
        report['rejected'] = len(frame)
        return pd.DataFrame(), report
    if len(frame) > 100000:
        report['errors'] = ['Maximum 100,000 event rows per upload.']
        return pd.DataFrame(), report
    if 'resource' not in frame:
        frame['resource'] = 'Unassigned'
    frame = frame[REQUIRED + ['resource']].copy()
    for col in frame:
        frame[col] = frame[col].str.strip()
    duplicate = frame.duplicated()
    report['duplicates'] = int(duplicate.sum())
    for index in frame.index[duplicate]:
        report['rows'].append({'row': int(index)+2, 'reason': 'Duplicate event removed'})
    frame = frame[~duplicate].copy()
    start = pd.to_datetime(frame.start_time, errors='coerce', format='mixed', utc=True).dt.tz_localize(None)
    end = pd.to_datetime(frame.end_time, errors='coerce', format='mixed', utc=True).dt.tz_localize(None)
    reasons = pd.Series('', index=frame.index)
    for col in ['case_id', 'process_type', 'activity', 'role', 'department', 'outcome']:
        reasons.loc[frame[col].eq('')] += f'Missing {col}; '
    reasons.loc[start.isna()] += 'Invalid start_time; '
    reasons.loc[end.isna() & frame.end_time.ne('')] += 'Invalid end_time; '
    reasons.loc[end < start] += 'end_time precedes start_time; '
    reasons.loc[~frame.outcome.isin(['Approved', 'Rejected', 'Returned'])] += 'Unsupported outcome; '
    inconsistent = frame.groupby('case_id')[['process_type', 'department']].nunique().max(axis=1)
    reasons.loc[frame.case_id.isin(inconsistent[inconsistent > 1].index)] += 'Conflicting case metadata; '
    for index, reason in reasons[reasons.ne('')].items():
        report['rows'].append({'row': int(index)+2, 'reason': reason.rstrip('; ')})
    report['rejected'] = int(reasons.ne('').sum())
    frame['start_time'], frame['end_time'] = start, end
    frame = frame[reasons.eq('')].sort_values(['case_id', 'start_time'], kind='stable')
    previous = frame.groupby('case_id').end_time.shift()
    if (frame.start_time < previous).any():
        report['warnings'].append(f'{int((frame.start_time < previous).sum())} overlapping activities; negative queue gaps are clamped to zero.')
    if frame.end_time.isna().any():
        report['warnings'].append(f'{int(frame.end_time.isna().sum())} missing end times retained; affected cases are treated as open.')
    if report['rejected']:
        report['warnings'].append('Invalid rows were excluded. Review affected cases before drawing conclusions.')
    report['accepted'] = len(frame)
    return frame, report

def store_dataset(frame: pd.DataFrame, report: dict, name: str) -> int:
    """Commit validated events and case metadata in a single transaction."""
    from .analysis import get_settings
    settings = get_settings()
    with Session.begin() as session:
        dataset = Dataset(name=name[:150], created_at=datetime.now(timezone.utc).isoformat(), quality=report)
        session.add(dataset)
        session.flush()
        records = frame.copy()
        for col in ['start_time', 'end_time']:
            records[col] = records[col].map(lambda v: v.isoformat() if pd.notna(v) else None)
        records['dataset_id'] = dataset.id
        session.execute(insert(Event), records.to_dict('records'))
        cases = []
        for cid, group in frame.groupby('case_id', sort=False):
            last = group.iloc[-1]
            terminal = settings['ideal_paths'].get(last.process_type, ['Issued'])[-1]
            status = 'Open' if group.end_time.isna().any() or (last.activity != terminal and last.outcome != 'Rejected') else ('Rejected' if last.outcome == 'Rejected' else 'Completed')
            target = settings['sla_rules'].get(last.process_type, 120)
            hours = (group.end_time.max() - group.start_time.min()).total_seconds()/3600
            cases.append(dict(dataset_id=dataset.id, case_id=cid, process_type=last.process_type, start=group.start_time.min().isoformat(),
                              end=last.end_time.isoformat() if pd.notna(last.end_time) else None, status=status, sla_hours=target, breached=bool(hours>target and status!='Open')))
        session.execute(insert(Case), cases)
        return dataset.id
