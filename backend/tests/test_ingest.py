"""Malformed logs must produce row reasons rather than server errors."""
import pandas as pd
import pytest
from app.services.ingest import validate_csv

HEADER='case_id,process_type,activity,start_time,end_time,role,department,outcome\n'
VALID='A,Fee Receipt,Issued,2026-01-01 09:00,2026-01-01 10:00,Office,CSE,Approved\n'

@pytest.mark.parametrize('content,accepted,rejected',[
 (HEADER+VALID,1,0),
 (HEADER+VALID+VALID,1,0),
 (HEADER+VALID.replace('10:00','08:00'),0,1),
 (HEADER+VALID.replace('2026-01-01 09:00','bad-date'),0,1),
 (HEADER+VALID.replace('2026-01-01 10:00','bad-date'),0,1),
 (HEADER+VALID.replace('2026-01-01 10:00',''),1,0),
 (HEADER+VALID.replace('Approved','Unknown'),0,1),
 (HEADER+VALID.replace('Office,CSE','Office,'),0,1),
])
def test_validation_rows(content,accepted,rejected):
    frame,report=validate_csv(content)
    assert len(frame)==report['accepted']==accepted and report['rejected']==rejected
    if rejected:assert report['rows'][0]['reason']

def test_bad_schema_and_empty():
    for content in ['', 'wrong,columns\n1,2', '"unterminated']:
        frame,audit=validate_csv(content)
        assert frame.empty and audit['errors']

def test_conflicting_metadata_and_overlap():
    frame,report=validate_csv(HEADER+VALID+VALID.replace('CSE','ECE'))
    assert frame.empty and report['rejected']==2
    _,report=validate_csv(HEADER+VALID+VALID.replace('Issued','Office Processing').replace('09:00','09:30'))
    assert any('overlapping' in r for r in report['warnings'])

def test_upload_limit():
    _,report=validate_csv(HEADER+VALID*100001)
    assert report['errors']==['Maximum 100,000 event rows per upload.']
