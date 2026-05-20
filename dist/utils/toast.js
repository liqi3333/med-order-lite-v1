export function showToast(message, tone = "info") {
    document.querySelector(".toast")?.remove();
    const toast = document.createElement("div");
    toast.className = `toast ${tone}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3200);
}
