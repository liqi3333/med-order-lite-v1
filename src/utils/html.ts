export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function qs<T extends HTMLElement = HTMLElement>(selector: string): T | null {
  return document.querySelector<T>(selector);
}

export function valueOf(selector: string): string {
  return document.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector)?.value || "";
}

export function checked(selector: string): boolean {
  return Boolean(document.querySelector<HTMLInputElement>(selector)?.checked);
}

export function splitList(value: string): string[] {
  return value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean);
}

export function optionHtml(options: Array<{ value: string; label: string }>, selected = "", allLabel = "请选择"): string {
  return `<option value="">${escapeHtml(allLabel)}</option>${options.map((item) => `<option value="${escapeHtml(item.value)}" ${selected === item.value ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}`;
}
