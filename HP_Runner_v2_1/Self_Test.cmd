@echo off
cd /d "%~dp0"
node runner.mjs selftest
pause
