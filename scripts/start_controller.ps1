# LAN Remote Control - Controller Startup Script (Computer A)
$Host.UI.RawUI.WindowTitle = "LAN Remote Control - Controller (Computer A)"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " Starting Controller Application (Computer A)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Controller Backend starting on http://localhost:8080" -ForegroundColor Green
Write-Host "Serving Web Dashboard..." -ForegroundColor Green
Write-Host ""

python -m controller.backend.app.main --port 8080
