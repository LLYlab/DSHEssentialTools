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

// 走 background 的 setMode RPC:它会持久化 + 更新徽标 + 把新档位推给 DSH 宿主。
// 直接写 chrome.storage 也能生效于扩展侧门禁,但宿主收不到通知,会继续按旧档位拒绝
// (症状:改成「启用」后 det_browser 仍报 ext-mode-off)。
function setMode(next, cb) {
  chrome.runtime.sendMessage({ type: "setMode", mode: next }, (res) => {
    mode = (res && res.mode) || next;
    render();
    cb && cb();
  });
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
