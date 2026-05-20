export function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
export function qs(selector) {
    return document.querySelector(selector);
}
export function valueOf(selector) {
    return document.querySelector(selector)?.value || "";
}
export function checked(selector) {
    return Boolean(document.querySelector(selector)?.checked);
}
export function splitList(value) {
    return value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean);
}
export function optionHtml(options, selected = "", allLabel = "请选择") {
    return `<option value="">${escapeHtml(allLabel)}</option>${options.map((item) => `<option value="${escapeHtml(item.value)}" ${selected === item.value ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}`;
}
