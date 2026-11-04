$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$portableGh = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\work\gh\bin'))
if (Test-Path -LiteralPath (Join-Path $portableGh 'gh.exe')) { $env:PATH = $portableGh + ';' + $env:PATH }
& node '.\scripts\deploy.mjs'
if ($LASTEXITCODE -ne 0) { throw 'Quy trình deploy đang dừng. Xem thông báo ở trên.' }
