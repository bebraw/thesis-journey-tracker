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

export interface DashboardFilters {
  search: string;
  degree: string;
  phase: string;
  status: string;
  sortKey: string;
  sortDirection: "asc" | "desc";
}

export interface DashboardPageData {
  viewer: ViewerContext;
  students: import("../db").Student[];
  selectedStudent: import("../db").Student | null;
  logs: import("../db").MeetingLog[];
  phaseAudit: import("../db").PhaseAuditEntry[];
  filters: DashboardFilters;
  notice: string | null;
  error: string | null;
  metrics: Metrics;
  showStyleGuide: boolean;
}

export interface AddStudentPageData {
  viewer: ViewerContext;
  notice: string | null;
  error: string | null;
  showStyleGuide: boolean;
}

export interface DataToolsPageData {
  viewer: ViewerContext;
  notice: string | null;
  error: string | null;
  studentCount: number;
  logCount: number;
  replaceImportEnabled: boolean;
}
