import path from "node:path";
import { readJsonFile } from "../../utils/fs.js";
import { DrugCategoriesTaxonomy, TaxonomyBundle, TaxonomyOption } from "./types.js";

export class TaxonomyService {
  constructor(private readonly kbRoot: string) {}

  private taxonomyPath(name: string): string {
    return path.join(this.kbRoot, "taxonomies", `${name}.json`);
  }

  async getDrugCategories(): Promise<DrugCategoriesTaxonomy> {
    return readJsonFile<DrugCategoriesTaxonomy>(this.taxonomyPath("drug-categories"), { systems: [], categories: [] });
  }

  async getOptions(name: "dosage-forms" | "routes" | "prescription-types" | "risk-tags" | "frequencies"): Promise<TaxonomyOption[]> {
    return readJsonFile<TaxonomyOption[]>(this.taxonomyPath(name), []);
  }

  async getBundle(): Promise<TaxonomyBundle> {
    const [drugCategories, dosageForms, routes, prescriptionTypes, riskTags, frequencies] = await Promise.all([
      this.getDrugCategories(),
      this.getOptions("dosage-forms"),
      this.getOptions("routes"),
      this.getOptions("prescription-types"),
      this.getOptions("risk-tags"),
      this.getOptions("frequencies")
    ]);
    return { drugCategories, dosageForms, routes, prescriptionTypes, riskTags, frequencies };
  }

  async isValidSystem(system: string): Promise<boolean> {
    const taxonomy = await this.getDrugCategories();
    return taxonomy.systems.some((item) => item.value === system);
  }

  async isValidCategory(system: string, category: string): Promise<boolean> {
    const taxonomy = await this.getDrugCategories();
    return taxonomy.categories.some((item) => item.value === category && (!item.system || item.system === system));
  }

  async isValidSecondaryCategory(primaryCategory: string, secondaryCategory?: string): Promise<boolean> {
    if (!secondaryCategory) return true;
    const taxonomy = await this.getDrugCategories();
    const category = taxonomy.categories.find((item) => item.value === primaryCategory);
    return Boolean(category?.children?.some((item) => item.value === secondaryCategory));
  }

  async isValidOption(name: "dosage-forms" | "routes" | "prescription-types" | "risk-tags" | "frequencies", value: string): Promise<boolean> {
    const options = await this.getOptions(name);
    return options.some((item) => item.value === value);
  }
}
