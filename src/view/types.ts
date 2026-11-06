import type { MeetingLog, PhaseAuditEntry, Student } from "../students/store";
import type { DashboardLaneDefinition } from "../dashboard-lanes";

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
  scope: "active" | "archived";
  search: string;
  degree: string;
  phase: string;
  status: string;
  viewMode: "list" | "phases" | "gantt";
  sortKey: string;
  sortDirection: "asc" | "desc";
}

export interface DashboardPageData {
  viewer: ViewerContext;
  students: Student[];
  selectedStudent: Student | null;
  logs: MeetingLog[];
  phaseAudit: PhaseAuditEntry[];
  dashboardLanes: DashboardLaneDefinition[];
  filters: DashboardFilters;
  notice: string | null;
  error: string | null;
  metrics: Metrics;
  activeStudentCount: number;
  archivedStudentCount: number;
  timeZone: string;
  showStyleGuide: boolean;
}

export interface AddStudentPageData {
  viewer: ViewerContext;
  dashboardLanes: DashboardLaneDefinition[];
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
  dashboardLanes: DashboardLaneDefinition[];
  storedDashboardLanesUpdatedAt: string | null;
  usingDefaultDashboardLanes: boolean;
}
