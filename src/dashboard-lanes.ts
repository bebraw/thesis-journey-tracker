import type { Env } from "./app-env";
import { deleteAppSecret, getAppSecret, upsertAppSecret } from "./calendar/store";
import { decryptText, encryptText } from "./encryption";
import { normalizeString } from "./forms/normalize";
import { PHASES } from "./students/reference-data";
import type { PhaseId } from "./students/store";

const DASHBOARD_LANE_CONFIG_SECRET_KEY = "dashboard_lane_config";

export interface DashboardLaneDefinition {
  label: string;
  phaseId: PhaseId;
}

export interface StoredDashboardLaneConfigRecord {
  lanes: DashboardLaneDefinition[];
  updatedAt: string;
}

interface StoredDashboardLaneLike {
  label?: unknown;
  phaseId?: unknown;
  phaseIds?: unknown;
}

interface DashboardLaneConfigPayload {
  lanes?: unknown;
}

export interface DashboardLaneConfigParseResult {
  lanes: DashboardLaneDefinition[] | null;
  error: string | null;
}

export function getDefaultDashboardLanes(): DashboardLaneDefinition[] {
  return PHASES.map((phase) => ({
    label: phase.label,
    phaseId: phase.id,
  }));
}

export async function getStoredDashboardLaneConfig(env: Env): Promise<StoredDashboardLaneConfigRecord | null> {
  const storedSecret = await getAppSecret(env.DB, DASHBOARD_LANE_CONFIG_SECRET_KEY);
  if (!storedSecret) {
    return null;
  }

  try {
    const decryptedPayload = await decryptText(storedSecret.encryptedValue, resolveAppEncryptionSecret(env));
    const parsedPayload = JSON.parse(decryptedPayload) as DashboardLaneConfigPayload;
    const validation = validateDashboardLanes(parsedPayload.lanes);
    if (!validation.lanes) {
      throw new Error(validation.error || "Invalid dashboard lane configuration");
    }

    return {
      lanes: validation.lanes,
      updatedAt: storedSecret.updatedAt,
    };
  } catch (error) {
    console.error("Failed to load stored dashboard lane configuration", error);
    return null;
  }
}

export async function resolveDashboardLanesForApp(env: Env): Promise<DashboardLaneDefinition[]> {
  return (await getStoredDashboardLaneConfig(env))?.lanes || getDefaultDashboardLanes();
}

export async function saveDashboardLaneConfig(env: Env, lanes: DashboardLaneDefinition[], updatedAt: string): Promise<void> {
  const encryptedValue = await encryptText(JSON.stringify({ lanes }), resolveAppEncryptionSecret(env));
  await upsertAppSecret(env.DB, DASHBOARD_LANE_CONFIG_SECRET_KEY, encryptedValue, updatedAt);
}

export async function clearDashboardLaneConfig(env: Env): Promise<void> {
  await deleteAppSecret(env.DB, DASHBOARD_LANE_CONFIG_SECRET_KEY);
}

export function parseDashboardLaneConfigurationForm(formData: FormData): DashboardLaneConfigParseResult {
  return {
    lanes: PHASES.map((phase, index) => ({
      phaseId: phase.id,
      label: normalizeString(formData.get(`laneLabel${index}`)) || phase.label,
    })),
    error: null,
  };
}

export function validateDashboardLanes(rawLanes: unknown): DashboardLaneConfigParseResult {
  const lanes = normalizeStoredDashboardLanes(rawLanes);
  if (!lanes) {
    return {
      lanes: null,
      error: "Stored dashboard lane settings are invalid.",
    };
  }

  return {
    lanes,
    error: null,
  };
}

function normalizeStoredDashboardLanes(rawLanes: unknown): DashboardLaneDefinition[] | null {
  if (!Array.isArray(rawLanes)) {
    return null;
  }

  const phaseToLabel = new Map<PhaseId, string>();

  for (const phase of PHASES) {
    phaseToLabel.set(phase.id, phase.label);
  }

  for (const rawLane of rawLanes as StoredDashboardLaneLike[]) {
    if (!rawLane || typeof rawLane !== "object") {
      return null;
    }

    const label = normalizeString(rawLane.label as string | null | undefined) || null;
    const resolvedPhaseId = resolveStoredLanePhaseId(rawLane);
    if (!resolvedPhaseId || !label) {
      return null;
    }

    phaseToLabel.set(resolvedPhaseId, label);
  }

  return PHASES.map((phase) => ({
    phaseId: phase.id,
    label: phaseToLabel.get(phase.id) || phase.label,
  }));
}

function resolveStoredLanePhaseId(rawLane: StoredDashboardLaneLike): PhaseId | null {
  if (typeof rawLane.phaseId === "string" && PHASES.some((phase) => phase.id === rawLane.phaseId)) {
    return rawLane.phaseId as PhaseId;
  }

  if (Array.isArray(rawLane.phaseIds) && rawLane.phaseIds.length === 1 && typeof rawLane.phaseIds[0] === "string") {
    const phaseId = rawLane.phaseIds[0];
    if (PHASES.some((phase) => phase.id === phaseId)) {
      return phaseId as PhaseId;
    }
  }

  return null;
}

function resolveAppEncryptionSecret(env: Env): string {
  return env.APP_ENCRYPTION_SECRET || env.SESSION_SECRET || "";
}
