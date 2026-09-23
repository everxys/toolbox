@echo off
rem Keep a .cmd entry point for manual use. The PowerShell script handles Ctrl+C correctly.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0commit-tag-push-toolbox.ps1"
pause
