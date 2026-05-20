import { DrugImportPlugin, LabelTextImportInput } from "../../modules/drug-entry-plugin/types.js";
import { labelTextPlugin } from "../label-text/plugin.js";

export interface LabelOcrImportInput extends Omit<LabelTextImportInput, "label_text"> {
  image_base64?: string;
  file_name?: string;
  ocr_text?: string;
}

export const labelOcrPlugin: DrugImportPlugin<LabelOcrImportInput> = {
  id: "label-ocr",
  name: "图片 / 扫描件 OCR 导入",
  description: "上传图片或扫描件，并粘贴 OCR/识别后的说明书文本，生成标准 drug.md。当前版本不内置 OCR 引擎，需人工或外部 OCR 后粘贴文本。",
  inputSchema: {
    saveMode: ["preview", "publish"],
    image_base64: "图片文件 base64，可选，用于来源追溯",
    ocr_text: "OCR 或人工识别后的说明书文本",
    basic: "药物基础信息与分类",
    forms: "剂型、规格和给药途径列表"
  },
  async import(input, context) {
    if (!input.ocr_text?.trim()) throw new Error("ocr_text 不能为空。当前版本不内置 OCR 引擎，请先用本机 OCR/手机识别/扫描软件得到文字，再粘贴到 OCR 文本框。");
    const result = await labelTextPlugin.import({
      ...input,
      label_text: input.ocr_text,
      source: { ...(input.source || {}), source_type: "ocr", file_path: input.file_name || input.source?.file_path }
    }, context);
    result.notes.unshift(`图片/OCR 导入：${input.file_name || "未命名图片"}。当前版本使用用户提供的 OCR 文本生成 drug.md，请务必人工校对剂量、规格、频次和禁忌。`);
    return result;
  }
};
