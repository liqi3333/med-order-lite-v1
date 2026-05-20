import { apiFetch } from "./http.js";
export function generateOrder(body) {
    return apiFetch("/api/orders/generate", { method: "POST", body: JSON.stringify(body) });
}
