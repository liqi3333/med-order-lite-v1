import { DrugDocument, DrugFrontmatter, DrugLabelSections, ValidationResult } from "../drug-kb/types.js";

export interface DrugImportContext { now: string; actor?: string; }
export interface DrugImportResult {
  drugId: string;
  status: "preview" | "published";
  markdown: string;
  savedPath?: string;
  validation: ValidationResult;
  document: DrugDocument;
  notes: string[];
}
export interface DrugImportPlugin<I = unknown> {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  import(input: I, context: DrugImportContext): Promise<{ frontmatter: DrugFrontmatter; label: DrugLabelSections; notes: string[] }>;
}
export interface ManualDrugInput {
  saveMode?: "preview" | "publish";
  actor?: string;
  frontmatter: DrugFrontmatter;
  label: DrugLabelSections;
}
export interface LabelTextImportInput {
  saveMode?: "preview" | "publish";
  actor?: string;
  basic: { generic_cn: string; generic_en?: string; brand_names?: string[]; aliases?: string[]; system: string; primary_category: string; secondary_category?: string; pharmacologic_class?: string; prescription_type?: string; };
  forms: Array<{ dosage_form: string; strength?: string; route: string; package_unit?: string; manufacturer?: string; approval_number?: string; }>;
  risk_tags?: string[];
  label_text: string;
  source?: { title?: string; url?: string; file_path?: string; source_type?: "package_insert" | "manual_entry" | "external_api" | "ocr" | "website" | "hospital_policy"; revision_date?: string; };
}
