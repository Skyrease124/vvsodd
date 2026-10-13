@echo off
cd /d "%~dp0"
echo Preparing Stagehand 4.2.1 browser and protected egress images.
echo Downloads Chromium and pinned npm dependencies once. Keep Docker Desktop running.
docker build -f browser-service/Dockerfile -t skydata-stagehand:4.2.1-a2 .
if errorlevel 1 goto failed
docker build -f browser-service/Dockerfile.proxy -t skydata-browser-proxy:a2 .
if errorlevel 1 goto failed
node runner.mjs browser-selftest
if errorlevel 1 goto failed
echo Browser setup passed. Now open Start_Runner.cmd.
pause
exit /b 0
:failed
echo Setup failed. Keep the old runner folder. Send browser-selftest-report.txt if it was created.
pause
exit /b 1
