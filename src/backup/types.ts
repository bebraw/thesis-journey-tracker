import type { MeetingLog, PhaseAuditEntry, Student } from "../students/store";

export interface R2HttpMetadata {
  contentDisposition?: string;
  contentType?: string;
  cacheControl?: string;
}

export interface R2PutOptions {
  httpMetadata?: R2HttpMetadata;
  customMetadata?: Record<string, string>;
}

export interface R2ObjectLike {
  key: string;
}

export interface R2ListOptions {
  cursor?: string;
  limit?: number;
  prefix?: string;
}

export interface R2ListResult {
  objects: R2ObjectLike[];
  truncated?: boolean;
  cursor?: string;
}

export interface R2ObjectBodyLike {
  text(): Promise<string>;
}

export interface R2BucketLike {
  put(key: string, value: string, options?: R2PutOptions): Promise<unknown>;
  list?(options?: R2ListOptions): Promise<R2ListResult>;
  get?(key: string): Promise<R2ObjectBodyLike | null>;
}

export interface AutomatedBackupManifest {
  app: "thesis-journey-tracker";
  backupVersion: 1;
  generatedAt: string;
  cron: string;
  contentHash: string;
  counts: {
    students: number;
    meetingLogs: number;
    phaseChanges: number;
  };
  artifacts: {
    jsonExportKey: string;
    professorReportKey: string;
  };
}

export interface AutomatedBackupResult {
  skipped: boolean;
  contentHash: string;
  manifest: AutomatedBackupManifest | null;
  manifestKey: string | null;
  matchedManifestKey: string | null;
}

export interface StudentBackupBundle {
  student: Student;
  logs: MeetingLog[];
  phaseAudit: PhaseAuditEntry[];
}
