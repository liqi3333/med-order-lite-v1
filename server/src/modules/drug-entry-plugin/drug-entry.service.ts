import { DrugRepository } from "../drug-kb/drug-repository.js";
import { stringifyDrugMarkdown, parseDrugMarkdown } from "../drug-kb/drug-md.js";
import { DrugValidator } from "../drug-kb/drug-validator.js";
import { DrugImportPlugin, DrugImportResult } from "./types.js";

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
    const prepared = this.prepareForMode(generated.frontmatter, saveMode, actor);
    const markdown = stringifyDrugMarkdown(prepared.frontmatter, generated.label);
    const document = parseDrugMarkdown(markdown);
    const validation = await this.validator.validate(document, saveMode === "publish" ? "publish" : "draft");
    let savedPath: string | undefined;
    if (saveMode === "publish") {
      if (!validation.ok) {
        return { drugId: prepared.frontmatter.id, status: "published", markdown, validation, document, notes: ["校验未通过，未写入正式药物库。", ...generated.notes] };
      }
      const saved = await this.repository.publish(prepared.frontmatter, generated.label);
      await this.repository.buildIndex(false);
      savedPath = saved.path;
    }
    const finalMarkdown = stringifyDrugMarkdown(prepared.frontmatter, generated.label);
    return { drugId: prepared.frontmatter.id, status: saveMode === "publish" ? "published" : "preview", markdown: finalMarkdown, savedPath, validation, document: parseDrugMarkdown(finalMarkdown), notes: generated.notes };
  }

  private prepareForMode(frontmatter: Parameters<typeof stringifyDrugMarkdown>[0], saveMode: "preview" | "publish", actor?: string) {
    frontmatter.review = {
      review_status: saveMode === "publish" ? "approved" : "draft",
      lifecycle: saveMode === "publish" ? "active" : "inactive",
      created_by: frontmatter.review?.created_by || actor,
      reviewed_by: saveMode === "publish" ? actor || "web-user" : frontmatter.review?.reviewed_by,
      reviewed_at: saveMode === "publish" ? new Date().toISOString().slice(0, 10) : frontmatter.review?.reviewed_at,
      updated_at: new Date().toISOString().slice(0, 10),
      version: frontmatter.review?.version || 1
    };
    return { frontmatter };
  }
}
