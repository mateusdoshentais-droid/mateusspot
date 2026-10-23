@echo off
title SpotCry Desktop
cd /d %~dp0

REM Inicia o executavel do Electron
if exist "node_modules\electron\dist\electron.exe" (
    start "" "node_modules\electron\dist\electron.exe" .
    exit
)

REM Fallback via electron.cmd
if exist "node_modules\.bin\electron.cmd" (
    start "" "node_modules\.bin\electron.cmd" .
    exit
)

REM Fallback via npm
call npm.cmd start
