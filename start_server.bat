@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Starting both dedicated LAST ROUND servers...
where py >nul 2>nul
if %errorlevel%==0 (
  start "Last Round - Soldiers (8765)" cmd /k "cd /d "%~dp0" ^&^& py -3 -m pip install websockets ^&^& py -3 server.py soldier 8765"
  start "Last Round - Tanks (8766)" cmd /k "cd /d "%~dp0" ^&^& py -3 -m pip install websockets ^&^& py -3 server.py tank 8766"
) else (
  start "Last Round - Soldiers (8765)" cmd /k "cd /d "%~dp0" ^&^& python -m pip install websockets ^&^& python server.py soldier 8765"
  start "Last Round - Tanks (8766)" cmd /k "cd /d "%~dp0" ^&^& python -m pip install websockets ^&^& python server.py tank 8766"
)
echo Both server windows should remain open.
pause
