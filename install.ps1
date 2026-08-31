# ====================================================================
#  dsh-essential-tools 通用安装器
#  --------------------------------
#  把 dsh-essential-tools 安装为一个「永久 DSH 插件」并注册进 DSH profile。
#  ▸ 默认不写任何工程专属路径（通用化）：只注册插件本体。
#  ▸ 若你要启用「工程」功能（运行 / 文件 / 版本），用 -LvalRoot/-Solution 等参数传入即可。
#  ▸ 幂等：重复运行会先移除旧的 dsh-essential-tools 注册块再重新写入。
#
#  用法（PowerShell）：
#    .\install.ps1                      # 默认 -Profile web
#    .\install.ps1 -Profile web
#    .\install.ps1 -Profile web -LvalRoot 'C:\path\proj' -Solution 'C:\path\proj\App.slnx' -Msbuild 'C:\Program Files\...\MSBuild.exe'
# ====================================================================
[CmdletBinding()]
param(
  [string]$Profile = 'web',
  [string]$PluginId = 'dsh-essential-tools',
  # 可选：工程路径。不填则 config 留空（工程功能不启用，其余功能照常）。
  [string]$LvalRoot   = '',
  [string]$SrcDir     = '',
  [string]$Solution   = '',
  [string]$Msbuild    = '',
  [string]$Configuration = 'Debug',
  [string]$Platform      = 'x64'
)

$ErrorActionPreference = 'Stop'
function Write-Step($m){ Write-Host ">> $m" -ForegroundColor Cyan }
function Write-Ok($m){ Write-Host "   $m" -ForegroundColor Green }
function Write-Warn($m){ Write-Host "   $m" -ForegroundColor Yellow }

# ---- 1. 校验 dsh CLI 与 profile ----
Write-Step "检查 dsh CLI..."
if (-not (Get-Command dsh -ErrorAction SilentlyContinue)) { Write-Warn '未找到 dsh 命令，请先安装 DSH。'; exit 1 }
Write-Ok "dsh 已找到"

$profileDir = Join-Path $env:USERPROFILE ".dsh\profiles\$Profile"
if (-not (Test-Path $profileDir)) {
  Write-Warn "DSH profile '$Profile' 不存在（$profileDir）。可用 profile:"
  Get-ChildItem (Join-Path $env:USERPROFILE '.dsh\profiles') -Directory | ForEach-Object { Write-Host "   - $($_.Name)" }
  exit 1
}
Write-Ok "profile: $Profile ($profileDir)"

# ---- 2. 安装/更新 npm 包 ----
Write-Step "安装/更新 npm 包 '$PluginId' 到 profile '$Profile'..."
try {
  dsh plugin --profile $Profile add $PluginId
  Write-Ok "插件包已安装：dsh plugin --profile $Profile add $PluginId"
} catch {
  Write-Warn "dsh plugin add 失败（$($_.Exception.Message)），回退到 npm 全局安装..."
  & npm install -g $PluginId
}

# ---- 3. 注册进 cordis.patch.yml（幂等） ----
$patchPath = Join-Path $profileDir 'cordis.patch.yml'
Write-Step "更新注册文件：$patchPath"

# 构造要写入的插件块（config 为空则不展开工程路径）
$hasProj = [bool]($LvalRoot -or $Solution)
$configLines = @()
if ($hasProj) {
  $configLines += "      config:"
  if ($LvalRoot) { $configLines += "        lvalRoot: '$LvalRoot'" }
  if ($SrcDir)   { $configLines += "        srcDir:   '$SrcDir'" }
  if ($Solution) { $configLines += "        solution: '$Solution'" }
  if ($Msbuild)  { $configLines += "        msbuild:  '$Msbuild'" }
  $configLines += "        configuration: '$Configuration'"
  $configLines += "        platform: '$Platform'"
  $configLines += "        rollbackTargetDefault: 'minor'"
} else {
  $configLines += "      # config:            # 可选：要为「工程」功能填上项目路径才需要"
  $configLines += "      #   lvalRoot: 'C:\path\to\project'"
  $configLines += "      #   srcDir:   'C:\path\to\project\src'"
  $configLines += "      #   solution: 'C:\path\to\project\App.slnx'"
  $configLines += "      #   msbuild:  'C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Current\Bin\MSBuild.exe'"
}

$block = @(
  '# ── dsh-essential-tools（永久插件：VTD 对话树 + DET 管理器 + 全局插件控制 + MDA/CDM/TCT + DeepSeek 余额）'
  '# 安装器自动维护；重复运行会替换本块。可手动编辑 config 增加工程路径。'
  '- insert:'
  "    - id: $PluginId"
  "      name: '$PluginId'"
) + $configLines

# 幂等：先移除旧块（`- insert:` 且其下一条非缩进行带 `- id: <PluginId>`）
$text = if (Test-Path $patchPath) { Get-Content $patchPath -Raw -Encoding UTF8 } else { '' }
$lines = @($text -split "`r?`n")
$out = New-Object System.Collections.Generic.List[string]
$i = 0
while ($i -lt $lines.Count) {
  $line = $lines[$i]
  if ($line -match '^\s*- insert:\s*$') {
    # 找到下一条顶层条目（非缩进且以 - 开头）或结尾
    $j = $i + 1
    while ($j -lt $lines.Count -and ($lines[$j] -notmatch '^\S' -or $lines[$j] -match '^\s')) { $j++ }
    $blk = ($lines[$i..($j-1)] -join "`n")
    if ($blk -match "(?m)^\s*- id:\s*$([regex]::Escape($PluginId))\s*$") {
      Write-Ok "移除旧的 $PluginId 注册块"
      $i = $j   # 跳过该块
      continue
    }
  }
  $out.Add($line)
  $i++
}
# 去除尾部空行
while ($out.Count -gt 0 -and [string]::IsNullOrWhiteSpace($out[$out.Count-1])) { $out.RemoveAt($out.Count-1) }

$newText = ($out -join "`n").TrimEnd()
if ($newText) { $newText += "`n`n" }
$newText += (($block -join "`n") + "`n")

# 保留原文件编码（UTF-8）；若原文件带 BOM 则保留 BOM
$utf8 = New-Object System.Text.UTF8Encoding($true)
try {
  [System.IO.File]::WriteAllText($patchPath, $newText, $utf8)
  Write-Ok "已写入 $patchPath"
} catch {
  [System.IO.File]::WriteAllText($patchPath, $newText, (New-Object System.Text.UTF8Encoding($false)))
  Write-Ok "已写入 $patchPath（UTF-8 无 BOM）"
}

# ---- 4. 完成 ----
Write-Step "安装完成。"
Write-Host ""
Write-Host "  请重启 DSH，使插件常驻。重启后可在 Settings → Plugin inventory 看到 '$PluginId'。" -ForegroundColor Green
if (-not $hasProj) {
  Write-Host "  提示：config 留空时「工程」功能（运行/文件/版本）不启用；需要时用 -LvalRoot/-Solution 参数或编辑 config 补上。" -ForegroundColor Yellow
}
Write-Host ""
