import { getAIConfig, getAIProviders, updateAIConfig, resetAIConfig, type ProviderInfo } from "../api/ai-api.js";
import { escapeHtml } from "../utils/html.js";
import { showToast } from "../utils/toast.js";

let modalEl: HTMLDivElement | null = null;
let listenerAttached = false;

function escapeAttr(value: string): string {
  return value.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function wireAISettingsButton(): void {
  if (listenerAttached) return;
  listenerAttached = true;
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.id === "open-ai-settings" || target.closest("#open-ai-settings")) {
      e.preventDefault();
      openModal();
    }
  });
}

async function openModal(): Promise<void> {
  closeModal();

  let config = null;
  let providersResp: { providers: ProviderInfo[]; current: string } = { providers: [], current: "openai" };
  try {
    [config, providersResp] = await Promise.all([
      getAIConfig(),
      getAIProviders(),
    ]);
  } catch {
    // use defaults
  }

  const providers = providersResp.providers || [];
  const currentProvider = (config?.provider || providersResp.current || "openai") as string;
  const currentProviderData = providers.find((p) => p.id === currentProvider);
  const currentModels = currentProviderData?.models || [];

  modalEl = document.createElement("div");
  modalEl.className = "ai-modal-overlay";
  modalEl.innerHTML = `
    <div class="ai-modal">
      <div class="ai-modal-header">
        <h3>模型设置</h3>
        <button class="ai-modal-close" id="ai-settings-close">&times;</button>
      </div>
      <div class="ai-modal-body">
        <div class="ai-field">
          <label>供应商 <span class="required">*</span></label>
          <select id="ai-provider" class="select">
            ${providers.map((p) => `<option value="${escapeAttr(p.id)}" ${p.id === currentProvider ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}
          </select>
        </div>
        <div class="ai-field">
          <label>模型名称 <span class="required">*</span></label>
          <select id="ai-model-select" class="select" ${currentProvider === "openai-compat" ? ' style="display:none"' : ""}>
            ${currentModels.map((m) => `<option value="${escapeAttr(m.value)}" ${m.value === (config?.model || currentProviderData?.defaultModel || "") ? "selected" : ""}>${escapeHtml(m.label)}</option>`).join("")}
          </select>
          <input id="ai-model-input" class="input" value="${escapeAttr(config?.model || currentProviderData?.defaultModel || "")}" placeholder="输入模型名称" ${currentProvider !== "openai-compat" ? ' style="display:none"' : ""} />
        </div>
        <div class="ai-field">
          <label>API Key <span class="required">*</span></label>
          <div class="ai-key-row">
            <input id="ai-api-key" class="input" type="password" placeholder="${config?.api_key_set ? "已设置（末位 " + escapeAttr(config.api_key_suffix || "") + "）" : "输入 API Key"}" autocomplete="off" />
            <button id="ai-toggle-key" class="btn btn-ghost btn-sm" type="button">显示</button>
          </div>
        </div>
        <div class="ai-field">
          <label>Base URL${currentProvider === "openai-compat" ? ' <span class="required">*</span>' : "（可选）"}</label>
          <input id="ai-base-url" class="input" value="${escapeAttr(config?.base_url || currentProviderData?.defaultBaseUrl || "")}" placeholder="留空使用默认" />
        </div>
        <div class="ai-field">
          <label>Temperature: <span id="ai-temp-val">${config?.temperature ?? 0.3}</span></label>
          <input id="ai-temperature" class="input" type="range" min="0" max="1" step="0.1" value="${config?.temperature ?? 0.3}" />
        </div>
        <div class="ai-field ai-actions">
          <button id="ai-test-connection" class="btn btn-ghost" type="button">测试连接</button>
          <button id="ai-save-config" class="btn btn-primary" type="button">保存</button>
          <button id="ai-reset-config" class="btn btn-ghost" type="button">重置为默认</button>
        </div>
        <div id="ai-test-result" style="margin-top:8px;"></div>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);
  wireModalEvents(providers);
}

function closeModal(): void {
  if (modalEl) {
    modalEl.remove();
    modalEl = null;
  }
}

function wireModalEvents(providers: ProviderInfo[]): void {
  if (!modalEl) return;

  // Close button
  const closeBtn = modalEl.querySelector("#ai-settings-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeModal();
    });
  }

  // Click overlay to close
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) closeModal();
  });

  // Escape key to close
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape" && modalEl) {
      closeModal();
      document.removeEventListener("keydown", escHandler);
    }
  };
  document.addEventListener("keydown", escHandler);

  const providerSelect = modalEl.querySelector<HTMLSelectElement>("#ai-provider");
  const modelSelect = modalEl.querySelector<HTMLSelectElement>("#ai-model-select");
  const modelInput = modalEl.querySelector<HTMLInputElement>("#ai-model-input");

  providerSelect?.addEventListener("change", () => {
    const pid = providerSelect.value;
    const prov = providers.find((p) => p.id === pid);
    const models = prov?.models || [];
    const isCompat = pid === "openai-compat";

    if (modelSelect) {
      modelSelect.innerHTML = models.length > 0
        ? models.map((m) => `<option value="${escapeAttr(m.value)}">${escapeHtml(m.label)}</option>`).join("")
        : '<option value="">无可用模型</option>';
      modelSelect.style.display = isCompat ? "none" : "";
      if (models.length > 0) {
        modelSelect.value = models[0].value;
      }
    }
    if (modelInput) {
      modelInput.style.display = isCompat ? "" : "none";
      if (prov) modelInput.value = prov.defaultModel;
    }

    // Update base URL
    const baseUrlInput = modalEl?.querySelector<HTMLInputElement>("#ai-base-url");
    if (baseUrlInput && prov) {
      baseUrlInput.value = prov.defaultBaseUrl;
    }
  });

  const tempSlider = modalEl.querySelector<HTMLInputElement>("#ai-temperature");
  const tempVal = modalEl.querySelector("#ai-temp-val");
  tempSlider?.addEventListener("input", () => {
    if (tempVal) tempVal.textContent = tempSlider.value;
  });

  const toggleBtn = modalEl.querySelector("#ai-toggle-key");
  const keyInput = modalEl.querySelector<HTMLInputElement>("#ai-api-key");
  toggleBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    if (!keyInput) return;
    const isPassword = keyInput.type === "password";
    keyInput.type = isPassword ? "text" : "password";
    toggleBtn.textContent = isPassword ? "隐藏" : "显示";
  });

  modalEl.querySelector("#ai-test-connection")?.addEventListener("click", async () => {
    const resultEl = modalEl?.querySelector("#ai-test-result");
    if (resultEl) resultEl.innerHTML = '<div class="ai-testing">测试中...</div>';
    try {
      const cfg = collectConfig();
      const patchResult = await updateAIConfig(cfg);
      if (!patchResult.success) throw new Error("配置更新失败");
      showToast("连接测试成功", "success");
      if (resultEl) resultEl.innerHTML = '<div class="ai-test-ok">连接正常</div>';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`测试失败: ${msg}`, "danger");
      if (resultEl) resultEl.innerHTML = `<div class="ai-test-fail">${escapeHtml(msg)}</div>`;
    }
  });

  modalEl.querySelector("#ai-save-config")?.addEventListener("click", async () => {
    try {
      const cfg = collectConfig();
      await updateAIConfig(cfg);
      showToast("配置已保存", "success");
      closeModal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "danger");
    }
  });

  modalEl.querySelector("#ai-reset-config")?.addEventListener("click", async () => {
    try {
      await resetAIConfig();
      showToast("已重置为默认配置", "success");
      closeModal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "danger");
    }
  });
}

function collectConfig(): Record<string, unknown> {
  if (!modalEl) return {};
  const provider = modalEl.querySelector<HTMLSelectElement>("#ai-provider")?.value || "openai";
  const modelSelect = modalEl.querySelector<HTMLSelectElement>("#ai-model-select");
  const modelInput = modalEl.querySelector<HTMLInputElement>("#ai-model-input");
  const model = provider === "openai-compat" ? (modelInput?.value || "") : (modelSelect?.value || "");
  const api_key = modalEl.querySelector<HTMLInputElement>("#ai-api-key")?.value || "";
  const base_url = modalEl.querySelector<HTMLInputElement>("#ai-base-url")?.value || "";
  const temperature = parseFloat(modalEl.querySelector<HTMLInputElement>("#ai-temperature")?.value || "0.3");

  const config: Record<string, unknown> = { provider, model, base_url, temperature, enabled: true };
  if (api_key) config.api_key = api_key;
  return config;
}
