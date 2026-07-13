import { type DataExportFile } from "../data-transfer";
import { createDataExportContentHash } from "./data";
import type { R2BucketLike } from "./types";

const DEFAULT_BACKUP_PREFIX = "automated-backups";
export const BACKUP_MANIFEST_FILENAME = "backup-manifest.json";

export function normalizeBackupPrefix(prefix: string | null | undefined): string {
  const trimmed = (prefix || DEFAULT_BACKUP_PREFIX).trim().replace(/^\/+|\/+$/g, "");
  return trimmed || DEFAULT_BACKUP_PREFIX;
}

export function buildAutomatedBackupPrefix(timestamp: Date, rawPrefix: string | null | undefined): string {
  const prefix = normalizeBackupPrefix(rawPrefix);
  const [year, month, day] = timestamp.toISOString().slice(0, 10).split("-");
  const timestampSlug = timestamp.toISOString().replace(/[:.]/g, "-");
  return `${prefix}/${year}/${month}/${day}/${timestampSlug}`;
}

export async function findLatestStoredBackup(
  bucket: R2BucketLike,
  backupPrefix: string,
): Promise<{ manifestKey: string; contentHash: string | null; generatedAt: string | null } | null> {
  if (!bucket.list) {
    return null;
  }

  const manifestKeys = await listBackupManifestKeys(bucket, backupPrefix);
  const latestManifestKey = manifestKeys.at(-1);
  if (!latestManifestKey) {
    return null;
  }

  const metadata = await readStoredBackupMetadata(bucket, latestManifestKey);
  return {
    manifestKey: latestManifestKey,
    contentHash: metadata?.contentHash ?? null,
    generatedAt: metadata?.generatedAt ?? null,
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

async function readStoredBackupMetadata(
  bucket: R2BucketLike,
  manifestKey: string,
): Promise<{ contentHash: string | null; generatedAt: string | null } | null> {
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

  const generatedAt = readStoredGeneratedAt(parsedManifest);
  const storedContentHash = typeof parsedManifest.contentHash === "string" ? parsedManifest.contentHash : "";
  if (storedContentHash) {
    return {
      contentHash: /^[a-f0-9]{64}$/.test(storedContentHash) ? storedContentHash : null,
      generatedAt,
    };
  }

  const jsonExportKey = readStoredJsonExportKey(parsedManifest);
  if (!jsonExportKey) {
    return { contentHash: null, generatedAt };
  }

  const jsonExportObject = await bucket.get(jsonExportKey);
  if (!jsonExportObject) {
    return { contentHash: null, generatedAt };
  }

  const jsonExportText = await jsonExportObject.text();
  let parsedExport: unknown;
  try {
    parsedExport = JSON.parse(jsonExportText);
  } catch {
    return { contentHash: null, generatedAt };
  }

  if (!isDataExportFileLike(parsedExport)) {
    return { contentHash: null, generatedAt };
  }

  return {
    contentHash: await createDataExportContentHash(parsedExport),
    generatedAt,
  };
}

function readStoredGeneratedAt(value: Record<string, unknown>): string | null {
  if (typeof value.generatedAt !== "string") {
    return null;
  }

  const generatedAt = value.generatedAt;
  const generatedAtTime = Date.parse(generatedAt);
  if (!Number.isFinite(generatedAtTime) || new Date(generatedAtTime).toISOString() !== generatedAt) {
    return null;
  }
  return generatedAt;
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
