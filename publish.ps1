# DSHEssentialTools 一键发布脚本
# 在「你自己的」PowerShell 终端中运行（不是 DSH 对话沙箱，沙箱没有外网）
# 用法：
#   cd C:\Users\L2959\Desktop\项目\LVAL\DSHEssentialTools
#   .\publish.ps1
# 或手动执行下面注释里的步骤。

$ErrorActionPreference = 'Stop'

# 1. 安装 GitHub CLI（若未安装）
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Host "== 安装 GitHub CLI ==" -ForegroundColor Cyan
  winget install --id GitHub.cli --accept-source-agreements --accept-package-agreements
  # 重新加载 PATH，让 gh 立即可用
  $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')
}

# 2. 登录 GitHub（会提示输入设备码并在浏览器中授权；登录账号 LLYlab）
gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "== 登录 GitHub（请按提示完成浏览器授权）==" -ForegroundColor Cyan
  gh auth login --hostname github.com --git-protocol https --web
}

# 3. 进入仓库目录并创建远程仓库 + 推送
Set-Location $PSScriptRoot
Write-Host "== 创建仓库 DSHEssentialTools 并推送 ==" -ForegroundColor Cyan
gh repo create DSHEssentialTools --public --source . --remote origin --push

Write-Host ""
Write-Host "✔ 发布完成：https://github.com/LLYlab/DSHEssentialTools" -ForegroundColor Green
