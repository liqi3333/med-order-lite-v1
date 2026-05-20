import { apiFetch } from "./http.js";
export function listPlugins() {
    return apiFetch("/api/plugins");
}
export function importLabelText(body) {
    return apiFetch("/api/plugins/label-text/import", { method: "POST", body: JSON.stringify(body) });
}
export function importMarkdown(markdown) {
    return apiFetch("/api/drugs/import/markdown", { method: "POST", body: JSON.stringify({ markdown }) });
}
export function importCsvDrugs(body) {
    return apiFetch("/api/drugs/import/csv", { method: "POST", body: JSON.stringify(body) });
}
export function importPdfLabel(body) {
    return apiFetch("/api/drugs/import/pdf", { method: "POST", body: JSON.stringify(body) });
}
export function importOcrLabel(body) {
    return apiFetch("/api/drugs/import/ocr", { method: "POST", body: JSON.stringify(body) });
}
