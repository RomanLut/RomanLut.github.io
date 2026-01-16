@echo off
setlocal
rem Launch Vite dev server and open the site.
pushd "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  npm install
)

start "dev-server" cmd /k "npm run dev"
timeout /t 2 > nul
start "" "http://localhost:5173/"

popd
