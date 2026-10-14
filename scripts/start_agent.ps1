# LAN Remote Control - Agent Startup Script (Computer B)
$Host.UI.RawUI.WindowTitle = "LAN Remote Control - Agent (Computer B)"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " Starting Remote Agent (Computer B)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Remote Agent listening on port 8000" -ForegroundColor Green
Write-Host "Announcing on LAN UDP discovery port 50050" -ForegroundColor Green
Write-Host "Pairing PIN: 123456" -ForegroundColor Yellow
Write-Host ""

python -m remote_agent.agent --port 8000
