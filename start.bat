@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Authme Dev Runner

echo ========================================================
echo   Preparing Authme Development Environment...
echo ========================================================

:: Free port 3000 and terminate lingering authme instances
taskkill /F /IM authme.exe >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo   Starting Authme (npm start)...
echo ========================================================
echo.

call npm start

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Process exited with error code %ERRORLEVEL%.
    echo Press any key to exit...
    pause >nul
)
