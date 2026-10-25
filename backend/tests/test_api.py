"""API integration contracts, settings invalidation, privacy and model boundaries."""
import json
from datetime import date
import pandas as pd
import pytest
from app.services.prediction import train
from app.services.analysis import snapshot,model_snapshot,get_settings,invalidate
from app.schemas import Settings

@pytest.mark.parametrize('path',[
 'overview','analysis','process/graph','process/variants','process/conformance',
 'bottlenecks','bottlenecks?dimension=edge','bottlenecks?dimension=role','bottlenecks/resources',
 'delays/sla','delays/trend','delays/heatmap','delays/root-cause','workload/queue','cases','predict/metrics','recommendations',
])
def test_all_get_routes(client,path):
    response=client.get('/api/'+path)
    assert response.status_code==200,response.text
    assert response.json()

def test_filters_pagination_and_errors(client):
    assert client.get('/health').json()['status']=='ok'
    assert client.get('/api/overview?dataset_id=999999').status_code==404
    assert client.get('/api/overview?start=2026-06-01&end=2026-01-01').status_code==422
    assert client.get('/api/overview?department=none').status_code==404
    assert client.get('/api/process/graph?min_freq=101').status_code==422
    subset=client.get('/api/overview?process_type=Fee%20Receipt&start=2026-05-01&end=2026-05-31').json()
    assert 20<subset['total_cases']<200
    page=client.get('/api/cases?page=2&page_size=7').json()
    assert page['total']==3200 and len(page['items'])==7
    cid=page['items'][0]['case_id']
    assert client.get('/api/cases/'+cid).json()['events']
    assert client.get('/api/cases/missing').status_code==404
    assert not client.get('/api/cases?search=missing').json()['items']

def test_upload_audit_and_idempotent_seed(client):
    existing=client.get('/api/datasets').json()
    assert client.post('/api/datasets/seed').json()['dataset_id']==existing[0]['id']
    assert len(client.get('/api/datasets').json())==len(existing)
    malformed=client.post('/api/datasets/upload',files={'file':('bad.csv',b'wrong,columns\n1,2','text/csv')}).json()
    assert malformed['dataset_id'] is None and malformed['quality']['errors']
    assert client.post('/api/datasets/upload',files={'file':('bad.csv',b'\xff','text/csv')}).status_code==422
    # Quoted formula-like case IDs are harmless in the exported case register.
    csv='case_id,process_type,activity,start_time,end_time,role,department,outcome\n=HYPERLINK(1),Fee Receipt,Issued,2026-01-01 09:00,2026-01-01 10:00,Office,CSE,Approved\n'
    result=client.post('/api/datasets/upload',files={'file':('safe.csv',csv,'text/csv')}).json()
    identifier=result['dataset_id'];assert identifier
    assert "'=HYPERLINK(1)" in client.get(f'/api/export/csv?dataset_id={identifier}').text
    assert client.get(f'/api/predict/metrics?dataset_id={identifier}').json()['available'] is False
    assert client.post(f'/api/predict?dataset_id={identifier}',json={'process_type':'Fee Receipt','department':'CSE','weekday':0,'first_wait':1}).status_code==422

def test_predict_and_simulate(client):
    payload={'process_type':'Fee Receipt','department':'AI & DS','weekday':0,'first_wait':8}
    result=client.post('/api/predict?dataset_id=1',json=payload)
    assert result.status_code==200,result.text
    assert 0<=result.json()['probability']<=1
    payload['department']='Unseen'
    assert client.post('/api/predict?dataset_id=1',json=payload).status_code==422
    result=client.post('/api/simulate?dataset_id=1',json={'activity':'HOD Approval','reduction':50}).json()
    assert result['after_cycle']<result['before_cycle'] and result['after_breach']<=result['before_breach']
    assert client.post('/api/simulate?dataset_id=1',json={'activity':'bad','reduction':50}).status_code==422
    assert client.post('/api/simulate?dataset_id=1',json={'activity':'HOD Approval','reduction':101}).status_code==422

def test_settings_privacy_calendar_cache_invalidation(client,settings):
    original=client.get('/api/settings').json()
    changed={**original,'anonymise':True,'working_hours':True}
    try:
        before=client.get('/api/overview?dataset_id=1').json()['avg_cycle']
        assert client.put('/api/settings',json=changed).status_code==200
        assert client.get('/api/overview?dataset_id=1').json()['avg_cycle']<before
        resources=client.get('/api/bottlenecks/resources?dataset_id=1').json()
        assert all(r['name'].startswith('Staff-') for r in resources)
        detail=client.get('/api/cases/BON-2026-0001?dataset_id=1').json()
        events=detail['events']
        assert all(e['resource'].startswith('Staff-') for e in events)
        assert events[-1]['offset']+events[-1]['service']==pytest.approx(detail['cycle'])
        assert client.put('/api/settings',json={**changed,'weights':[0,0,0,0]}).status_code==422
        assert client.put('/api/settings',json={**changed,'sla_rules':{'Fee Receipt':-5}}).status_code==422
        assert client.put('/api/settings',json={**changed,'ideal_paths':{'Fee Receipt':[]}}).status_code==422
        assert client.put('/api/settings',json={**changed,'holidays':['bad-date']}).status_code==422
    finally:
        client.put('/api/settings',json=original)

def test_exports(client):
    pdf=client.get('/api/export/report?dataset_id=1')
    assert pdf.status_code==200 and pdf.content.startswith(b'%PDF-') and len(pdf.content)>5000
    assert 'application/pdf' in pdf.headers['content-type']
    csv=client.get('/api/export/csv?dataset_id=1')
    assert csv.status_code==200 and len(csv.text.splitlines())==3201

def test_model_holdout(sample):
    data,cases,_=sample
    model,metrics=train(data,cases)
    assert model is not None and metrics['available']
    assert metrics['train_count']+metrics['test_count']<=len(cases)
    assert metrics['test_count']>500
    assert 0<=metrics['accuracy']<=1 and 0<=metrics['precision']<=1 and 0<=metrics['recall']<=1
    assert sum(r['importance'] for r in metrics['feature_importance'])==pytest.approx(1)
    _,insufficient=train(data.iloc[:0],cases.iloc[:0])
    assert not insufficient['available']
    _,one_class=train(data,cases.assign(breached=False))
    assert not one_class['available']
