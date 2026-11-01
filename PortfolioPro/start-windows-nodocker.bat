@echo off
setlocal
cd /d "%~dp0"

echo [1/2] Launching Spring Boot 3 Backend with Embedded Local Database (http://localhost:8080)...
start "PortfolioPro Backend (Local DB)" cmd /k "cd /d "%~dp0backend" && mvn spring-boot:run -Dspring-boot.run.profiles=h2"

echo [2/2] Launching Angular 17+ Frontend (http://localhost:4200)...
if exist "%~dp0frontend\node_modules" (
    start "PortfolioPro Frontend" cmd /k "cd /d "%~dp0frontend" && npx ng serve --open"
) else (
    start "PortfolioPro Frontend" cmd /k "cd /d "%~dp0frontend" && npm install && npx ng serve --open"
)

echo.
echo PortfolioPro is starting without Docker!
echo Demo Login: demo@portfoliopro.in / Demo@1234
pause
