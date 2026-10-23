@echo off
chcp 65001 >nul
title Compilar SpotCry Desktop (.exe)
cd /d "%~dp0"
echo ====================================================
echo   Compilando SpotCry Desktop (.exe) para Windows...
echo ====================================================
echo.
call npm.cmd run build
echo.
echo ====================================================
echo   Compilação Concluída com sucesso!
echo   Os executáveis do SpotCry estão na pasta 'dist':
echo   - SpotCry Setup 1.0.0.exe (Instalador NSIS)
echo   - SpotCry 1.0.0.exe (Versão Portátil)
echo ====================================================
echo.
explorer dist
pause
