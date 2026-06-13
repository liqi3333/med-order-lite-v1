import { getConfig } from "./config.js";
import { TaxonomyService } from "../modules/taxonomy/taxonomy.service.js";
import { DrugRepository } from "../modules/drug-kb/drug-repository.js";
import { DrugValidator } from "../modules/drug-kb/drug-validator.js";
import { DrugEntryPluginRegistry, DrugEntryService } from "../modules/drug-entry-plugin/drug-entry.service.js";
import { OrderGeneratorService } from "../modules/order-generator/order-generator.service.js";
import { manualDrugMdPlugin } from "../plugins/manual-drug-md/plugin.js";
import { labelTextPlugin } from "../plugins/label-text/plugin.js";
import { excelCsvPlugin } from "../plugins/excel-csv/plugin.js";
import { labelPdfPlugin } from "../plugins/label-pdf/plugin.js";
import { labelOcrPlugin } from "../plugins/label-ocr/plugin.js";

export function createAppContext() {
  const config = getConfig();
  const taxonomyService = new TaxonomyService(config.kbRoot);
  const drugRepository = new DrugRepository(config.kbRoot);
  const drugValidator = new DrugValidator(taxonomyService);
  const pluginRegistry = new DrugEntryPluginRegistry();
  pluginRegistry.register(manualDrugMdPlugin);
  pluginRegistry.register(labelTextPlugin);
  pluginRegistry.register(excelCsvPlugin);
  pluginRegistry.register(labelPdfPlugin);
  pluginRegistry.register(labelOcrPlugin);
  const drugEntryService = new DrugEntryService(pluginRegistry, drugRepository, drugValidator);
  const orderGeneratorService = new OrderGeneratorService(drugRepository, taxonomyService);
  return { config, taxonomyService, drugRepository, drugValidator, drugEntryService, orderGeneratorService };
}

export type AppContext = ReturnType<typeof createAppContext>;
