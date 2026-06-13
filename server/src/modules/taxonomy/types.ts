export interface TaxonomyOption {
  value: string;
  label: string;
  system?: string;
  parent?: string;
  children?: TaxonomyOption[];
  tags?: string[];
}

export interface DrugCategoriesTaxonomy {
  systems: TaxonomyOption[];
  categories: TaxonomyOption[];
}

export interface TaxonomyBundle {
  drugCategories: DrugCategoriesTaxonomy;
  dosageForms: TaxonomyOption[];
  routes: TaxonomyOption[];
  prescriptionTypes: TaxonomyOption[];
  riskTags: TaxonomyOption[];
  frequencies: TaxonomyOption[];
}
