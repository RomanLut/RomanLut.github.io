@echo off
setlocal
pushd "%~dp0"

rem Regenerate public/filesystem/filesystem.json
python tools\update_filesystem.py

popd
