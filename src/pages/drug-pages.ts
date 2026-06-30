import { getDrug, getRawDrugMarkdown, searchDrugs } from "../api/drug-api.js";
import { rebuildIndexes } from "../api/system-api.js";
import {
  renderDrugCard,
  dosageFormLabel,
  riskTagLabel,
  routeLabel,
} from "../components/drug-card.js";
import { renderError, renderShell } from "../components/shell.js";
import { state } from "../state.js";
import { DrugFilter, DrugIndexItem } from "../types/drug.js";
import { escapeHtml, optionHtml, qs, valueOf } from "../utils/html.js";
import { showToast } from "../utils/toast.js";

let filters: DrugFilter = {
  q: "",
  system: "",
  primaryCategory: "",
  secondaryCategory: "",
  route: "",
  dosageForm: "",
};

let currentItems: DrugIndexItem[] = [];
let hasSearched = false;

function categoriesForSystem(system: string) {
  return (state.taxonomies?.drugCategories.categories || [])
    .filter((cat) => !system || cat.system === system)
    .map((cat) => ({ value: cat.value, label: cat.label }));
}

function childrenForCategory(primary: string) {
  return (
    state.taxonomies?.drugCategories.categories.find(
      (cat) => cat.value === primary,
    )?.children || []
  );
}

function readFilters(): DrugFilter {
  return {
    q: valueOf("#drug-q"),
    system: valueOf("#drug-system"),
    primaryCategory: valueOf("#drug-primary"),
    secondaryCategory: valueOf("#drug-secondary"),
    route: valueOf("#drug-route"),
    dosageForm: valueOf("#drug-dosage"),
  };
}

function updateSecondaryOptions(): void {
  const primaryValue = valueOf("#drug-primary");
  const secondary = qs<HTMLSelectElement>("#drug-secondary");
  if (!secondary) return;
  const options = childrenForCategory(primaryValue);
  const current = secondary.value;
  const nextValue = options.some((item) => item.value === current)
    ? current
    : "";
  secondary.innerHTML = optionHtml(options, nextValue, "全部");
  filters.secondaryCategory = nextValue;
}

function updateResults(items: DrugIndexItem[]): void {
  const container = qs("#drug-results");
  if (container) {
    container.innerHTML = items.map(renderDrugCard).join("") || "暂无匹配药物。";
  }
  const count = qs("#drug-count");
  if (count) count.textContent = `查询结果：${items.length}`;
}

async function runSearch(): Promise<void> {
  filters = readFilters();
  const hasAnyFilter = filters.q || filters.system || filters.primaryCategory ||
    filters.secondaryCategory || filters.route || filters.dosageForm;
  if (!hasAnyFilter) {
    showToast("请输入搜索条件或选择筛选项", "warning");
    return;
  }
  try {
    const result = await searchDrugs(filters);
    state.drugs = result.items;
    currentItems = result.items;
    hasSearched = true;
    updateResults(result.items);
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), "danger");
  }
}

async function runFilterChange(): Promise<void> {
  filters = readFilters();
  try {
    const result = await searchDrugs(filters);
    state.drugs = result.items;
    currentItems = result.items;
    hasSearched = true;
    updateResults(result.items);
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), "danger");
  }
}

export function renderDrugLibraryPage(): void {
  renderShell(
    `
    <section class="card">
      <h3>药物查询</h3>
      <p class="muted">输入药物通用名、商品名、别名或说明书关键词，快速进入详情并生成候选医嘱。</p>
      <div class="search-box" style="margin-top:14px;">
        <input id="drug-q" class="input" value="${escapeHtml(filters.q)}" placeholder="搜索药物名称 / 商品名 / 说明书关键词" />
      </div>
      <details class="advanced-panel" style="margin-top:14px;" open>
        <summary>高级筛选</summary>
        <div class="form-grid" style="margin-top:14px;">
          <div class="form-field"><label>药物体系</label><select id="drug-system" class="select">${optionHtml(state.taxonomies?.drugCategories.systems || [], filters.system, "全部")}</select></div>
          <div class="form-field"><label>一级分类</label><select id="drug-primary" class="select">${optionHtml(categoriesForSystem(filters.system), filters.primaryCategory, "全部")}</select></div>
          <div class="form-field"><label>二级分类</label><select id="drug-secondary" class="select">${optionHtml(childrenForCategory(filters.primaryCategory), filters.secondaryCategory, "全部")}</select></div>
          <div class="form-field"><label>剂型</label><select id="drug-dosage" class="select">${optionHtml(state.taxonomies?.dosageForms || [], filters.dosageForm, "全部")}</select></div>
          <div class="form-field"><label>给药途径</label><select id="drug-route" class="select">${optionHtml(state.taxonomies?.routes || [], filters.route, "全部")}</select></div>
        </div>
      </details>
      <div class="actions" style="margin-top:14px;">
        <button id="drug-search" class="btn btn-primary">搜索</button>
        <button id="drug-reset" class="btn btn-ghost">重置</button>
        <button id="drug-rebuild-index" class="btn btn-ghost">重建索引</button>
        <a class="btn btn-primary" href="#/import">导入药物</a>
      </div>
    </section>
    <section class="card" style="margin-top:16px;">
      <div class="section-title"><h3 id="drug-count">查询结果：${currentItems.length}</h3></div>
      <div id="drug-results" class="list">${
        hasSearched
          ? currentItems.map(renderDrugCard).join("") || "暂无匹配药物。"
          : '<div class="muted" style="text-align:center; padding:40px 0;">请输入搜索条件或选择筛选项后点击"搜索"</div>'
      }</div>
    </section>
  `,
    "药物查询",
  );

  qs("#drug-search")?.addEventListener("click", () => void runSearch());

  qs<HTMLInputElement>("#drug-q")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void runSearch();
  });

  qs("#drug-system")?.addEventListener("change", () => {
    filters.system = valueOf("#drug-system");
    filters.primaryCategory = "";
    filters.secondaryCategory = "";
    const primary = qs<HTMLSelectElement>("#drug-primary");
    if (primary) {
      primary.innerHTML = optionHtml(categoriesForSystem(filters.system), "", "全部");
    }
    updateSecondaryOptions();
    void runFilterChange();
  });

  qs("#drug-primary")?.addEventListener("change", () => {
    filters.primaryCategory = valueOf("#drug-primary");
    filters.secondaryCategory = "";
    updateSecondaryOptions();
    void runFilterChange();
  });

  qs("#drug-secondary")?.addEventListener("change", () => void runFilterChange());
  qs("#drug-dosage")?.addEventListener("change", () => void runFilterChange());
  qs("#drug-route")?.addEventListener("change", () => void runFilterChange());

  qs("#drug-reset")?.addEventListener("click", async () => {
    filters = {
      q: "",
      system: "",
      primaryCategory: "",
      secondaryCategory: "",
      route: "",
      dosageForm: "",
    };
    currentItems = [];
    hasSearched = false;
    renderDrugLibraryPage();
  });

  qs("#drug-rebuild-index")?.addEventListener("click", async () => {
    const btn = qs<HTMLButtonElement>("#drug-rebuild-index");
    const originalText = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "重建中...";
    }
    try {
      const result = await rebuildIndexes();
      showToast(`索引重建完成，共 ${result.drugs} 个药物`, "success");
      if (btn) btn.textContent = "索引已重建";
      setTimeout(() => {
        if (btn) {
          btn.disabled = false;
          btn.textContent = originalText || "重建索引";
        }
      }, 2000);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : String(error),
        "danger",
      );
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText || "重建索引";
      }
    }
  });
}

function labelBlock(
  title: string,
  value?: string,
  tone: "default" | "warning" | "danger" = "default",
): string {
  const tag = tone === "default" ? "tag" : `tag ${tone}`;
  return `<div style="margin-bottom:14px;"><span class="${tag}">${escapeHtml(title)}</span><div class="item" style="margin-top:8px;white-space:pre-wrap;">${escapeHtml(value || "暂无结构化内容。")}</div></div>`;
}

function specialPopulationHtml(
  value?: Record<string, string | undefined>,
): string {
  const labels: Record<string, string> = {
    pregnancy: "孕妇及哺乳期妇女用药",
    lactation: "哺乳期妇女用药",
    pediatric: "儿童用药",
    geriatric: "老年用药",
    renal_impairment: "肾功能不全",
    hepatic_impairment: "肝功能不全",
    driving_or_machines: "驾驶与机械操作",
  };
  const entries = Object.entries(labels)
    .map(([key, label]) => ({ label, text: value?.[key] || "" }))
    .filter((item) => item.text);
  if (!entries.length) return '<div class="card"><p>暂无特殊人群信息</p></div>';
  return `<div class="grid two">${entries.map((item) => `
    <div class="card">
      <div style="font-size: 12px; font-weight: 600; color: var(--ink-faint); margin-bottom: 6px;">${escapeHtml(item.label)}</div>
      <p>${escapeHtml(item.text)}</p>
    </div>`).join("")}</div>`;
}

export async function renderDrugDetailPage(id: string): Promise<void> {
  renderShell('<div class="card"><div class="loading">正在读取药物详情...</div></div>', "药物详情");
  try {
    const detail = await getDrug(id);
    const fm = detail.frontmatter;
    const label = detail.label;

    renderShell(`
      <div class="grid two">
        <div class="card">
          <h3>基础信息</h3>
          <table class="data-table">
            <tr><th>通用名</th><td>${escapeHtml(fm.names.generic_cn)}</td></tr>
            <tr><th>英文名</th><td>${escapeHtml(fm.names.generic_en || "-")}</td></tr>
            <tr><th>商品名/别名</th><td>${escapeHtml([...(fm.names.brand_names || []), ...(fm.names.aliases || [])].join(" / ") || "-")}</td></tr>
            <tr><th>药理分类</th><td>${escapeHtml(fm.classification.pharmacologic_class || "-")}</td></tr>
            <tr><th>版本</th><td>v${fm.review.version}</td></tr>
          </table>
        </div>
        <div class="card">
          <h3>剂型规格</h3>
          ${fm.forms.map((f) => `
            <div style="padding: 10px 0; border-bottom: 1px solid var(--line);">
              <strong>${escapeHtml(dosageFormLabel(f.dosage_form))}</strong>
              <span style="color: var(--ink-faint); margin-left: 8px;">${escapeHtml(f.strength || "未填规格")} · ${escapeHtml(routeLabel(f.route))}</span>
            </div>`).join("")}
          <h3 style="margin-top: 16px;">风险标签</h3>
          <div class="tag-row">
            ${fm.risk_tags.map((x) => `<span class="tag warning">${escapeHtml(riskTagLabel(x))}</span>`).join("") || '<span class="tag">无</span>'}
          </div>
        </div>
      </div>

      <div class="grid two" style="margin-top: 16px;">
        <div class="card">
          <h3>说明书核心</h3>
          ${labelBlock("适应症", label.indications as string)}
          ${labelBlock("用法用量", label.dosage as string)}
          ${labelBlock("禁忌", label.contraindications as string)}
        </div>
        <div class="card">
          <h3>安全信息</h3>
          ${labelBlock("注意事项", label.precautions as string)}
          ${labelBlock("不良反应", label.adverse_reactions as string)}
          ${labelBlock("相互作用", label.interactions as string)}
        </div>
      </div>

      <div style="margin-top: 16px;">
        <h3 style="margin-bottom: 12px;">特殊人群</h3>
        ${specialPopulationHtml(label.special_populations)}
      </div>

      <div class="card" style="margin-top: 16px;">
        <h3>操作</h3>
        <p>基于当前药物说明书生成候选医嘱模板。</p>
        <div class="actions" style="margin-top: 12px;">
          <a href="#/orders?drug=${encodeURIComponent(fm.id)}" class="btn btn-primary">生成候选医嘱</a>
          <a href="#/import?edit=${encodeURIComponent(fm.id)}" class="btn btn-ghost">修改维护</a>
        </div>
        <details class="advanced-panel" style="margin-top: 16px;">
          <summary>查看原始 Markdown</summary>
          <div style="margin-top: 12px;">
            <button class="btn btn-ghost" id="raw-md">读取原始内容</button>
            <div id="raw-output" style="margin-top: 12px;"></div>
          </div>
        </details>
      </div>
    `, fm.names.generic_cn);

    qs("#raw-md")?.addEventListener("click", async () => {
      try {
        const raw = await getRawDrugMarkdown(id);
        const out = qs("#raw-output");
        if (out) out.innerHTML = `<pre class="order-output">${escapeHtml(raw)}</pre>`;
      } catch (e) {
        showToast(e instanceof Error ? e.message : String(e), "danger");
      }
    });
  } catch (error) {
    renderError(error instanceof Error ? error.message : String(error), "药物详情");
  }
}
