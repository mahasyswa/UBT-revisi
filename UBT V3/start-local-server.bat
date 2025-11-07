@echo off
cls
echo ============================================
echo   BARCODE PROTOCOL - LOCAL DEPLOYMENT
echo ============================================
echo.

cd /d "D:\PROJECT\UBT\New folder"

REM Check if port 8080 is in use
echo [1/4] Checking port 8080...
netstat -ano | findstr :8080 >nul
if %errorlevel% equ 0 (
    echo     Port 8080 is in use, cleaning up...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
        taskkill /f /pid %%a >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
    echo     Port cleaned!
) else (
    echo     Port 8080 is free!
)

echo.
echo [2/4] Getting your IP address...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set IP=%%a
    goto :found_ip
)
:found_ip
set IP=%IP:~1%
echo     Local IP: %IP%

echo.
echo [3/4] Starting server...
echo.
echo ============================================
echo   SERVER INFORMATION
echo ============================================
echo   Local Access (this computer):
echo     http://localhost:8080
echo     http://127.0.0.1:8080
echo.
echo   Network Access (other devices):
echo     http://%IP%:8080
echo.
echo   Scanner (no login):
echo     http://%IP%:8080/scanner
echo.
echo   Login Credentials:
echo     Username: admin
echo     Password: admin
echo ============================================
echo.
echo [4/4] Server is starting...
echo.
echo Press Ctrl+C to stop the server
echo ============================================
echo.

node server.js

echo.
echo ============================================
echo Server stopped!
echo Press any key to restart or close to exit
echo ============================================
pause >nul
goto :eof
