<p align="center">
  <img src="docs/banner.svg" alt="DSHEssentialTools" width="100%">
</p>

<p align="center">
  <b>DET · dsh-essential-tools</b> — the plugin that turns DeepSeek Harness into a usable engineering cockpit.<br>
  <b>Let the AI drive your own logged-in browser</b> · <b>Branch, edit and retry any conversation</b> · <b>Run / snapshot / roll back real projects</b> · <b>Manage every plugin and every token you spend</b>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT"></a>
  <img src="https://img.shields.io/badge/DeepSeek%20Harness-0.1.1--rc.2%2B-blue?style=flat-square" alt="DSH">
  <img src="https://img.shields.io/badge/type-permanent%20plugin-8c9eff?style=flat-square" alt="type">
  <img src="https://img.shields.io/badge/version-2.5.0-8c9eff?style=flat-square" alt="version">
  <img src="https://img.shields.io/badge/tools-25%20model%20tools-7c4dff?style=flat-square" alt="tools">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Edge%20%2F%20Chrome-F7DF1E?style=flat-square" alt="platform">
</p>

<p align="center">
  <a href="#-quick-start-60-seconds"><b>Quick start</b></a> ·
  <a href="docs/GUIDE.md"><b>用户指导手册</b></a> ·
  <a href="CHANGELOG.md"><b>Changelog</b></a> ·
  <a href="docs/SECURITY.md"><b>Security</b></a> ·
  <a href="docs/DET功能.md"><b>功能总览</b></a>
</p>

---

## 😤 The problem

If you hack on real code with an AI agent in the loop, you already know these four:

| Pain | What everyone does today | What DET does |
| --- | --- | --- |
| 🧠 **One wrong turn kills the thread** — you want to re-ask from message #12, not start over | Copy-paste into a fresh chat and lose all context | **VTD**: edit / retry **any** message → a real hidden branch, switch back with `<N>`, and the **workspace code rolls back with you** |
| 🌐 **The AI can't see or click what you see** — your logged-in dashboards, internal pages, file:// pages | Screenshot, paste, hand-hold, retry | **DET Browser Extension**: the model drives **your already-logged-in Edge/Chrome** through a localhost bridge you gate yourself (off / read / write / on) |
| 🛠 **Build-run-look-check is a manual loop** | Alt-Tab to the IDE and terminal 40 times an hour | Right toolbar: **▶ run · 🗎 file tree + preview/edit · 🕘 program snapshots & rollback** |
| 💸 **You have no idea what a session costs** | Find out at the end of the month | Live **balance + per-model price + per-turn cost + peak/off-peak estimate** in the corner |

DET (the plugin `dsh-essential-tools`) is the **permanent** DeepSeek Harness plugin that fixes all four — and adds a full **plugin manager**, **conversation memory layer** and **security audit** on top. It lives in your `web` profile, survives restarts, and shows up in **Settings → Plugin inventory**.

> 🎁 **Zero config:** without project paths, every conversation/token/plugin feature works out of the box. Add paths only when you want ▶ run.

---

## ✨ Feature tour

### 🌐 Browser control — *the headline act*
A real **MV3 extension** (Edge / Chrome) connects to the DSH host over a **localhost-only WebSocket** (`127.0.0.1:9123`) so the model can operate the browser **you are already logged into** — internal tools, dashboards, webmail, local `file://` pages, whatever you have open.

- **Read:** `read_text` · `read_dom` · `screenshot` · `get_url` · `get_title`
- **Write:** `navigate` · `click` · `fill` · `run`
- **Six model tools:** `det_browser` plus `web_human_search` (search like a human), `web_insite_search` (find it in your open tabs), `web_act`, `web_inspect`, `web_focus`
- **You hold the permission dial** — the four-position switch lives in the **extension popup**, and DSH can only read it:
  | Mode | Model can |
  | --- | --- |
  | `关闭 off` | nothing at all |
  | `只读 read` | read pages (text / DOM / URL / screenshot) |
  | `只写 write` | navigate, click, fill, run — **but no page content comes back** |
  | `启用 on` | full read + write |
- **Double gate:** the host refuses to even start the bridge unless **network permission = tier 4 (use your browser)**; below that, `det_browser` is blocked before it reaches your browser.
- **Approval aware:** outside Full access mode, browser actions go through DSH's `tools/pre-execute` approval flow; Full access is exempt.
- Hardened: origin-checked handshake, injection via fixed function + arguments (never `new Function`), only the `tabId` DSH names, and the bridge keeps only the **newest** extension connection so stale MV3 service workers can't eat your commands.

➡️ Setup: [`browser-extension/README.md`](browser-extension/README.md) · deep dive in the [指导手册](docs/GUIDE.md#6-浏览器控制扩展-)

### 🌲 VTD — virtual conversation tree
Stop throwing conversations away.

- **Edit / retry any user message** → creates a genuine branch child session (`origin: vtd-fork`, hidden from the sidebar). Your original thread is untouched.
- **`<N>` fork selector** on messages: hop between branches, and DET **snapshots the workspace and restores the target branch's code** for you (message micro-versions).
- **Streaming branch view:** no fixed 4 s polling — the host signals `generating`, so the tab refreshes at ≈700 ms while tokens flow and ≈2.5 s when idle, auto-scrolls, and shows “正在生成…”.
- **Product-native rendering:** real user bubbles only, context injections folded away, tool calls/results as cards, reasoning folded, fine-grained Markdown.
- **Message micro-versions:** `baseline` / `edit` / `retry` / `auto-switch` recorded automatically and restorable.

### 🖥 Right-hand toolbar — project work without leaving the chat
| | Tool | What it does |
| --- | --- | --- |
| ▶ | **Run** | Finds your entry point (`main/entry/run` .py/.cpp, or `.sln/.slnx`), builds with MSBuild, launches the program |
| 🗎 | **Files** | Workspace file tree (collapsible, counts, indent), click to preview or edit in a modal |
| 🕘 | **Versions** | Program-level snapshots: manual snapshot / roll back (auto-backup first) / delete — **code files only** |
| 🧩 | **Plugins** | Jump into the plugin manager / this conversation's plugin switches |
| 🛡 | **Security** | Audit log and security switches |

MSBuild missing or misconfigured? **Auto-discovery**: `vswhere` → common VS install dirs → `PATH`, cached for 60 s, and `lvalInfo` reports the path actually in use.

### 🧩 Global plugin manager — one library, five levels, two install paths
- **Library** across the whole process (storage domain `dsh_global_plugins`, survives restarts). Every plugin carries a **level**:
  `全局启用 always` · `对话AI可自行决定启用 ai-auto` · `对话内AI需审批启用 ai-approve` · `不再会有新启用 frozen` · `全局禁用 disabled`
- **Bring plugins in:** ① promote a live dynamic Cordis plugin from any running conversation; ② search the store (GitHub / marketplace / leaderboard / radar) with a cached AI summary; ③ paste a manifest URL.
- **From GitHub two ways:** ① **direct download** (`det_global_plugin_github_direct`); ② **AI reads the source and rewrites an equivalent, safer version** (`det_global_plugin_github_rebuild` → `det_global_plugin_github_save`) — the third-party code is **never executed**, and both paths return virus/vuln warnings.
- **Resident plugins** (e.g. `dbs`) get a clean **enable/disable** switch that hot-unloads/reloads through the loader, persists across restarts, and refreshes the UI (`det_global_plugin_set_enabled`).
- **Boot Guard:** persisted enable-state is re-applied on boot; `bootFailLimit` consecutive boot failures (default 2) auto-disable **all** global plugins so a bad plugin can never brick your startup.
- **In-conversation tools:** `det_global_plugin_list/enable/disable/scan_installed/import_installed/set_enabled/github_direct/github_rebuild/github_save/store_search`.

### 🧭 MDA · CDM · TCT — memory and cost control
- **MDA (Mixing Dialogue Agent) layering:** `native` / `workspace` group / `model` group (collapsible tree from the sidebar `🔀 MDA 分组`).
- **CDM (CrossDialogueMemory):** `cdm_list` / `cdm_search` (workspace-scoped by default, `cross=true` to escalate) / `cdm_read` — retrieve what you already worked out in another conversation.
- **TCT (Temp Chat Tool):** `det_tct` — one prompt, optional preset (`review` / `summary` / `format` / `brainstorm`), typed permissions, one feedback string, **session destroyed, nothing persisted**.
- **Model collaboration (model group):** `mda_card` writes a model's profile with TCT; `mda_activate` dispatches work to another model (⚠ token-hungry, off by default); `mda_create_no_workspace_agent` spins up a workspace-less agent.

### 📊 DeepSeek balance · pricing · per-turn cost
- Corner status card: balance from `api.deepseek.com/user/balance`, refreshed every 5 s, expandable to multi-currency detail and **days-until-empty** estimate.
- **Per-model price chip** parsed from the official pricing page (CNY page first, USD fallback), switching between **peak / off-peak** (Beijing time Mon–Fri 09:00–12:00 & 14:00–18:00 = peak), cached 6 h with last-good fallback.
- **Per-turn cost** for the conversation you're in.
- **Key handling:** resolved by the host only (config → DSH credential seam → env var), lives only in a request header — **never written to disk, never logged, never sent to the client**. No MITM proxy, no key ledger, no telemetry. Network touches only `api.deepseek.com` and `api-docs.deepseek.com`.

### 🛡 Security audit + network permission tiers
- Optional pre-execution audit: every tool call gets one independent model review; high-risk calls are `deny`-ed and logged (`secCmdAudit`, `secPromptDefense`). ⚠ It costs latency and tokens per call.
- **Network permission — 5 tiers** (inline dropdown in the input row, persisted as `det.webperm`):

  | Tier | key | Meaning |
  | --- | --- | --- |
  | 禁用网络 | `off` | no network at all |
  | 官方API搜索 | `api` | DeepSeek official API only (balance/pricing need ≥1) |
  | 搜索API搜索 | `search` | search APIs; generic fetch needs ≥2 |
  | 静默浏览器仿真 | `silent` | headless browser simulation (read pages) |
  | 使用用户浏览器 | `browser` | **drives your real browser** (`det_browser` needs exactly this) |

### 🎛 Master switch — stock DSH in one click
**Settings → DET 管理器** opens with a **master switch** (`det.features.master`, **on** by default) above the per-feature switches.

- **Off = fully native.** DET keeps exactly two things: this manager page and the switch itself. Everything else is unloaded — the ▶🗎🕘🧩🛡 toolbar, the corner balance/cost/MMS card, the network-permission control, the VTD tab and message actions, the MDA sidebar overlay, the *Global plugins* and *MDA* settings entries, all `det_*` / `web_*` model tools and system-prompt injections, the security-audit hook, the local browser bridge, and the sidebar-registry self-check. MDA grouping resets to `native`.
- **On** restores all of it (per-feature switches keep their saved values). The switch applies instantly and is persisted — no restart, and turning it off is reversible because every registration is held as a disposer.
- With the master switch on, the per-feature switches still work as before: turn **plugin manager** off and all global plugins are disabled; turn **MDA** off and grouping returns to native.

---

## 🚀 Quick start (60 seconds)

**Requirements:** Windows, DeepSeek Harness `0.1.1-rc.2+`, PowerShell, a `web` profile (auto-created on first `dsh web`).

```powershell
# Option A — installer from the clone (recommended: installs + registers the plugin)
.\install.ps1 -Profile web

# Option B — manual, exactly equivalent
dsh plugin --profile web add dsh-essential-tools
```

Then restart DSH. `dsh-essential-tools` appears under **Settings → Plugin inventory**, with its own **DET 管理器** section.

<details>
<summary>Registering by hand / adding project paths / config reference</summary>

Append to `%USERPROFILE%\.dsh\profiles\web\cordis.patch.yml`:

```yaml
- insert:
    - id: dsh-essential-tools
      name: 'dsh-essential-tools'
      # config:                      # optional — only needed for the ▶ run / 🗎 file / 🕘 version tools
      #   lvalRoot: 'C:\path\to\project'
      #   srcDir: 'C:\path\to\project\src'
      #   solution: 'C:\path\to\project\App.slnx'
      #   msbuild: 'C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Current\Bin\MSBuild.exe'  # optional, auto-discovered
      #   configuration: 'Debug'
      #   platform: 'x64'
      #   rollbackTargetDefault: 'minor'
      #   bootFailLimit: 2           # consecutive boot failures before auto-disabling all global plugins
```

Leave `config` empty and everything except the project tools still works.

</details>

<details>
<summary>Optional: enable the browser extension</summary>

1. `edge://extensions` (or `chrome://extensions`) → enable **Developer mode** → **Load unpacked** → pick `browser-extension/`.
2. In DET, set **network permission = 使用用户浏览器 (tier 4)**.
3. Click the extension icon and pick a mode — start with **只读** and move up only when you need it.
4. Ask the model to work on your open tab; watch the **浏览器控制** status block in DET.

</details>

<details>
<summary>v1 dynamic loading (development only)</summary>

`cordis_define` with `plugin/host.js` + `plugin/client.js`, then `cordis_run`. v2 (npm) is the supported path.

</details>

---

## 📚 Documentation

| Doc | What's inside |
| --- | --- |
| **[docs/GUIDE.md](docs/GUIDE.md)** | 🧑‍🏫 **用户指导手册** — install, first-run walkthrough, every feature step by step, permission model, FAQ, troubleshooting, uninstall |
| [docs/DET功能.md](docs/DET功能.md) | Feature inventory: 25 model tools, 75 endpoints, 8 UI slots, storage domains, permission tiers |
| [docs/DET修改.md](docs/DET修改.md) | Change/dev log: what was changed and why |
| [docs/DET运行思路.md](docs/DET运行思路.md) | Architecture and runtime flow |
| [docs/SECURITY.md](docs/SECURITY.md) | Security design, five-dimension review, known boundaries, mitigations |
| [CHANGELOG.md](CHANGELOG.md) | Release history |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Implementation-level architecture |

---

## 🔒 Security in one paragraph

Plugin code runs with the **real permissions of the DSH process** — that is not a sandbox, so only enable code you trust (DET says this loudly before every install). What DET does add: SSRF protection on every host-side fetch (http/https only, no credentials in URL, private/loopback/metadata addresses rejected, **DNS re-checked after resolution** to stop rebinding, manual redirects re-validated per hop, 5-hop cap), 15 s timeouts and `Content-Length` pre-checks, suspicious-code scanning with commit-SHA provenance on store installs, quoted `cmd.exe` argv to kill argument-splitting/injection, browser bridge bound to `127.0.0.1` with origin-checked handshake and an extension-side gate the host cannot override, approval routing for browser actions outside Full access, and a credential path that never persists your API key. The blacklist scanner is a **hint, not a boundary**; the real boundary is your approval.

## 🤝 Contributing
Issues and PRs welcome at [LLYlab/DSHEssentialTools](https://github.com/LLYlab/DSHEssentialTools). The browser extension must be tested by loading it unpacked; the npm package never ships it (`.npmignore`).

## License
[MIT](LICENSE) © 2026 L2959159224
