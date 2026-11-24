@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-seatspace.ps1"
if errorlevel 1 pause
