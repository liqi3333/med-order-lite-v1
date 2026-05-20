import { searchDrugs } from "../api/drug-api.js";
import { renderShell } from "../components/shell.js";
import { renderDrugCard } from "../components/drug-card.js";
import { state } from "../state.js";
import { escapeHtml, qs } from "../utils/html.js";
import { showToast } from "../utils/toast.js";
export function renderHomePage() {
    renderShell(`
    <section class="hero">
      <div>
        <h3>药物信息库</h3>
        <p>轻量版只保留药物信息、药物导入和候选医嘱生成。药物数据来自后端本地 Markdown 知识库。</p>
      </div>
      <div class="search-box"><input id="global-search" class="input" placeholder="搜索药物通用名、商品名、别名、说明书关键词" /><button id="global-search-btn" class="btn">搜索药物</button></div>
    </section>
    <section class="grid three" style="margin-top:16px;">
      <div class="card kpi"><strong>${state.drugs.length}</strong><span>药物条目</span></div>
      <div class="card kpi"><strong>${state.taxonomies?.drugCategories.categories.length || 0}</strong><span>药物分类</span></div>
      <div class="card kpi"><strong>${state.backendOnline ? "在线" : "离线"}</strong><span>${escapeHtml(state.backendMessage)}</span></div>
    </section>
    <section class="grid three" style="margin-top:16px;">
      <a class="card action-card" href="#/drugs"><h3>药物库</h3><p>查询、筛选和查看药物说明书结构化信息。</p></a>
      <a class="card action-card" href="#/import"><h3>导入药物</h3><p>通过说明书文本插件或标准 drug.md 文件导入药物。</p></a>
      <a class="card action-card" href="#/orders"><h3>生成医嘱</h3><p>选择药物后生成候选医嘱模板，供医生确认和复制。</p></a>
    </section>
    <section id="search-results" class="card" style="margin-top:16px;"><h3>最近药物</h3><div class="list">${state.drugs.slice(0, 8).map(renderDrugCard).join("") || "暂无药物，请先导入。"}</div></section>
  `);
    const runSearch = async () => {
        const q = qs("#global-search")?.value.trim() || "";
        if (!q)
            return showToast("请输入搜索关键词", "warning");
        const container = qs("#search-results");
        if (container)
            container.innerHTML = `<div class="card flat">正在搜索药物...</div>`;
        try {
            const result = await searchDrugs({ q });
            if (container)
                container.innerHTML = `<h3>药物结果：${result.items.length}</h3><div class="list">${result.items.map(renderDrugCard).join("") || "无匹配药物"}</div>`;
        }
        catch (error) {
            showToast(error instanceof Error ? error.message : String(error), "danger");
        }
    };
    qs("#global-search-btn")?.addEventListener("click", runSearch);
    qs("#global-search")?.addEventListener("keydown", (e) => { if (e.key === "Enter")
        void runSearch(); });
}
