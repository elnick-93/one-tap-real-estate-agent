# ONE TAP Easy Local Master Launch (Windows)
# Run with: powershell -ExecutionPolicy Bypass -File .\easy-launch.ps1

$ErrorActionPreference = "Stop"
$ProjectPath = $PSScriptRoot

Write-Host "=== ONE TAP Real Estate Agent - Master Launch ===" -ForegroundColor Cyan

Set-Location $ProjectPath

if (-not (Test-Path "server/node_modules")) {
  Write-Host "Installing server deps..."
  cd server; npm install; cd ..
}

$env:ENABLE_DEV_AUTO_LOGIN = "true"
$env:NODE_ENV = "development"

Write-Host "Starting server with master profile (full premium access)..."
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "cd '$ProjectPath\server'; npm start" -WindowStyle Normal

Start-Sleep -Seconds 6
Start-Process "http://127.0.0.1:3000/admin.html"

Write-Host "Launched. Master profile active. Use desktop Soluna.lnk next time." -ForegroundColor Green