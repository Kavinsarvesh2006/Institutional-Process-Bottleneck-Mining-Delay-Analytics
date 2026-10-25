# Start FlowLens on this computer

The installed project is in `D:\mini project\FlowLens`.

1. Double-click **Start-FlowLens.cmd** in this folder.
2. Wait for **FlowLens is ready**. The browser opens at http://127.0.0.1:5173.
3. Keep the launcher window open while using the app. Press **Ctrl+C** there to stop it.

The prepared D: drive copy includes the local Python environment, frontend dependencies and seeded SQLite database. Internet is not needed for normal use. If an earlier session is already running, use the existing browser tab instead of starting another copy.

## Final commands

Open PowerShell in this folder:

```powershell
.\.venv\Scripts\python.exe run.py test
.\.venv\Scripts\python.exe run.py build
.\.venv\Scripts\python.exe run.py demo
```

The `demo` command regenerates the deterministic CSV and loads the built-in sample idempotently; it preserves existing uploaded datasets. Choose **Campus operations · Jan–Jun 2026** in the dataset selector for the presentation.

## Documents

- **README.md**: setup, features, CSV format and troubleshooting.
- **docs/architecture.md** and **docs/algorithms.md**: design and analytical methods.
- **docs/viva_qna.md**: 30 viva questions and answers.
- **docs/report_outline.md**: college report chapter structure.
- **docs/demo_script.md**: five-minute demonstration.
- **docs/verification.md**: measured test results and known limitations.
- **docs/sample-report.pdf**, **docs/screenshots/** and **docs/coverage/index.html**: report, UI and test evidence.

The sibling **FlowLens-Complete-Project.zip** is the portable source backup. On a different computer, extract it, install Python 3.11+ and Node.js 22.12+, and run **Setup.cmd** before **Start-FlowLens.cmd**. Installed environments from this D: drive copy are intended for this computer.
