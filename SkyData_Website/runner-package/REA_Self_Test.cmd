@echo off
cd /d "%~dp0"
node runner.mjs rea-selftest
node runner.mjs rea-files-selftest
pause
