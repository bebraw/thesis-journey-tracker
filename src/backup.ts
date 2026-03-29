import {
  listLogsForStudent,
  listPhaseAuditEntriesForStudent,
  listStudents,
  type D1Database,
  type MeetingLog,
  type PhaseAuditEntry,
  type Student,
} from "./db";
import {
  buildExportFilename,
  buildProfessorReportFilename,
  createDataExport,
  createProfessorStatusReport,
  type DataExportFile,
} from "./import-export";

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

interface StudentBackupBundle {
  student: Student;
  logs: MeetingLog[];
  phaseAudit: PhaseAuditEntry[];
}

const DEFAULT_BACKUP_PREFIX = "automated-backups";
const BACKUP_MANIFEST_FILENAME = "backup-manifest.json";

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
  const dataExport = createDataExport(studentBundles);
  dataExport.exportedAt = exportedAt;
  const contentHash = await createDataExportContentHash(dataExport);
  const normalizedPrefix = normalizeBackupPrefix(options.backupPrefix);
  const latestStoredBackup = await findLatestStoredBackup(bucket, normalizedPrefix);

  if (latestStoredBackup?.contentHash === contentHash) {
    return {
      skipped: true,
      contentHash,
      manifest: null,
      manifestKey: null,
      matchedManifestKey: latestStoredBackup.manifestKey,
    };
  }

  const prefix = buildAutomatedBackupPrefix(timestamp, options.backupPrefix);
  const jsonExportKey = `${prefix}/${buildExportFilename(timestamp)}`;
  const professorReportKey = `${prefix}/${buildProfessorReportFilename(timestamp)}`;
  const manifestKey = `${prefix}/${BACKUP_MANIFEST_FILENAME}`;

  const jsonExport = JSON.stringify(dataExport, null, 2);
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
    contentHash,
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
    contentHash: manifest.contentHash,
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
    skipped: false,
    contentHash,
    manifest,
    manifestKey,
    matchedManifestKey: null,
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
  const students = await listStudents(db, { includeArchived: true });
  return Promise.all(
    students.map(async (student) => ({
      student,
      logs: await listLogsForStudent(db, student.id),
      phaseAudit: await listPhaseAuditEntriesForStudent(db, student.id),
    })),
  );
}

async function createDataExportContentHash(dataExport: DataExportFile): Promise<string> {
  const stableContent = JSON.stringify({
    app: dataExport.app,
    schemaVersion: dataExport.schemaVersion,
    students: dataExport.students,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableContent));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function findLatestStoredBackup(
  bucket: R2BucketLike,
  backupPrefix: string,
): Promise<{ manifestKey: string; contentHash: string | null } | null> {
  if (!bucket.list) {
    return null;
  }

  const manifestKeys = await listBackupManifestKeys(bucket, backupPrefix);
  const latestManifestKey = manifestKeys.at(-1);
  if (!latestManifestKey) {
    return null;
  }

  return {
    manifestKey: latestManifestKey,
    contentHash: await readStoredBackupContentHash(bucket, latestManifestKey),
  };
}

async function listBackupManifestKeys(bucket: R2BucketLike, backupPrefix: string): Promise<string[]> {
  const manifestKeys: string[] = [];
  let cursor: string | undefined;

  do {
    const page = await bucket.list?.({
      cursor,
      prefix: `${backupPrefix}/`,
    });

    if (!page) {
      break;
    }

    for (const object of page.objects) {
      if (object.key.endsWith(`/${BACKUP_MANIFEST_FILENAME}`)) {
        manifestKeys.push(object.key);
      }
    }

    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  manifestKeys.sort();
  return manifestKeys;
}

async function readStoredBackupContentHash(bucket: R2BucketLike, manifestKey: string): Promise<string | null> {
  if (!bucket.get) {
    return null;
  }

  const manifestObject = await bucket.get(manifestKey);
  if (!manifestObject) {
    return null;
  }

  const manifestText = await manifestObject.text();
  let parsedManifest: unknown;
  try {
    parsedManifest = JSON.parse(manifestText);
  } catch {
    return null;
  }

  if (!isRecord(parsedManifest)) {
    return null;
  }

  const contentHash = typeof parsedManifest.contentHash === "string" ? parsedManifest.contentHash.trim() : "";
  if (contentHash) {
    return contentHash;
  }

  const jsonExportKey = readStoredJsonExportKey(parsedManifest);
  if (!jsonExportKey) {
    return null;
  }

  const jsonExportObject = await bucket.get(jsonExportKey);
  if (!jsonExportObject) {
    return null;
  }

  const jsonExportText = await jsonExportObject.text();
  let parsedExport: unknown;
  try {
    parsedExport = JSON.parse(jsonExportText);
  } catch {
    return null;
  }

  if (!isDataExportFileLike(parsedExport)) {
    return null;
  }

  return createDataExportContentHash(parsedExport);
}

function readStoredJsonExportKey(value: Record<string, unknown>): string | null {
  const artifacts = value.artifacts;
  if (!isRecord(artifacts) || typeof artifacts.jsonExportKey !== "string") {
    return null;
  }
  return artifacts.jsonExportKey;
}

function isDataExportFileLike(value: unknown): value is DataExportFile {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.app === "thesis-journey-tracker" &&
    typeof value.schemaVersion === "number" &&
    typeof value.exportedAt === "string" &&
    Array.isArray(value.students)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
