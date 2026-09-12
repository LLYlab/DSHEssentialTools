# ====================================================================
#  用一次性口令(OTP)发布 dsh-essential-tools
#  --------------------------------
#  npm 账号 llylab 开了 2FA:发布必须带 --otp <6 位码>(认证器 App 里的码,约 30 秒有效)。
#  这个脚本把「读码 → 立刻发布 → 校验」压进一次执行,减少码过期的概率。
#
#  用法(在 upstream 目录):
#    .\publish-otp.ps1 -Otp 123456
# ====================================================================
param(
  [Parameter(Mandatory = $true)][string]$Otp,
  [string]$Tag = 'latest'
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
Set-Location $root

if ($Otp -notmatch '^\d{6}$') { Write-Host "OTP 必须是 6 位数字" -ForegroundColor Red; exit 1 }

Write-Host ">> 校验身份..." -ForegroundColor Cyan
$who = (npm whoami 2>&1 | Select-Object -First 1)
if ($who -ne 'llylab') { Write-Host "   当前身份是 '$who',期望 llylab —— 请先 npm login / 更新 ~/.npmrc" -ForegroundColor Yellow }

$ver = (Get-Content "$root\package.json" -Raw | ConvertFrom-Json).version
Write-Host ">> 发布 dsh-essential-tools@$ver (tag=$Tag, otp=****)" -ForegroundColor Cyan

npm publish --otp $Otp --tag $Tag --cache "$root\.npm-cache"
if ($LASTEXITCODE -ne 0) { Write-Host "发布失败(exit $LASTEXITCODE)" -ForegroundColor Red; exit $LASTEXITCODE }

Write-Host ">> 校验 dist-tags..." -ForegroundColor Cyan
$r = Invoke-RestMethod -Uri 'https://registry.npmjs.org/dsh-essential-tools' -TimeoutSec 25
Write-Host "   latest = $($r.'dist-tags'.latest)" -ForegroundColor Green
Write-Host "   versions = $($r.versions.PSObject.Properties.Name -join ', ')" -ForegroundColor Green
