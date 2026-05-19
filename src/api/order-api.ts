import { apiFetch } from "./http.js";
import { CandidateOrderTemplate } from "../types/order.js";

export function generateOrder(body: {
  drugId: string;
  diagnosis?: string;
  scenario?: string;
  patientContext?: Record<string, unknown>;
}): Promise<CandidateOrderTemplate> {
  return apiFetch("/api/orders/generate", { method: "POST", body: JSON.stringify(body) });
}
