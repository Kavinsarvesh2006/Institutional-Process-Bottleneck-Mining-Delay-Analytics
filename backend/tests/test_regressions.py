"""Regression coverage for custom workflows and invalid institution settings."""
import copy
import pytest
from pydantic import ValidationError
from app.schemas import Settings
from app.services.process_miner import deviations, prepare, variants
from app.services.delay import case_metrics
from test_mining import trace


def test_repeated_ideal_steps_are_not_extra():
    """A legitimate repeated review must not be labelled rework deviation."""
    ideal = ['Submission', 'Review', 'Correction', 'Review', 'Complete']
    result = deviations(ideal, ideal)
    assert result == {'fitness': 100, 'skipped': [], 'extra': [], 'wrong_order': False}
    assert deviations(['Submission', 'Review', 'Correction', 'Complete'], ideal)['skipped'] == ['Review']


def test_unconfigured_conformance_is_not_perfect(settings):
    """An unknown ideal sequence cannot establish compliance."""
    frame = trace().assign(process_type='Scholarship Review')
    data = prepare(frame, settings)
    result = variants(data, case_metrics(data, settings), settings)
    assert result['fitness'] is None and result['assessed_cases'] == 0
    assert result['conforming'] == 0
    assert result['unconfigured_processes'] == ['Scholarship Review']
    assert all(not row['assessed'] and row['fitness'] is None for row in result['variants'])


def test_custom_terminal_and_missing_end(settings):
    """Configured terminal names close traces, while missing intervals stay open."""
    config = copy.deepcopy(settings)
    config['ideal_paths']['Scholarship Review'] = ['Submission', 'Office Processing', 'Complete']
    config['sla_rules']['Scholarship Review'] = 6
    frame = trace().assign(process_type='Scholarship Review')
    frame.loc[frame.activity.eq('Issued'), 'activity'] = 'Complete'
    cases = case_metrics(prepare(frame, config), config)
    assert cases.status.tolist() == ['Completed', 'Completed']
    assert cases.breached.tolist() == [True, False]
    frame.loc[2, 'end_time'] = None
    cases = case_metrics(prepare(frame, config), config)
    assert cases.status.tolist() == ['Open', 'Completed']
    assert not cases.breached.any()


@pytest.mark.parametrize('field', ['weights', 'sla_rules', 'activity_targets'])
@pytest.mark.parametrize('value', [float('nan'), float('inf'), -float('inf')])
def test_nonfinite_settings_are_rejected(settings, field, value):
    """Numeric settings must remain valid JSON and bounded calculations."""
    config = copy.deepcopy(settings)
    if field == 'weights':
        config[field][0] = value
    else:
        config[field]['Custom'] = value
    with pytest.raises(ValidationError):
        Settings.model_validate(config)


def test_custom_upload_metadata_and_configuration(client):
    """New workflow names become selectable and assessable after configuration."""
    original = client.get('/api/settings').json()
    csv = ('case_id,process_type,activity,start_time,end_time,role,department,outcome\n'
           'SCH-1,Scholarship Review,Submission,2026-01-01 09:00,2026-01-01 10:00,Student,Design,Approved\n'
           'SCH-1,Scholarship Review,Complete,2026-01-01 13:00,2026-01-01 14:00,Office,Design,Approved\n')
    uploaded = client.post('/api/datasets/upload', files={'file': ('custom.csv', csv, 'text/csv')}).json()
    identifier = uploaded['dataset_id']
    dataset = next(row for row in client.get('/api/datasets').json() if row['id'] == identifier)
    assert dataset['process_types'] == ['Scholarship Review']
    assert dataset['departments'] == ['Design']
    assert dataset['activities'] == ['Complete', 'Submission']
    query = f'?dataset_id={identifier}'
    assert client.get('/api/process/conformance' + query).json()['fitness'] is None
    changed = copy.deepcopy(original)
    changed['ideal_paths']['Scholarship Review'] = ['Submission', 'Complete']
    changed['sla_rules']['Scholarship Review'] = 4
    try:
        assert client.put('/api/settings', json=changed).status_code == 200
        overview = client.get('/api/overview' + query).json()
        assert overview['open_cases'] == 0 and overview['breach_rate'] == 100
        assert overview['fitness'] == 100
        assert client.get('/api/export/report' + query).content.startswith(b'%PDF')
    finally:
        client.put('/api/settings', json=original)
