@echo off
setlocal

rem Build the currently checked-out Toolbox source, then install the MSI it produced.
set "TOOLBOX_ROOT=%~dp0.."
pushd "%TOOLBOX_ROOT%" || exit /b 1

echo.
echo === Building the current local Toolbox version ===
echo Local installation does not need updater artifacts, so signing is skipped.
call npx tauri build --no-sign
if errorlevel 1 (
  echo.
  echo Build failed. Toolbox was not installed.
  popd
  pause
  exit /b 1
)

rem The build has just completed, so its MSI is the newest installer in the bundle folder.
set "TOOLBOX_INSTALLER="
for /f "delims=" %%I in ('dir /b /a-d /o-d "src-tauri\target\release\bundle\msi\*.msi" 2^>nul') do if not defined TOOLBOX_INSTALLER set "TOOLBOX_INSTALLER=src-tauri\target\release\bundle\msi\%%I"

if not exist "%TOOLBOX_INSTALLER%" (
  echo.
  echo The expected MSI was not created:
  echo %TOOLBOX_INSTALLER%
  popd
  pause
  exit /b 1
)

echo.
echo === Installing the newly built Toolbox version ===
start "Toolbox installer" /wait msiexec.exe /i "%TOOLBOX_INSTALLER%" /qn /norestart
if errorlevel 1 (
  echo.
  echo Installation failed with exit code %errorlevel%.
  popd
  pause
  exit /b %errorlevel%
)

echo.
echo Toolbox was built and installed successfully.
popd
pause
