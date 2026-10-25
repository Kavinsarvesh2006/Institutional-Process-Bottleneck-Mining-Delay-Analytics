"""Isolated SQLite fixture; tests never touch the demonstration database."""
import os
from pathlib import Path
import tempfile
import pytest

_temporary = tempfile.TemporaryDirectory(prefix='flowlens-tests-')
os.environ['DATABASE_URL'] = 'sqlite:///' + (Path(_temporary.name)/'test.db').as_posix()

@pytest.fixture(scope='session')
def settings() -> dict:
    """Independent institution defaults."""
    import copy
    from app.config import DEFAULT_SETTINGS
    return copy.deepcopy(DEFAULT_SETTINGS)

@pytest.fixture(scope='session')
def sample(settings):
    """One reproducible sample shared across quantitative tests."""
    from app.seed.generate_data import generate
    from app.services.ingest import validate_csv
    from app.services.process_miner import prepare
    from app.services.delay import case_metrics
    frame, audit = validate_csv(generate().to_csv(index=False))
    data = prepare(frame, settings)
    return data, case_metrics(data, settings), audit

@pytest.fixture(scope='session')
def client():
    """Real FastAPI test client with lifespan and isolated storage."""
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app) as connection:
        connection.post('/api/datasets/seed')
        yield connection
    from app.database import engine
    engine.dispose()
    _temporary.cleanup()
