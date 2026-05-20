import { API_BASE, APP_NAME, SAFETY_DISCLAIMER } from "../config.js";
import { state } from "../state.js";
import { escapeHtml } from "../utils/html.js";
const navItems = [
    { href: "#/", label: "首页", badge: "首" },
    { href: "#/drugs", label: "药物库", badge: "药" },
    { href: "#/import", label: "导入药物", badge: "入" },
    { href: "#/orders", label: "生成医嘱", badge: "医" }
];
export function backendStatusHtml() {
    const label = state.backendOnline ? "后端已连接" : "后端离线";
    const tone = state.backendOnline ? "approved" : "warning";
    return `<span class="tag ${tone}">${label}</span><span class="tag">${escapeHtml(API_BASE)}</span>`;
}
export function renderShell(content, title = APP_NAME, subtitle = "轻量版：只保留药物信息、药物导入和候选医嘱生成。") {
    const app = document.querySelector("#app");
    if (!app)
        return;
    const activeHash = (window.location.hash || "#/").split("?")[0];
    const navHtml = navItems.map((item) => `<a class="${activeHash === item.href ? "active" : ""}" href="${item.href}"><span>${item.label}</span><strong>${item.badge}</strong></a>`).join("");
    const mobileNavHtml = navItems.map((item) => `<a href="${item.href}">${item.label}</a>`).join("");
    app.innerHTML = `
    <div class="mobile-header"><div class="mobile-nav">${mobileNavHtml}</div></div>
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand"><div class="brand-mark">药</div><div><h1>${APP_NAME}</h1><p>Drug KB Lite</p></div></div>
        <nav class="nav">${navHtml}</nav>
        <div class="sidebar-note"><strong>安全边界</strong><br />${escapeHtml(SAFETY_DISCLAIMER)}</div>
      </aside>
      <main class="main">
        <div class="topbar">
          <div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p><div class="tag-row" style="margin-top:10px;">${backendStatusHtml()}</div></div>
          <div class="kb-badge">药物库轻量版</div>
        </div>
        ${content}
        <div class="footer-note">本系统仅生成候选医嘱模板，不构成医疗建议，不可直接用于真实诊疗或自动处方。</div>
      </main>
    </div>`;
}
export function renderLoading(message = "正在加载药物库...") { renderShell(`<div class="card">${escapeHtml(message)}</div>`); }
export function renderError(message, title = "发生错误") { renderShell(`<div class="warning-panel">${escapeHtml(message)}</div>`, title); }
