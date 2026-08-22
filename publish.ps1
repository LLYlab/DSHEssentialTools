# DSHEssentialTools 一键发布脚本（GitHub + npm）
# 在「你自己的」PowerShell 终端中运行（不是 DSH 对话沙箱，沙箱没有外网/凭证）
# 用法：
#   cd <本仓库目录>（含 package.json）
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

# 3. npm 登录（一次性；后续发布需保持 npm token）
if (-not (npm whoami 2>$null)) {
  Write-Host "== 登录 npm（请按提示完成）==" -ForegroundColor Cyan
  npm login
}

# 4. 进入仓库目录，确认依赖并打包校验
Set-Location $PSScriptRoot
if (-not (Test-Path "node_modules")) { Write-Host "== 安装依赖 ==" -ForegroundColor Cyan; npm install }

# 5. 版本号提升（可选：手动改 package.json 后跳过）
Write-Host "== 版本号（当前 $(node -p "require('./package.json').version")）==" -ForegroundColor Cyan
$bump = Read-Host "输入版本提升方式 (patch/minor/major)，直接回车跳过"
if ($bump) { npm version $bump --no-git-tag-version }

# 6. 发布到 npm（包名 dsh-essential-tools 需未被占用）
Write-Host "== 发布到 npm ==" -ForegroundColor Cyan
npm publish

# 7. 创建 GitHub 远程仓库并推送（已存在则直接推送）
Set-Location $PSScriptRoot
$hasRemote = (git remote) -match '^origin$'
if (-not $hasRemote) {
  Write-Host "== 创建仓库 DSHEssentialTools 并推送 ==" -ForegroundColor Cyan
  gh repo create DSHEssentialTools --public --source . --remote origin --push
} else {
  Write-Host "== 推送到已有远程仓库 ==" -ForegroundColor Cyan
  git push -u origin main
}

Write-Host ""
Write-Host "✔ 发布完成：" -ForegroundColor Green
Write-Host "  npm:    https://www.npmjs.com/package/dsh-essential-tools" -ForegroundColor Green
Write-Host "  GitHub: https://github.com/LLYlab/DSHEssentialTools" -ForegroundColor Green
