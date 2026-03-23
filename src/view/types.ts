export interface Metrics {
  total: number;
  noMeeting: number;
  pastTarget: number;
  submitted: number;
}

export interface DashboardPageData {
  students: import("../db").Student[];
  selectedStudent: import("../db").Student | null;
  logs: import("../db").MeetingLog[];
  notice: string | null;
  error: string | null;
  metrics: Metrics;
}

export interface AddStudentPageData {
  notice: string | null;
  error: string | null;
}

export interface DataToolsPageData {
  notice: string | null;
  error: string | null;
  studentCount: number;
  logCount: number;
}
