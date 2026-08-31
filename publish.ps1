# ====================================================================
#  dsh-essential-tools 一键发布脚本（GitHub + npm + Release 资产）
#  ------------------------------------------------------------------
#  用法（在「本机」PowerShell 中运行，需已用 gh 登录、npm 已认证）：
#    .\publish.ps1                       # npm version patch + npm publish + push + release
#    .\publish.ps1 -Version 2.3.4        # 指定版本号（推荐用于发布版）
#    .\publish.ps1 -Version 2.3.4 -OnlyGit   # 只提交+推送+Release，跳过 npm publish
#    .\publish.ps1 -Version 2.3.4 -DryRun    # 只预览，不执行（dry-run）
#
#  会依次：升版本 → 清理备份文件 → git add/commit/tag → push → npm publish →
#          gh release create 并上传 install.ps1（自动安装器）。
# ====================================================================
[CmdletBinding()]
param(
  [string]$Version = '',
  [switch]$OnlyGit,
  [switch]$DryRun,
  [switch]$NoBump
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Run-Step($m){ Write-Host "`n== $m ==" -ForegroundColor Cyan }
function RunCmd($m){
  if ($DryRun) { Write-Host "   [dry-run] $m" -ForegroundColor DarkGray; return 0 }
  Write-Host "   $m" -ForegroundColor DarkGray
  & powershell -NoProfile -Command $m
  if ($LASTEXITCODE -ne 0) { throw "命令失败: $m (exit $LASTEXITCODE)" }
  return 0
}

Write-Host "=== dsh-essential-tools 发布脚本 ===" -ForegroundColor Magenta

# ---- 1. 版本 ----
if (-not $Version) {
  $Version = (node -p "require('./package.json').version")
}
Write-Host "目标版本: $Version" -ForegroundColor Yellow

if (-not $DryRun) {
  if (-not $NoBump) {
    Run-Step "提升版本号为 $Version"
    RunCmd "npm version $Version --no-git-tag-version"
  }
}else{ Write-Host "[dry-run] 不修改版本" }

# ---- 2. 清理备份文件 ----
Run-Step "清理备份 / 传感器文件"
RunCmd "Remove-Item -Force lib\*.bak-* -ErrorAction SilentlyContinue; Remove-Item -Force lib\*.bak.* -ErrorAction SilentlyContinue"
RunCmd "git rm -q --cached lib/*.bak-* 2>$null; git rm -q --cached lib/*.bak.* 2>$null"

# ---- 3. 提交 + tag ----
Run-Step "提交 + 打 tag"
RunCmd "git add -A"
RunCmd "git -c core.autocrlf=false commit -m 'release: v$Version'"   # 若无可提交变更会失败，忽略
RunCmd "git tag -f v$Version"

# ---- 4. 推送 GitHub（含 tag） ----
Run-Step "推送 GitHub"
RunCmd "git push origin main"
RunCmd "git push origin v$Version -f"

# ---- 5. npm publish ----
if (-not $OnlyGit) {
  Run-Step "发布到 npm"
  RunCmd "npm publish"
}

# ---- 6. 创建 GitHub Release 并上传安装器 ----
Run-Step "创建 GitHub Release v$Version"
if (-not $OnlyGit) {
  $tag = "v$Version"
  $asset = Join-Path $PSScriptRoot 'install.ps1'
  $readme = Join-Path $PSScriptRoot 'README.md'
  $changelog = Join-Path $PSScriptRoot 'CHANGELOG.md'
  RunCmd "gh release create $tag --title 'DSHEssentialTools v$Version' --notes-file $changelog --target main"
  if (Test-Path $asset) { RunCmd "gh release upload $tag --clobber `"$asset`"" }
  if (Test-Path $readme) { RunCmd "gh release upload $tag --clobber `"$readme`"" }
}

Write-Host "`n✔ 发布完成：" -ForegroundColor Green
Write-Host "  npm:    https://www.npmjs.com/package/dsh-essential-tools" -ForegroundColor Green
Write-Host "  GitHub: https://github.com/LLYlab/DSHEssentialTools" -ForegroundColor Green
Write-Host "  Release: https://github.com/LLYlab/DSHEssentialTools/releases/tag/v$Version" -ForegroundColor Green
