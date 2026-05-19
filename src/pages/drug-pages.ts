import { getDrug, getRawDrugMarkdown, searchDrugs } from "../api/drug-api.js";
import { renderDrugCard, dosageFormLabel, riskTagLabel, routeLabel } from "../components/drug-card.js";
import { renderError, renderShell } from "../components/shell.js";
import { state } from "../state.js";
import { DrugFilter } from "../types/drug.js";
import { escapeHtml, optionHtml, qs, valueOf } from "../utils/html.js";
import { showToast } from "../utils/toast.js";

let filters: DrugFilter = { q: "", system: "", primaryCategory: "", secondaryCategory: "", route: "", dosageForm: "" };
function categoriesForSystem(system: string) { return (state.taxonomies?.drugCategories.categories || []).filter((cat) => !system || cat.system === system).map((cat) => ({ value: cat.value, label: cat.label })); }
function childrenForCategory(primary: string) { return state.taxonomies?.drugCategories.categories.find((cat) => cat.value === primary)?.children || []; }
function readFilters(): DrugFilter { return { q: valueOf("#drug-q"), system: valueOf("#drug-system"), primaryCategory: valueOf("#drug-primary"), secondaryCategory: valueOf("#drug-secondary"), route: valueOf("#drug-route"), dosageForm: valueOf("#drug-dosage") }; }

export function renderDrugLibraryPage(items = state.drugs): void {
  renderShell(`
    <section class="card"><h3>药物查询</h3><div class="form-grid">
      <div class="form-field"><label>关键词</label><input id="drug-q" class="input" value="${escapeHtml(filters.q)}" placeholder="通用名、商品名、说明书关键词" /></div>
      <div class="form-field"><label>药物体系</label><select id="drug-system" class="select">${optionHtml(state.taxonomies?.drugCategories.systems || [], filters.system, "全部")}</select></div>
      <div class="form-field"><label>一级分类</label><select id="drug-primary" class="select">${optionHtml(categoriesForSystem(filters.system), filters.primaryCategory, "全部")}</select></div>
      <div class="form-field"><label>二级分类</label><select id="drug-secondary" class="select">${optionHtml(childrenForCategory(filters.primaryCategory), filters.secondaryCategory, "全部")}</select></div>
      <div class="form-field"><label>剂型</label><select id="drug-dosage" class="select">${optionHtml(state.taxonomies?.dosageForms || [], filters.dosageForm, "全部")}</select></div>
      <div class="form-field"><label>给药途径</label><select id="drug-route" class="select">${optionHtml(state.taxonomies?.routes || [], filters.route, "全部")}</select></div>
    </div><div class="actions" style="margin-top:14px;"><button id="drug-search" class="btn">查询</button><button id="drug-reset" class="btn ghost">重置</button><a class="btn secondary" href="#/import">导入药物</a></div></section>
    <section class="card" style="margin-top:16px;"><h3>结果：${items.length}</h3><div class="list">${items.map(renderDrugCard).join("") || "暂无药物，请通过导入药物添加。"}</div></section>
  `, "药物库", "只显示已保存到本地药物库的药物。")
  qs("#drug-system")?.addEventListener("change", () => { filters.system = valueOf("#drug-system"); filters.primaryCategory = ""; filters.secondaryCategory = ""; renderDrugLibraryPage(items); });
  qs("#drug-primary")?.addEventListener("change", () => { filters.primaryCategory = valueOf("#drug-primary"); filters.secondaryCategory = ""; renderDrugLibraryPage(items); });
  qs("#drug-search")?.addEventListener("click", async () => { filters = readFilters(); const result = await searchDrugs(filters); state.drugs = result.items; renderDrugLibraryPage(result.items); });
  qs("#drug-reset")?.addEventListener("click", async () => { filters = { q: "", system: "", primaryCategory: "", secondaryCategory: "", route: "", dosageForm: "" }; const result = await searchDrugs(filters); state.drugs = result.items; renderDrugLibraryPage(result.items); });
}

function labelBlock(title: string, value?: string, tone: "default" | "warning" | "danger" = "default"): string {
  const tag = tone === "default" ? "tag" : `tag ${tone}`;
  return `<div style="margin-bottom:14px;"><span class="${tag}">${escapeHtml(title)}</span><div class="item" style="margin-top:8px;white-space:pre-wrap;">${escapeHtml(value || "暂无结构化内容。")}</div></div>`;
}
function specialPopulationHtml(value?: Record<string, string | undefined>): string {
  const labels: Record<string, string> = { pregnancy: "妊娠", lactation: "哺乳", pediatric: "儿童", geriatric: "老年", renal_impairment: "肾功能不全", hepatic_impairment: "肝功能不全", driving_or_machines: "驾驶/机械操作" };
  const entries = Object.entries(labels).map(([key, label]) => ({ label, text: value?.[key] || "" })).filter((item) => item.text);
  return entries.length ? `<div class="list">${entries.map((item) => `<div class="item"><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.text)}</p></div>`).join("")}</div>` : `<div class="item">暂无特殊人群结构化内容。</div>`;
}

export async function renderDrugDetailPage(id: string): Promise<void> {
  renderShell(`<div class="card">正在读取药物详情...</div>`, "药物详情");
  try {
    const detail = await getDrug(id);
    const fm = detail.frontmatter;
    const label = detail.label;
    renderShell(`
      <section class="grid two"><div class="card"><h3>基础信息</h3><table class="table"><tr><th>通用名</th><td>${escapeHtml(fm.names.generic_cn)}</td></tr><tr><th>英文名</th><td>${escapeHtml(fm.names.generic_en || "")}</td></tr><tr><th>商品名/别名</th><td>${escapeHtml([...(fm.names.brand_names || []), ...(fm.names.aliases || [])].join(" / "))}</td></tr><tr><th>药理分类</th><td>${escapeHtml(fm.classification.pharmacologic_class || "")}</td></tr><tr><th>版本</th><td>${escapeHtml(fm.review.version)}</td></tr></table></div>
      <div class="card"><h3>剂型规格</h3><div class="list">${fm.forms.map((f) => `<div class="item"><strong>${escapeHtml(dosageFormLabel(f.dosage_form))}</strong><p>${escapeHtml(f.strength || "未填规格")} · ${escapeHtml(routeLabel(f.route))}</p><p>${escapeHtml([f.manufacturer, f.approval_number].filter(Boolean).join(" · "))}</p></div>`).join("")}</div><h3 style="margin-top:16px;">风险标签</h3><div class="tag-row">${fm.risk_tags.map((x) => `<span class="tag warning">${escapeHtml(riskTagLabel(x))}</span>`).join("") || `<span class="tag">无</span>`}</div></div></section>
      <section class="grid two" style="margin-top:16px;"><div class="card"><h3>说明书核心字段</h3>${labelBlock("适应症", label.indications)}${labelBlock("用法用量", label.dosage)}${labelBlock("禁忌", label.contraindications, "danger")}</div><div class="card"><h3>安全信息</h3>${labelBlock("注意事项", label.precautions, "warning")}${labelBlock("不良反应", label.adverse_reactions, "warning")}${labelBlock("相互作用", label.interactions, "warning")}</div></section>
      <section class="grid two" style="margin-top:16px;"><div class="card"><h3>特殊人群</h3>${specialPopulationHtml(label.special_populations)}</div><div class="card"><h3>操作</h3><p>可查看原始 Markdown，或基于当前药物说明书生成候选医嘱模板。</p><div class="actions" style="margin-top:14px;"><a class="btn" href="#/orders?drug=${fm.id}">生成候选医嘱</a><button class="btn ghost" id="raw-md">查看原始 Markdown</button></div><div id="raw-output" style="margin-top:12px;"></div></div></section>
    `, fm.names.generic_cn, "药物详情由本地药物 Markdown 库解析得到。")
    qs("#raw-md")?.addEventListener("click", async () => { try { const raw = await getRawDrugMarkdown(id); const out = qs("#raw-output"); if (out) out.innerHTML = `<pre class="order-output">${escapeHtml(raw)}</pre>`; } catch (e) { showToast(e instanceof Error ? e.message : String(e), "danger"); } });
  } catch (error) { renderError(error instanceof Error ? error.message : String(error), "药物详情"); }
}
