$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) { $nodePath = $nodeCommand.Source }
else { $nodePath = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Can cai Node.js truoc khi dang nhap.' }
$oauthPath = (Read-Host 'Dan duong dan file JSON OAuth Desktop vua tai tu Google Cloud').Trim().Trim('"')
if (-not (Test-Path -LiteralPath $oauthPath -PathType Leaf)) { throw 'Khong tim thay file JSON.' }
& $nodePath '.\scripts\google-login.mjs' $oauthPath
if ($LASTEXITCODE -ne 0) { throw 'Dang nhap Google chua hoan tat. Xem thong bao o tren.' }
