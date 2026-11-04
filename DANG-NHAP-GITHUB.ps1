$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$ghCommand = Get-Command gh -ErrorAction SilentlyContinue
if ($ghCommand) { $ghPath = $ghCommand.Source }
else { $ghPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\work\gh\bin\gh.exe')) }
if (-not (Test-Path -LiteralPath $ghPath)) { throw 'Cần cài GitHub CLI (gh) rồi chạy lại.' }
Write-Host 'Đăng nhập GitHub bằng tài khoản AiGiaGiaD3. Hãy thao tác trên trình duyệt của bạn.'
& $ghPath auth login --hostname github.com --git-protocol https --web
if ($LASTEXITCODE -ne 0) { throw 'Đăng nhập chưa hoàn tất. Không tiếp tục deploy.' }
$loggedInUser = & $ghPath api user --jq '.login'
if ($loggedInUser -ne 'AiGiaGiaD3') { throw 'Tài khoản chưa đúng AiGiaGiaD3. Hãy chuyển tài khoản trước khi tiếp tục.' }
Write-Host 'Đã xác nhận GitHub: AiGiaGiaD3. Bạn có thể quay lại chat và báo đã xong.'
