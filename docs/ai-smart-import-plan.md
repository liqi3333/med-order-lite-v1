# AI 智能药品导入 + 多供应商 LLM 支持 — 实现计划

> 版本：v1.0  
> 日期：2026-06-30  
> 状态：待实施

---

## 1. 背景与目标

### 1.1 现状

Med Order Lite 已有 5 个导入插件（label-text、excel-csv、label-pdf、label-ocr、manual-drug-md），基于正则表达式和规则解析药品说明书文本。存在以下局限：

- 无法处理非标准格式的说明书文本
- 无法自动推断药物分类（system、primary_category 等）需要用户手动选择
- 对扫描件/图片依赖外部 OCR，无法端到端处理
- 无法从文本中推断隐含信息（如 ATC 代码、药理学分类）

### 1.2 目标

引入 AI/LLM 能力，实现：

1. **智能解析**：粘贴任意格式药品说明书文本 → AI 自动提取全部结构化字段
2. **多供应商支持**：兼容 OpenAI、Anthropic、DeepSeek、Google Gemini 等主流 LLM
3. **零新依赖**：使用 Node 20 内置 `fetch()`，不安装任何新 npm 包
4. **安全降级**：AI 失败时自动 fallback 到现有 regex 解析
5. **可视化配置**：支持 .env 环境变量 + 前端 GUI 运行时切换

---

## 2. 架构设计

### 2.1 整体架构

```
┌──────────────────────────────────────────────────────────┐
│  Frontend                                                │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Import 页面  │  │ 模型设置按钮  │  │ AI 解析预览    │  │
│  │ (新增AI tab) │  │ (首页导航)   │  │ (结果编辑)     │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬────────┘  │
│         │                │                   │           │
└─────────┼────────────────┼───────────────────┼───────────┘
          │                │                   │
          ▼                ▼                   ▼
┌──────────────────────────────────────────────────────────┐
│  Backend API Layer                                       │
│  POST /api/ai/parse-label   GET/PUT /api/ai/config      │
│  POST /api/plugins/ai-label-text/import                 │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  AI Module (server/src/modules/ai/)                      │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐  │
│  │ LLM Provider │  │ Label Parser  │  │ AI Config    │  │
│  │ 抽象层        │  │ (Prompt+解析) │  │ (.env+GUI)   │  │
│  └──────┬───────┘  └───────────────┘  └──────────────┘  │
│         │                                                │
│         ▼                                                │
│  ┌─────────────────────────────────┐                     │
│  │ Provider Implementations        │                     │
│  │ openai │ anthropic │ deepseek │ google               │
│  └─────────────────────────────────┘                     │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  Existing Plugin System                                  │
│  DrugEntryPluginRegistry → DrugEntryService              │
│  → Validation → Repository → Index Rebuild               │
└──────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
用户粘贴说明书文本
  │
  ├─ 选择 "AI 智能导入" tab
  │
  ▼
POST /api/ai/parse-label
  │
  ├─ text 预处理（去噪、截断）
  │
  ├─ LLM Provider.chat(system_prompt + user_text)
  │     │
  │     ├─ 成功 → JSON 解析 → 结构化数据
  │     │
  │     └─ 失败/超时(30s) → fallback 到 regex 解析
  │
  ▼
返回 AIParsedDrugData (含 confidence + warnings)
  │
  ▼
前端展示预览 → 用户编辑/确认
  │
  ▼
POST /api/plugins/ai-label-text/import
  │
  ▼
现有流程: Validation → Publish → Index Rebuild
```

---

## 3. 文件规划

### 3.1 新增文件

| # | 文件路径 | 职责 |
|---|---------|------|
| 1 | `server/src/modules/ai/types.ts` | AI 模块类型定义 |
| 2 | `server/src/modules/ai/config.ts` | AI 配置管理（.env + 运行时覆盖） |
| 3 | `server/src/modules/ai/llm-provider.ts` | LLM Provider 抽象层 + 工厂函数 |
| 4 | `server/src/modules/ai/providers/openai.ts` | OpenAI provider 实现 |
| 5 | `server/src/modules/ai/providers/anthropic.ts` | Anthropic Claude provider 实现 |
| 6 | `server/src/modules/ai/providers/deepseek.ts` | DeepSeek provider 实现 |
| 7 | `server/src/modules/ai/providers/google.ts` | Google Gemini provider 实现 |
| 8 | `server/src/modules/ai/label-parser.ts` | AI 药品说明书解析核心（prompt 模板 + 解析逻辑） |
| 9 | `server/src/plugins/ai-label-text/plugin.ts` | AI 增强版 label-text 插件 |

### 3.2 修改文件

| # | 文件路径 | 改动内容 |
|---|---------|---------|
| 1 | `server/src/core/app-context.ts` | 导入 AI 配置、创建 LLM Provider、注册 ai-label-text 插件 |
| 2 | `server/src/server.ts` | 新增 3 个路由：`GET /api/ai/config`、`PUT /api/ai/config`、`POST /api/ai/parse-label` |
| 3 | `src/pages/import-page.ts` | Import 页面新增 "AI 智能导入" tab |
| 4 | `src/components/shell.ts` | 导航栏新增 "模型设置" 按钮 |
| 5 | `src/styles.css` | 新增 AI 相关样式（模态框、confidence 指示器等） |

---

## 4. 详细设计

### 4.1 AI 类型定义 (`server/src/modules/ai/types.ts`)

```typescript
import { DrugLabelSections } from "../drug-kb/types.js";

// LLM Provider 配置
export interface LLMProviderConfig {
  provider: LLMProviderID;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export type LLMProviderID = "openai" | "anthropic" | "deepseek" | "google";

// 统一的 LLM 调用接口
export interface LLMProvider {
  readonly id: LLMProviderID;
  readonly name: string;
  chat(params: {
    system: string;
    user: string;
    json?: boolean;
  }): Promise<string>;
  isAvailable(): boolean;
}

// Provider 信息（用于前端展示）
export interface ProviderInfo {
  id: LLMProviderID;
  name: string;
  available: boolean;
  defaultModel: string;
  models: string[];
}

// AI 解析结果
export interface AIParsedDrugData {
  names: {
    generic_cn: string;
    generic_en?: string;
    brand_names?: string[];
    aliases?: string[];
  };
  classification: {
    system: string;
    primary_category: string;
    secondary_category?: string;
    pharmacologic_class?: string;
    prescription_type?: string;
    atc_code?: string;
  };
  forms: Array<{
    dosage_form: string;
    strength?: string;
    route: string;
    package_unit?: string;
    manufacturer?: string;
    approval_number?: string;
  }>;
  risk_tags: string[];
  label: DrugLabelSections;
  confidence: number;
  warnings: string[];
}

// AI 解析请求
export interface AIParseRequest {
  label_text: string;
  basic?: {
    generic_cn?: string;
    system?: string;
    primary_category?: string;
    [key: string]: unknown;
  };
}

// AI 解析响应
export interface AIParseResponse {
  success: boolean;
  provider: LLMProviderID;
  model: string;
  data?: AIParsedDrugData;
  fallback_used: boolean;
  error?: string;
  parse_time_ms: number;
}

// 运行时配置
export interface AIRuntimeConfig {
  provider: LLMProviderID;
  api_key: string;
  base_url?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  enabled: boolean;
}
```

### 4.2 LLM Provider 抽象层 (`server/src/modules/ai/llm-provider.ts`)

设计原则：
- 统一 `chat()` 接口，所有 provider 行为一致
- 错误统一捕获，返回结构化错误
- 使用 Node 20 内置 `fetch()`，零依赖

```typescript
export function createLLMProvider(config: AIRuntimeConfig): LLMProvider {
  switch (config.provider) {
    case "openai":    return new OpenAIProvider(config);
    case "anthropic": return new AnthropicProvider(config);
    case "deepseek":  return new DeepSeekProvider(config);
    case "google":    return new GoogleProvider(config);
  }
}
```

### 4.3 各 Provider 实现差异

| Provider | API 格式 | Base URL | 请求体格式 | 响应提取路径 | JSON 模式 |
|----------|---------|----------|-----------|-------------|----------|
| OpenAI | OpenAI Chat | `https://api.openai.com/v1` | `{ messages, model, response_format }` | `choices[0].message.content` | `response_format: { type: "json_object" }` |
| Anthropic | Anthropic Messages | `https://api.anthropic.com` | `{ messages, system, model }` (system 在顶层) | `content[0].text` | system prompt 中要求 JSON |
| DeepSeek | OpenAI 兼容 | `https://api.deepseek.com/v1` | 同 OpenAI | 同 OpenAI | `response_format: { type: "json_object" }` |
| Google | Gemini generateContent | `https://generativelanguage.googleapis.com/v1beta` | `{ contents, generationConfig }` | `candidates[0].content.parts[0].text` | `responseMimeType: "application/json"` |

所有 provider 统一超时 30 秒，统一错误处理。

### 4.4 Prompt 模板 (`server/src/modules/ai/label-parser.ts`)

```
System Prompt (核心):

你是一个专业的药品说明书结构化提取助手。你的任务是从药品说明书中提取标准化的结构化信息。

请输出 JSON 格式，包含以下字段：

{
  "names": {
    "generic_cn": "中文通用名（必填）",
    "generic_en": "英文通用名",
    "brand_names": ["商品名列表"],
    "aliases": ["别名列表"]
  },
  "classification": {
    "system": "药物体系（见下方选项）",
    "primary_category": "一级分类（见下方选项）",
    "secondary_category": "二级分类（见下方选项）",
    "pharmacologic_class": "药理学分类",
    "prescription_type": "处方类型",
    "atc_code": "ATC代码"
  },
  "forms": [{
    "dosage_form": "剂型（见下方选项）",
    "strength": "规格",
    "route": "给药途径（见下方选项）",
    "package_unit": "包装单位",
    "manufacturer": "生产厂家",
    "approval_number": "批准文号"
  }],
  "risk_tags": ["风险标签列表"],
  "label": {
    "composition": "成份",
    "character": "性状",
    "indications": "适应症",
    "dosage": "用法用量",
    "contraindications": "禁忌",
    "precautions": "注意事项",
    "adverse_reactions": "不良反应",
    "interactions": "药物相互作用",
    "pharmacology_toxicology": "药理毒理",
    "pharmacokinetics": "药代动力学",
    "storage": "贮藏",
    "packaging": "包装",
    "validity": "有效期",
    "standard": "执行标准",
    "approval_number": "批准文号",
    "revision_date": "修订日期",
    "special_populations": {
      "pregnancy": "妊娠期用药",
      "lactation": "哺乳期用药",
      "pediatric": "儿童用药",
      "geriatric": "老年用药",
      "renal_impairment": "肾功能不全用药",
      "hepatic_impairment": "肝功能不全用药",
      "driving_or_machines": "驾车及操作机器"
    }
  },
  "confidence": 0.85,
  "warnings": ["无法确定的字段或疑点"]
}

药物体系(system)选项：
- western_medicine (化学药物/西药)
- biologics (生物制品)
- chinese_patent_medicine (中成药)
- traditional_chinese_medicine_decoction_pieces (中药饮片)
- medical_nutrition_and_solutions (医用营养及溶液)
- diagnostic_agents (诊断用药物)
- other (其他)

一级分类(primary_category)选项（按体系）：
western_medicine: anti_infective, antiparasitic, cardiovascular, blood_and_coagulation, digestive_and_metabolism, respiratory, nervous_system_and_psychiatry, endocrine_and_metabolism, musculoskeletal_and_anti_inflammatory, genitourinary_and_sex_hormones, dermatological, sensory_organs, antineoplastic_and_immunomodulating, anesthesia_and_perioperative, emergency_and_critical_care, nutrition_electrolytes_and_vitamins, diagnostic_and_contrast_agents

biologics: vaccines, blood_products, therapeutic_antibodies, cytokines_growth_factors, insulin

chinese_patent_medicine: respiratory, digestive, cardiovascular, musculoskeletal, gynecology, pediatrics, ent_dermatology, tonic, cp_other

剂型(dosage_form)选项：tablet, capsule, granule, powder, oral_solution, syrup, injection, infusion, cream, ointment, gel, patch, eye_drop, ear_drop, nasal_spray, inhalation, suppository, other

给药途径(route)选项：oral, intravenous, intramuscular, subcutaneous, topical, ophthalmic, otic, nasal, inhalation, rectal, vaginal, other

处方类型(prescription_type)选项：prescription, OTC-A, OTC-B, restricted, unknown

风险标签(risk_tags)选项：
- allergy_check_required (需过敏检查)
- renal_adjustment_required (需肾功能调整)
- hepatic_adjustment_required (需肝功能调整)
- pregnancy_check_required (需妊娠检查)
- interaction_check_required (需相互作用检查)
- high_alert (高危药品)
- antimicrobial (抗菌药物)
- narcotic (麻醉药品)
- psychotropic (精神药品)
- toxic_drug (毒性药品)
- cold_chain (需冷链)
- protect_from_light (需避光)

规则：
1. 如果说明书文本中明确包含某字段信息，直接提取
2. 如果说明书文本中未明确包含某字段，但可以根据药品名称、分类等信息合理推断，在 warnings 中说明
3. confidence 基于提取完整度和确定性评分（0-1）
4. 尽量保持原文内容的完整性，不要过度概括
5. 特殊人群用药信息从说明书中相关段落提取，即使没有独立的标题
```

### 4.5 AI 增强版插件 (`server/src/plugins/ai-label-text/plugin.ts`)

```typescript
export const aiLabelTextPlugin: DrugImportPlugin<AILabelTextImportInput> = {
  id: "ai-label-text",
  name: "AI 智能说明书导入",
  description: "使用 AI 自动解析药品说明书，提取结构化信息。支持任意格式文本，自动推断分类。",

  async import(input, context) {
    const provider = getLLMProvider();  // 从全局配置获取
    let aiResult: AIParsedDrugData;
    let fallbackUsed = false;

    try {
      aiResult = await parseWithAI(input.label_text, provider);
    } catch (err) {
      // 降级到 regex 解析
      fallbackUsed = true;
      const regexResult = await labelTextPlugin.import(input, context);
      return {
        ...regexResult,
        notes: [
          "⚠️ AI 解析失败，已降级为规则解析",
          ...regexResult.notes,
        ],
      };
    }

    // 合并用户手动输入（用户输入优先）
    const merged = mergeUserOverrides(aiResult, input);

    return {
      frontmatter: buildFrontmatter(merged, input, context),
      label: merged.label,
      notes: [
        `🤖 AI 解析完成 (provider: ${provider.id}, confidence: ${aiResult.confidence})`,
        ...aiResult.warnings.map(w => `⚠️ ${w}`),
        "请由药师逐项校对，尤其是用法用量、禁忌和特殊人群。",
      ],
    };
  },
};
```

### 4.6 配置管理 (`server/src/modules/ai/config.ts`)

**环境变量**（`.env` 文件）：

```env
# AI 配置
AI_ENABLED=true
AI_PROVIDER=openai
AI_API_KEY=sk-your-api-key-here
AI_BASE_URL=                    # 可选，自定义 endpoint
AI_MODEL=                       # 可选，覆盖默认模型
AI_TEMPERATURE=0.3
AI_MAX_TOKENS=4096
```

**运行时配置**：

```typescript
// 内存中的运行时配置（可被前端 GUI 覆盖）
let runtimeConfig: AIRuntimeConfig = loadFromEnv();

export function getAIConfig(): AIRuntimeConfig { return runtimeConfig; }
export function updateAIConfig(patch: Partial<AIRuntimeConfig>): void {
  runtimeConfig = { ...runtimeConfig, ...patch };
}
export function resetAIConfig(): void {
  runtimeConfig = loadFromEnv();  // 恢复 .env 默认值
}
```

**API 路由**：

| Method | Path | 功能 | 请求体 | 响应 |
|--------|------|------|--------|------|
| `GET` | `/api/ai/config` | 获取当前配置 | - | `{ provider, api_key_suffix, model, base_url, temperature, max_tokens, enabled }` |
| `PUT` | `/api/ai/config` | 更新配置 | `{ provider?, api_key?, model?, ... }` | `{ success: true }` |
| `GET` | `/api/ai/providers` | 列出支持的 providers | - | `ProviderInfo[]` |
| `POST` | `/api/ai/parse-label` | AI 解析说明书 | `{ label_text, basic? }` | `AIParseResponse` |

### 4.7 前端改动

#### 4.7.1 Import 页面新增 "AI 智能导入" tab

位置：`src/pages/import-page.ts`

新增 tab 内容：
- **Provider 选择**：下拉框，显示可用 providers
- **说明书文本输入**：大文本框，placeholder "粘贴药品说明书全文..."
- **可选：补充信息**：折叠面板，允许用户预填 generic_cn 等（可选，AI 会自动识别）
- **"AI 解析" 按钮**：调用 `POST /api/ai/parse-label`
- **解析结果预览**：以表单形式展示 AI 提取的各字段，用户可编辑
- **Confidence 指示器**：显示 AI 置信度（绿/黄/红）
- **Warnings 列表**：AI 标注的疑点
- **"确认导入" 按钮**：走现有 plugin import 流程

#### 4.7.2 导航栏 "模型设置" 按钮

位置：`src/components/shell.ts`

- 在导航栏右侧新增 "⚙️ 模型设置" 按钮
- 点击打开模态框

#### 4.7.3 模型设置模态框

位置：新建 `src/components/ai-settings-modal.ts`（或内联在 shell.ts）

内容：
- **启用/禁用 AI** 开关
- **Provider 下拉框**：OpenAI / Claude / DeepSeek / Gemini
- **API Key 输入框**：密码类型，显示当前后4位
- **Base URL 输入框**：可选，用于代理或自定义 endpoint
- **Model 输入框**：可选，留空使用默认
- **Temperature 滑块**：0-1，默认 0.3
- **"测试连接" 按钮**：发送简单请求验证 API key 有效性
- **"保存" / "重置为默认" 按钮**

#### 4.7.4 新增 CSS 样式

位置：`src/styles.css`

```css
/* AI 设置模态框 */
.ai-settings-modal { ... }

/* AI 解析预览 */
.ai-parse-preview { ... }
.ai-confidence-badge { ... }         /* 绿/黄/红 */
.ai-confidence-badge.high { ... }    /* >= 0.8 绿色 */
.ai-confidence-badge.medium { ... }  /* 0.5-0.8 黄色 */
.ai-confidence-badge.low { ... }     /* < 0.5 红色 */

/* AI 导入 tab */
.import-tab-ai { ... }

/* Warnings 列表 */
.ai-warnings { ... }
.ai-warning-item { ... }
```

---

## 5. 降级策略

```
请求到达
  │
  ├─ AI_ENABLED=false → 直接使用 regex 解析（label-text plugin）
  │
  ├─ AI_ENABLED=true
  │    │
  │    ├─ provider 未配置 / apiKey 为空 → 降级 + 警告日志
  │    │
  │    ├─ 调用 LLM
  │    │    │
  │    │    ├─ 成功 (HTTP 200 + 有效 JSON)
  │    │    │    └─ 返回 AI 解析结果
  │    │    │
  │    │    ├─ 超时 (>30s)
  │    │    │    └─ 降级到 regex + notes 标注
  │    │    │
  │    │    ├─ API 错误 (401/429/500)
  │    │    │    └─ 降级到 regex + notes 标注 + 错误日志
  │    │    │
  │    │    └─ JSON 解析失败
  │    │         └─ 降级到 regex + notes 标注
  │    │
  │    └─ fallback 结果
  │         └─ 通过现有 labelTextPlugin 处理
  │
  └─ 返回结果（含 fallback_used 标记）
```

---

## 6. 安全设计

1. **API Key 保护**：
   - 存储于 `.env` 文件（已在 `.gitignore` 中）
   - `GET /api/ai/config` 返回时脱敏，仅显示后 4 位
   - 前端不持久化 API Key，仅在内存中

2. **输入验证**：
   - `label_text` 长度限制（最大 50,000 字符）
   - AI 返回结果经过 `validateAndNormalize()` 校验
   - 防止 prompt injection：system prompt 中明确指令边界

3. **输出安全**：
   - 所有 AI 生成的导入结果标记 `status: "draft"` + `review_status: "draft"`
   - 继承现有 `requiresPhysicianConfirmation: true` 设计
   - AI warnings 在 notes 中明确标注

---

## 7. 测试计划

### 7.1 单元测试

| 测试文件 | 测试内容 |
|---------|---------|
| `server/src/modules/ai/config.test.ts` | 配置加载、环境变量解析、运行时更新 |
| `server/src/modules/ai/llm-provider.test.ts` | Provider 工厂函数、统一接口 |
| `server/src/modules/ai/label-parser.test.ts` | prompt 构建、JSON 解析、fallback 逻辑 |
| `server/src/modules/ai/providers/openai.test.ts` | OpenAI 请求格式、响应解析 |
| `server/src/modules/ai/providers/anthropic.test.ts` | Anthropic 请求格式、响应解析 |

### 7.2 集成测试

| 测试 | 内容 |
|------|------|
| AI 解析端到端 | 真实说明书文本 → AI 解析 → 验证字段完整性 |
| Fallback 测试 | 模拟 AI 失败 → 验证 regex 降级 |
| 多 Provider 测试 | 分别测试 4 个 provider 的兼容性 |
| 配置切换测试 | 运行时切换 provider → 验证生效 |

### 7.3 手动测试

```bash
# 启动开发服务器
npm run dev

# 测试 AI 解析 API
curl -X POST http://localhost:8787/api/ai/parse-label \
  -H "Content-Type: application/json" \
  -d '{"label_text": "【药品名称】注射用头孢曲松钠..."}'

# 测试配置 API
curl http://localhost:8787/api/ai/config
curl -X PUT http://localhost:8787/api/ai/config \
  -H "Content-Type: application/json" \
  -d '{"provider": "deepseek", "api_key": "sk-xxx"}'
```

---

## 8. 实现顺序

| Phase | 内容 | 文件 | 依赖 |
|-------|------|------|------|
| **Phase 1** | AI 类型定义 + 配置管理 | `ai/types.ts`, `ai/config.ts` | 无 |
| **Phase 2** | LLM Provider 抽象层 + 4 个实现 | `ai/llm-provider.ts`, `ai/providers/*.ts` | Phase 1 |
| **Phase 3** | AI 药品说明书解析核心 | `ai/label-parser.ts` | Phase 2 |
| **Phase 4** | AI 增强版插件 | `plugins/ai-label-text/plugin.ts` | Phase 3 |
| **Phase 5** | 后端路由 + app-context 注册 | `server.ts`, `app-context.ts` | Phase 4 |
| **Phase 6** | 前端 UI（Import tab + 设置模态框） | `import-page.ts`, `shell.ts`, `styles.css` | Phase 5 |
| **Phase 7** | 测试 + 验证 | `*.test.ts`, smoke test | Phase 6 |

---

## 9. 后续扩展方向

本计划完成后，可进一步扩展：

1. **自然语言药品问答**：基于 drug.md 数据 + LLM 的 RAG 问答
2. **智能处方生成增强**：多药联合推荐、剂量自动计算
3. **药品知识自动补全**：缺失字段由 AI 根据药名推断
4. **批量 AI 导入**：CSV 中每行调用 AI 解析
5. **图片/扫描件 AI 解析**：集成 OCR + AI 端到端处理

---

## 10. 风险与注意事项

| 风险 | 缓解措施 |
|------|---------|
| AI 解析不准确 | confidence score + warnings + 人工校对流程 |
| API 调用成本 | 仅在用户主动触发时调用，不做批量自动调用 |
| API 限流/不可用 | 30s 超时 + 自动 fallback 到 regex |
| Prompt injection | system prompt 明确指令边界，输入长度限制 |
| API Key 泄露 | .env 管理 + 前端脱敏 + 不落盘 |
| 医疗安全风险 | 继承现有 "候选模板，非处方" 设计，所有结果需医师确认 |
