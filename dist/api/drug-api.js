import { apiFetch } from "./http.js";
function query(params) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params))
        if (value !== undefined && value !== "")
            qs.set(key, String(value));
    return qs.toString();
}
export function searchDrugs(filters = {}) {
    return apiFetch(`/api/drugs?${query({ q: filters.q, system: filters.system, primaryCategory: filters.primaryCategory, secondaryCategory: filters.secondaryCategory, route: filters.route, dosageForm: filters.dosageForm })}`);
}
export function getDrug(id) { return apiFetch(`/api/drugs/${encodeURIComponent(id)}`); }
export function getRawDrugMarkdown(id) { return apiFetch(`/api/drugs/${encodeURIComponent(id)}/raw-md`, { headers: { accept: "text/plain" } }); }
