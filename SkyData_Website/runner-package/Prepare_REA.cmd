@echo off
cd /d "%~dp0rea"
echo Preparing the SkyData REA image (rea-agents 6.5.0, SkyData adapter 1 with file analysis).
echo This downloads pinned base images and npm packages ONCE. Jobs never download anything.
docker build -t skydata-rea:6.5.0-a2 .
if errorlevel 1 (
  echo.
  echo The REA image could not be built. Check that Docker Desktop is running with Linux containers and that this PC is online.
  pause
  exit /b 1
)
docker tag skydata-rea:6.5.0-a2 skydata-rea:6.5.0-a1
echo Removing the large helper image used only to copy the ps tool...
docker image rm node@sha256:3d27e5c11e5786e309ec3e03f93ae536eb36e6e5eb3714d5eb3300a36157add0 >nul 2>&1
cd /d "%~dp0"
node runner.mjs rea-selftest
node runner.mjs rea-files-selftest
pause
