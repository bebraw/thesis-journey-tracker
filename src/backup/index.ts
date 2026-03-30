import type { D1Database } from "../db-core";
import {
  buildExportFilename,
  buildProfessorReportFilename,
  createDataExport,
  createProfessorStatusReport,
} from "../data-transfer";
import { collectStudentBackupBundles, createDataExportContentHash } from "./data";
import {
  BACKUP_MANIFEST_FILENAME,
  buildAutomatedBackupPrefix,
  findLatestStoredBackup,
  normalizeBackupPrefix,
} from "./storage";
import type { AutomatedBackupManifest, AutomatedBackupResult, R2BucketLike } from "./types";

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

export { normalizeBackupPrefix } from "./storage";
export type {
  AutomatedBackupManifest,
  AutomatedBackupResult,
  R2BucketLike,
  R2HttpMetadata,
  R2ListOptions,
  R2ListResult,
  R2ObjectBodyLike,
  R2ObjectLike,
  R2PutOptions,
} from "./types";
