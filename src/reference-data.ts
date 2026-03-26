import type { DegreeId, PhaseId } from "./db";

export interface PhaseDefinition {
  id: PhaseId;
  label: string;
}

export interface DegreeDefinition {
  id: DegreeId;
  label: string;
}

export const PHASES: PhaseDefinition[] = [
  { id: "research_plan", label: "Planning research" },
  { id: "researching", label: "Researching" },
  { id: "editing", label: "Editing" },
  { id: "submitted", label: "Submitted" },
];

export const DEGREE_TYPES: DegreeDefinition[] = [
  { id: "bsc", label: "BSc" },
  { id: "msc", label: "MSc" },
  { id: "dsc", label: "DSc" },
];
