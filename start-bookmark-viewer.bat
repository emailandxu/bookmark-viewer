@echo off
setlocal

REM Resolve repository root based on this script location
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Default to port 9999 when PORT is unset
if "%PORT%"=="" (
  set "PORT=9999"
)

echo Starting bookmark viewer on port %PORT%...
node server\index.js
