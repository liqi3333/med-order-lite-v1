import { apiFetch } from "./http.js";
export function getHealth() { return apiFetch("/health"); }
export function getTaxonomies() { return apiFetch("/api/taxonomies"); }
export function rebuildIndexes() { return apiFetch("/api/indexes/rebuild", { method: "POST", body: "{}" }); }
export function getIndexStatus() { return apiFetch("/api/indexes/status"); }
