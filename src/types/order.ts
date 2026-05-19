export type CandidateOrderTemplate = {
  drugId: string;
  drugName: string;
  scenario: string;
  templateText: string;
  structured: { medication_name: string; dosage: string; route: string; frequency: string; duration: string; instructions: string };
  sourceSections: Array<{ section: string; text: string }>;
  warnings: Array<{ level: "info" | "warning" | "block"; message: string; source?: string }>;
  requiresPhysicianConfirmation: true;
  disclaimer: string;
};
