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
