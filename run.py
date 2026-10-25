"""Cross-platform setup, demo, run and test entry point (Python 3.11+)."""
from __future__ import annotations
import argparse
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time
import urllib.request
import webbrowser

ROOT = Path(__file__).resolve().parent
PYTHON = ROOT / '.venv' / ('Scripts/python.exe' if os.name=='nt' else 'bin/python')
NPM = shutil.which('npm.cmd' if os.name=='nt' else 'npm')

def execute(command: list[str], directory: str = '') -> None:
    """Run one checked command with a consistent project working directory."""
    subprocess.run(command,cwd=ROOT/directory,check=True)

def setup() -> None:
    """Create a virtual environment and install reproducible dependencies."""
    if sys.version_info<(3,11):
        raise RuntimeError('Python 3.11 or newer is required.')
    if not NPM:
        raise RuntimeError('Install Node.js 22.12+ or 24 LTS, then reopen your terminal.')
    if not PYTHON.exists():
        execute([sys.executable,'-m','venv',str(ROOT/'.venv')])
    execute([str(PYTHON),'-m','pip','install','-r','requirements.txt'],'backend')
    execute([NPM,'ci','--no-audit','--no-fund'],'frontend')
    print('\nSetup complete. Next: python run.py demo',flush=True)

def require_setup() -> None:
    """Fail with an actionable message when dependencies are not prepared."""
    if not PYTHON.exists() or not (ROOT/'frontend/node_modules').exists() or not NPM:
        raise RuntimeError('Run python run.py setup first.')

def seed() -> None:
    """Generate the CSV and idempotently load SQLite without starting a server."""
    require_setup()
    execute([str(PYTHON),'-m','app.seed.generate_data'],'backend')
    code='from app.main import app; from app.database import Base,engine; Base.metadata.create_all(engine); from app.routers.api import seed; r=seed(); print("Sample dataset loaded:",r["dataset_id"])'
    execute([str(PYTHON),'-c',code],'backend')

def run(open_browser: bool = False) -> None:
    """Run both development services and clean up child processes on Ctrl+C."""
    require_setup()
    import socket
    for port in [8000,5173]:
        with socket.socket() as probe:
            probe.settimeout(.5)
            if probe.connect_ex(('127.0.0.1',port))==0:
                raise RuntimeError(f'Port {port} is already occupied. Stop that service before launching FlowLens.')
    processes=[]
    child_options={'creationflags':subprocess.CREATE_NO_WINDOW} if os.name=='nt' else {'start_new_session':True}
    try:
        processes.append(subprocess.Popen([str(PYTHON),'-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000'],cwd=ROOT/'backend',**child_options))
        processes.append(subprocess.Popen([NPM,'run','dev'],cwd=ROOT/'frontend',**child_options))
        for _ in range(120):
            if any(p.poll() is not None for p in processes):
                raise RuntimeError('A service stopped unexpectedly. Read the error above.')
            try:
                with urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=1) as api:
                    with urllib.request.urlopen('http://127.0.0.1:5173/',timeout=1) as ui:
                        if api.status==ui.status==200:
                            break
            except OSError:
                time.sleep(.5)
        else:
            raise RuntimeError('Startup timed out. Check the terminal output.')
        print('\nFlowLens is ready: http://127.0.0.1:5173\nAPI documentation: http://127.0.0.1:8000/docs\nPress Ctrl+C to stop both services.\n',flush=True)
        if open_browser:
            webbrowser.open('http://127.0.0.1:5173')
        while all(p.poll() is None for p in processes):
            time.sleep(.5)
    except KeyboardInterrupt:
        print('\nStopping FlowLens...',flush=True)
    finally:
        for process in processes:
            if process.poll() is None:
                try:
                    if os.name=='nt':
                        subprocess.run(['taskkill','/PID',str(process.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=10)
                    else:
                        os.killpg(os.getpgid(process.pid),signal.SIGTERM)
                except (OSError, subprocess.TimeoutExpired):
                    pass
        for process in processes:
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                # A failed child or blocked OS shutdown must not replace the
                # original startup error with a cleanup traceback.
                try:
                    if os.name=='nt':
                        process.kill()
                    else:
                        os.killpg(os.getpgid(process.pid),signal.SIGKILL)
                except OSError:
                    pass
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    print(f'Could not confirm shutdown of child process {process.pid}.',file=sys.stderr)

def main() -> None:
    """Dispatch a portable equivalent of every Make target."""
    parser=argparse.ArgumentParser(description='FlowLens project launcher')
    parser.add_argument('command',choices=['setup','seed','run','demo','test','build'])
    command=parser.parse_args().command
    try:
        if command=='setup':setup()
        elif command=='seed':seed()
        elif command=='demo':seed();run(True)
        elif command=='run':run()
        elif command=='test':
            require_setup()
            execute([str(PYTHON),'-m','pytest','-q','--cov=app/services','--cov-fail-under=80'],'backend')
            execute([NPM,'test'],'frontend')
        elif command=='build':
            require_setup();execute([NPM,'run','build'],'frontend')
    except (RuntimeError,subprocess.CalledProcessError) as error:
        print(f'\nFlowLens: {error}',file=sys.stderr)
        sys.exit(1)

if __name__=='__main__':main()

