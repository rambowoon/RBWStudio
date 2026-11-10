const tauriInvoke = window.__TAURI__?.core?.invoke || (async () => {});
const tauriListen = window.__TAURI__?.event?.listen || (async () => {});
const tauriWindow = window.__TAURI__?.window?.getCurrentWindow?.();
const tauriDialog = window.__TAURI__?.dialog;

const ICONS = {
  zap: `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
  minus: `<line x1="5" y1="12" x2="19" y2="12"/>`,
  x: `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`,
  sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>`,
  moon: `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`,
  dashboard: `<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>`,
  globe: `<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`,
  mail: `<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>`,
  package: `<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>`,
  settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
  crown: `<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/>`,
  refresh: `<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>`,
  play: `<polygon points="5 3 19 12 5 21 5 3"/>`,
  square: `<rect x="4" y="4" width="16" height="16" rx="2"/>`,
  server: `<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>`,
  code: `<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>`,
  database: `<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>`,
  sliders: `<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>`,
  power: `<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>`,
  table: `<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/>`,
  external: `<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>`,
  folder: `<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>`,
  search: `<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>`,
  trash: `<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>`,
  inbox: `<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>`,
  hexagon: `<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>`,
  feather: `<path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/>`,
  wrench: `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>`,
  help: `<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
  save: `<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>`,
  rocket: `<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>`,
  eye: `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`,
  type: `<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>`,
  cloud: `<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>`,
  download: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`,
  lock: `<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
  plus: `<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`,
  home: `<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
  terminal: `<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>`,
  check: `<polyline points="20 6 9 17 4 12"/>`,
  alert: `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`,
  info: `<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>`,
};

function svgIcon(name, size = 16) {
  const paths = ICONS[name] || ICONS.info;
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

function renderIcons(root = document) {
  root.querySelectorAll("i[data-icon]").forEach((el) => {
    const name = el.getAttribute("data-icon");
    const size = el.getAttribute("data-size") || 16;
    el.outerHTML = svgIcon(name, size);
  });
}

let appState = {
  settings: {},
  demoConfig: {},
  status: {},
  sites: [],
  emails: [],
  storeItems: [],
  activeMailId: null,
  activeVhostSite: null,
  activeDeploySite: null,
  activeFontSite: null,
  activeNodeSite: null,
  activeConfigPath: "",
  localFonts: [],
  googleFonts: [],
  selectedFontMode: "local",
  selectedFontFamily: null,
  activeStoreCategory: "php",
  latestReleaseUrl: "https://github.com/rambowoon/RBWStack/releases",
};

document.addEventListener("DOMContentLoaded", async () => {
  renderIcons();
  initLiquidGlassTheme();
  bindWindowControls();
  bindNavigation();
  bindStoreTabs();
  bindServiceEvents();
  bindGeneralEvents();
  bindSiteEvents();
  bindMailEvents();
  bindModalEvents();
  bindRealtimeListeners();

  await loadInitialAppState();
  setInterval(pollServiceAndMailStatus, 4000);
});

function showToast(msg, type = "info") {
  const stack = document.getElementById("toastStack");
  if (!stack) return;
  const iconName = type === "success" ? "check" : type === "error" ? "alert" : "info";
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `${svgIcon(iconName, 16)}<span>${msg}</span>`;
  stack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 240);
  }, 3200);
}

function initLiquidGlassTheme() {
  let saved = localStorage.getItem("rbw_theme") || "dark";
  if (saved !== "light" && saved !== "dark") {
    saved = "dark";
    localStorage.setItem("rbw_theme", saved);
  }
  applyTheme(saved);
  document.getElementById("btnToggleTheme")?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem("rbw_theme", next);
    applyTheme(next);
  });
}

function applyTheme(mode) {
  const validMode = mode === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", validMode);
  const icon = document.getElementById("themeIcon");
  if (icon) {
    icon.innerHTML = svgIcon(validMode === "light" ? "sun" : "moon", 15);
  }
  const proFrame = document.getElementById("rbwProFrame");
  if (proFrame) {
    try {
      if (proFrame.contentDocument && proFrame.contentDocument.documentElement) {
        proFrame.contentDocument.documentElement.setAttribute("data-mode", validMode);
      }
      if (proFrame.contentWindow) {
        proFrame.contentWindow.postMessage({ type: "rbw-theme-sync", mode: validMode }, "*");
      }
    } catch (_) {}
  }
}

function setHeaderStatus(msg, isBusy = false) {
  const txt = document.getElementById("headerStatusText");
  const dot = document.getElementById("headerSyncDot");
  if (txt) txt.textContent = msg;
  if (dot) dot.classList.toggle("busy", !!isBusy);
}

function bindWindowControls() {
  document.getElementById("btnMinimize")?.addEventListener("click", () => {
    tauriWindow?.minimize();
  });
  document.getElementById("btnMaximize")?.addEventListener("click", async () => {
    await tauriInvoke("window_toggle_maximize");
  });
  document.getElementById("btnClose")?.addEventListener("click", async () => {
    await tauriInvoke("window_close_or_hide");
  });
  const handleExitApp = async () => {
    setHeaderStatus("Đang thoát ứng dụng...", true);
    await tauriInvoke("exit_app");
  };
  document.getElementById("btnExitApp")?.addEventListener("click", handleExitApp);
  document.getElementById("sbExitApp")?.addEventListener("click", handleExitApp);
}

function bindNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      navItems.forEach((n) => n.classList.remove("active"));
      item.classList.add("active");

      const tabKey = item.getAttribute("data-tab");
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));

      const panel = document.getElementById(`tab-${tabKey}`);
      if (panel) panel.classList.add("active");

      if (tabKey === "pro") {
        document.body.classList.add("tab-is-pro");
      } else {
        document.body.classList.remove("tab-is-pro");
      }

      if (tabKey === "sites") refreshSitesList();
      if (tabKey === "mail") refreshEmailsList();
      if (tabKey === "store") renderStoreItems(appState.activeStoreCategory);
      if (tabKey === "pro") refreshProSuite();
      if (tabKey === "about") checkUpdateInfo();
    });
  });
}

function bindStoreTabs() {
  const segBtns = document.querySelectorAll("#storeTabs .seg-btn");
  segBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      segBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const cat = btn.getAttribute("data-cat") || "php";
      appState.activeStoreCategory = cat;
      renderStoreItems(cat);
    });
  });
}

async function loadInitialAppState() {
  try {
    setHeaderStatus("Đang đồng bộ...", true);
    const data = await tauriInvoke("get_initial_state");
    if (!data) return;

    appState.settings = data.settings || {};
    appState.demoConfig = data.demoConfig || {};
    appState.status = data.status || {};
    appState.sites = data.sites || [];
    appState.emails = data.emails || [];
    appState.storeItems = data.storeItems || [];

    const badge = document.getElementById("osBadge");
    if (badge) {
      const osLabel = data.osPlatform === "macos" ? "macOS · Rust" : "Windows · Rust";
      badge.textContent = `v${data.appVersion || "1.0.0"} · ${osLabel}`;
    }

    populateGeneralSettingsForm();
    renderServiceStatus(appState.status);
    renderSitesList();
    renderEmailsList();
    renderStoreItems(appState.activeStoreCategory);
    setHeaderStatus("Sẵn sàng");
  } catch (err) {
    console.error(err);
    setHeaderStatus("Lỗi tải trạng thái", true);
  }
}

let isPolling = false;
async function pollServiceAndMailStatus() {
  if (isPolling || document.hidden) return;
  isPolling = true;
  try {
    const status = await tauriInvoke("get_service_status");
    if (status) {
      appState.status = status;
      renderServiceStatus(status);
    }
    const emails = await tauriInvoke("get_emails");
    if (emails && emails.length !== appState.emails.length) {
      appState.emails = emails;
      renderEmailsList();
    }
  } catch (_) {
  } finally {
    isPolling = false;
  }
}

function renderServiceStatus(st) {
  if (!st) return;
  const isNginx = (st.webServerType || "Apache").toLowerCase() === "nginx";
  const webName = isNginx ? "Nginx Server" : "Apache Server";

  const lblWeb = document.getElementById("lblWebServerName");
  if (lblWeb) lblWeb.textContent = webName;
  const sbLblWeb = document.getElementById("sbLblWeb");
  if (sbLblWeb) sbLblWeb.textContent = isNginx ? "Nginx" : "Apache";

  document.getElementById("lblWebPortSub").textContent = `Port ${appState.settings.webPort || 80}`;
  document.getElementById("lblPhpPortSub").textContent = `Port ${appState.settings.phpCgiPort || 9000}`;
  document.getElementById("lblMysqlPortSub").textContent = `Port ${appState.settings.mysqlPort || 3306}`;
  document.getElementById("lblWwwRootPath").textContent = st.wwwRoot || "./www";

  updateServiceCard("svcCardWeb", "btnToggleWeb", "pillWeb", "sbDotWeb", st.webRunning);
  updateServiceCard("svcCardPhp", "btnTogglePhp", "pillPhp", "sbDotPhp", st.phpRunning);
  updateServiceCard("svcCardMysql", "btnToggleMysql", "pillMysql", "sbDotMysql", st.mysqlRunning);

  const runningCount = [st.webRunning, st.phpRunning, st.mysqlRunning].filter(Boolean).length;
  const sbCount = document.getElementById("sbRunningCount");
  if (sbCount) sbCount.textContent = `${runningCount}/3`;

  populateVersionSelect(
    "selWebVersion",
    isNginx ? st.nginxVersions : st.apacheVersions,
    isNginx ? st.activeNginx : st.activeApache,
    isNginx ? "Chưa cài Nginx" : "Chưa cài Apache"
  );
  populateVersionSelect("selPhpVersion", st.phpVersions, st.activePhp, "Chưa cài PHP");
  populateVersionSelect("selMysqlVersion", st.mysqlVersions, st.activeMysql, "Chưa cài MySQL");
}

function updateServiceCard(cardId, switchId, pillId, sbDotId, running) {
  const isOn = !!running;
  const card = document.getElementById(cardId);
  const sw = document.getElementById(switchId);
  const pill = document.getElementById(pillId);
  const sbDot = document.getElementById(sbDotId);

  if (card) card.classList.toggle("running", isOn);
  if (sw) {
    sw.classList.remove("busy");
    sw.classList.toggle("on", isOn);
    sw.setAttribute("aria-checked", isOn ? "true" : "false");
  }
  if (pill) {
    pill.className = `pill ${isOn ? "pill-success" : "pill-muted"}`;
    pill.innerHTML = `<span class="pill-dot"></span>${isOn ? "Đang chạy" : "Đã dừng"}`;
  }
  if (sbDot) {
    sbDot.classList.toggle("on", isOn);
  }
}

function populateVersionSelect(selectId, list, activeVal, emptyText) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const items = Array.isArray(list) ? list : [];
  if (items.length === 0) {
    sel.innerHTML = `<option value="">${emptyText}</option>`;
    return;
  }
  sel.innerHTML = items
    .map((v) => `<option value="${v}" ${v === activeVal ? "selected" : ""}>${v}</option>`)
    .join("");
}

function bindServiceEvents() {
  document.getElementById("btnRefreshServices")?.addEventListener("click", loadInitialAppState);

  const toggleSvc = async (serviceName, selectId, switchId, label) => {
    const ver = document.getElementById(selectId)?.value || "";
    const sw = document.getElementById(switchId);
    sw?.classList.add("busy");
    setHeaderStatus(`Đang chuyển trạng thái ${label}...`, true);
    try {
      const st = await tauriInvoke("toggle_service", { serviceName, version: ver });
      appState.status = st;
      renderServiceStatus(st);
      setHeaderStatus("Sẵn sàng");
    } catch (e) {
      sw?.classList.remove("busy");
      showToast(String(e), "error");
      setHeaderStatus("Sẵn sàng");
    }
  };

  document.getElementById("btnToggleWeb")?.addEventListener("click", () =>
    toggleSvc("web", "selWebVersion", "btnToggleWeb", "Web Server")
  );
  document.getElementById("btnTogglePhp")?.addEventListener("click", () =>
    toggleSvc("php", "selPhpVersion", "btnTogglePhp", "PHP FastCGI")
  );
  document.getElementById("btnToggleMysql")?.addEventListener("click", () =>
    toggleSvc("mysql", "selMysqlVersion", "btnToggleMysql", "MySQL")
  );

  const handleStartAll = async () => {
    setHeaderStatus("Đang khởi chạy toàn bộ dịch vụ...", true);
    try {
      const st = await tauriInvoke("start_all_services");
      appState.status = st;
      renderServiceStatus(st);
      setHeaderStatus("Đã bật tất cả dịch vụ");
      showToast("Đã khởi động toàn bộ dịch vụ", "success");
    } catch (e) {
      showToast(String(e), "error");
      setHeaderStatus("Sẵn sàng");
    }
  };

  const handleStopAll = async () => {
    setHeaderStatus("Đang dừng toàn bộ dịch vụ...", true);
    try {
      const st = await tauriInvoke("stop_all_services");
      appState.status = st;
      renderServiceStatus(st);
      setHeaderStatus("Đã dừng tất cả dịch vụ");
      showToast("Đã dừng toàn bộ dịch vụ", "info");
    } catch (e) {
      showToast(String(e), "error");
      setHeaderStatus("Sẵn sàng");
    }
  };

  document.getElementById("btnStartAll")?.addEventListener("click", handleStartAll);
  document.getElementById("sbStartAll")?.addEventListener("click", handleStartAll);
  document.getElementById("btnStopAll")?.addEventListener("click", handleStopAll);
  document.getElementById("sbStopAll")?.addEventListener("click", handleStopAll);

  document.getElementById("btnOpenPhpMyAdmin")?.addEventListener("click", async () => {
    if (!appState.status.phpmyadminInstalled) {
      showToast("Chưa cài đặt phpMyAdmin! Đang chuyển tới Kho tải...", "info");
      document.querySelector('.nav-item[data-tab="store"]')?.click();
      document.querySelector('#storeTabs .seg-btn[data-cat="phpmyadmin"]')?.click();
      return;
    }
    if (!appState.status.webRunning || !appState.status.mysqlRunning || !appState.status.phpRunning) {
      setHeaderStatus("Đang tự động bật dịch vụ cho phpMyAdmin...", true);
      const st = await tauriInvoke("start_all_services");
      appState.status = st;
      renderServiceStatus(st);
      setHeaderStatus("Sẵn sàng");
    }
    const port = appState.settings.webPort || 80;
    const portSuffix = port === 80 ? "" : `:${port}`;
    await tauriInvoke("open_browser", { url: `http://localhost${portSuffix}/phpmyadmin/` });
  });

  document.getElementById("btnOpenLocalhost")?.addEventListener("click", async () => {
    const port = appState.settings.webPort || 80;
    const portSuffix = port === 80 ? "" : `:${port}`;
    await tauriInvoke("open_browser", { url: `http://localhost${portSuffix}` });
  });

  document.getElementById("btnOpenWwwFolder")?.addEventListener("click", async () => {
    if (appState.status.wwwRoot) {
      await tauriInvoke("open_folder", { path: appState.status.wwwRoot });
    }
  });

  document.getElementById("btnConfigWeb")?.addEventListener("click", () =>
    openConfigEditor("web", "Cấu hình Web Server (httpd.conf / nginx.conf)")
  );
  document.getElementById("btnConfigPhp")?.addEventListener("click", () =>
    openConfigEditor("php", "Cấu hình PHP Engine (php.ini)")
  );
  document.getElementById("btnConfigMysql")?.addEventListener("click", () =>
    openConfigEditor("mysql", "Cấu hình Database (my.ini)")
  );
}

async function openConfigEditor(target, title) {
  try {
    const res = await tauriInvoke("read_service_config", { target });
    if (!res) return;
    const [filePath, content] = res;
    appState.activeConfigPath = filePath;
    document.getElementById("cfgEditorTitle").textContent = title;
    document.getElementById("cfgEditorPath").textContent = filePath;
    document.getElementById("cfgEditorTextarea").value = content;
    openModal("modalConfigEditor");
  } catch (e) {
    showToast(String(e), "error");
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function populateGeneralSettingsForm() {
  const s = appState.settings;
  const d = appState.demoConfig;

  document.getElementById("cfgDefaultWebServer").value = s.defaultWebServer || "Apache";
  document.getElementById("cfgVhostSuffix").value = s.vhostSuffix || ".local";
  document.getElementById("cfgWebPort").value = s.webPort || 80;
  document.getElementById("cfgMysqlPort").value = s.mysqlPort || 3306;
  document.getElementById("cfgPhpPort").value = s.phpCgiPort || 9000;
  document.getElementById("cfgColorHotkey").value = s.colorPickerHotkey || "Ctrl+Shift+C";

  document.getElementById("cfgAutoStart").checked = !!s.autoStart;
  document.getElementById("cfgMinimizeToTray").checked = s.minimizeToTray !== false;
  document.getElementById("cfgAutoOptimizePhp").checked = s.autoOptimizePhp !== false;
  document.getElementById("cfgAdminVhostMode").checked = !!s.adminVhostMode;

  loadProSettingsToForm();
}

appState.demoServers = [];
appState.defaultDemoId = "";

async function loadProSettingsToForm() {
  try {
    const res = await tauriInvoke("rbw_pro_dispatch", {
      req: {
        endpoint: "api.php",
        method: "GET",
        query: { action: "getGlobalConfig" },
        bodyType: "json",
        body: ""
      }
    });

    if (res && res.data) {
      const cfg = res.data;
      appState.proSettings = cfg;

      // Card 3: RBW Pro Scaffolding Settings
      if (document.getElementById("cfgSourcePath")) document.getElementById("cfgSourcePath").value = cfg.source_path || "";
      if (document.getElementById("cfgSourceFolderName")) document.getElementById("cfgSourceFolderName").value = cfg.source_folder_name || "";
      if (document.getElementById("cfgSourceDbName")) document.getElementById("cfgSourceDbName").value = cfg.source_db_name || "";
      if (document.getElementById("cfgEditorPath")) document.getElementById("cfgEditorPath").value = cfg.editor_path || "";
      if (document.getElementById("cfgFontSourcePath")) document.getElementById("cfgFontSourcePath").value = cfg.font_source_path || "";
      if (document.getElementById("cfgImagesPoolPath")) document.getElementById("cfgImagesPoolPath").value = cfg.images_pool_path || "";
      if (document.getElementById("cfgMonthFolderFormat")) document.getElementById("cfgMonthFolderFormat").value = cfg.month_folder_format || "YYYY_MM";
      if (document.getElementById("cfgGeminiKey")) document.getElementById("cfgGeminiKey").value = cfg.gemini_api_key || "";

      // Card 2: Demo Servers
      if (Array.isArray(cfg.demo_list) && cfg.demo_list.length > 0) {
        appState.demoServers = cfg.demo_list;
        appState.defaultDemoId = cfg.default_demo_id || cfg.demo_list[0].id || "";
      } else {
        // Fallback: create from legacy demo config or primary server
        const primary = {
          id: "srv_" + Date.now(),
          name: "Server Demo Chính (DirectAdmin)",
          ftp_host: cfg.ftp_host || appState.demoConfig.FtpHost || "",
          web_domain: cfg.web_domain || appState.demoConfig.WebDomain || "",
          ftp_user: cfg.ftp_user || appState.demoConfig.FtpUser || "",
          ftp_pass: cfg.ftp_pass || appState.demoConfig.FtpPass || "",
          ftp_root: cfg.ftp_root || appState.demoConfig.FtpRootPath || "/domains/{domain}/public_html",
          da_user: cfg.da_user || appState.demoConfig.DaUser || cfg.ftp_user || "",
          da_port: cfg.da_port || appState.demoConfig.DaPort || "2222",
          db_naming_mode: Number(cfg.db_naming_mode || appState.demoConfig.DbNamingMode || 0)
        };
        appState.demoServers = [primary];
        appState.defaultDemoId = primary.id;
      }
      renderDemoServersSettingsList();
    }
  } catch (err) {
    console.error("Lỗi khi tải cấu hình RBW Pro:", err);
    if (!appState.demoServers || appState.demoServers.length === 0) {
      const primary = {
        id: "srv_" + Date.now(),
        name: "Server Demo Chính (DirectAdmin)",
        ftp_host: (appState.demoConfig && appState.demoConfig.FtpHost) || "",
        web_domain: (appState.demoConfig && appState.demoConfig.WebDomain) || "",
        ftp_user: (appState.demoConfig && appState.demoConfig.FtpUser) || "",
        ftp_pass: (appState.demoConfig && appState.demoConfig.FtpPass) || "",
        ftp_root: (appState.demoConfig && appState.demoConfig.FtpRootPath) || "/domains/{domain}/public_html",
        da_user: (appState.demoConfig && appState.demoConfig.DaUser) || (appState.demoConfig && appState.demoConfig.FtpUser) || "",
        da_port: (appState.demoConfig && appState.demoConfig.DaPort) || "2222",
        db_naming_mode: Number((appState.demoConfig && appState.demoConfig.DbNamingMode) || 0)
      };
      appState.demoServers = [primary];
      appState.defaultDemoId = primary.id;
      renderDemoServersSettingsList();
    }
  }
}

function renderDemoServersSettingsList() {
  const container = document.getElementById("demoServersContainer");
  if (!container) return;

  if (!appState.demoServers || appState.demoServers.length === 0) {
    container.innerHTML = `
      <div style="padding: 24px; text-align: center; border: 1px dashed var(--border); border-radius: 8px; color: var(--text-muted);">
        Chưa có server demo nào được thêm. Bấm <strong>Thêm Server Demo</strong> hoặc <strong>Dán nhanh</strong> để bắt đầu.
      </div>
    `;
    return;
  }

  container.innerHTML = appState.demoServers.map((srv, idx) => {
    const isDefault = srv.id === appState.defaultDemoId || (!appState.defaultDemoId && idx === 0);
    const borderStyle = isDefault ? "border: 1px solid var(--accent); background: rgba(99, 102, 241, 0.04);" : "border: 1px solid var(--border); background: var(--surface);";
    return `
      <div class="demo-server-card" data-srv-id="${srv.id}" style="${borderStyle} border-radius: 10px; padding: 14px 16px; margin-bottom: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 15px; font-weight: 700; color: var(--text);">${escapeHtml(srv.name || "Server Demo #" + (idx + 1))}</span>
            ${isDefault ? '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 11px; padding: 2px 7px; border-radius: 4px; font-weight: 700;">⭐ MẶC ĐỊNH</span>' : ''}
          </div>
          <div style="display: flex; gap: 6px;">
            ${!isDefault ? `<button type="button" class="btn btn-ghost btn-xs btn-set-default" data-id="${srv.id}" style="font-size: 11px; padding: 3px 8px;">⭐ Đặt mặc định</button>` : ''}
            <button type="button" class="btn btn-ghost btn-xs btn-test-conn" data-id="${srv.id}" style="font-size: 11px; padding: 3px 8px;">🔌 Test kết nối</button>
            <button type="button" class="btn btn-ghost btn-xs btn-del-srv" data-id="${srv.id}" style="font-size: 11px; padding: 3px 8px; color: #ef4444;">🗑️ Xóa</button>
          </div>
        </div>

        <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;">
          <div class="field" style="margin-bottom: 0;">
            <label style="font-size: 11px; color: var(--text-muted);">Tên gợi nhớ máy chủ</label>
            <input type="text" class="input srv-input" data-srv-id="${srv.id}" data-field="name" value="${escapeHtml(srv.name || '')}" placeholder="Server Demo 1" style="height: 32px; font-size: 12px;" />
          </div>
          <div class="field" style="margin-bottom: 0;">
            <label style="font-size: 11px; color: var(--text-muted);">Host FTP / IP máy chủ</label>
            <input type="text" class="input srv-input" data-srv-id="${srv.id}" data-field="ftp_host" value="${escapeHtml(srv.ftp_host || '')}" placeholder="ftp.domain.com hoặc 123.45.67.89" style="height: 32px; font-size: 12px;" />
          </div>
          <div class="field" style="margin-bottom: 0;">
            <label style="font-size: 11px; color: var(--text-muted);">Tên miền Web Demo (Domain)</label>
            <input type="text" class="input srv-input" data-srv-id="${srv.id}" data-field="web_domain" value="${escapeHtml(srv.web_domain || '')}" placeholder="demo.domain.com" style="height: 32px; font-size: 12px;" />
          </div>
          <div class="field" style="margin-bottom: 0;">
            <label style="font-size: 11px; color: var(--text-muted);">FTP / DirectAdmin Username</label>
            <input type="text" class="input srv-input" data-srv-id="${srv.id}" data-field="ftp_user" value="${escapeHtml(srv.ftp_user || '')}" placeholder="admin hoặc da_user" style="height: 32px; font-size: 12px;" />
          </div>
          <div class="field" style="margin-bottom: 0;">
            <label style="font-size: 11px; color: var(--text-muted);">Mật khẩu (FTP / DirectAdmin)</label>
            <div class="input-group">
              <input type="password" class="input srv-input" data-srv-id="${srv.id}" data-field="ftp_pass" value="${escapeHtml(srv.ftp_pass || '')}" placeholder="••••••••" style="height: 32px; font-size: 12px;" />
              <button class="icon-btn h32 btn-toggle-pass" type="button" title="Hiện / Ẩn"><i data-icon="eye" data-size="13"></i></button>
            </div>
          </div>
          <div class="field" style="margin-bottom: 0;">
            <label style="font-size: 11px; color: var(--text-muted);">Port DirectAdmin API</label>
            <input type="text" class="input srv-input" data-srv-id="${srv.id}" data-field="da_port" value="${escapeHtml(srv.da_port || '2222')}" placeholder="2222" style="height: 32px; font-size: 12px;" />
          </div>
          <div class="field" style="margin-bottom: 0; grid-column: span 2;">
            <label style="font-size: 11px; color: var(--text-muted);">Đường dẫn FTP Root</label>
            <input type="text" class="input srv-input" data-srv-id="${srv.id}" data-field="ftp_root" value="${escapeHtml(srv.ftp_root || '/domains/{domain}/public_html')}" placeholder="/domains/{domain}/public_html" style="height: 32px; font-size: 12px;" />
          </div>
          <div class="field" style="margin-bottom: 0;">
            <label style="font-size: 11px; color: var(--text-muted);">Quy tắc tạo Database DirectAdmin</label>
            <select class="select srv-input" data-srv-id="${srv.id}" data-field="db_naming_mode" style="height: 32px; font-size: 12px;">
              <option value="0" ${Number(srv.db_naming_mode) === 0 ? 'selected' : ''}>Standard ({user}_{dbname})</option>
              <option value="1" ${Number(srv.db_naming_mode) === 1 ? 'selected' : ''}>Direct ({dbname})</option>
            </select>
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Re-bind icons
  if (typeof renderIcons === "function") renderIcons();

  // Bind change listeners to live update appState.demoServers
  container.querySelectorAll(".srv-input").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const sId = e.target.getAttribute("data-srv-id");
      const field = e.target.getAttribute("data-field");
      const targetSrv = appState.demoServers.find((s) => s.id === sId);
      if (targetSrv && field) {
        targetSrv[field] = e.target.value;
      }
    });
  });

  // Toggle password visibility inside cards
  container.querySelectorAll(".btn-toggle-pass").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const fieldWrap = e.target.closest(".field");
      const inp = fieldWrap?.querySelector('input[data-field="ftp_pass"]');
      if (inp) {
        inp.type = inp.type === "password" ? "text" : "password";
      }
    });
  });

  // Set default button
  container.querySelectorAll(".btn-set-default").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      appState.defaultDemoId = id;
      renderDemoServersSettingsList();
      showToast("Đã đặt server làm mặc định", "info");
    });
  });

  // Delete server button
  container.querySelectorAll(".btn-del-srv").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      if (appState.demoServers.length <= 1) {
        showToast("Phải giữ lại ít nhất 1 server demo!", "warning");
        return;
      }
      appState.demoServers = appState.demoServers.filter((s) => s.id !== id);
      if (appState.defaultDemoId === id) {
        appState.defaultDemoId = appState.demoServers[0]?.id || "";
      }
      renderDemoServersSettingsList();
      showToast("Đã xóa server demo", "info");
    });
  });

  // Test connection button
  container.querySelectorAll(".btn-test-conn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const srv = appState.demoServers.find((s) => s.id === id);
      if (!srv) return;
      if (!srv.ftp_host || !srv.ftp_user) {
        showToast("Vui lòng nhập Host và User trước khi test kết nối!", "warning");
        return;
      }

      btn.disabled = true;
      btn.textContent = "⏳ Đang kết nối...";
      try {
        const res = await tauriInvoke("rbw_pro_dispatch", {
          req: {
            endpoint: "api.php",
            method: "POST",
            query: { action: "testDemoConnection" },
            bodyType: "json",
            body: JSON.stringify({
              ftp_host: srv.ftp_host,
              ftp_user: srv.ftp_user,
              ftp_pass: srv.ftp_pass,
              da_port: srv.da_port || "2222"
            })
          }
        });

        if (res && res.status === "success") {
          showToast(`✅ [${srv.name || srv.ftp_host}] ${res.message || "Kết nối thành công!"}`, "success");
        } else {
          showToast(`❌ [${srv.name || srv.ftp_host}] ${res?.message || "Không thể kết nối đến máy chủ demo!"}`, "error");
        }
      } catch (err) {
        showToast("Lỗi kiểm tra kết nối: " + String(err), "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "🔌 Test kết nối";
      }
    });
  });
}

function bindGeneralEvents() {
  // Add Demo Server Button
  document.getElementById("btnAddDemoServer")?.addEventListener("click", () => {
    const newId = "srv_" + Date.now();
    const newIdx = appState.demoServers.length + 1;
    appState.demoServers.push({
      id: newId,
      name: `Server Demo #${newIdx}`,
      ftp_host: "",
      web_domain: "",
      ftp_user: "",
      ftp_pass: "",
      ftp_root: "/domains/{domain}/public_html",
      da_user: "",
      da_port: "2222",
      db_naming_mode: 0
    });
    if (!appState.defaultDemoId) appState.defaultDemoId = newId;
    renderDemoServersSettingsList();
  });

  // Quick Paste Demo Server Button
  document.getElementById("btnQuickPasteServer")?.addEventListener("click", async () => {
    let clipText = "";
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        clipText = await navigator.clipboard.readText();
      }
    } catch (_) {}

    const text = prompt("Dán thông tin cấu hình FTP / DirectAdmin vào đây:\n(Hỗ trợ định dạng dạng: Host: ..., User: ..., Pass: ..., Domain: ... hoặc JSON)", clipText || "");
    if (!text || !text.trim()) return;

    let parsed = {
      id: "srv_" + Date.now(),
      name: "Server Demo " + (appState.demoServers.length + 1),
      ftp_host: "",
      web_domain: "",
      ftp_user: "",
      ftp_pass: "",
      ftp_root: "/domains/{domain}/public_html",
      da_user: "",
      da_port: "2222",
      db_naming_mode: 0
    };

    // Try JSON
    try {
      const obj = JSON.parse(text);
      if (typeof obj === "object" && obj !== null) {
        parsed.ftp_host = obj.ftp_host || obj.host || obj.server || "";
        parsed.web_domain = obj.web_domain || obj.domain || "";
        parsed.ftp_user = obj.ftp_user || obj.user || obj.username || "";
        parsed.ftp_pass = obj.ftp_pass || obj.pass || obj.password || "";
        parsed.da_port = obj.da_port || obj.port || "2222";
        parsed.ftp_root = obj.ftp_root || "/domains/{domain}/public_html";
        parsed.name = obj.name || `Server ${parsed.web_domain || parsed.ftp_host}`;
      }
    } catch (_) {
      // Regex parsing lines
      const hostMatch = text.match(/(?:host|server|máy chủ|ftp)[:\s=]+([^\r\n]+)/i);
      const userMatch = text.match(/(?:user|username|tài khoản)[:\s=]+([^\r\n]+)/i);
      const passMatch = text.match(/(?:pass|password|mật khẩu)[:\s=]+([^\r\n]+)/i);
      const domainMatch = text.match(/(?:domain|tên miền|web)[:\s=]+([^\r\n]+)/i);
      const portMatch = text.match(/(?:port|cổng)[:\s=]+([^\r\n]+)/i);

      if (hostMatch) parsed.ftp_host = hostMatch[1].trim();
      if (userMatch) parsed.ftp_user = userMatch[1].trim();
      if (passMatch) parsed.ftp_pass = passMatch[1].trim();
      if (domainMatch) parsed.web_domain = domainMatch[1].trim();
      if (portMatch) parsed.da_port = portMatch[1].trim();
      parsed.da_user = parsed.ftp_user;
      if (parsed.web_domain || parsed.ftp_host) {
        parsed.name = `Server ${parsed.web_domain || parsed.ftp_host}`;
      }
    }

    if (!parsed.ftp_host && !parsed.ftp_user) {
      showToast("Không tìm thấy thông tin Host hoặc User hợp lệ trong nội dung đã dán!", "warning");
      return;
    }

    appState.demoServers.push(parsed);
    if (!appState.defaultDemoId) appState.defaultDemoId = parsed.id;
    renderDemoServersSettingsList();
    showToast(`Đã nhận diện thành công server: ${parsed.name}`, "success");
  });

  // Browse Directory handlers for RBW Pro Card 3
  document.getElementById("btnBrowseSourcePath")?.addEventListener("click", async () => {
    if (tauriDialog?.open) {
      const selected = await tauriDialog.open({ directory: true, multiple: false });
      if (selected) document.getElementById("cfgSourcePath").value = selected;
    }
  });

  document.getElementById("btnBrowseEditorPath")?.addEventListener("click", async () => {
    if (tauriDialog?.open) {
      const selected = await tauriDialog.open({
        directory: false,
        multiple: false,
        filters: [{ name: "Executable", extensions: ["exe"] }]
      });
      if (selected) document.getElementById("cfgEditorPath").value = selected;
    }
  });

  document.getElementById("btnBrowseFontSourcePath")?.addEventListener("click", async () => {
    if (tauriDialog?.open) {
      const selected = await tauriDialog.open({ directory: true, multiple: false });
      if (selected) document.getElementById("cfgFontSourcePath").value = selected;
    }
  });

  document.getElementById("btnBrowseImagesPoolPath")?.addEventListener("click", async () => {
    if (tauriDialog?.open) {
      const selected = await tauriDialog.open({ directory: true, multiple: false });
      if (selected) document.getElementById("cfgImagesPoolPath").value = selected;
    }
  });

  document.getElementById("btnToggleGeminiPass")?.addEventListener("click", () => {
    const inp = document.getElementById("cfgGeminiKey");
    if (inp) inp.type = inp.type === "password" ? "text" : "password";
  });

  // Save General & RBW Pro Settings
  document.getElementById("btnSaveGeneral")?.addEventListener("click", async () => {
    const newSettings = {
      ...appState.settings,
      defaultWebServer: document.getElementById("cfgDefaultWebServer").value,
      vhostSuffix: document.getElementById("cfgVhostSuffix").value.trim() || ".local",
      webPort: Number(document.getElementById("cfgWebPort").value) || 80,
      mysqlPort: Number(document.getElementById("cfgMysqlPort").value) || 3306,
      phpCgiPort: Number(document.getElementById("cfgPhpPort").value) || 9000,
      colorPickerHotkey: document.getElementById("cfgColorHotkey").value.trim() || "Ctrl+Shift+C",
      autoStart: document.getElementById("cfgAutoStart").checked,
      minimizeToTray: document.getElementById("cfgMinimizeToTray").checked,
      autoOptimizePhp: document.getElementById("cfgAutoOptimizePhp").checked,
      adminVhostMode: document.getElementById("cfgAdminVhostMode").checked,
      activePhpVersion: document.getElementById("selPhpVersion")?.value || appState.settings.activePhpVersion || "",
      activeApacheVersion: appState.settings.activeApacheVersion || "",
      activeNginxVersion: appState.settings.activeNginxVersion || "",
      activeMysqlVersion: document.getElementById("selMysqlVersion")?.value || appState.settings.activeMysqlVersion || "",
    };

    const defaultSrv = appState.demoServers.find((s) => s.id === appState.defaultDemoId) || appState.demoServers[0] || {};

    const newDemo = {
      FtpHost: defaultSrv.ftp_host || "",
      WebDomain: defaultSrv.web_domain || "",
      FtpUser: defaultSrv.ftp_user || "",
      FtpPass: defaultSrv.ftp_pass || "",
      FtpRootPath: defaultSrv.ftp_root || "/domains/{domain}/public_html",
      DaUser: defaultSrv.da_user || defaultSrv.ftp_user || "",
      DaPort: defaultSrv.da_port || "2222",
      DbNamingMode: Number(defaultSrv.db_naming_mode) || 0,
      FontFolderPath: document.getElementById("cfgFontSourcePath")?.value.trim() || "",
    };

    const proPayload = {
      demo_list: appState.demoServers,
      default_demo_id: appState.defaultDemoId || defaultSrv.id || "",
      ftp_host: defaultSrv.ftp_host || "",
      web_domain: defaultSrv.web_domain || "",
      ftp_user: defaultSrv.ftp_user || "",
      ftp_pass: defaultSrv.ftp_pass || "",
      ftp_root: defaultSrv.ftp_root || "/domains/{domain}/public_html",
      da_user: defaultSrv.da_user || defaultSrv.ftp_user || "",
      da_port: defaultSrv.da_port || "2222",
      db_naming_mode: Number(defaultSrv.db_naming_mode) || 0,
      source_path: document.getElementById("cfgSourcePath")?.value.trim() || "",
      source_folder_name: document.getElementById("cfgSourceFolderName")?.value.trim() || "",
      source_db_name: document.getElementById("cfgSourceDbName")?.value.trim() || "",
      editor_path: document.getElementById("cfgEditorPath")?.value.trim() || "",
      font_source_path: document.getElementById("cfgFontSourcePath")?.value.trim() || "",
      images_pool_path: document.getElementById("cfgImagesPoolPath")?.value.trim() || "",
      month_folder_format: document.getElementById("cfgMonthFolderFormat")?.value || "YYYY_MM",
      gemini_api_key: document.getElementById("cfgGeminiKey")?.value.trim() || "",
    };

    try {
      setHeaderStatus("Đang lưu cấu hình...", true);
      const st = await tauriInvoke("save_general_settings", {
        settings: newSettings,
        demoConfig: newDemo,
      });

      // Dispatch directly to RBW Pro Rust backend
      await tauriInvoke("rbw_pro_dispatch", {
        req: {
          endpoint: "api.php",
          method: "POST",
          query: { action: "saveGlobalConfig" },
          bodyType: "json",
          body: JSON.stringify(proPayload)
        }
      });

      appState.settings = newSettings;
      appState.demoConfig = newDemo;
      renderServiceStatus(st);

      // Refresh RBW Pro iframe so changes reflect instantly
      const frame = document.getElementById("rbwProFrame");
      if (frame && frame.contentWindow) {
        try {
          frame.contentWindow.postMessage({ type: "rbw-settings-updated" }, "*");
        } catch (_) {}
      }

      setHeaderStatus("Đã lưu cấu hình");
      showToast("Đã lưu toàn bộ cài đặt RBWStudio & Server Demo thành công!", "success");
    } catch (e) {
      showToast(String(e), "error");
      setHeaderStatus("Sẵn sàng");
    }
  });
}

/* SITES */
async function refreshSitesList() {
  const sites = await tauriInvoke("get_sites");
  if (sites) {
    appState.sites = sites;
    renderSitesList();
  }
}

function renderSitesList() {
  const container = document.getElementById("sitesListContainer");
  const badge = document.getElementById("sitesCountBadge");
  if (badge) badge.textContent = String(appState.sites.length);
  if (!container) return;

  const query = (document.getElementById("txtSearchSites")?.value || "").toLowerCase().trim();
  const filtered = appState.sites.filter(
    (s) => s.name.toLowerCase().includes(query) || (s.vhostDomain || "").toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state empty-card">
        ${svgIcon("folder", 34)}
        <p>Chưa tìm thấy dự án nào</p>
        <small>Tạo thư mục mới trong Document Root (${appState.status.wwwRoot || "./www"})</small>
      </div>`;
    return;
  }

  const phpVers = appState.status.phpVersions || [];
  const hues = [239, 262, 199, 158, 36, 350];

  container.innerHTML = filtered
    .map((site, idx) => {
      const hue = hues[idx % hues.length];
      const initials = (site.name || "PR").slice(0, 2).toUpperCase();
      const engineOptions = [
        ...phpVers.map((v) => `<option value="${v}" ${site.phpVersion === v ? "selected" : ""}>${v}</option>`),
        `<option value="Node.js" ${site.isNode ? "selected" : ""}>Node.js</option>`,
      ].join("");

      const deployClass =
        site.deployStatus === "deployed"
          ? "is-on"
          : site.deployStatus === "locked"
          ? "is-danger"
          : "";

      return `
      <div class="site-card">
        <div class="avatar" style="--h:${hue}">${initials}</div>
        <div class="site-info">
          <div class="site-title-row">
            <span class="site-name">${site.name}</span>
            ${site.isRootProject ? `<span class="tag tag-warn">Root</span>` : ""}
            ${site.vhostActive ? `<span class="tag tag-primary">${site.vhostDomain}</span>` : ""}
          </div>
          <a class="site-url" data-url="${site.url}">
            ${svgIcon("external", 11)}
            <span>${site.url}</span>
          </a>
        </div>

        <div class="site-controls">
          <select class="select select-sm site-engine-select" data-site="${site.name}">
            ${engineOptions}
          </select>

          ${
            site.isNode
              ? `<button class="icon-btn ${site.nodeRunning ? "is-on" : ""}" data-action="node-toggle" data-site="${site.name}" title="${site.nodeRunning ? "Dừng Node.js" : "Chạy Node.js"}">${svgIcon(site.nodeRunning ? "square" : "play", 14)}</button>
                 <button class="icon-btn" data-action="node-cfg" data-site="${site.name}" title="Cấu hình lệnh Node.js">${svgIcon("sliders", 14)}</button>`
              : ""
          }

          <button class="icon-btn ${site.sslEnabled ? "is-on" : ""}" data-action="ssl" data-site="${site.name}" data-path="${site.path}" title="Bật / Tắt HTTPS (SSL)">${svgIcon("lock", 14)}</button>
          <button class="icon-btn ${site.vhostActive ? "is-primary" : ""}" data-action="vhost" data-site="${site.name}" data-path="${site.path}" title="Tên miền ảo (.local)">${svgIcon("globe", 14)}</button>
          <button class="icon-btn ${site.isRootProject ? "is-warn" : ""}" data-action="root" data-site="${site.name}" data-path="${site.path}" title="Đặt làm Dự án Gốc (localhost)">${svgIcon("home", 14)}</button>
          <button class="icon-btn" data-action="vscode" data-site="${site.name}" data-path="${site.path}" title="Mở trong VS Code">${svgIcon("code", 14)}</button>
          <button class="icon-btn" data-action="folder" data-site="${site.name}" data-path="${site.path}" title="Mở thư mục">${svgIcon("folder", 14)}</button>
        </div>
      </div>`;
    })
    .join("");

  container.querySelectorAll(".site-url").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      tauriInvoke("open_browser", { url: el.getAttribute("data-url") });
    });
  });

  container.querySelectorAll(".site-engine-select").forEach((sel) => {
    sel.addEventListener("change", async () => {
      const siteName = sel.getAttribute("data-site");
      const sites = await tauriInvoke("set_site_engine", { siteName, engine: sel.value });
      appState.sites = sites;
      renderSitesList();
      showToast(`Đã đổi engine cho ${siteName}`, "success");
    });
  });

  container.querySelectorAll(".icon-btn").forEach((btn) => {
    btn.addEventListener("click", () => handleSiteActionButton(btn));
    btn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openSiteContextMenu(btn, e.clientX, e.clientY);
    });
  });
}

let ctxMenuOpenedAt = 0;

function closeContextMenu() {
  if (Date.now() - ctxMenuOpenedAt < 180) return;
  const menu = document.getElementById("ctxMenu");
  if (menu) {
    menu.classList.remove("open");
    menu.innerHTML = "";
  }
}

document.addEventListener("click", closeContextMenu);
document.addEventListener("contextmenu", (e) => {
  if (!e.target.closest(".site-card .icon-btn")) {
    closeContextMenu();
  }
});

function openSiteContextMenu(btn, x, y) {
  const menu = document.getElementById("ctxMenu");
  if (!menu) return;
  const action = btn.getAttribute("data-action");
  const siteName = btn.getAttribute("data-site");
  const path = btn.getAttribute("data-path");
  const site = appState.sites.find((s) => s.name === siteName);

  let items = [];

  switch (action) {
    case "ssl":
      items = [
        { label: site?.sslEnabled ? "Tắt HTTPS (SSL)" : "Bật HTTPS (SSL)", icon: "lock", action: () => handleSiteActionButton(btn) },
        { label: "Mở link HTTPS", icon: "external", action: () => tauriInvoke("open_browser", { url: `https://localhost` }) },
      ];
      break;

    case "vhost":
      items = [
        { label: "Cấu hình Tên miền ảo...", icon: "globe", action: () => handleSiteActionButton(btn) },
        { label: site?.vhostActive ? "Tắt nhanh Tên miền ảo" : "Bật nhanh Tên miền ảo", icon: "globe", action: () => {
            const domain = site?.vhostDomain || `${siteName.toLowerCase()}${appState.settings.vhostSuffix || ".local"}`;
            tauriInvoke("save_site_vhost", { siteName, domain, enable: !site?.vhostActive }).then((st) => {
              appState.sites = st;
              renderSitesList();
              showToast(site?.vhostActive ? "Đã tắt VHost" : "Đã bật VHost", "success");
            });
          }
        },
        { isSep: true },
        { label: "Mở file hosts hệ thống", icon: "code", action: () => tauriInvoke("open_vscode", { path: "C:\\Windows\\System32\\drivers\\etc\\hosts" }) },
      ];
      break;

    case "root":
      items = [
        { label: site?.isRootProject ? "Hủy đặt làm Dự án Gốc (Root)" : "Đặt làm Dự án Gốc (localhost)", icon: "home", action: () => handleSiteActionButton(btn) },
        { label: "Mở https://localhost", icon: "external", action: () => tauriInvoke("open_browser", { url: "https://localhost" }) },
      ];
      break;

    case "fonts":
      items = [
        { label: "Cài đặt Font chữ cho dự án...", icon: "type", action: () => handleSiteActionButton(btn) },
        { label: "Mở thư mục fonts (assets/fonts)", icon: "folder", action: () => tauriInvoke("open_folder", { path: `${site?.path}/assets/fonts` }) },
        { label: "Mở file fonts.css", icon: "code", action: () => tauriInvoke("open_vscode", { path: `${site?.path}/assets/css/fonts.css` }) },
      ];
      break;

    case "vscode":
      items = [
        { label: "Mở bằng VS Code", icon: "code", action: () => tauriInvoke("open_vscode", { path }) },
        { label: "Mở Terminal tại đây", icon: "terminal", action: () => tauriInvoke("open_terminal", { path }) },
        { label: "Mở trong Explorer", icon: "folder", action: () => tauriInvoke("open_folder", { path }) },
      ];
      break;

    case "folder":
      items = [
        { label: "Mở thư mục dự án", icon: "folder", action: () => tauriInvoke("open_folder", { path }) },
        { label: "Mở bằng VS Code", icon: "code", action: () => tauriInvoke("open_vscode", { path }) },
        { label: "Mở Terminal / PowerShell", icon: "terminal", action: () => tauriInvoke("open_terminal", { path }) },
        { isSep: true },
        { label: "Cài đặt Fonts...", icon: "type", action: () => openFontInstallerModal(site) },
      ];
      break;

    case "deploy":
      items = [
        { label: "Deploy Demo lên Hosting...", icon: "rocket", action: () => openDeployModal(siteName) },
        { label: "Mở phpMyAdmin", icon: "table", action: () => tauriInvoke("open_browser", { url: "http://localhost/phpmyadmin" }) },
        { isSep: true },
        { label: "Cài đặt Fonts...", icon: "type", action: () => openFontInstallerModal(site) },
      ];
      break;

    case "node-toggle":
    case "node-cfg":
      items = [
        { label: site?.nodeRunning ? "Dừng Node.js" : "Chạy Node.js", icon: site?.nodeRunning ? "square" : "play", action: () => handleSiteActionButton(btn) },
        { label: "Cấu hình lệnh Start...", icon: "sliders", action: () => {
            appState.activeNodeSite = site;
            document.getElementById("nodeCfgTitle").textContent = `Cấu hình Node.js — ${siteName}`;
            document.getElementById("txtNodeStartCmd").value = site?.nodeCmd || "npm start";
            document.getElementById("chkNodeAutostart").checked = !!site?.nodeAutostart;
            openModal("modalNodeConfig");
          }
        },
      ];
      break;

    default:
      return;
  }

  menu.innerHTML = items
    .map((it) => {
      if (it.isSep) return `<div class="menu-sep"></div>`;
      return `<button class="menu-item" data-idx="${items.indexOf(it)}">${svgIcon(it.icon, 14)}<span>${it.label}</span></button>`;
    })
    .join("");

  menu.querySelectorAll(".menu-item").forEach((mBtn) => {
    mBtn.addEventListener("click", () => {
      const idx = Number(mBtn.getAttribute("data-idx"));
      closeContextMenu();
      if (items[idx]?.action) items[idx].action();
    });
  });

  const menuWidth = 230;
  const menuHeight = items.length * 34;
  const posX = Math.min(x, window.innerWidth - menuWidth - 10);
  const posY = Math.min(y, window.innerHeight - menuHeight - 10);

  menu.style.left = `${posX}px`;
  menu.style.top = `${posY}px`;
  menu.classList.add("open");
  ctxMenuOpenedAt = Date.now();
}

async function handleSiteActionButton(btn) {
  const action = btn.getAttribute("data-action");
  const siteName = btn.getAttribute("data-site");
  const path = btn.getAttribute("data-path");
  const site = appState.sites.find((s) => s.name === siteName);

  switch (action) {
    case "ssl": {
      const sites = await tauriInvoke("toggle_site_ssl", {
        siteName,
        enabled: !site?.sslEnabled,
      });
      appState.sites = sites;
      renderSitesList();
      showToast(`${!site?.sslEnabled ? "Đã bật" : "Đã tắt"} SSL cho ${siteName}`, "success");
      break;
    }
    case "vhost": {
      appState.activeVhostSite = site;
      const suffix = appState.settings.vhostSuffix || ".local";
      document.getElementById("vhostModalTitle").textContent = `Tên miền ảo — ${siteName}`;
      document.getElementById("txtVhostDomain").value =
        site?.vhostDomain || `${siteName.toLowerCase()}${suffix}`;
      openModal("modalVhost");
      break;
    }
    case "root": {
      const sites = await tauriInvoke("set_root_project", { siteName });
      appState.sites = sites;
      renderSitesList();
      showToast(`Đã đặt ${siteName} làm dự án gốc`, "success");
      break;
    }
    case "tunnel": {
      try {
        setHeaderStatus("Đang khởi tạo Cloudflare Tunnel...", true);
        const sites = await tauriInvoke("toggle_site_tunnel", { siteName });
        appState.sites = sites;
        renderSitesList();
        setHeaderStatus("Sẵn sàng");
      } catch (e) {
        showToast(String(e), "error");
        setHeaderStatus("Sẵn sàng");
      }
      break;
    }
    case "node-toggle": {
      try {
        const sites = await tauriInvoke("toggle_node_site", { siteName });
        appState.sites = sites;
        renderSitesList();
      } catch (e) {
        showToast(String(e), "error");
      }
      break;
    }
    case "node-cfg": {
      appState.activeNodeSite = site;
      document.getElementById("nodeCfgTitle").textContent = `Cấu hình Node.js — ${siteName}`;
      document.getElementById("txtNodeStartCmd").value = site?.nodeCmd || "npm start";
      document.getElementById("chkNodeAutostart").checked = !!site?.nodeAutostart;
      openModal("modalNodeConfig");
      break;
    }
    case "fonts": {
      openFontInstallerModal(site);
      break;
    }
    case "vscode": {
      await tauriInvoke("open_vscode", { path });
      break;
    }
    case "folder": {
      await tauriInvoke("open_folder", { path });
      break;
    }
    case "deploy": {
      openDeployModal(siteName);
      break;
    }
  }
}

function bindSiteEvents() {
  document.getElementById("txtSearchSites")?.addEventListener("input", renderSitesList);
  document.getElementById("btnRefreshSites")?.addEventListener("click", refreshSitesList);
  document.getElementById("btnChangeSitesRoot")?.addEventListener("click", async () => {
    if (tauriDialog?.open) {
      const folder = await tauriDialog.open({ directory: true, multiple: false });
      if (folder) {
        const sites = await tauriInvoke("set_sites_root", { folderPath: folder });
        appState.sites = sites;
        renderSitesList();
        showToast("Đã cập nhật thư mục gốc dự án", "success");
      }
    }
  });
}

/* MAIL SANDBOX */
async function refreshEmailsList() {
  const emails = await tauriInvoke("get_emails");
  if (emails) {
    appState.emails = emails;
    renderEmailsList();
  }
}

function renderEmailsList() {
  const listBox = document.getElementById("mailListBox");
  const unreadBadge = document.getElementById("unreadMailBadge");
  const unreadCount = appState.emails.filter((e) => !e.IsRead).length;

  if (unreadBadge) {
    unreadBadge.hidden = unreadCount === 0;
    unreadBadge.textContent = String(unreadCount);
  }

  if (!listBox) return;
  if (appState.emails.length === 0) {
    listBox.innerHTML = `<div class="list-empty" style="margin:auto">Hộp thư trống</div>`;
    return;
  }

  listBox.innerHTML = appState.emails
    .map(
      (m) => `
    <div class="mail-item ${!m.IsRead ? "unread" : ""} ${appState.activeMailId === m.Id ? "active" : ""}" data-id="${m.Id}">
      <div class="mail-item-top">
        <span class="mail-from">${m.Recipients || m.Sender}</span>
        <span class="mail-time">${(m.ReceivedAt || "").split(" ")[1] || ""}</span>
      </div>
      <div class="mail-subject">${m.Subject || "(Không tiêu đề)"}</div>
    </div>`
    )
    .join("");

  listBox.querySelectorAll(".mail-item").forEach((el) => {
    el.addEventListener("click", async () => {
      const id = el.getAttribute("data-id");
      appState.activeMailId = id;
      const mail = appState.emails.find((e) => e.Id === id);
      if (mail) {
        document.getElementById("mailPreviewSubject").textContent = mail.Subject || "(Không tiêu đề)";
        document.getElementById("mailPreviewMeta").textContent = `Từ: ${mail.Sender} → Tới: ${mail.Recipients} · ${mail.ReceivedAt}`;
        document.getElementById("mailEmptyState").hidden = true;
        document.getElementById("mailPreviewActions").hidden = false;
        const iframe = document.getElementById("mailPreviewIframe");
        if (iframe) {
          iframe.hidden = false;
          iframe.srcdoc = mail.HtmlBody || `<pre style="font-family:sans-serif;padding:16px">${mail.TextBody}</pre>`;
        }
        const updated = await tauriInvoke("mark_email_read", { id });
        appState.emails = updated;
        renderEmailsList();
      }
    });
  });
}

function resetMailPreview() {
  appState.activeMailId = null;
  document.getElementById("mailPreviewSubject").textContent = "Chưa chọn email";
  document.getElementById("mailPreviewMeta").textContent = "";
  document.getElementById("mailEmptyState").hidden = false;
  document.getElementById("mailPreviewActions").hidden = true;
  const iframe = document.getElementById("mailPreviewIframe");
  if (iframe) {
    iframe.hidden = true;
    iframe.srcdoc = "";
  }
}

function bindMailEvents() {
  document.getElementById("btnRefreshMail")?.addEventListener("click", refreshEmailsList);
  document.getElementById("btnClearAllMail")?.addEventListener("click", async () => {
    const empty = await tauriInvoke("clear_emails");
    appState.emails = empty;
    resetMailPreview();
    renderEmailsList();
    showToast("Đã xóa toàn bộ email", "info");
  });
  document.getElementById("btnOpenMailBrowser")?.addEventListener("click", async () => {
    if (appState.activeMailId) {
      await tauriInvoke("open_email_in_browser", { id: appState.activeMailId });
    }
  });
  document.getElementById("btnDeleteCurrentMail")?.addEventListener("click", async () => {
    if (appState.activeMailId) {
      const updated = await tauriInvoke("delete_email", { id: appState.activeMailId });
      appState.emails = updated;
      resetMailPreview();
      renderEmailsList();
    }
  });
}

/* STORE DOWNLOADS */
function renderStoreItems(category) {
  const catMeta = {
    php: { icon: "code", tile: "tile-violet" },
    nodejs: { icon: "hexagon", tile: "tile-green" },
    apache: { icon: "feather", tile: "tile-indigo" },
    nginx: { icon: "zap", tile: "tile-sky" },
    mysql: { icon: "database", tile: "tile-amber" },
    phpmyadmin: { icon: "table", tile: "tile-rose" },
    vcredist: { icon: "wrench", tile: "tile-slate" },
  };
  const meta = catMeta[category] || catMeta.php;

  const container = document.getElementById("storeItemsContainer");
  if (!container) return;
  const filtered = appState.storeItems.filter((i) => i.category === category);

  container.innerHTML = filtered
    .map(
      (item) => `
    <div class="store-card ${item.installed ? "installed" : ""}" id="store-card-${item.id}">
      <div class="store-head">
        <span class="tile sm ${meta.tile}">${svgIcon(meta.icon, 16)}</span>
        <div class="store-meta">
          <div class="store-title">${item.name}</div>
          <div class="store-desc">${item.description}</div>
        </div>
      </div>
      <div id="dl-wrap-${item.id}" style="display:none">
        <div class="progress"><div class="progress-fill" id="dl-bar-${item.id}"></div></div>
        <div class="dl-status" id="dl-status-${item.id}"></div>
      </div>
      <div class="store-foot">
        <span class="tag ${item.installed ? "tag-success" : ""}">${item.installed ? "Đã cài đặt" : "Sẵn sàng tải"}</span>
        <button class="btn btn-sm ${item.installed ? "btn-ghost" : "btn-primary"} btn-dl-item" data-id="${item.id}">
          ${svgIcon(item.installed ? "refresh" : "download", 13)}
          <span>${item.installed ? "Cài lại" : "Tải & Cài đặt"}</span>
        </button>
      </div>
    </div>`
    )
    .join("");

  container.querySelectorAll(".btn-dl-item").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      btn.disabled = true;
      const wrap = document.getElementById(`dl-wrap-${id}`);
      if (wrap) wrap.style.display = "block";
      await tauriInvoke("download_and_install_item", { itemId: id });
    });
  });
}

/* MODALS & ADVANCED TOOLS */
function openModal(id) {
  document.getElementById(id)?.classList.add("open");
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove("open");
}

function bindModalEvents() {
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.getAttribute("data-close")));
  });

  document.getElementById("btnSaveConfigFile")?.addEventListener("click", async () => {
    try {
      await tauriInvoke("save_service_config", {
        filePath: appState.activeConfigPath,
        content: document.getElementById("cfgEditorTextarea").value,
      });
      closeModal("modalConfigEditor");
      showToast("Đã lưu file cấu hình", "success");
    } catch (e) {
      showToast(String(e), "error");
    }
  });

  document.getElementById("btnSaveVhost")?.addEventListener("click", async () => {
    if (!appState.activeVhostSite) return;
    try {
      const domain = document.getElementById("txtVhostDomain").value.trim();
      const sites = await tauriInvoke("save_site_vhost", {
        siteName: appState.activeVhostSite.name,
        domain,
        enable: true,
      });
      appState.sites = sites;
      renderSitesList();
      closeModal("modalVhost");
      showToast(`Đã kích hoạt ${domain}`, "success");
    } catch (e) {
      showToast(String(e), "error");
    }
  });

  document.getElementById("btnDisableVhost")?.addEventListener("click", async () => {
    if (!appState.activeVhostSite) return;
    try {
      const sites = await tauriInvoke("save_site_vhost", {
        siteName: appState.activeVhostSite.name,
        domain: "",
        enable: false,
      });
      appState.sites = sites;
      renderSitesList();
      closeModal("modalVhost");
      showToast("Đã gỡ tên miền ảo", "info");
    } catch (e) {
      showToast(String(e), "error");
    }
  });

  document.getElementById("btnSaveNodeConfig")?.addEventListener("click", async () => {
    if (!appState.activeNodeSite) return;
    const sites = await tauriInvoke("save_node_site_config", {
      siteName: appState.activeNodeSite.name,
      autostart: document.getElementById("chkNodeAutostart").checked,
      startCmd: document.getElementById("txtNodeStartCmd").value.trim() || "npm start",
    });
    appState.sites = sites;
    renderSitesList();
    closeModal("modalNodeConfig");
    showToast("Đã lưu cấu hình Node.js", "success");
  });

  document.getElementById("btnStartDeploy")?.addEventListener("click", async () => {
    if (!appState.activeDeploySite) return;
    document.getElementById("deployConsoleLog").textContent = "Đang chuẩn bị tiến trình...\n";
    document.getElementById("deployProgressBar").style.width = "5%";
    await tauriInvoke("start_deploy_demo", {
      siteName: appState.activeDeploySite,
      sslEnabled: document.getElementById("chkDeploySsl").checked,
      dbOnly: document.getElementById("chkDeployDbOnly").checked,
      customDbSuffix: document.getElementById("txtCustomDbSuffix").value.trim(),
    });
  });

  document.getElementById("btnLockDemo")?.addEventListener("click", async () => {
    if (!appState.activeDeploySite) return;
    await tauriInvoke("toggle_lock_demo", { siteName: appState.activeDeploySite });
  });

  document.getElementById("btnDeleteDemo")?.addEventListener("click", async () => {
    if (!appState.activeDeploySite) return;
    await tauriInvoke("delete_demo_project", { siteName: appState.activeDeploySite });
  });

  document.getElementById("btnTabLocalFont")?.addEventListener("click", () => {
    appState.selectedFontMode = "local";
    document.getElementById("btnTabLocalFont").classList.add("active");
    document.getElementById("btnTabGoogleFont").classList.remove("active");
    document.getElementById("localFontOptions").style.display = "flex";
    document.getElementById("googleFontOptions").style.display = "none";
    renderFontModalList();
  });

  document.getElementById("btnTabGoogleFont")?.addEventListener("click", async () => {
    appState.selectedFontMode = "google";
    document.getElementById("btnTabGoogleFont").classList.add("active");
    document.getElementById("btnTabLocalFont").classList.remove("active");
    document.getElementById("localFontOptions").style.display = "none";
    document.getElementById("googleFontOptions").style.display = "flex";
    if (appState.googleFonts.length === 0) {
      appState.googleFonts = await tauriInvoke("get_google_fonts");
    }
    renderFontModalList();
  });

  document.getElementById("txtSearchFonts")?.addEventListener("input", renderFontModalList);

  document.getElementById("btnInstallSelectedFont")?.addEventListener("click", async () => {
    if (!appState.activeFontSite || !appState.selectedFontFamily) return;
    const fam = appState.localFonts.find((f) => f.familyName === appState.selectedFontFamily);
    if (!fam) return;
    try {
      const [css, installed] = await tauriInvoke("install_local_font", {
        projectPath: appState.activeFontSite.path,
        familyName: fam.familyName,
        variants: fam.variants,
        convertWoff: document.getElementById("chkConvertWoff").checked,
      });
      renderProjectInstalledFonts(css, installed);
      showToast(`Đã cài đặt font ${fam.familyName}`, "success");
    } catch (e) {
      showToast(String(e), "error");
    }
  });

  document.getElementById("btnInstallGoogleFont")?.addEventListener("click", async () => {
    if (!appState.activeFontSite || !appState.selectedFontFamily) return;
    const gFont = appState.googleFonts.find((f) => f.family === appState.selectedFontFamily);
    if (!gFont) return;
    try {
      setHeaderStatus(`Đang tải Google Font ${gFont.family}...`, true);
      const [css, installed] = await tauriInvoke("install_google_font", {
        projectPath: appState.activeFontSite.path,
        familyName: gFont.family,
        weights: gFont.variants,
        mode: document.getElementById("selGoogleFontMode").value,
      });
      renderProjectInstalledFonts(css, installed);
      setHeaderStatus("Đã cài đặt Google Font");
      showToast(`Đã cài đặt Google Font ${gFont.family}`, "success");
    } catch (e) {
      showToast(String(e), "error");
      setHeaderStatus("Sẵn sàng");
    }
  });

  document.getElementById("btnCheckUpdate")?.addEventListener("click", checkUpdateInfo);
  document.getElementById("btnOpenReleaseUrl")?.addEventListener("click", () => {
    tauriInvoke("open_browser", { url: appState.latestReleaseUrl });
  });
  document.getElementById("btnSyncOnlineStore")?.addEventListener("click", async () => {
    setHeaderStatus("Đang quét phiên bản mới nhất...", true);
    const sub = document.getElementById("storeSyncSubtitle");
    if (sub) sub.textContent = "Đang quét và đồng bộ dữ liệu phiên bản mới nhất từ trang chủ dịch vụ...";
    await tauriInvoke("sync_online_store_versions");
  });

  initProSuiteEvents();
}

async function openDeployModal(siteName) {
  appState.activeDeploySite = siteName;
  const info = await tauriInvoke("get_deploy_data", { siteName });
  document.getElementById("deployModalTitle").textContent = `Deploy Demo — ${siteName}`;
  document.getElementById("lblDeployTargetUrl").textContent = info.targetUrl;
  document.getElementById("lblDeployLocalDb").textContent = info.localDbName || "(Không có)";
  document.getElementById("lblDeployTargetDb").textContent = info.targetDbName;
  document.getElementById("chkDeploySsl").checked = info.sslEnabled;
  document.getElementById("txtCustomDbSuffix").value = info.customDbSuffix || "";
  document.getElementById("grpCustomDbSuffix").style.display = info.dbNamingMode === 1 ? "flex" : "none";
  document.getElementById("deployProgressBar").style.width = "0%";
  document.getElementById("deployConsoleLog").textContent = info.configReady
    ? "Sẵn sàng kết nối FTP & DirectAdmin để Deploy..."
    : "Chưa cấu hình đủ thông tin FTP/Domain trong mục Cài đặt chung!";
  openModal("modalDeployDemo");
}

async function openFontInstallerModal(site) {
  appState.activeFontSite = site;
  document.getElementById("fontModalTitle").textContent = `Cài đặt Font chữ — ${site.name}`;
  appState.localFonts = await tauriInvoke("scan_local_fonts", {
    folderPath: appState.demoConfig.FontFolderPath || "",
  });
  const [css, installed] = await tauriInvoke("get_project_fonts", { projectPath: site.path });
  renderFontModalList();
  renderProjectInstalledFonts(css, installed);
  openModal("modalFontInstaller");
}

function renderFontModalList() {
  const box = document.getElementById("fontFamilyListBox");
  const q = (document.getElementById("txtSearchFonts")?.value || "").toLowerCase().trim();

  if (appState.selectedFontMode === "local") {
    const list = appState.localFonts.filter((f) => f.familyName.toLowerCase().includes(q));
    if (list.length === 0) {
      box.innerHTML = `<div class="list-empty">Chưa có font trong thư mục kho máy trạm</div>`;
      return;
    }
    box.innerHTML = list
      .map(
        (f) => `
      <div class="list-item ${appState.selectedFontFamily === f.familyName ? "active" : ""}" data-fam="${f.familyName}">
        <span><b>${f.familyName}</b></span>
        <small>${f.variants.length} kiểu</small>
      </div>`
      )
      .join("");
  } else {
    const list = appState.googleFonts.filter((f) => f.family.toLowerCase().includes(q));
    box.innerHTML = list
      .map(
        (f) => `
      <div class="list-item ${appState.selectedFontFamily === f.family ? "active" : ""}" data-fam="${f.family}">
        <span><b>${f.family}</b></span>
        <small>${f.category}</small>
      </div>`
      )
      .join("");
  }

  box.querySelectorAll(".list-item").forEach((el) => {
    el.addEventListener("click", () => {
      appState.selectedFontFamily = el.getAttribute("data-fam");
      renderFontModalList();
    });
  });
}

function renderProjectInstalledFonts(css, installed) {
  document.getElementById("txtFontsCssPreview").value = css || "/* Chưa có font nào được cài đặt */";
  const box = document.getElementById("installedFontsList");
  if (!installed || installed.length === 0) {
    box.innerHTML = `<div class="list-empty">Dự án chưa cài đặt bộ font nào</div>`;
    return;
  }
  box.innerHTML = installed
    .map(
      (i) => `
    <div class="list-item">
      <div><b>${i.familyName}</b> <span class="tag">${i.sourceType}</span></div>
      <button class="btn btn-sm btn-danger-ghost btn-uninst-font" data-fam="${i.familyName}">Gỡ</button>
    </div>`
    )
    .join("");

  box.querySelectorAll(".btn-uninst-font").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const fam = btn.getAttribute("data-fam");
      const [newCss, newInst] = await tauriInvoke("uninstall_project_font", {
        projectPath: appState.activeFontSite.path,
        familyName: fam,
      });
      renderProjectInstalledFonts(newCss, newInst);
      showToast(`Đã gỡ font ${fam}`, "info");
    });
  });
}

async function checkUpdateInfo() {
  const info = await tauriInvoke("check_github_update");
  if (!info) return;
  document.getElementById("lblCurrentVer").textContent = `v${info.currentVersion}`;
  document.getElementById("txtReleaseNotes").textContent = info.releaseNotes;
  appState.latestReleaseUrl = info.downloadUrl;
  const btn = document.getElementById("btnOpenReleaseUrl");
  if (info.hasUpdate) {
    document.getElementById("lblLatestVerStatus").textContent = `Đã có phiên bản mới v${info.latestVersion}!`;
    btn.hidden = false;
  } else {
    document.getElementById("lblLatestVerStatus").textContent = "Bạn đang sử dụng phiên bản mới nhất.";
    btn.hidden = true;
  }
}

function bindRealtimeListeners() {
  tauriListen("deploy-log", async (event) => {
    const payload = event.payload;
    const logBox = document.getElementById("deployConsoleLog");
    const bar = document.getElementById("deployProgressBar");
    if (logBox) {
      logBox.textContent += `\n${payload.message}`;
      logBox.scrollTop = logBox.scrollHeight;
    }
    if (bar) bar.style.width = `${payload.progress}%`;
    if (payload.done) {
      await refreshSitesList();
    }
  });

  tauriListen("download-progress", async (event) => {
    const p = event.payload;
    const bar = document.getElementById(`dl-bar-${p.id}`);
    const st = document.getElementById(`dl-status-${p.id}`);
    if (bar) bar.style.width = `${p.progress}%`;
    if (st) st.textContent = p.error ? `Lỗi: ${p.error}` : p.status;
    if (p.done) {
      if (p.error) {
        showToast(p.error, "error");
      } else {
        showToast("Đã tải và cài đặt thành công!", "success");
        await loadInitialAppState();
        renderStoreItems(appState.activeStoreCategory);
      }
    }
  });

  tauriListen("store-synced", (event) => {
    const payload = event.payload;
    if (payload && Array.isArray(payload.items)) {
      appState.storeItems = payload.items;
      renderStoreItems(appState.activeStoreCategory);
      const sub = document.getElementById("storeSyncSubtitle");
      if (payload.online) {
        setHeaderStatus("Đã đồng bộ phiên bản mới nhất");
        if (sub) sub.textContent = "Đã đồng bộ trực tiếp các phiên bản mới nhất từ trang chủ dịch vụ";
      } else {
        setHeaderStatus("Danh sách phiên bản Offline");
        if (sub) sub.textContent = "Không có kết nối mạng — đang hiển thị danh sách phiên bản dự phòng";
      }
    }
  });
}

// ============================================================================
// RBW PRO SUITE (AUTHENTIC RBWMANAGER WORKSPACE EMBED)
// ============================================================================

let rbwProLoaded = false;

async function refreshProSuite() {
  const frame = document.getElementById("rbwProFrame");
  if (!frame) return;
  if (!rbwProLoaded || frame.src === "about:blank") {
    frame.src = "pro/index.html";
    rbwProLoaded = true;
  }
  const currentMode = document.documentElement.getAttribute("data-theme") || "dark";
  try {
    frame.contentDocument?.documentElement?.setAttribute("data-mode", currentMode);
    frame.contentWindow?.postMessage({ type: "rbw-theme-sync", mode: currentMode }, "*");
  } catch (_) {}
}

function initProSuiteEvents() {
  const frame = document.getElementById("rbwProFrame");
  if (frame) {
    frame.addEventListener("load", () => {
      const currentMode = document.documentElement.getAttribute("data-theme") || "dark";
      try {
        frame.contentDocument?.documentElement?.setAttribute("data-mode", currentMode);
        frame.contentWindow?.postMessage({ type: "rbw-theme-sync", mode: currentMode }, "*");
      } catch (_) {}
    });
  }
  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "rbw-open-url" && event.data.url) {
      tauriInvoke("open_browser", { url: event.data.url });
    } else if (event.data && event.data.type === "rbw-open-tab" && event.data.tab) {
      const tabTarget = event.data.tab;
      document.querySelector(`.nav-item[data-tab="${tabTarget}"]`)?.click();
    }
  });
}

