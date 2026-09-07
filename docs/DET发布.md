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

## 当前状态(最近一次)
- 已发布 **2.3.5**(npm + GitHub Release)。v2.4.0(浏览器控制)已提交本机(`main` 领先 origin),**未推未发**——扩展需先真机装载验证。
