import { apiFetch } from "./http.js";
import { TaxonomyBundle } from "../types/common.js";

export type RebuildIndexResult = { ok: boolean; drugs: number; indexPath: string; rebuiltAt: string };
export type IndexStatusResult = { ok: boolean; drugs: { exists: boolean; count: number; indexPath: string; updatedAt?: string } };

export function getHealth(): Promise<{ ok: boolean; service: string; version: string; kbRoot: string }> { return apiFetch("/health"); }
export function getTaxonomies(): Promise<TaxonomyBundle> { return apiFetch("/api/taxonomies"); }
export function rebuildIndexes(): Promise<RebuildIndexResult> { return apiFetch("/api/indexes/rebuild", { method: "POST", body: "{}" }); }
export function getIndexStatus(): Promise<IndexStatusResult> { return apiFetch("/api/indexes/status"); }
