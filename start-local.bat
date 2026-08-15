@echo off
chcp 65001 >nul
setlocal

set "NODE_DIR=%LOCALAPPDATA%\opencode\node\node-v24.19.0-win-x64"
set "NODE_EXE=%NODE_DIR%\node.exe"
set "NPM_CMD=%NODE_DIR%\npm.cmd"
set "PORT=3000"

echo [Fruit Ninja] starting local server...

if not exist "%NODE_EXE%" goto :noNode

cd /d "%~dp0"

if not exist "node_modules" call :install

echo Opening browser at http://localhost:%PORT% ...
start "" "http://localhost:%PORT%"

echo Server is running. Keep this window open. Close it to stop the server.
"%NODE_EXE%" server.js
goto :eof

:install
echo Installing dependencies (first run only)...
"%NPM_CMD%" install --no-audit --no-fund
goto :eof

:noNode
echo Portable Node not found.
echo Please install Node.js (>=18) from https://nodejs.org and try again.
pause
