import { getHealth, getTaxonomies } from "./api/system-api.js";
import { renderLoading, renderShell } from "./components/shell.js";
import { state } from "./state.js";
import { route } from "./router.js";

async function loadBootstrap(): Promise<void> {
  renderLoading();
  try {
    const health = await getHealth();
    state.backendOnline = Boolean(health.ok);
    state.backendMessage = health.service || "API online";
    const taxonomies = await getTaxonomies();
    state.taxonomies = taxonomies;
    state.drugs = [];
  } catch (error) {
    state.backendOnline = false;
    state.backendMessage = error instanceof Error ? error.message : String(error);
    state.taxonomies = { drugCategories: { systems: [], categories: [] }, dosageForms: [], routes: [], prescriptionTypes: [], riskTags: [], frequencies: [] };
    state.drugs = [];
    renderShell(`<div class="warning-panel">后端不可用：${state.backendMessage}<br />请确认后端服务已启动，例如 <code>npm run dev:api</code>，并监听 http://localhost:8787。</div>`, "后端离线");
    return;
  }
  await route();
}

window.addEventListener("hashchange", () => void route());
window.addEventListener("load", () => void loadBootstrap());

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => undefined);
  });
}
