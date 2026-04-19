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
  search: string;
  degree: string;
  phase: string;
  status: string;
  viewMode: "list" | "phases";
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
  timeZone: string;
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
  dashboardLanes: DashboardLaneDefinition[];
  storedDashboardLanesUpdatedAt: string | null;
  usingDefaultDashboardLanes: boolean;
  googleCalendarConfigSource: "stored_api" | "stored_ical" | "none";
  storedGoogleCalendarUpdatedAt: string | null;
  effectiveGoogleCalendarId: string | null;
  effectiveGoogleCalendarTimeZone: string | null;
  googleCalendarClientId: string;
  googleCalendarClientSecret: string;
  googleCalendarRefreshToken: string;
  googleCalendarCalendarId: string;
  googleCalendarIcalUrl: string;
  googleCalendarTimeZone: string;
}

export interface ScheduleSlotViewData {
  label: string;
  href: string;
  selected: boolean;
}

export interface ScheduleEventViewData {
  summary: string;
  timeText: string;
  description: string | null;
  htmlLink: string | null;
}

export interface ScheduleDayViewData {
  label: string;
  hasEvents: boolean;
  hasSlots: boolean;
  events: ScheduleEventViewData[];
  slots: ScheduleSlotViewData[];
}

export interface ScheduleStudentOptionViewData {
  value: string;
  label: string;
  selected: boolean;
}

export interface SchedulePageData {
  viewer: ViewerContext;
  notice: string | null;
  error: string | null;
  showStyleGuide: boolean;
  configured: boolean;
  sourceMode: "api" | "ical" | null;
  syncFailed: boolean;
  timeZone: string;
  weekLabel: string;
  prevWeekHref: string;
  nextWeekHref: string;
  currentWeekHref: string;
  selectedWeek: string;
  selectedSlotHref: string | null;
  students: ScheduleStudentOptionViewData[];
  selectedStudentId: string;
  selectedStudentName: string | null;
  selectedStudentEmail: string;
  selectedSlotLabel: string | null;
  selectedSlotStart: string | null;
  selectedSlotEnd: string | null;
  defaultTitle: string;
  defaultDescription: string;
  days: ScheduleDayViewData[];
}
