import { apiFetch } from "./http.js";
import { DrugDocumentResponse } from "../types/drug.js";

type ValidationResult = { ok: boolean; errors: ValidationIssue[]; warnings: ValidationIssue[] };
export type ValidationIssue = { level: "error" | "warning"; code: string; field?: string; message: string };
export type DrugImportPluginSummary = { id: string; name: string; description: string; inputSchema: Record<string, unknown> };

export type DrugBatchImportResult = {
  pluginId: string;
  status: "preview" | "published";
  total: number;
  succeeded: number;
  failed: number;
  results: DrugImportResult[];
  errors: Array<{ row?: number; drugId?: string; message: string }>;
  indexRebuilt?: boolean;
  indexCount?: number;
  indexWarning?: string;
};

export type DrugImportResult = {
  drugId: string;
  status: "preview" | "published";
  markdown: string;
  savedPath?: string;
  validation: ValidationResult;
  document?: DrugDocumentResponse;
  notes: string[];
  indexRebuilt?: boolean;
  indexCount?: number;
  indexWarning?: string;
};

export function listPlugins(): Promise<{ plugins: DrugImportPluginSummary[] }> {
  return apiFetch("/api/plugins");
}

export function importLabelText(body: Record<string, unknown>): Promise<DrugImportResult> {
  return apiFetch("/api/plugins/label-text/import", { method: "POST", body: JSON.stringify(body) });
}

export function importMarkdown(markdown: string): Promise<DrugImportResult> {
  return apiFetch("/api/drugs/import/markdown", { method: "POST", body: JSON.stringify({ markdown }) });
}


export function importCsvDrugs(body: Record<string, unknown>): Promise<DrugBatchImportResult> {
  return apiFetch("/api/drugs/import/csv", { method: "POST", body: JSON.stringify(body) });
}

export function importPdfLabel(body: Record<string, unknown>): Promise<DrugImportResult> {
  return apiFetch("/api/drugs/import/pdf", { method: "POST", body: JSON.stringify(body) });
}

export function importOcrLabel(body: Record<string, unknown>): Promise<DrugImportResult> {
  return apiFetch("/api/drugs/import/ocr", { method: "POST", body: JSON.stringify(body) });
}
