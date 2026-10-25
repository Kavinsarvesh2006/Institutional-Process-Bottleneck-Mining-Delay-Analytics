"""Reproducible isolated 50,000+ event benchmark; run from backend directory."""
import json
import os
from pathlib import Path
import tempfile
from time import perf_counter

def main() -> None:
    """Measure cold snapshot and warm endpoints without changing the demo database."""
    with tempfile.TemporaryDirectory(prefix='flowlens-benchmark-') as temporary:
        os.environ['DATABASE_URL']='sqlite:///'+(Path(temporary)/'benchmark.db').as_posix()
        from fastapi.testclient import TestClient
        from app.main import app
        from app.database import engine
        from app.seed.generate_data import generate
        from app.services.ingest import validate_csv,store_dataset
        from app.services.analysis import invalidate,model_snapshot
        try:
            with TestClient(app) as client:
                data,audit=validate_csv(generate(11000).to_csv(index=False))
                identifier=store_dataset(data,audit,'Performance fixture')
                invalidate();model_snapshot.cache_clear()
                results={'events':len(data),'cases':int(data.case_id.nunique()),'timings_seconds':{}}
                paths=['overview','process/graph','process/variants','process/conformance','bottlenecks','bottlenecks/resources','delays/sla','delays/trend','delays/heatmap','delays/root-cause','workload/queue','recommendations','predict/metrics']
                for index,path in enumerate(paths):
                    start=perf_counter();response=client.get(f'/api/{path}?dataset_id={identifier}');duration=perf_counter()-start
                    if response.status_code!=200:raise RuntimeError(response.text)
                    results['timings_seconds'][path+(' (cold shared snapshot)' if index==0 else '')]=round(duration,4)
                print(json.dumps(results,indent=2))
        finally:
            invalidate();model_snapshot.cache_clear();engine.dispose()

if __name__=='__main__':main()
