@echo off
title A.V.C.C.E Store POS Server Launcher
cd /d "%~dp0"

echo ===================================================
echo  A.V.C.C.E Store POS - Starting System Launcher
echo ===================================================

:: Check if Node server is already running on port 3000
netstat -ano | findstr ":3000" >nul 2>&1
if %errorlevel%==0 (
    echo [OK] Node.js server is already active on http://localhost:3000
    goto launch_browser
)

echo [INFO] Starting Node.js Express server...
start "AVCCE POS Server" /b node server.js

echo [INFO] Waiting for server to initialize...
set count=0

:wait_loop
timeout /t 1 /nobreak >nul
set /a count+=1
netstat -ano | findstr ":3000" >nul 2>&1
if %errorlevel%==0 goto launch_browser
if %count% LSS 10 goto wait_loop

:launch_browser
echo [OK] Opening Application Web Portal...
start "" "http://localhost:3000"

