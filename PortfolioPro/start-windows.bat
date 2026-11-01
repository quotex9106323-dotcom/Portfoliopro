@echo off
setlocal
cd /d "%~dp0"

if not exist ".env" (
    copy /Y ".env.example" ".env" >nul
)

echo [1/3] Checking Docker MySQL 8 on 127.0.0.1:3307 (waiting until TCP ready)...
docker rm -f portfoliopro-mysql >nul 2>&1
docker compose up -d --wait
if errorlevel 1 (
    echo [Info] Docker MySQL not available — Backend will automatically start with the embedded local database!
)

echo [2/3] Launching Spring Boot 3 Backend in a new window (http://localhost:8080)...
start "PortfolioPro Backend" cmd /k "cd /d "%~dp0backend" && mvn spring-boot:run"

echo [3/3] Launching Angular 17+ Frontend in a new window (http://localhost:4200)...
if exist "%~dp0frontend\node_modules" (
    start "PortfolioPro Frontend" cmd /k "cd /d "%~dp0frontend" && npx ng serve --open"
) else (
    start "PortfolioPro Frontend" cmd /k "cd /d "%~dp0frontend" && npm install && npx ng serve --open"
)

echo.
echo PortfolioPro services are starting in separate windows!
echo Demo Login: demo@portfoliopro.in / Demo@1234
pause
