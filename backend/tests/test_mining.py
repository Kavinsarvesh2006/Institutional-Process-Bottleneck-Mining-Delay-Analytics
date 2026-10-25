"""Worked-example tests for queue semantics and sequence discovery."""
import copy
import pandas as pd
import pytest
from app.services.process_miner import prepare, graph, deviations, stats, variants
from app.services.delay import case_metrics,sla,trend,queue,root_causes,heatmap
from app.services.bottleneck import rank
from app.services.recommend import simulate,recommendations

def trace() -> pd.DataFrame:
    """Two traces with hand-calculable queue intervals."""
    return pd.DataFrame([
        ['A','Submission','2026-01-05 09:00','2026-01-05 10:00'],
        ['A','Office Processing','2026-01-05 13:00','2026-01-05 14:00'],
        ['A','Issued','2026-01-05 16:00','2026-01-05 17:00'],
        ['B','Submission','2026-01-06 09:00','2026-01-06 10:00'],
        ['B','Office Processing','2026-01-06 11:00','2026-01-06 12:00'],
        ['B','Issued','2026-01-06 13:00','2026-01-06 14:00'],
    ],columns=['case_id','activity','start_time','end_time']).assign(process_type='Fee Receipt',department='AI & DS',resource='Office Clerk A',role='Office',outcome='Approved')

def test_wait_is_not_service(settings):
    data=prepare(trace(),settings)
    assert data.wait.tolist()==[0,3,2,0,1,1]
    assert data.service.tolist()==[1]*6
    assert data.groupby('case_id').wait.sum().to_dict()=={'A':5,'B':2}

def test_business_calendar_excludes_sunday_holiday_and_night(settings):
    frame=trace().iloc[:2].copy()
    frame.loc[0,['start_time','end_time']]=['2026-01-24 15:00','2026-01-24 16:00']
    frame.loc[1,['start_time','end_time']]=['2026-01-27 10:00','2026-01-27 11:00']
    config={**settings,'working_hours':True,'holidays':['2026-01-26']}
    data=prepare(frame,config)
    assert data.wait.tolist()==[0,2] # Saturday 16–17, Tuesday 09–10
    assert data.raw_wait.iloc[-1]==66
    assert data.service.tolist()==[1,1]

def test_dfg_receiving_gap_and_frequency(settings):
    data=prepare(trace(),settings)
    discovered=graph(data)
    edge=next(e for e in discovered['edges'] if e['source']=='Submission')
    assert edge['count']==2 and edge['mean']==2 and edge['median']==2
    assert edge['p90']==pytest.approx(2.8)
    assert len(graph(data,100)['edges'])==2
    assert not graph(data.iloc[:1])['edges']

@pytest.mark.parametrize('actual,fitness,missing,extra,wrong',[
    (['A','B','C'],100,[],[],False),(['A','C'],80,['B'],[],False),
    (['A','B','B','C'],600/7,[],['B'],False),(['A','C','B'],200/3,[],[],True),
])
def test_sequence_alignment(actual,fitness,missing,extra,wrong):
    result=deviations(actual,['A','B','C'])
    assert result['fitness']==pytest.approx(fitness)
    assert result['skipped']==missing and result['extra']==extra and result['wrong_order']==wrong

def test_variant_grouping_and_sla_boundary(settings):
    config=copy.deepcopy(settings);config['sla_rules']['Fee Receipt']=5
    data=prepare(trace(),config);cases=case_metrics(data,config)
    variant=variants(data,cases,config)
    assert len(variant['variants'])==1 and variant['conforming']==2 and variant['fitness']==100
    assert cases.cycle.tolist()==[8,5]
    assert cases.breached.tolist()==[True,False] # equality is compliant
    summary=sla(cases)
    assert summary['breach_rate']==50 and summary['avg_delay']==3
    assert summary['percentiles']['p50']==6.5

def test_open_cases_not_in_sla(settings):
    frame=trace();frame.loc[2,'end_time']=None
    cases=case_metrics(prepare(frame,settings),settings)
    assert cases.status.tolist()==['Open','Completed']
    assert sla(cases)['eligible']==1 and sla(cases)['open']==1
    empty=sla(cases.iloc[:0]);assert empty['breach_rate']==0
    assert trend(cases.iloc[:0])==[]

def test_overlap_and_missing_previous_end_do_not_invent_wait(settings):
    frame=trace().iloc[:3].copy();frame.loc[0,'end_time']=None
    frame.loc[2,'start_time']='2026-01-05 13:30'
    data=prepare(frame,settings)
    assert data.wait.eq(0).all()
    assert stats(pd.Series([],dtype=float))['mean']==0

def test_scores_and_simulation_are_monotonic(settings):
    data=prepare(trace(),settings);cases=case_metrics(data,settings)
    ranking=rank(data,settings['weights'])
    assert ranking[0]['name']=='Office Processing'
    assert all(0<=r['score']<=100 for r in ranking)
    assert rank(data.iloc[:0],settings['weights'])==[]
    assert rank(data,[4,2.5,2,1.5])[0]['score']==pytest.approx(ranking[0]['score'])
    assert len(rank(data,settings['weights'],'edge'))==2
    zero=simulate(data,cases,'Office Processing',0)
    half=simulate(data,cases,'Office Processing',50)
    full=simulate(data,cases,'Office Processing',100)
    assert zero['before_cycle']==zero['after_cycle']
    assert full['after_cycle']<=half['after_cycle']<=zero['after_cycle']
    assert full['saved_hours']==4
    with pytest.raises(ValueError):simulate(data,cases,'Unknown',50)
    actions=recommendations(data,cases,ranking,settings)
    assert actions and actions[0]['impact']['saved_hours']>=actions[-1]['impact']['saved_hours']

def test_time_diagnostics(sample,settings):
    data,cases,_=sample
    timeline=trend(cases)
    assert len(timeline)==181 and any(r['change'] for r in timeline)
    assert all(r['moving'] is not None for r in timeline)
    cells=heatmap(data);assert len(cells)==168 and sum(c['count'] for c in cells)==len(data)
    workload=queue(data);assert workload['series'] and any(r['peak']>0 for r in workload['roles'])
    assert queue(data.iloc[:0])=={'series':[],'roles':[]}
    causes=root_causes(data,cases);assert causes and causes[0]['lift']>1
    assert all(0<=r['p_value']<=1 for r in causes)
    assert root_causes(data,cases.assign(breached=False))==[]
    # Case presence: a staff member never contributes a case twice to one group.
    assert max(r['count'] for r in causes)<=len(cases)

def test_ground_truth_detection(sample,settings):
    """Quantitatively rediscover all five planted effects, not fixture labels."""
    data,cases,_=sample
    ranks=rank(data,settings['weights'])
    hod=data[data.activity.eq('HOD Approval')]
    office=data[data.activity.eq('Office Processing')].groupby('resource').service.mean()
    fee=data[data.process_type.eq('Fee Receipt')]
    reworked=fee.loc[fee.duplicated(['case_id','activity']),'case_id'].nunique()/fee.case_id.nunique()
    principal=data[data.activity.eq('Principal Approval')]
    early=cases[cases.start.dt.month.le(4)&cases.status.ne('Open')].cycle.mean()
    late=cases[cases.start.dt.month.ge(5)&cases.status.ne('Open')].cycle.mean()
    detected={
      'hod':hod.wait.mean()>20 and 'HOD Approval' in [r['name'] for r in ranks[:2]],
      'clerk':office['Office Clerk B']/office['Office Clerk A']>2.5,
      'rework':.18<reworked<.32,
      'batch':principal.start_time.dt.dayofweek.eq(3).mean()>.95 and principal.wait.mean()>48,
      'trend':late/early>1.2,
    }
    assert sum(detected.values())>=4,detected
    print('Ground-truth detection:',detected)
