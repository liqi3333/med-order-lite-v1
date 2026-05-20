import { API_BASE } from "../config.js";
export async function apiFetch(path, init) {
    const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
    const response = await fetch(url, {
        ...init,
        headers: { "content-type": "application/json", ...(init?.headers || {}) }
    });
    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json") ? await response.json() : await response.text();
    if (!response.ok) {
        const message = typeof body === "object" && body && "error" in body ? String(body.error) : String(body);
        throw new Error(message || `请求失败：${response.status}`);
    }
    return body;
}
