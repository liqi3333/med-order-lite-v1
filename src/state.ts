import { TaxonomyBundle } from "./types/common.js";
import { DrugIndexItem } from "./types/drug.js";

export const state: {
  backendOnline: boolean;
  backendMessage: string;
  taxonomies: TaxonomyBundle | null;
  drugs: DrugIndexItem[];
  aiModel: string;
  aiProvider: string;
  aiEnabled: boolean;
} = {
  backendOnline: false,
  backendMessage: "后端尚未连接",
  taxonomies: null,
  drugs: [],
  aiModel: "",
  aiProvider: "",
  aiEnabled: false,
};
