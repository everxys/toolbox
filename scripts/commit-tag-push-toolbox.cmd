@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem Review, commit, tag, and push the currently checked-out Toolbox repository.
set "TOOLBOX_ROOT=%~dp0.."
pushd "%TOOLBOX_ROOT%" || exit /b 1

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo This folder is not a Git repository.
  popd
  pause
  exit /b 1
)

for /f "delims=" %%I in ('git branch --show-current') do set "TOOLBOX_BRANCH=%%I"
echo.
echo === Current branch: %TOOLBOX_BRANCH% ===
echo.
git status --short
echo.
set /p "TOOLBOX_CONTINUE=Type YES to stage all displayed changes, commit, tag, and push: "
if /I not "%TOOLBOX_CONTINUE%"=="YES" (
  echo Cancelled. Nothing was changed.
  popd
  pause
  exit /b 0
)

set /p "TOOLBOX_MESSAGE=Commit message: "
if "%TOOLBOX_MESSAGE%"=="" (
  echo A commit message is required.
  popd
  pause
  exit /b 1
)

for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$config = Get-Content -Raw 'src-tauri\tauri.conf.json' ^| ConvertFrom-Json; 'v' + $config.version"`) do set "TOOLBOX_DEFAULT_TAG=%%I"
set /p "TOOLBOX_TAG=Tag name [%TOOLBOX_DEFAULT_TAG%]: "
if "%TOOLBOX_TAG%"=="" set "TOOLBOX_TAG=%TOOLBOX_DEFAULT_TAG%"

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  echo The Git remote named origin is not configured.
  popd
  pause
  exit /b 1
)

git rev-parse -q --verify "refs/tags/%TOOLBOX_TAG%" >nul 2>&1
if not errorlevel 1 (
  echo Tag %TOOLBOX_TAG% already exists locally. Choose a new tag name.
  popd
  pause
  exit /b 1
)

echo.
echo === Creating commit ===
git add -A
if errorlevel 1 goto :failure
git commit -m "%TOOLBOX_MESSAGE%"
if errorlevel 1 goto :failure

echo.
echo === Creating tag %TOOLBOX_TAG% ===
git tag -a "%TOOLBOX_TAG%" -m "%TOOLBOX_TAG%"
if errorlevel 1 goto :failure

echo.
echo === Pushing branch and tag to origin ===
git push origin HEAD
if errorlevel 1 goto :failure
git push origin "%TOOLBOX_TAG%"
if errorlevel 1 goto :failure

echo.
echo Successfully pushed the current branch and tag %TOOLBOX_TAG%.
popd
pause
exit /b 0

:failure
echo.
echo The operation stopped because the previous Git command failed.
echo Any commit or local tag already created was left intact for you to inspect.
popd
pause
exit /b 1
