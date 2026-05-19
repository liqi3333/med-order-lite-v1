export type ReviewStatus = "draft" | "approved";
export type LifecycleStatus = "active" | "inactive" | "deprecated";

export interface DrugNames {
  generic_cn: string;
  generic_en?: string;
  brand_names?: string[];
  aliases?: string[];
}

export interface DrugClassification {
  system: string;
  primary_category: string;
  secondary_category?: string;
  pharmacologic_class?: string;
  atc_code?: string;
  prescription_type?: string;
  antimicrobial_level?: string;
}

export interface DrugForm {
  dosage_form: string;
  strength?: string;
  route: string;
  package_unit?: string;
  manufacturer?: string;
  approval_number?: string;
}

export interface DrugSource {
  source_id: string;
  source_type: "package_insert" | "manual_entry" | "external_api" | "ocr" | "website" | "hospital_policy";
  title?: string;
  url?: string;
  file_path?: string;
  imported_at: string;
  imported_by?: string;
  revision_date?: string;
}

export interface DrugReviewInfo {
  review_status: ReviewStatus;
  lifecycle: LifecycleStatus;
  created_by?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  updated_at: string;
  version: number;
}

export interface DrugFrontmatter {
  id: string;
  type: "drug";
  status?: ReviewStatus;
  names: DrugNames;
  classification: DrugClassification;
  forms: DrugForm[];
  risk_tags: string[];
  sources: DrugSource[];
  review: DrugReviewInfo;
}

export interface DrugLabelSections {
  composition?: string;
  character?: string;
  indications?: string;
  dosage?: string;
  contraindications?: string;
  precautions?: string;
  adverse_reactions?: string;
  interactions?: string;
  pharmacology_toxicology?: string;
  pharmacokinetics?: string;
  storage?: string;
  packaging?: string;
  validity?: string;
  standard?: string;
  approval_number?: string;
  revision_date?: string;
  special_populations?: {
    pregnancy?: string;
    lactation?: string;
    pediatric?: string;
    geriatric?: string;
    renal_impairment?: string;
    hepatic_impairment?: string;
    driving_or_machines?: string;
  };
}

export interface DrugDocument {
  frontmatter: DrugFrontmatter;
  label: DrugLabelSections;
  rawMarkdown: string;
  filePath?: string;
}

export interface DrugIndexItem {
  id: string;
  generic_cn: string;
  generic_en?: string;
  brand_names: string[];
  aliases: string[];
  system: string;
  primary_category: string;
  secondary_category?: string;
  dosage_forms: string[];
  routes: string[];
  risk_tags: string[];
  review_status: ReviewStatus;
  lifecycle: LifecycleStatus;
  updated_at: string;
  version: number;
  path: string;
  searchable_text: string;
}

export interface ValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  field?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}
