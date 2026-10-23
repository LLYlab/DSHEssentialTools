# ====================================================================
#  ALV OCR bridge - Windows.Media.Ocr via PowerShell 5.1 (WinRT)
#  ------------------------------------------------------------------
#  Why: ALV wants *offline, deterministic* OCR with word bounding boxes.
#  Windows ships exactly that (Windows.Media.Ocr).  No tesseract, no
#  network, no API key, and boxes come back per word.
#
#  Contract (called by py/alv.py):
#     powershell -File alv_ocr.ps1 -Path <png|jpg> [-Lang zh-Hans-CN] [-Scale 2.0]
#  stdout: one JSON object
#     {"ok":true,"text":"...","lang":"zh-Hans-CN","scale":2.0,
#      "words":[{"text":"..","x":..,"y":..,"w":..,"h":..}]}
#  Coordinates are in the SCALED image; the caller divides by "scale".
#
#  NOTE: pure ASCII on purpose - Windows PowerShell 5.1 mis-decodes UTF-8
#  .ps1 files that carry no BOM.  Recognised text still comes out as UTF-8
#  because we force the console output encoding below.
# ====================================================================
param(
  [Parameter(Mandatory = $true)][string]$Path,
  [string]$Lang = '',
  [double]$Scale = 1.0
)

$ErrorActionPreference = 'Stop'

function Emit($obj) {
  $json = $obj | ConvertTo-Json -Depth 8 -Compress
  [Console]::Out.Write($json)
  [Console]::Out.Flush()
  exit 0
}

function FailJson($message) {
  Emit @{ ok = $false; error = [string]$message }
}

try {
  [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
  $OutputEncoding = [System.Text.Encoding]::UTF8
} catch { }

if (-not (Test-Path -LiteralPath $Path)) { FailJson "image not found: $Path" }

try {
  Add-Type -AssemblyName System.Drawing -ErrorAction Stop
} catch {
  FailJson "System.Drawing unavailable: $($_.Exception.Message)"
}

# ---- optional upscale (small text is what kills OCR accuracy) --------------
$source = $null
$tmpFile = $null
try {
  $source = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $Path).Path)
} catch {
  FailJson "cannot open image: $($_.Exception.Message)"
}

try {
  $scaleOk = ($Scale -gt 1.001 -or $Scale -lt 0.999)
  $target = $source
  if ($scaleOk) {
    $nw = [int][Math]::Max(1, [Math]::Round($source.Width * $Scale))
    $nh = [int][Math]::Max(1, [Math]::Round($source.Height * $Scale))
    # OCR engine limit is generous but not infinite; clamp the long edge
    $maxEdge = 9000
    if ($nw -gt $maxEdge -or $nh -gt $maxEdge) {
      $factor = $maxEdge / [Math]::Max($nw, $nh)
      $nw = [int][Math]::Max(1, [Math]::Round($nw * $factor))
      $nh = [int][Math]::Max(1, [Math]::Round($nh * $factor))
      $Scale = $Scale * $factor
    }
    $bmp = New-Object System.Drawing.Bitmap $nw, $nh
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($source, 0, 0, $nw, $nh)
    $g.Dispose()
    $tmpFile = Join-Path $env:TEMP ("alv-ocr-" + [Guid]::NewGuid().ToString('N') + ".png")
    $bmp.Save($tmpFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $targetPath = $tmpFile
  } else {
    $targetPath = (Resolve-Path -LiteralPath $Path).Path
    $Scale = 1.0
  }
} catch {
  if ($tmpFile -and (Test-Path $tmpFile)) { Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue }
  FailJson "resize failed: $($_.Exception.Message)"
} finally {
  if ($source) { $source.Dispose() }
}

# ---- WinRT async helper ----------------------------------------------------
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction Stop
  $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
      $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
      $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    })[0]
  if (-not $asTaskGeneric) { throw "AsTask(IAsyncOperation) not found" }
} catch {
  if ($tmpFile -and (Test-Path $tmpFile)) { Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue }
  FailJson "WinRT interop unavailable: $($_.Exception.Message)"
}

function Await($operation, $resultType) {
  $task = $asTaskGeneric.MakeGenericMethod($resultType).Invoke($null, @($operation))
  $task.Wait(-1) | Out-Null
  return $task.Result
}

try {
  $null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
  $null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
  $null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]

  $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($targetPath)) ([Windows.Storage.StorageFile])
  $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])

  $engine = $null
  if ($Lang -and $Lang.Trim() -ne '') {
    try {
      $language = New-Object Windows.Globalization.Language $Lang
      $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
    } catch { $engine = $null }
  }
  if (-not $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
  if (-not $engine) {
    if ($tmpFile -and (Test-Path $tmpFile)) { Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue }
    FailJson "no OCR engine available (install a language pack for Windows OCR)"
  }

  $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

  $words = New-Object System.Collections.ArrayList
  foreach ($line in $result.Lines) {
    foreach ($word in $line.Words) {
      $r = $word.BoundingRect
      [void]$words.Add([ordered]@{
          text = [string]$word.Text
          x    = [int][Math]::Round($r.X)
          y    = [int][Math]::Round($r.Y)
          w    = [int][Math]::Round($r.Width)
          h    = [int][Math]::Round($r.Height)
        })
    }
  }

  $langTag = $null
  try { $langTag = $engine.RecognizerLanguage.LanguageTag } catch { }

  if ($tmpFile -and (Test-Path $tmpFile)) { Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue }

  Emit @{
    ok     = $true
    text   = [string]$result.Text
    lang   = $langTag
    scale  = [double]$Scale
    words  = @($words)
    width  = [int]$bitmap.PixelWidth
    height = [int]$bitmap.PixelHeight
  }
} catch {
  if ($tmpFile -and (Test-Path $tmpFile)) { Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue }
  FailJson "OCR failed: $($_.Exception.Message)"
}
