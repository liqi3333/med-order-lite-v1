import { slugify } from "../../utils/fs.js";
import {
  DrugImportPlugin,
  LabelTextImportInput,
} from "../../modules/drug-entry-plugin/types.js";
import { labelTextPlugin } from "../label-text/plugin.js";
import { createLLMProvider } from "../../modules/ai/llm-provider.js";
import { getAIConfig } from "../../modules/ai/config.js";
import { parseWithAI } from "../../modules/ai/label-parser.js";
import type { AIParsedDrugData } from "../../modules/ai/types.js";

interface AILabelTextImportInput extends LabelTextImportInput {
  ai_mode?: boolean;
}

function mergeUserOverrides(
  aiData: AIParsedDrugData,
  input: LabelTextImportInput,
): AIParsedDrugData {
  const result = { ...aiData };

  if (input.basic?.generic_cn?.trim()) {
    result.names = { ...result.names, generic_cn: input.basic.generic_cn.trim() };
  }
  if (input.basic?.generic_en?.trim()) {
    result.names = { ...result.names, generic_en: input.basic.generic_en.trim() };
  }
  if (input.basic?.brand_names?.length) {
    result.names = { ...result.names, brand_names: input.basic.brand_names };
  }
  if (input.basic?.system) {
    result.classification = { ...result.classification, system: input.basic.system };
  }
  if (input.basic?.primary_category) {
    result.classification = { ...result.classification, primary_category: input.basic.primary_category };
  }
  if (input.basic?.secondary_category) {
    result.classification = { ...result.classification, secondary_category: input.basic.secondary_category };
  }
  if (input.basic?.pharmacologic_class) {
    result.classification = { ...result.classification, pharmacologic_class: input.basic.pharmacologic_class };
  }
  if (input.basic?.prescription_type) {
    result.classification = { ...result.classification, prescription_type: input.basic.prescription_type };
  }
  if (input.forms?.length) {
    result.forms = input.forms;
  }
  if (input.risk_tags?.length) {
    result.risk_tags = input.risk_tags;
  }

  return result;
}

function buildFrontmatter(
  merged: AIParsedDrugData,
  input: LabelTextImportInput,
  context: { now: string; actor?: string },
) {
  const id = input.basic?.id?.trim() || `drug-${slugify(merged.names.generic_cn)}`;
  const sourceType = input.source?.source_type || "package_insert";

  return {
    id,
    type: "drug" as const,
    status: "draft" as const,
    names: {
      generic_cn: merged.names.generic_cn,
      generic_en: merged.names.generic_en || undefined,
      brand_names: merged.names.brand_names || [],
      aliases: merged.names.aliases || [],
    },
    classification: {
      system: merged.classification.system,
      primary_category: merged.classification.primary_category,
      secondary_category: merged.classification.secondary_category || undefined,
      pharmacologic_class: merged.classification.pharmacologic_class || undefined,
      prescription_type: merged.classification.prescription_type || undefined,
    },
    forms: merged.forms.length > 0 ? merged.forms : (input.forms || []),
    risk_tags: merged.risk_tags.length > 0 ? merged.risk_tags : (input.risk_tags || []),
    sources: [
      {
        source_id: `source-${id}-${Date.now()}`,
        source_type: sourceType,
        title: input.source?.title || `${merged.names.generic_cn}说明书`,
        url: input.source?.url,
        file_path: input.source?.file_path,
        imported_at: context.now,
        imported_by: context.actor,
        revision_date: input.source?.revision_date || merged.label.revision_date || undefined,
      },
    ],
    review: {
      review_status: "draft" as const,
      lifecycle: "inactive" as const,
      created_by: context.actor,
      updated_at: context.now.slice(0, 10),
      version: 1,
    },
  };
}

export const aiLabelTextPlugin: DrugImportPlugin<AILabelTextImportInput> = {
  id: "ai-label-text",
  name: "AI 智能说明书导入",
  description:
    "使用 AI 自动解析药品说明书文本，自动提取药物名称、分类、剂型、标签内容等结构化信息。支持任意格式文本，自动推断分类。",
  inputSchema: {
    saveMode: ["preview", "publish"],
    ai_mode: "是否启用 AI 解析（默认 true）",
    basic: "药物基础信息（可选，AI 会自动提取）",
    forms: "剂型、规格和给药途径列表（可选）",
    label_text: "说明书全文文本",
    source: "说明书来源",
  },

  async import(input, context) {
    const genericCn = input.basic?.generic_cn?.trim();
    if (!genericCn) throw new Error("basic.generic_cn 不能为空");
    if (!input.label_text?.trim())
      throw new Error("label_text 不能为空，请粘贴药品说明书文本。");

    const aiEnabled = input.ai_mode !== false;
    let aiResult: AIParsedDrugData | null = null;
    let fallbackUsed = false;

    if (aiEnabled) {
      const config = getAIConfig();
      if (config.enabled && config.api_key) {
        try {
          const provider = createLLMProvider(config);
          if (provider.isAvailable()) {
            aiResult = await parseWithAI(input.label_text, provider);
          }
        } catch (err) {
          console.error("AI 解析失败，降级到规则解析:", err);
          fallbackUsed = true;
        }
      } else {
        fallbackUsed = true;
      }
    } else {
      fallbackUsed = true;
    }

    if (aiResult) {
      const merged = mergeUserOverrides(aiResult, input);
      const frontmatter = buildFrontmatter(merged, input, context);

      return {
        frontmatter,
        label: merged.label,
        notes: [
          `🤖 AI 解析完成 (provider: ${getAIConfig().provider}, confidence: ${aiResult.confidence})`,
          ...aiResult.warnings.map((w) => `⚠️ ${w}`),
          `已提取 ${Object.keys(merged.label).filter((k) => {
            const v = merged.label[k as keyof typeof merged.label];
            return typeof v === "string" && v.trim();
          }).length} 个标签字段。`,
          "请由药师逐项校对，尤其是用法用量、禁忌和特殊人群。",
        ],
      };
    }

    const regexResult = await labelTextPlugin.import(input, context);
    return {
      ...regexResult,
      notes: [
        fallbackUsed ? "⚠️ AI 未启用或解析失败，已降级为规则解析" : "",
        ...regexResult.notes,
      ].filter(Boolean),
    };
  },
};
