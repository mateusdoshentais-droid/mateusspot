@echo off
chcp 65001 >nul
title Gerador de Executavel (.EXE) - SpotCry Desktop
cd /d "%~dp0"

echo ====================================================
echo    Iniciando Gerador de Executavel SpotCry...
echo ====================================================
echo.

node gerador_exe.js

if errorlevel 1 (
    echo.
    echo Ocorreu um erro ao executar o gerador.
    pause
)
