# DSHEssentialTools - product frontend patch script (Plan A)
# Adds a user-bubble action slot (conversation.chat.user-actions) to the
# product chat view (dsh-client-ui-conversation):
#   1) user chat node data gains messageId
#   2) UserMessageNodeView injects renderSlot and wires extraActions to the slot
#   3) the "user" keyed registration declares the child slot (list, session scope)
# Usage:
#   .\apply-patch.ps1            apply the patch (auto backup of the original)
#   .\apply-patch.ps1 -Restore   restore the original
# Re-run this script after a product upgrade. It fails loudly when the search
# strings no longer match (upgrade changed the bundle); do not force through.
param([switch]$Restore)
$ErrorActionPreference = 'Stop'

$npmRoot = npm root -g 2>$null
if (-not $npmRoot -or -not (Test-Path $npmRoot)) { throw "npm global root not found (npm root -g)" }
$target = Join-Path $npmRoot '@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js'
$bak = "$target.dsh-essential-tools.bak"

if ($Restore) {
  if (-not (Test-Path $bak)) { throw "backup not found: $bak" }
  Copy-Item $bak $target -Force
  Write-Host "OK restored original: $target"
  exit 0
}
if (-not (Test-Path $target)) { throw "product file not found: $target" }
if (-not (Test-Path $bak)) {
  Copy-Item $target $bak
  Write-Host "backed up original: $bak"
}

$c = [System.IO.File]::ReadAllText($target)   # original: pure LF, no BOM
$t = "`t"
$NL = "`n"

function ApplyPatch([string]$name, [string]$old, [string]$new) {
  $count = ([regex]::Matches($c, [regex]::Escape($old))).Count
  if ($count -ne 1) {
    throw "patch '$name' did not match (expected 1 occurrence, got $count) - product upgraded? do not continue"
  }
  $script:c = $c.Replace($old, $new)
  Write-Host "OK $name"
}

# 1) user chat node data gains messageId
ApplyPatch "user node data + messageId" `
  "$t$t$t$t$t`kind: `"user`",`n$t$t$t$t$t`seq: event.seq," `
  "$t$t$t$t$t`kind: `"user`",`n$t$t$t$t$t`messageId: event.data.id,`n$t$t$t$t$t`seq: event.seq,"

# 2a) UserMessageNodeView injects renderSlot
ApplyPatch "UserMessageNodeView + renderSlot" `
  "function UserMessageNodeView({ node, renderMessageImages, t })" `
  "function UserMessageNodeView({ node, renderMessageImages, renderSlot, t })"

# 2b) extraActions wired to user-actions slot (next to the copy button)
# NOTE: props are 5-tab indented; the closing "})" is 4-tab (same level as "actions:").
# Built via concatenation: a bare backtick before "time" would be eaten as a tab escape.
$T5 = $t + $t + $t + $t + $t
$T4 = $t + $t + $t + $t
$old2b = $T5 + 'time: data.time,' + $NL + $T5 + 'clock: "start",' + $NL + $T5 + 'className: MessageItem_module_css_default.actions,' + $NL + $T5 + 't' + $NL + $T4 + '})'
$new2b = $T5 + 'time: data.time,' + $NL + $T5 + 'clock: "start",' + $NL + $T5 + 'className: MessageItem_module_css_default.actions,' + $NL + $T5 + 'extraActions: renderSlot("conversation.chat.user-actions", { messageId: data.messageId, seq: data.seq }),' + $NL + $T5 + 't' + $NL + $T4 + '})'
ApplyPatch "extraActions -> user-actions slot" $old2b $new2b

# 3) "user" keyed registration declares the child slot
ApplyPatch "user registration + child slot" `
  "$t$t$t$t`key: `"user`",`n$t$t$t$t`locale: NS`n$t$t$t`}, UserMessageNodeView));" `
  "$t$t$t$t`key: `"user`",`n$t$t$t$t`children: {`n$t$t$t$t$t`"conversation.chat.user-actions`": {`n$t$t$t$t$t$t`kind: `"list`",`n$t$t$t$t$t$t`scope: `"session`"`n$t$t$t$t$t`}`n$t$t$t$t`},`n$t$t$t$t`locale: NS`n$t$t$t`}, UserMessageNodeView));"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($target, $c, $utf8NoBom)
Write-Host "OK patch applied: $target"
Write-Host "    re-run after product upgrade; restore: .\apply-patch.ps1 -Restore"
