import { state } from "../state.js";
import { DrugIndexItem } from "../types/drug.js";
import { escapeHtml } from "../utils/html.js";

function label(options: Array<{ value: string; label: string }> | undefined, value: string | undefined): string {
  return options?.find((item) => item.value === value)?.label || value || "";
}
export function categoryLabel(value?: string): string { return label(state.taxonomies?.drugCategories.categories, value); }
export function routeLabel(value?: string): string { return label(state.taxonomies?.routes, value); }
export function dosageFormLabel(value?: string): string { return label(state.taxonomies?.dosageForms, value); }
export function riskTagLabel(value: string): string { return label(state.taxonomies?.riskTags, value); }

export function renderDrugCard(drug: DrugIndexItem): string {
  return `<div class="item">
    <div class="item-header">
      <div><strong>${escapeHtml(drug.generic_cn)}</strong><p>${escapeHtml([drug.generic_en, ...drug.brand_names, ...drug.aliases].filter(Boolean).join(" / "))}</p></div>
      <span class="tag approved">已入库</span>
    </div>
    <div class="tag-row">
      <span class="tag">${escapeHtml(categoryLabel(drug.primary_category))}</span>
      ${drug.dosage_forms.map((item) => `<span class="tag secondary">${escapeHtml(dosageFormLabel(item))}</span>`).join("")}
      ${drug.routes.map((item) => `<span class="tag secondary">${escapeHtml(routeLabel(item))}</span>`).join("")}
    </div>
    <div class="actions" style="margin-top:12px;"><a class="btn ghost" href="#/drugs/${encodeURIComponent(drug.id)}">详情</a><a class="btn" href="#/orders?drug=${encodeURIComponent(drug.id)}">生成候选医嘱</a></div>
  </div>`;
}
