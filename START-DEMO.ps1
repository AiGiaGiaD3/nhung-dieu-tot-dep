$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) { throw 'Cần cài Node.js 24 LTS rồi mở PowerShell mới.' }
if (-not (Test-Path -LiteralPath '.\node_modules\vite\bin\vite.js')) { throw 'Chạy npm ci trước khi mở demo.' }
& $nodeCommand.Source '.\node_modules\vite\bin\vite.js' '--mode' 'demo' '--host' '127.0.0.1'
