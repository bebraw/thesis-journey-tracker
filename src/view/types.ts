export interface ViewerContext {
  name: string;
  role: "editor" | "readonly";
}

export interface Metrics {
  total: number;
  noMeeting: number;
  pastTarget: number;
  submitted: number;
}

export interface DashboardPageData {
  viewer: ViewerContext;
  students: import("../db").Student[];
  selectedStudent: import("../db").Student | null;
  logs: import("../db").MeetingLog[];
  phaseAudit: import("../db").PhaseAuditEntry[];
  notice: string | null;
  error: string | null;
  metrics: Metrics;
}

export interface AddStudentPageData {
  viewer: ViewerContext;
  notice: string | null;
  error: string | null;
}

export interface DataToolsPageData {
  viewer: ViewerContext;
  notice: string | null;
  error: string | null;
  studentCount: number;
  logCount: number;
  replaceImportEnabled: boolean;
}
