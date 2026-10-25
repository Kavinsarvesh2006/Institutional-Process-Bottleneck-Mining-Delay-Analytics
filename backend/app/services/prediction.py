"""Early-stage SLA risk with chronological validation and explicit limitations."""
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, confusion_matrix

FEATURES = ['process_type','department','weekday','first_wait']

def train(data: pd.DataFrame, cases: pd.DataFrame) -> tuple[Pipeline | None, dict]:
    """Train on first 80% by arrival; evaluate on the later 20%, without future features."""
    second = data.groupby('case_id').nth(1)[['case_id','wait']].set_index('case_id').wait
    rows = cases[cases.status.ne('Open') & cases.case_id.isin(second.index)].sort_values('start').copy()
    rows['first_wait'] = rows.case_id.map(second)
    rows['weekday'] = rows.start.dt.dayofweek
    if len(rows)<50 or rows.breached.nunique()<2:
        return None, {'available':False,'reason':'At least 50 closed cases with two steps and both SLA classes are required.'}
    cut = int(len(rows)*.8)
    training, test = rows.iloc[:cut],rows.iloc[cut:]
    if training.breached.nunique()<2:
        return None, {'available':False,'reason':'Training period needs both SLA classes.'}
    encoder = ColumnTransformer([('categories',OneHotEncoder(handle_unknown='ignore',sparse_output=False),FEATURES[:2]),('numeric','passthrough',FEATURES[2:])])
    model = Pipeline([('encode',encoder),('forest',RandomForestClassifier(n_estimators=100,max_depth=7,min_samples_leaf=8,class_weight='balanced',random_state=34,n_jobs=1))])
    model.fit(training[FEATURES],training.breached.astype(int))
    predicted = model.predict(test[FEATURES])
    importance = model.named_steps['forest'].feature_importances_
    names = model.named_steps['encode'].get_feature_names_out()
    grouped = {key:0. for key in FEATURES}
    for name, value in zip(names,importance):
        for feature in FEATURES:
            if name.split('__')[-1] == feature or name.split('__')[-1].startswith(feature+'_'):
                grouped[feature] += float(value)
    return model, {'available':True,'accuracy':float(accuracy_score(test.breached,predicted)),
                   'precision':float(precision_score(test.breached,predicted,zero_division=0)),
                   'recall':float(recall_score(test.breached,predicted,zero_division=0)),
                   'baseline_accuracy':float(max(test.breached.mean(),1-test.breached.mean())),
                   'train_count':len(training),'test_count':len(test),'confusion_matrix':confusion_matrix(test.breached,predicted,labels=[0,1]).tolist(),
                   'feature_importance':[{'feature':key,'importance':value} for key,value in grouped.items()],
                   'note':'Chronological 80/20 holdout. Synthetic data demonstration; risk is an association, not a guarantee.'}
