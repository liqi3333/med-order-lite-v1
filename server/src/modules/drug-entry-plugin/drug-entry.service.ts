import { DrugRepository } from "../drug-kb/drug-repository.js";
import { stringifyDrugMarkdown, parseDrugMarkdown } from "../drug-kb/drug-md.js";
import { DrugValidator } from "../drug-kb/drug-validator.js";
import { DrugBatchImportResult, DrugImportPlugin, DrugImportResult, GeneratedDrugDocument } from "./types.js";
import { DrugFrontmatter } from "../drug-kb/types.js";

export class DrugEntryPluginRegistry {
  private readonly plugins = new Map<string, DrugImportPlugin<unknown>>();
  register(plugin: DrugImportPlugin<unknown>): void {
    if (this.plugins.has(plugin.id)) throw new Error(`重复插件 id：${plugin.id}`);
    this.plugins.set(plugin.id, plugin);
  }
  list(): Array<{ id: string; name: string; description: string; inputSchema: Record<string, unknown> }> {
    return Array.from(this.plugins.values()).map((plugin) => ({ id: plugin.id, name: plugin.name, description: plugin.description, inputSchema: plugin.inputSchema }));
  }
  get(id: string): DrugImportPlugin<unknown> | null { return this.plugins.get(id) || null; }
}

export class DrugEntryService {
  constructor(private readonly registry: DrugEntryPluginRegistry, private readonly repository: DrugRepository, private readonly validator: DrugValidator) {}
  listPlugins(): Array<{ id: string; name: string; description: string; inputSchema: Record<string, unknown> }> { return this.registry.list(); }

  async importWithPlugin(pluginId: string, input: Record<string, unknown>): Promise<DrugImportResult> {
    const plugin = this.registry.get(pluginId);
    if (!plugin) throw new Error(`未找到药物导入插件：${pluginId}`);
    const saveMode = String(input.saveMode || "preview") as "preview" | "publish";
    const actor = typeof input.actor === "string" ? input.actor : undefined;
    const generated = await plugin.import(input, { now: new Date().toISOString(), actor });
    return this.prepareValidateAndMaybeSave(generated, saveMode, actor, generated.notes);
  }

  async importBatchWithPlugin(pluginId: string, input: Record<string, unknown>): Promise<DrugBatchImportResult> {
    const plugin = this.registry.get(pluginId);
    if (!plugin) throw new Error(`未找到药物导入插件：${pluginId}`);
    if (!plugin.importBatch) throw new Error(`插件 ${pluginId} 不支持批量导入。`);
    const saveMode = String(input.saveMode || "preview") as "preview" | "publish";
    const actor = typeof input.actor === "string" ? input.actor : undefined;
    const generatedList = await plugin.importBatch(input, { now: new Date().toISOString(), actor });
    const results: DrugImportResult[] = [];
    const errors: Array<{ row?: number; drugId?: string; message: string }> = [];

    for (const [index, generated] of generatedList.entries()) {
      try {
        const result = await this.prepareValidateAndMaybeSave(generated, saveMode, actor, generated.notes, { skipIndex: true });
        results.push(result);
        if (saveMode === "publish" && !result.validation.ok) {
          errors.push({ row: index + 2, drugId: result.drugId, message: "校验未通过，未写入正式药物库。" });
        }
      } catch (error) {
        errors.push({ row: index + 2, drugId: generated.frontmatter.id, message: error instanceof Error ? error.message : String(error) });
      }
    }

    let indexRebuilt: boolean | undefined;
    let indexCount: number | undefined;
    let indexWarning: string | undefined;
    if (saveMode === "publish" && results.some((item) => item.savedPath)) {
      try {
        const index = await this.repository.buildIndex(false);
        indexRebuilt = true;
        indexCount = index.length;
        for (const item of results) {
          if (item.savedPath) {
            item.indexRebuilt = true;
            item.indexCount = index.length;
            item.notes.push(`批量导入完成后索引已重建。当前索引药物数：${index.length}。`);
          }
        }
      } catch (error) {
        indexRebuilt = false;
        indexWarning = error instanceof Error ? error.message : String(error);
        for (const item of results) {
          if (item.savedPath) {
            item.indexRebuilt = false;
            item.indexWarning = indexWarning;
            item.notes.push(`批量导入保存成功，但索引重建失败，请手动重建索引。${indexWarning ? `错误：${indexWarning}` : ""}`);
          }
        }
      }
    }

    return {
      pluginId,
      status: saveMode === "publish" ? "published" : "preview",
      total: generatedList.length,
      succeeded: results.filter((item) => saveMode === "preview" ? item.validation.ok : !!item.savedPath).length,
      failed: errors.length,
      results,
      errors,
      indexRebuilt,
      indexCount,
      indexWarning
    };
  }

  private async prepareValidateAndMaybeSave(
    generated: GeneratedDrugDocument,
    saveMode: "preview" | "publish",
    actor: string | undefined,
    baseNotes: string[],
    options: { skipIndex?: boolean } = {}
  ): Promise<DrugImportResult> {
    const prepared = this.prepareForMode(generated.frontmatter, saveMode, actor);
    const markdown = stringifyDrugMarkdown(prepared.frontmatter, generated.label);
    const document = parseDrugMarkdown(markdown);
    const validation = await this.validator.validate(document, saveMode === "publish" ? "publish" : "draft");
    let savedPath: string | undefined;
    let indexRebuilt: boolean | undefined;
    let indexCount: number | undefined;
    let indexWarning: string | undefined;
    const notes = [...baseNotes];

    if (saveMode === "publish") {
      if (!validation.ok) {
        return { drugId: prepared.frontmatter.id, status: "published", markdown, validation, document, notes: ["校验未通过，未写入正式药物库。", ...notes], indexRebuilt: false };
      }
      const saved = await this.repository.publish(prepared.frontmatter, generated.label);
      savedPath = saved.path;
      if (!options.skipIndex) {
        try {
          const index = await this.repository.buildIndex(false);
          indexRebuilt = true;
          indexCount = index.length;
          notes.push(`索引已自动重建。当前索引药物数：${index.length}。`);
        } catch (error) {
          indexRebuilt = false;
          indexWarning = error instanceof Error ? error.message : String(error);
          notes.push(`药物已保存，但索引自动重建失败，请在药物库页面点击“重建索引”。${indexWarning ? `错误：${indexWarning}` : ""}`);
        }
      }
    }

    const finalMarkdown = stringifyDrugMarkdown(prepared.frontmatter, generated.label);
    return { drugId: prepared.frontmatter.id, status: saveMode === "publish" ? "published" : "preview", markdown: finalMarkdown, savedPath, validation, document: parseDrugMarkdown(finalMarkdown), notes, indexRebuilt, indexCount, indexWarning };
  }

  private prepareForMode(frontmatter: DrugFrontmatter, saveMode: "preview" | "publish", actor?: string): { frontmatter: DrugFrontmatter } {
    const now = new Date().toISOString();
    const date = now.slice(0, 10);
    const next = structuredClone(frontmatter) as DrugFrontmatter;
    next.status = saveMode === "publish" ? "approved" : "draft";
    next.review = {
      ...next.review,
      review_status: saveMode === "publish" ? "approved" : "draft",
      lifecycle: saveMode === "publish" ? "active" : "inactive",
      created_by: next.review.created_by || actor,
      reviewed_by: saveMode === "publish" ? (actor || next.review.reviewed_by || "local_user") : next.review.reviewed_by,
      reviewed_at: saveMode === "publish" ? date : next.review.reviewed_at,
      updated_at: date,
      version: next.review.version || 1
    };
    next.sources = (next.sources || []).map((source) => ({ ...source, imported_by: source.imported_by || actor, imported_at: source.imported_at || now }));
    return { frontmatter: next };
  }
}
