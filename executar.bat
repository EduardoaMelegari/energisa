@echo off
cd /d "%~dp0"
start "" /min cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:1289"
python app.py
pause
