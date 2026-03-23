import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAutomatedBackup } from "../src/backup";
import { MockD1Database } from "./helpers/mock-d1";
import { MockR2Bucket } from "./helpers/mock-r2";

vi.mock("../.generated/styles.css", () => ({ default: "" }));
vi.mock("../src/favicon.ico", () => ({ default: new ArrayBuffer(0) }));

describe("automated backups", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T01:30:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes JSON, professor report, and manifest artifacts to R2", async () => {
    const db = new MockD1Database();
    const bucket = new MockR2Bucket();

    db.meetingLogs.push({
      id: 1,
      student_id: 1,
      happened_at: "2026-03-22T09:00:00.000Z",
      discussed: "Initial review",
      agreed_plan: "Write chapter 1",
      next_step_deadline: "2026-03-29",
    });
    db.phaseAuditEntries.push({
      id: 1,
      student_id: 1,
      changed_at: "2026-03-21T12:00:00.000Z",
      from_phase: "research_plan",
      to_phase: "researching",
    });

    const result = await runAutomatedBackup(db, bucket, {
      backupPrefix: "prod-backups",
      cron: "30 1 * * *",
      timestamp: new Date("2026-03-23T01:30:00.000Z"),
    });

    expect(bucket.objects).toHaveLength(3);
    expect(result.manifest.generatedAt).toBe("2026-03-23T01:30:00.000Z");
    expect(result.manifest.counts.students).toBe(1);
    expect(result.manifest.counts.meetingLogs).toBe(1);
    expect(result.manifest.counts.phaseChanges).toBe(1);

    const jsonObject = bucket.objects.find((object) => object.key.endsWith(".json") && !object.key.endsWith("backup-manifest.json"));
    const reportObject = bucket.objects.find((object) => object.key.endsWith(".md"));
    const manifestObject = bucket.objects.find((object) => object.key.endsWith("backup-manifest.json"));

    expect(jsonObject?.key).toContain("prod-backups/2026/03/23/2026-03-23T01-30-00-000Z/");
    expect(reportObject?.key).toContain("prod-backups/2026/03/23/2026-03-23T01-30-00-000Z/");
    expect(manifestObject?.key).toBe(result.manifestKey);
    expect(jsonObject?.options?.httpMetadata?.contentType).toBe("application/json; charset=utf-8");
    expect(reportObject?.options?.httpMetadata?.contentType).toBe("text/markdown; charset=utf-8");

    const exportedJson = JSON.parse(jsonObject?.value || "{}") as {
      students: Array<{ name: string; logs: Array<{ discussed: string }>; phaseAudit: Array<{ toPhase: string }> }>;
    };
    expect(exportedJson.students[0]?.name).toBe("Base Student");
    expect(exportedJson.students[0]?.logs[0]?.discussed).toBe("Initial review");
    expect(exportedJson.students[0]?.phaseAudit[0]?.toPhase).toBe("researching");

    const manifest = JSON.parse(manifestObject?.value || "{}") as {
      cron: string;
      artifacts: { jsonExportKey: string; professorReportKey: string };
    };
    expect(manifest.cron).toBe("30 1 * * *");
    expect(manifest.artifacts.jsonExportKey).toBe(jsonObject?.key);
    expect(manifest.artifacts.professorReportKey).toBe(reportObject?.key);
  });

  it("runs the scheduled worker backup with the configured R2 binding", async () => {
    vi.resetModules();
    const workerModule = await import("../src/worker");

    const env = {
      DB: new MockD1Database(),
      BACKUP_BUCKET: new MockR2Bucket(),
      BACKUP_PREFIX: "nightly",
      APP_PASSWORD: "test-password",
      SESSION_SECRET: "test-secret",
    };

    await workerModule.default.scheduled(
      {
        cron: "30 1 * * *",
      },
      env,
    );

    expect(env.BACKUP_BUCKET.objects).toHaveLength(3);
    expect(env.BACKUP_BUCKET.objects[0]?.key).toContain("nightly/2026/03/23/2026-03-23T01-30-00-000Z/");
  });
});
