# DET 发布流程 (dsh-essential-tools)

> 面向 **AI / 维护者**:如何发布。发布同时作用于 GitHub 与 npm;浏览器扩展**不随 npm**、从仓库本机装载。

## 前置
- 仓库:`LLYlab/DSHEssentialTools`(本机 `git remote origin`)。
- 已 `gh auth`(repo 权限)、`npm login`(whoami=llylab)。
- 在 `upstream/` 目录(即 npm 包根)。

## 一键脚本
`publish.ps1`(在本机 PowerShell 运行):
```powershell
# 指定版本(推荐发布版),完整:升版本→清备份→commit/tag→push→npm publish→gh release
.\publish.ps1 -Version 2.4.0
# 只提交+push+Release,不 publish npm
.\publish.ps1 -Version 2.4.0 -OnlyGit
# 仅预览
.\publish.ps1 -Version 2.4.0 -DryRun
```
> 注意:`publish.ps1` 内 `git rm ... 2>$null` 在嵌套 PowerShell 会失败,已改为 `2>&1 | Out-Null`。脚本同时清 `lib/*.bak-*`。

## 手动(等同脚本,更可控)
```powershell
cd C:\Users\L2959\.dsh\.agent-presets\dsh-essential-tools\upstream
# 1) 升版本
npm version 2.4.0 --no-git-tag-version
# 2) 清理备份
Remove-Item -Force lib\*.bak-* -ErrorAction SilentlyContinue
# 3) 提交 + tag
git add -A && git -c core.autocrlf=false commit -m "release: v2.4.0"
git tag -f v2.4.0
# 4) 推送
git push origin main
git push origin v2.4.0 -f
# 5) npm 发布
npm publish
# 6) GitHub Release
gh release create v2.4.0 --title "DSHEssentialTools v2.4.0" --notes-file <notes.md> --target main
gh release upload v2.4.0 --clobber install.ps1; gh release upload v2.4.0 --clobber README.md
```

## 发布什么(进 npm)
- `package.json` 的 `files`:`["lib","docs","README.md","LICENSE"]` + `main: lib/index.js`。
- 更新后的 `lib/*.js`(含 `store.js`/`browser.js`)会进包。
- **`browser-extension/` 不进 npm**(`.npmignore` 排除 `*.ps1`/`*.bak*`,且不在 `files`),需单独从仓库装载扩展。

## 版本语义
- 新功能 → minor(如 2.4.0);bug 修 → patch(2.3.5);破坏 → major。

## 发布前自检
1. `node --check lib/*.js`(语法)。
2. `node --input-type=module -e "await import('file:///.../lib/index.js')"`(模块能加载,顶层/方法无引用错误)。
3. 客户端 bundle(`lib/client.js`)能完整执行(factory 冒烟)。
4. 扩展文件 `manifest.json` 可 `JSON.parse`;`background.js`/`options.js`/`popup.js` 可 `node --check`。

## 发布后
- 本机 DSH 需**重启 + 强刷**加载新版本(若从 npm 重装或发布版)。
- 已发布不可撤回(公开);若要回滚,`npm dist-tag` 或切 GitHub tag。

## ⚠ npm 发布凭据(2026-09-10 实测,已解决)
- 现象:`~/.npmrc` 里的旧 token 已失效 —— `npm whoami` → `E401`,直接 PUT 发布 → `404 Not found`(npm 对无 publish 权限的凭据回 404);换成新 token 后仍被 `EOTP` 拦(该账号开了 2FA)。
- 结论:**必须用 llylab 账号的凭据,且该凭据要能免 OTP**。两条可行路径:
  1. 交互式终端里 `npm publish`(npm 会走网页认证分支,浏览器点一下即可);
  2. **Automation token(Bypass 2FA)**:<https://www.npmjs.com/settings/llylab/tokens> → Generate New Token → Classic/Automation,或 Granular 勾 Publish + Bypass 2FA;写进 `~/.npmrc`:
     ```
     //registry.npmjs.org/:_authToken=npm_xxx
     ```
- 验证:`npm whoami` 应输出 `llylab`;再 `npm publish --cache ./.npm-cache`。
- 备用:非交互环境下要临时输码,用 `.\publish-otp.ps1 -Otp 123456`(把「读码→发布→校验」压进一次执行,减少码过期概率)。
- 包名已存在(npm 上 2.3.3/2.3.4/2.3.5),**不要**改名发布,否则现有用户的 `dsh plugin add dsh-essential-tools` 会装不到新版。

## 当前状态(最近一次)
- **v2.5.1 已完整发布**:npm `dsh-essential-tools@2.5.1`(dist-tag latest)+ GitHub tag `v2.5.1`(Release 资产 `install.ps1` / `README.md`)。本版补齐总开关语义(**关闭时一并停用 DET 管控的插件**,快照恢复)并让**全局插件管理的指示 = 实际状态**(常驻按 loader 核对并回写、会话区分「记录」与「在跑」);另修掉登记簿自检的 `id=""` 幽灵会话。
- 上一版 **v2.5.0**:总开关(`det.features.master`,关闭即「完全原生」)+ 0.1.5 适配(`lib/host.js` 能力层 + `lib/vtd/index.js`);GitHub tag `v2.5.0` = `d69454d`。
- 再上一版 **v2.4.1**:GitHub tag `v2.4.1` = `ba23561` + npm `dsh-essential-tools@2.4.1`。
- 用户升级:`dsh plugin --profile web add dsh-essential-tools`(或 `.\install.ps1 -Profile web`),然后**重启 DSH + 强刷**。浏览器扩展仍需从仓库 `browser-extension/` 本机装载。

## ⚠ 脚本编码(2026-09-12 实测)
- `publish.ps1` / `publish-otp.ps1` 含中文,**必须带 UTF-8 BOM**:本机 `pwsh`/`powershell` 实为 **Windows PowerShell 5.1**,无 BOM 时按 ANSI(GBK)读取 → 中文字符串被截断 → `The string is missing the terminator` 解析失败。已补 BOM;若日后编辑器去掉 BOM,请重新补上(或改用 `pwsh 7`)。
- 等价手动流程见上文 §手动,当时即按该流程发布(脚本不可用不影响发布)。
