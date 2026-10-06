@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Stop-QASentinel.ps1"
if errorlevel 1 pause
