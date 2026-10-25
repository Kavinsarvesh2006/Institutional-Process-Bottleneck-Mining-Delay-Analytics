"""Environment configuration and editable analysis defaults."""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
ROOT = Path(__file__).resolve().parents[1]
DATABASE_URL = os.getenv('DATABASE_URL', f'sqlite:///{(ROOT / "flowlens.db").as_posix()}')
ORIGINS = os.getenv('CORS_ORIGINS', 'http://127.0.0.1:5173,http://localhost:5173').split(',')
PATHS = {
    'Bonafide Certificate': ['Submission', 'Staff Verification', 'HOD Approval', 'Office Processing', 'Issued'],
    'Fee Receipt': ['Submission', 'Office Processing', 'Issued'],
    'Leave / On-duty': ['Submission', 'Staff Verification', 'HOD Approval', 'Issued'],
    'Event Permission': ['Submission', 'Staff Verification', 'HOD Approval', 'Principal Approval', 'Issued'],
    'Scholarship': ['Submission', 'Staff Verification', 'HOD Approval', 'Office Processing', 'Principal Approval', 'Issued'],
}
DEFAULT_SETTINGS = {
    'working_hours': False, 'anonymise': False, 'holidays': ['2026-01-26', '2026-04-14'],
    'weights': [0.4, 0.25, 0.2, 0.15], 'ideal_paths': PATHS,
    'sla_rules': dict(zip(PATHS, [120, 48, 72, 168, 240])),
    'activity_targets': {'HOD Approval': 24, 'Office Processing': 12, 'Principal Approval': 48},
}
