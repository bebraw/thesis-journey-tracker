import {
  listLogsForStudent,
  listPhaseAuditEntriesForStudent,
  listStudents,
  type D1Database,
  type MeetingLog,
  type PhaseAuditEntry,
  type Student,
} from "./db";
import { buildExportFilename, buildProfessorReportFilename, createDataExport, createProfessorStatusReport } from "./import-export";

export interface R2HttpMetadata {
  contentDisposition?: string;
  contentType?: string;
  cacheControl?: string;
}

export interface R2PutOptions {
  httpMetadata?: R2HttpMetadata;
  customMetadata?: Record<string, string>;
}

export interface R2BucketLike {
  put(key: string, value: string, options?: R2PutOptions): Promise<unknown>;
}

export interface AutomatedBackupManifest {
  app: "thesis-journey-tracker";
  backupVersion: 1;
  generatedAt: string;
  cron: string;
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
  manifest: AutomatedBackupManifest;
  manifestKey: string;
}

interface StudentBackupBundle {
  student: Student;
  logs: MeetingLog[];
  phaseAudit: PhaseAuditEntry[];
}

const DEFAULT_BACKUP_PREFIX = "automated-backups";

export async function runAutomatedBackup(
  db: D1Database,
  bucket: R2BucketLike,
  options: {
    backupPrefix?: string | null;
    cron: string;
    timestamp?: Date;
  },
): Promise<AutomatedBackupResult> {
  const timestamp = options.timestamp || new Date();
  const studentBundles = await collectStudentBackupBundles(db);
  const exportedAt = timestamp.toISOString();
  const prefix = buildAutomatedBackupPrefix(timestamp, options.backupPrefix);
  const jsonExportKey = `${prefix}/${buildExportFilename(timestamp)}`;
  const professorReportKey = `${prefix}/${buildProfessorReportFilename(timestamp)}`;
  const manifestKey = `${prefix}/backup-manifest.json`;

  const jsonExport = JSON.stringify(createDataExport(studentBundles), null, 2);
  const professorReport = createProfessorStatusReport(
    studentBundles.map(({ student, logs }) => ({
      student,
      latestLog: logs[0] || null,
    })),
    timestamp,
  );

  const meetingLogCount = studentBundles.reduce((total, bundle) => total + bundle.logs.length, 0);
  const phaseChangeCount = studentBundles.reduce((total, bundle) => total + bundle.phaseAudit.length, 0);

  const manifest: AutomatedBackupManifest = {
    app: "thesis-journey-tracker",
    backupVersion: 1,
    generatedAt: exportedAt,
    cron: options.cron,
    counts: {
      students: studentBundles.length,
      meetingLogs: meetingLogCount,
      phaseChanges: phaseChangeCount,
    },
    artifacts: {
      jsonExportKey,
      professorReportKey,
    },
  };

  const customMetadata = {
    app: manifest.app,
    generatedAt: manifest.generatedAt,
    cron: manifest.cron,
    students: String(manifest.counts.students),
    meetingLogs: String(manifest.counts.meetingLogs),
    phaseChanges: String(manifest.counts.phaseChanges),
  };

  await Promise.all([
    bucket.put(jsonExportKey, jsonExport, {
      httpMetadata: {
        cacheControl: "no-store",
        contentDisposition: `attachment; filename="${buildExportFilename(timestamp)}"`,
        contentType: "application/json; charset=utf-8",
      },
      customMetadata,
    }),
    bucket.put(professorReportKey, professorReport, {
      httpMetadata: {
        cacheControl: "no-store",
        contentDisposition: `attachment; filename="${buildProfessorReportFilename(timestamp)}"`,
        contentType: "text/markdown; charset=utf-8",
      },
      customMetadata,
    }),
  ]);

  await bucket.put(manifestKey, JSON.stringify(manifest, null, 2), {
    httpMetadata: {
      cacheControl: "no-store",
      contentType: "application/json; charset=utf-8",
    },
    customMetadata,
  });

  return {
    manifest,
    manifestKey,
  };
}

export function normalizeBackupPrefix(prefix: string | null | undefined): string {
  const trimmed = (prefix || DEFAULT_BACKUP_PREFIX).trim().replace(/^\/+|\/+$/g, "");
  return trimmed || DEFAULT_BACKUP_PREFIX;
}

function buildAutomatedBackupPrefix(timestamp: Date, rawPrefix: string | null | undefined): string {
  const prefix = normalizeBackupPrefix(rawPrefix);
  const [year, month, day] = timestamp.toISOString().slice(0, 10).split("-");
  const timestampSlug = timestamp.toISOString().replace(/[:.]/g, "-");
  return `${prefix}/${year}/${month}/${day}/${timestampSlug}`;
}

async function collectStudentBackupBundles(db: D1Database): Promise<StudentBackupBundle[]> {
  const students = await listStudents(db);
  return Promise.all(
    students.map(async (student) => ({
      student,
      logs: await listLogsForStudent(db, student.id),
      phaseAudit: await listPhaseAuditEntriesForStudent(db, student.id),
    })),
  );
}
