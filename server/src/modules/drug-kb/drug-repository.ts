import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir, listFilesRecursive, pathExists, readJsonFile, writeJsonFile } from "../../utils/fs.js";
import { parseDrugMarkdown, stringifyDrugMarkdown } from "./drug-md.js";
import { DrugDocument, DrugFrontmatter, DrugIndexItem, DrugLabelSections } from "./types.js";

export interface DrugQuery {
  q?: string;
  system?: string;
  primaryCategory?: string;
  secondaryCategory?: string;
  route?: string;
  dosageForm?: string;
  reviewStatus?: string;
  includeDrafts?: boolean;
}

export class DrugRepository {
  constructor(private readonly kbRoot: string) {}
  get drugRoot(): string { return path.join(this.kbRoot, "drugs"); }
  get indexPath(): string { return path.join(this.kbRoot, "indexes", "drugs.index.json"); }

  async publish(frontmatter: DrugFrontmatter, label: DrugLabelSections): Promise<{ path: string; markdown: string }> {
    const system = frontmatter.classification.system.replace(/_/g, "-");
    const category = frontmatter.classification.primary_category.replace(/_/g, "-");
    const filePath = path.join(this.drugRoot, system, category, `${frontmatter.id}.md`);
    const markdown = stringifyDrugMarkdown(frontmatter, label);
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, markdown, "utf8");
    return { path: filePath, markdown };
  }

  async readMarkdown(filePath: string): Promise<DrugDocument> {
    const markdown = await fs.readFile(filePath, "utf8");
    const document = parseDrugMarkdown(markdown);
    document.filePath = filePath;
    return document;
  }

  async readById(id: string, _includeDrafts = false): Promise<DrugDocument | null> {
    const files = await listFilesRecursive(this.drugRoot, ".md");
    const match = files.find((file) => path.basename(file) === `${id}.md`);
    return match ? this.readMarkdown(match) : null;
  }

  async readRawById(id: string, includeDrafts = false): Promise<string | null> {
    const document = await this.readById(id, includeDrafts);
    if (!document?.filePath) return null;
    return fs.readFile(document.filePath, "utf8");
  }

  async listAllDocuments(_includeDrafts = false): Promise<DrugDocument[]> {
    const documents: DrugDocument[] = [];
    const files = await listFilesRecursive(this.drugRoot, ".md");
    for (const file of files) documents.push(await this.readMarkdown(file));
    return documents;
  }

  toIndexItem(document: DrugDocument): DrugIndexItem {
    const fm = document.frontmatter;
    const pathForIndex = document.filePath ? path.relative(this.kbRoot, document.filePath) : "";
    const searchable = [fm.names.generic_cn, fm.names.generic_en, ...(fm.names.brand_names || []), ...(fm.names.aliases || []), fm.classification.pharmacologic_class, document.label.indications, document.label.dosage, document.label.contraindications, document.label.precautions].filter(Boolean).join("\n").toLowerCase();
    return { id: fm.id, generic_cn: fm.names.generic_cn, generic_en: fm.names.generic_en, brand_names: fm.names.brand_names || [], aliases: fm.names.aliases || [], system: fm.classification.system, primary_category: fm.classification.primary_category, secondary_category: fm.classification.secondary_category, dosage_forms: fm.forms.map((form) => form.dosage_form), routes: fm.forms.map((form) => form.route), risk_tags: fm.risk_tags || [], review_status: fm.review.review_status, lifecycle: fm.review.lifecycle, updated_at: fm.review.updated_at, version: fm.review.version, path: pathForIndex, searchable_text: searchable };
  }

  async buildIndex(_includeDrafts = false): Promise<DrugIndexItem[]> {
    const documents = await this.listAllDocuments(false);
    const index = documents.map((document) => this.toIndexItem(document));
    await writeJsonFile(this.indexPath, index);
    return index;
  }

  async readIndex(): Promise<DrugIndexItem[]> {
    if (!(await pathExists(this.indexPath))) return this.buildIndex(false);
    return readJsonFile<DrugIndexItem[]>(this.indexPath, []);
  }

  async getIndexStatus(): Promise<{ exists: boolean; count: number; indexPath: string; updatedAt?: string }> {
    if (!(await pathExists(this.indexPath))) return { exists: false, count: 0, indexPath: this.indexPath };
    const stats = await fs.stat(this.indexPath);
    const index = await readJsonFile<DrugIndexItem[]>(this.indexPath, []);
    return { exists: true, count: index.length, indexPath: this.indexPath, updatedAt: stats.mtime.toISOString() };
  }

  async query(query: DrugQuery): Promise<DrugIndexItem[]> {
    const index = await this.readIndex();
    const q = query.q?.trim().toLowerCase();
    return index.filter((item) => {
      if (item.review_status !== "approved") return false;
      if (q && !item.searchable_text.includes(q) && !item.id.toLowerCase().includes(q)) return false;
      if (query.system && item.system !== query.system) return false;
      if (query.primaryCategory && item.primary_category !== query.primaryCategory) return false;
      if (query.secondaryCategory && item.secondary_category !== query.secondaryCategory) return false;
      if (query.route && !item.routes.includes(query.route)) return false;
      if (query.dosageForm && !item.dosage_forms.includes(query.dosageForm)) return false;
      return true;
    });
  }
}
