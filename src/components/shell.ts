import { APP_NAME, SAFETY_DISCLAIMER } from "../config.js";
import { state } from "../state.js";
import { escapeHtml } from "../utils/html.js";
import { wireAISettingsButton } from "./ai-settings-modal.js";

const navItems = [
  { href: "#/drugs", match: "#/drugs", label: "查询", icon: "🔍" },
  { href: "#/import", match: "#/import", label: "导入", icon: "📥" },
  { href: "#/orders", match: "#/orders", label: "医嘱", icon: "📋" }
];

export function backendStatusHtml(): string {
  const label = state.backendOnline ? "后端已连接" : "后端离线";
  const tone = state.backendOnline ? "approved" : "warning";
  return `<span class="status-dot ${tone}"></span><span class="status-text">${label}</span>`;
}

function isActive(activeHash: string, match: string): boolean {
  if (activeHash === "#/" && match === "#/drugs") return true;
  return activeHash === match || activeHash.startsWith(`${match}/`) || activeHash.startsWith(`${match}?`);
}

export function renderShell(content: string, title = APP_NAME, _subtitle = "") {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;
  const activeHash = (window.location.hash || "#/drugs").split("?")[0];
  const navHtml = navItems.map((item) => {
    const active = isActive(activeHash, item.match);
    return `<a class="nav-item ${active ? "active" : ""}" href="${item.href}">
      <span class="nav-icon">${item.icon}</span>
      <span class="nav-label">${item.label}</span>
    </a>`;
  }).join("");

  app.innerHTML = `
    <header class="hero">
      <h1>${escapeHtml(APP_NAME)}</h1>
      <p class="hero-subtitle">药物信息管理与候选医嘱生成</p>
    </header>
    <nav class="nav">
      <div class="nav-inner">
        <div class="nav-brand">
          <span class="brand-icon">💊</span>
          <span class="brand-text">药</span>
        </div>
        <div class="nav-links">${navHtml}</div>
        <div class="nav-status">
          ${backendStatusHtml()}
          <button id="open-ai-settings" class="nav-action-btn" title="模型设置">
            <span class="nav-action-icon">⚙️</span>
            <span class="nav-action-text">${state.aiEnabled && state.aiModel ? escapeHtml(state.aiModel) : "模型"}</span>
          </button>
        </div>
      </div>
    </nav>
    <main class="main">
      ${content}
    </main>
    <footer class="footer">
      <p>${escapeHtml(SAFETY_DISCLAIMER)}</p>
    </footer>`;
  wireAISettingsButton();
}

export function renderLoading(message = "正在加载药物库...") {
  renderShell(`<div class="card"><div class="loading">${escapeHtml(message)}</div></div>`);
}

export function renderError(message: string, title = "发生错误") {
  renderShell(`<div class="card error-panel"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p></div>`);
}
