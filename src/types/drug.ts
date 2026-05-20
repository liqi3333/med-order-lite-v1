import { ReviewStatus } from "./common.js";

export type DrugIndexItem = {
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
  lifecycle: string;
  updated_at: string;
  version: number;
  path: string;
  searchable_text: string;
};

export type DrugDocumentResponse = {
  frontmatter: {
    id: string;
    names: { generic_cn: string; generic_en?: string; brand_names?: string[]; aliases?: string[] };
    classification: { system: string; primary_category: string; secondary_category?: string; pharmacologic_class?: string; prescription_type?: string };
    forms: Array<{ dosage_form: string; strength?: string; route: string; package_unit?: string; manufacturer?: string; approval_number?: string }>;
    risk_tags: string[];
    sources: Array<{ source_id: string; source_type: string; title?: string; url?: string; imported_at: string; imported_by?: string; revision_date?: string }>;
    review: { review_status: ReviewStatus; lifecycle: string; created_by?: string; reviewed_by?: string; reviewed_at?: string; updated_at: string; version: number };
  };
  label: Record<string, unknown> & {
    indications?: string;
    dosage?: string;
    contraindications?: string;
    precautions?: string;
    adverse_reactions?: string;
    interactions?: string;
    special_populations?: Record<string, string | undefined>;
  };
  filePath?: string;
};

export type DrugFilter = {
  q: string;
  system: string;
  primaryCategory: string;
  secondaryCategory: string;
  route: string;
  dosageForm: string;
};
