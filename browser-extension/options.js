// DSH 浏览器控制 — options.js:四档模式开关(权威在扩展侧)
const MODES = ["off", "read", "write", "on"];
let mode = "off";

function loadMode() {
  return new Promise((resolve) => {
    chrome.storage.local.get("dshBrowserMode", (s) => {
      const m = s && s.dshBrowserMode;
      resolve(MODES.indexOf(m) >= 0 ? m : "off");
    });
  });
}

function setMode(next) {
  return new Promise((resolve) => {
    if (MODES.indexOf(next) < 0) { resolve(mode); return; }
    chrome.storage.local.set({ dshBrowserMode: next }, () => {
      mode = next;
      render();
      resolve(mode);
    });
  });
}

function render() {
  const chips = document.querySelectorAll("#modes .chip[data-mode]");
  chips.forEach((c) => {
    const on = c.getAttribute("data-mode") === mode;
    c.classList.toggle("on", on);
  });
  const st = document.getElementById("status");
  const label = { off: "关闭", read: "只读", write: "只写", on: "启用" }[mode];
  const danger = mode === "on" || mode === "write";
  st.className = "status" + (danger ? " err" : "");
  st.textContent = "当前: " + label + (danger ? "（高危模式：DSH 可" + (mode === "on" ? "读写" : "执行写操作") + "页面）" : "");
}

document.querySelectorAll("#modes .chip[data-mode]").forEach((c) => {
  c.addEventListener("click", () => setMode(c.getAttribute("data-mode")));
});

loadMode().then((m) => { mode = m; render(); });
