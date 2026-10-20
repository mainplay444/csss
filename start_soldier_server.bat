@echo off
chcp 65001 >nul
cd /d "%~dp0"
py -3 -m pip install websockets 2>nul || python -m pip install websockets
py -3 server.py soldier 8765 2>nul || python server.py soldier 8765
pause
