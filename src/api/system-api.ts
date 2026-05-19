import { apiFetch } from "./http.js";
import { TaxonomyBundle } from "../types/common.js";

export function getHealth(): Promise<{ ok: boolean; service: string; version: string; kbRoot: string }> { return apiFetch("/health"); }
export function getTaxonomies(): Promise<TaxonomyBundle> { return apiFetch("/api/taxonomies"); }
export function rebuildIndexes(): Promise<{ ok: boolean; drugs: number }> { return apiFetch("/api/index/rebuild", { method: "POST", body: "{}" }); }
export function getIndexStatus(): Promise<{ drugs: number; indexPath: string }> { return apiFetch("/api/index/status"); }
