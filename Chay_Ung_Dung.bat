@echo off
title Khoi Chay App Cham Cong Multi-Launcher
cd /d "%~dp0"
echo =========================================================
echo    DANG KHOI DONG APP CHAM CONG & MULTI-LAUNCHER OS
echo =========================================================
echo.
echo Dang mo trinh duyet...
start http://localhost:8080/index.html
echo May chu cuc bo dang chay tai cong 8080.
echo Vui long giu cua so nay de ung dung hoat dong.
echo.
python -m http.server 8080
if %errorlevel% neq 0 (
    echo Python chua duoc them vao PATH hoac khong kha dung.
    echo Dang mo truc tiep index.html bang trinh duyet mac dinh...
    start index.html
)
pause
