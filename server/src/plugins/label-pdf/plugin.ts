import { DrugImportPlugin, LabelTextImportInput } from "../../modules/drug-entry-plugin/types.js";
import { labelTextPlugin } from "../label-text/plugin.js";
import { extractPdfTextFromBase64 } from "./pdf-text.js";

export interface LabelPdfImportInput extends Omit<LabelTextImportInput, "label_text"> {
  pdf_base64: string;
  file_name?: string;
}

export const labelPdfPlugin: DrugImportPlugin<LabelPdfImportInput> = {
  id: "label-pdf",
  name: "PDF 说明书导入",
  description: "上传文字型 PDF 说明书，提取 PDF 文本后复用说明书文本插件生成标准 drug.md。扫描 PDF 请使用 OCR 导入。",
  inputSchema: {
    saveMode: ["preview", "publish"],
    pdf_base64: "PDF 文件 base64 内容",
    basic: "药物基础信息与分类",
    forms: "剂型、规格和给药途径列表"
  },
  async import(input, context) {
    if (!input.pdf_base64) throw new Error("pdf_base64 不能为空，请上传 PDF 文件。");
    const extracted = extractPdfTextFromBase64(input.pdf_base64);
    if (!extracted.text.trim()) throw new Error(`${extracted.notes.join(" ")} 未能提取文字，无法生成 drug.md。`);
    const result = await labelTextPlugin.import({
      ...input,
      label_text: extracted.text,
      source: { ...(input.source || {}), source_type: "package_insert", file_path: input.file_name || input.source?.file_path }
    }, context);
    result.notes.unshift(...extracted.notes, `PDF 文件：${input.file_name || "未命名 PDF"}`);
    return result;
  }
};
