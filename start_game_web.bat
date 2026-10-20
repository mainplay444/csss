@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Starting game webpage for this PC and local Wi-Fi network.
echo On the PC open http://localhost:8000
echo On the phone, use http://PC-IP-ADDRESS:8000 (same Wi-Fi network).
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 -m http.server 8000 --bind 0.0.0.0
) else (
  python -m http.server 8000 --bind 0.0.0.0
)
pause
