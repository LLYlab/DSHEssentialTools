// DSH 浏览器控制 — popup.js
const MODES = ["off", "read", "write", "on"];
let mode = "off";

function loadMode(cb) {
  chrome.storage.local.get("dshBrowserMode", (s) => {
    const m = s && s.dshBrowserMode;
    mode = MODES.indexOf(m) >= 0 ? m : "off";
    cb && cb(mode);
  });
}

function setMode(next, cb) {
  chrome.storage.local.set({ dshBrowserMode: next }, () => { mode = next; render(); cb && cb(); });
}

function render() {
  const chips = document.querySelectorAll("#modes .chip[data-mode]");
  chips.forEach((c) => c.classList.toggle("on", c.getAttribute("data-mode") === mode));
  document.getElementById("status").textContent =
    "当前: " + ({ off: "关闭", read: "只读", write: "只写", on: "启用" }[mode]);
}

document.querySelectorAll("#modes .chip[data-mode]").forEach((c) => {
  c.addEventListener("click", () => setMode(c.getAttribute("data-mode")));
});

loadMode(render);
