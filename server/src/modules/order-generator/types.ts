export interface PatientContext {
  age?: string | number;
  weight?: string | number;
  allergies?: string[];
  renalFunction?: string;
  hepaticFunction?: string;
  pregnancy?: boolean;
  lactation?: boolean;
}

export interface OrderGenerationRequest {
  drugId: string;
  diagnosis?: string;
  scenario?:
    | "outpatient"
    | "inpatient_long_term"
    | "inpatient_stat"
    | "emergency";
  patientContext?: PatientContext;
}

export interface CandidateOrderTemplate {
  drugId: string;
  drugName: string;
  diagnosis?: string;
  scenario: string;
  templateText: string;
  simplifiedTemplateText: string;
  simplified: {
    medication_name: string;
    dose: string;
    specification: string;
    route: string;
    dosage_instructions: string;
  };
  structured: {
    medication_name: string;
    dosage: string;
    route: string;
    duration: string;
    instructions: string;
  };
  sourceSections: Array<{ section: string; text: string }>;
  warnings: Array<{
    level: "info" | "warning" | "block";
    message: string;
    source?: string;
  }>;
  requiresPhysicianConfirmation: true;
  disclaimer: string;
}
