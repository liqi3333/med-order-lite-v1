import {
  getAIConfig, getAIProviders, updateAIConfig, resetAIConfig,
  listProfiles, createProfile, updateProfile, deleteProfile, activateProfile, deactivateAll, testAIConnection,
  type ProviderInfo, type AIProfile, type AIProfileSummary,
} from "../api/ai-api.js";
import { escapeHtml } from "../utils/html.js";
import { showToast } from "../utils/toast.js";
import { state } from "../state.js";

let modalEl: HTMLDivElement | null = null;
let listenerAttached = false;
let editingProfileId: string | null = null;
let loadedProfiles: AIProfile[] = [];

function escapeAttr(value: string): string {
  return value.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function refreshAIState(): Promise<void> {
  try {
    const cfg = await getAIConfig();
    state.aiModel = cfg.model;
    state.aiProvider = cfg.provider;
    state.aiEnabled = cfg.enabled;
    const btn = document.querySelector<HTMLSpanElement>("#open-ai-settings .nav-action-text");
    if (btn) btn.textContent = cfg.enabled && cfg.model ? cfg.model : "模型";
  } catch { /* ignore */ }
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

// ── Provider name map ──────────────────────────────────────────────────────

const PROVIDER_NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
  google: "Google Gemini",
  "openai-compat": "OpenAI 兼容",
};

function providerName(id: string): string {
  return PROVIDER_NAMES[id] || id;
}

// ── Open modal ─────────────────────────────────────────────────────────────

async function openModal(): Promise<void> {
  closeModal();

  let config = null;
  let providersResp: { providers: ProviderInfo[]; current: string } = { providers: [], current: "openai" };
  let profilesResp: { profiles: AIProfileSummary[]; activeProfileId: string | null } = { profiles: [], activeProfileId: null };
  try {
    [config, providersResp, profilesResp] = await Promise.all([
      getAIConfig(),
      getAIProviders(),
      listProfiles(),
    ]);
  } catch { /* use defaults */ }

  const providers = providersResp.providers || [];
  const profiles = profilesResp.profiles || [];
  const activeId = profilesResp.activeProfileId || config?.activeProfileId || null;
  editingProfileId = null;
  loadedProfiles = await loadFullProfiles();

  // If there are profiles and an active one, load it as edit data
  let editData = config;
  if (profiles.length > 0 && activeId) {
    const activeProfile = loadedProfiles.find((p) => p.id === activeId);
    if (activeProfile) {
      editData = {
        provider: activeProfile.provider,
        api_key_set: true,
        api_key_suffix: activeProfile.api_key.slice(-4),
        base_url: activeProfile.base_url,
        model: activeProfile.model,
        temperature: activeProfile.temperature,
        max_tokens: activeProfile.max_tokens,
        enabled: true,
        profiles: profiles,
        activeProfileId: activeId,
      };
      editingProfileId = activeId;
    }
  }

  const currentProvider = (editData?.provider || "openai") as string;
  const currentProviderData = providers.find((p) => p.id === currentProvider);
  const currentModels = currentProviderData?.models || [];
  const isOffline = !activeId;

  modalEl = document.createElement("div");
  modalEl.className = "ai-modal-overlay";
  modalEl.innerHTML = `
    <div class="ai-modal">
      <div class="ai-modal-header">
        <h3>模型设置</h3>
        <button class="ai-modal-close" id="ai-settings-close">&times;</button>
      </div>
      <div class="ai-modal-body">
        <div class="ai-profile-bar">
          <select id="ai-profile-select" class="select">
            <option value="offline" ${isOffline ? "selected" : ""}>📴 离线（禁用 AI）</option>
            ${profiles.map((p) => `<option value="${escapeAttr(p.id)}" ${p.id === editingProfileId ? "selected" : ""}>${escapeHtml(p.name)} — ${escapeHtml(providerName(p.provider))} / ${escapeHtml(p.model)}</option>`).join("")}
          </select>
          <button id="ai-profile-new" class="btn btn-ghost btn-sm" type="button">+ 新建</button>
          <button id="ai-profile-delete" class="btn btn-ghost btn-sm" type="button" ${!editingProfileId ? "disabled" : ""}>删除</button>
          <button id="ai-profile-detail" class="btn btn-ghost btn-sm" type="button" ${!editingProfileId ? "disabled" : ""}>ℹ️</button>
        </div>
        <div id="ai-profile-detail-panel" class="ai-detail-panel" style="display:none;"></div>
        <div class="ai-field">
          <label>配置名称 <span class="required">*</span></label>
          <input id="ai-profile-name" class="input" value="${escapeAttr(getProfileName(profiles, editingProfileId))}" placeholder="如：GPT-4o、DeepSeek 本地" />
        </div>
        <div class="ai-field">
          <label>供应商 <span class="required">*</span></label>
          <select id="ai-provider" class="select">
            ${providers.map((p) => `<option value="${escapeAttr(p.id)}" ${p.id === currentProvider ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}
          </select>
        </div>
        <div class="ai-field">
          <label>模型名称 <span class="required">*</span></label>
          <select id="ai-model-select" class="select" ${currentProvider === "openai-compat" ? ' style="display:none"' : ""}>
            ${currentModels.map((m) => `<option value="${escapeAttr(m.value)}" ${m.value === (editData?.model || currentProviderData?.defaultModel || "") ? "selected" : ""}>${escapeHtml(m.label)}</option>`).join("")}
          </select>
          <input id="ai-model-input" class="input" value="${escapeAttr(editData?.model || currentProviderData?.defaultModel || "")}" placeholder="输入模型名称" ${currentProvider !== "openai-compat" ? ' style="display:none"' : ""} />
        </div>
        <div class="ai-field">
          <label>API Key <span class="required">*</span></label>
          <div class="ai-key-row">
            <input id="ai-api-key" class="input" type="password" placeholder="${editData?.api_key_set ? "已设置（末位 " + escapeAttr(editData.api_key_suffix || "") + "）" : "输入 API Key"}" autocomplete="off" />
            <button id="ai-toggle-key" class="btn btn-ghost btn-sm" type="button">显示</button>
          </div>
        </div>
        <div class="ai-field">
          <label>Base URL${currentProvider === "openai-compat" ? ' <span class="required">*</span>' : "（可选）"}</label>
          <input id="ai-base-url" class="input" value="${escapeAttr(editData?.base_url || currentProviderData?.defaultBaseUrl || "")}" placeholder="留空使用默认" />
        </div>
        <div class="ai-field">
          <label>Temperature: <span id="ai-temp-val">${editData?.temperature ?? 0.3}</span></label>
          <input id="ai-temperature" class="input" type="range" min="0" max="1" step="0.1" value="${editData?.temperature ?? 0.3}" />
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
  wireModalEvents(providers, profiles);
}

function closeModal(): void {
  if (modalEl) {
    modalEl.remove();
    modalEl = null;
  }
}

function getProfileName(profiles: AIProfileSummary[], id: string | null): string {
  if (!id) return "";
  return profiles.find((p) => p.id === id)?.name || "";
}

async function loadFullProfiles(): Promise<AIProfile[]> {
  try {
    const resp = await listProfiles();
    return resp.profiles || [];
  } catch {
    return [];
  }
}

async function reloadModal(): Promise<void> {
  closeModal();
  await openModal();
}

// ── Wire events ─────────────────────────────────────────────────────────────

function wireModalEvents(providers: ProviderInfo[], profiles: AIProfileSummary[]): void {
  if (!modalEl) return;

  const closeBtn = modalEl.querySelector("#ai-settings-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeModal();
    });
  }

  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) closeModal();
  });

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
  const keyInput = modalEl.querySelector<HTMLInputElement>("#ai-api-key");

  // ── Provider change ─────────────────────────────────────────────────────
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
      if (models.length > 0) modelSelect.value = models[0].value;
    }
    if (modelInput) {
      modelInput.style.display = isCompat ? "" : "none";
      if (prov) modelInput.value = prov.defaultModel;
    }

    const baseUrlInput = modalEl?.querySelector<HTMLInputElement>("#ai-base-url");
    if (baseUrlInput && prov) baseUrlInput.value = prov.defaultBaseUrl;
  });

  // ── Temperature slider ──────────────────────────────────────────────────
  const tempSlider = modalEl.querySelector<HTMLInputElement>("#ai-temperature");
  const tempVal = modalEl.querySelector("#ai-temp-val");
  tempSlider?.addEventListener("input", () => {
    if (tempVal) tempVal.textContent = tempSlider.value;
  });

  // ── Toggle API key visibility ───────────────────────────────────────────
  const toggleBtn = modalEl.querySelector("#ai-toggle-key");
  toggleBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    if (!keyInput) return;
    const isPassword = keyInput.type === "password";
    keyInput.type = isPassword ? "text" : "password";
    toggleBtn.textContent = isPassword ? "隐藏" : "显示";
  });

  // ── Profile select: offline or auto-activate ────────────────────────────
  const profileSelect = modalEl.querySelector<HTMLSelectElement>("#ai-profile-select");
  profileSelect?.addEventListener("change", async () => {
    const pid = profileSelect.value;
    const detailPanel = modalEl?.querySelector<HTMLDivElement>("#ai-profile-detail-panel");
    if (detailPanel) detailPanel.style.display = "none";

    if (pid === "offline") {
      editingProfileId = null;
      try {
        await deactivateAll();
        state.aiModel = "";
        state.aiProvider = "";
        state.aiEnabled = false;
        const btn = document.querySelector<HTMLSpanElement>("#open-ai-settings .nav-action-text");
        if (btn) btn.textContent = "模型";
        showToast("已切换为离线模式", "success");
      } catch (err) {
        showToast(err instanceof Error ? err.message : String(err), "danger");
      }
      // Disable edit buttons
      const delBtn = modalEl?.querySelector<HTMLButtonElement>("#ai-profile-delete");
      const detailBtn = modalEl?.querySelector<HTMLButtonElement>("#ai-profile-detail");
      if (delBtn) delBtn.disabled = true;
      if (detailBtn) detailBtn.disabled = true;
      // Clear form
      const nameInput = modalEl?.querySelector<HTMLInputElement>("#ai-profile-name");
      if (nameInput) nameInput.value = "";
      if (keyInput) { keyInput.value = ""; keyInput.placeholder = "输入 API Key"; }
      return;
    }

    editingProfileId = pid;
    const fullProfiles = await loadFullProfiles();
    const profile = fullProfiles.find((p) => p.id === pid);
    if (!profile) return;

    // Populate form
    const nameInput = modalEl?.querySelector<HTMLInputElement>("#ai-profile-name");
    if (nameInput) nameInput.value = profile.name;
    if (providerSelect) {
      providerSelect.value = profile.provider;
      providerSelect.dispatchEvent(new Event("change"));
    }
    setTimeout(() => {
      const ms = modalEl?.querySelector<HTMLSelectElement>("#ai-model-select");
      const mi = modalEl?.querySelector<HTMLInputElement>("#ai-model-input");
      if (profile.provider === "openai-compat" && mi) mi.value = profile.model;
      else if (ms) ms.value = profile.model;
    }, 0);
    if (keyInput) keyInput.value = "";
    const baseUrlInput = modalEl?.querySelector<HTMLInputElement>("#ai-base-url");
    if (baseUrlInput) baseUrlInput.value = profile.base_url;
    if (tempSlider) tempSlider.value = String(profile.temperature);
    if (tempVal) tempVal.textContent = String(profile.temperature);

    // Enable buttons
    const delBtn = modalEl?.querySelector<HTMLButtonElement>("#ai-profile-delete");
    const detailBtn = modalEl?.querySelector<HTMLButtonElement>("#ai-profile-detail");
    if (delBtn) delBtn.disabled = false;
    if (detailBtn) detailBtn.disabled = false;

    // Auto-activate
    try {
      await activateProfile(pid);
      await refreshAIState();
    } catch { /* ignore */ }
  });

  // ── New profile ─────────────────────────────────────────────────────────
  modalEl.querySelector("#ai-profile-new")?.addEventListener("click", () => {
    editingProfileId = null;
    const nameInput = modalEl?.querySelector<HTMLInputElement>("#ai-profile-name");
    if (nameInput) nameInput.value = "";
    if (keyInput) { keyInput.value = ""; keyInput.placeholder = "输入 API Key"; }
    const delBtn = modalEl?.querySelector<HTMLButtonElement>("#ai-profile-delete");
    const detailBtn = modalEl?.querySelector<HTMLButtonElement>("#ai-profile-detail");
    if (delBtn) delBtn.disabled = true;
    if (detailBtn) detailBtn.disabled = true;
    if (profileSelect) profileSelect.value = "offline";
    const detailPanel = modalEl?.querySelector<HTMLDivElement>("#ai-profile-detail-panel");
    if (detailPanel) detailPanel.style.display = "none";
  });

  // ── Delete profile ──────────────────────────────────────────────────────
  modalEl.querySelector("#ai-profile-delete")?.addEventListener("click", async () => {
    if (!editingProfileId) return;
    if (!confirm("确定删除此配置？")) return;
    try {
      await deleteProfile(editingProfileId);
      showToast("配置已删除", "success");
      await reloadModal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "danger");
    }
  });

  // ── Detail toggle ───────────────────────────────────────────────────────
  modalEl.querySelector("#ai-profile-detail")?.addEventListener("click", () => {
    if (!editingProfileId) return;
    const panel = modalEl?.querySelector<HTMLDivElement>("#ai-profile-detail-panel");
    if (!panel) return;
    if (panel.style.display !== "none") {
      panel.style.display = "none";
      return;
    }
    const profile = loadedProfiles.find((p) => p.id === editingProfileId);
    if (!profile) return;
    const maskedKey = profile.api_key
      ? profile.api_key.slice(0, 3) + "***" + profile.api_key.slice(-4)
      : "未设置";
    panel.innerHTML = `
      <div class="ai-detail-row"><span class="ai-detail-label">名称</span><span>${escapeHtml(profile.name)}</span></div>
      <div class="ai-detail-row"><span class="ai-detail-label">供应商</span><span>${escapeHtml(providerName(profile.provider))}</span></div>
      <div class="ai-detail-row"><span class="ai-detail-label">模型</span><span>${escapeHtml(profile.model)}</span></div>
      <div class="ai-detail-row"><span class="ai-detail-label">API Key</span><span class="ai-detail-mono">${escapeHtml(maskedKey)}</span></div>
      <div class="ai-detail-row"><span class="ai-detail-label">Base URL</span><span class="ai-detail-mono">${escapeHtml(profile.base_url || "默认")}</span></div>
      <div class="ai-detail-row"><span class="ai-detail-label">Temperature</span><span>${profile.temperature}</span></div>
      <div class="ai-detail-row"><span class="ai-detail-label">Max Tokens</span><span>${profile.max_tokens}</span></div>
    `;
    panel.style.display = "";
  });

  // ── Test connection ─────────────────────────────────────────────────────
  modalEl.querySelector("#ai-test-connection")?.addEventListener("click", async () => {
    const resultEl = modalEl?.querySelector("#ai-test-result");
    if (resultEl) resultEl.innerHTML = '<div class="ai-testing">测试中...</div>';
    try {
      const cfg = collectConfig();
      if (!cfg.api_key) {
        showToast("请先输入 API Key", "warning");
        if (resultEl) resultEl.innerHTML = '<div class="ai-test-fail">请先输入 API Key</div>';
        return;
      }
      const result = await testAIConnection({
        provider: cfg.provider as string,
        api_key: cfg.api_key as string,
        base_url: (cfg.base_url as string) || "",
        model: (cfg.model as string) || "",
        temperature: (cfg.temperature as number) || 0.3,
      });
      if (result.success) {
        showToast(`连接成功 (${result.latency_ms}ms)`, "success");
        if (resultEl) resultEl.innerHTML = `<div class="ai-test-ok">连接正常 — ${escapeHtml(result.reply || "ok")} (${result.latency_ms}ms)</div>`;
      } else {
        showToast(`连接失败: ${result.error}`, "danger");
        if (resultEl) resultEl.innerHTML = `<div class="ai-test-fail">${escapeHtml(result.error || "未知错误")}</div>`;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`测试失败: ${msg}`, "danger");
      if (resultEl) resultEl.innerHTML = `<div class="ai-test-fail">${escapeHtml(msg)}</div>`;
    }
  });

  // ── Save profile ────────────────────────────────────────────────────────
  modalEl.querySelector("#ai-save-config")?.addEventListener("click", async () => {
    try {
      const cfg = collectConfig();
      const name = modalEl?.querySelector<HTMLInputElement>("#ai-profile-name")?.value?.trim();

      if (editingProfileId) {
        const patch: Record<string, unknown> = { ...cfg };
        if (name) patch.name = name;
        await updateProfile(editingProfileId, patch);
        showToast("配置已更新", "success");
      } else {
        if (!name) {
          showToast("请输入配置名称", "warning");
          return;
        }
        const resp = await createProfile({
          name,
          provider: cfg.provider as string,
          api_key: (cfg.api_key as string) || "",
          base_url: (cfg.base_url as string) || "",
          model: (cfg.model as string) || "",
          temperature: (cfg.temperature as number) || 0.3,
          max_tokens: (cfg.max_tokens as number) || 4096,
        });
        editingProfileId = resp.profile.id;
        await activateProfile(resp.profile.id);
        showToast("配置已创建并启用", "success");
      }
      await refreshAIState();
      await reloadModal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "danger");
    }
  });

  // ── Reset ───────────────────────────────────────────────────────────────
  modalEl.querySelector("#ai-reset-config")?.addEventListener("click", async () => {
    try {
      await resetAIConfig();
      state.aiModel = "";
      state.aiProvider = "";
      state.aiEnabled = false;
      const btn = document.querySelector<HTMLSpanElement>("#open-ai-settings .nav-action-text");
      if (btn) btn.textContent = "模型";
      showToast("已重置为默认配置", "success");
      closeModal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "danger");
    }
  });
}

// ── Collect form data ──────────────────────────────────────────────────────

function collectConfig(): Record<string, unknown> {
  if (!modalEl) return {};
  const provider = modalEl.querySelector<HTMLSelectElement>("#ai-provider")?.value || "openai";
  const modelSelect = modalEl.querySelector<HTMLSelectElement>("#ai-model-select");
  const modelInput = modalEl.querySelector<HTMLInputElement>("#ai-model-input");
  const model = provider === "openai-compat" ? (modelInput?.value || "") : (modelSelect?.value || "");
  let api_key = modalEl.querySelector<HTMLInputElement>("#ai-api-key")?.value || "";
  const base_url = modalEl.querySelector<HTMLInputElement>("#ai-base-url")?.value || "";
  const temperature = parseFloat(modalEl.querySelector<HTMLInputElement>("#ai-temperature")?.value || "0.3");

  // Fall back to saved profile key if input is empty
  if (!api_key && editingProfileId) {
    const saved = loadedProfiles.find((p) => p.id === editingProfileId);
    if (saved?.api_key) api_key = saved.api_key;
  }

  const config: Record<string, unknown> = { provider, model, base_url, temperature, enabled: true };
  if (api_key) config.api_key = api_key;
  return config;
}
