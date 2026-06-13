import { apiFetch } from "./http.js";
import { DrugDocumentResponse, DrugFilter, DrugIndexItem } from "../types/drug.js";

function query(params: Record<string, string | boolean | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") qs.set(key, String(value));
  return qs.toString();
}

export function searchDrugs(filters: Partial<DrugFilter> = {}): Promise<{ total: number; items: DrugIndexItem[] }> {
  return apiFetch(`/api/drugs?${query({ q: filters.q, system: filters.system, primaryCategory: filters.primaryCategory, secondaryCategory: filters.secondaryCategory, route: filters.route, dosageForm: filters.dosageForm })}`);
}
export function getDrug(id: string): Promise<DrugDocumentResponse> { return apiFetch(`/api/drugs/${encodeURIComponent(id)}`); }
export function getRawDrugMarkdown(id: string): Promise<string> { return apiFetch(`/api/drugs/${encodeURIComponent(id)}/raw-md`, { headers: { accept: "text/plain" } }); }
