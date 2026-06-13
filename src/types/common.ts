export type ReviewStatus = "draft" | "approved";
export type ToastTone = "info" | "success" | "warning" | "danger";
export type TaxonomyOption = { value: string; label: string };
export type DrugCategory = TaxonomyOption & { system?: string; children?: TaxonomyOption[] };
export type TaxonomyBundle = {
  drugCategories: { systems: TaxonomyOption[]; categories: DrugCategory[] };
  dosageForms: TaxonomyOption[];
  routes: TaxonomyOption[];
  prescriptionTypes: TaxonomyOption[];
  riskTags: TaxonomyOption[];
  frequencies: TaxonomyOption[];
};
