import type { Env } from "../../app-env";
import {
  clearDashboardLaneConfig,
  parseDashboardLaneConfigurationForm,
  saveDashboardLaneConfig,
} from "../../dashboard-lanes";
import { readFormData } from "../../http/request-body";
import { redirect } from "../../http/response";
import { logError } from "../../observability/error-logging";

export async function handleSaveDashboardLaneSettings(request: Request, env: Env): Promise<Response> {
  const formData = await readFormData(request);
  const { lanes, error } = parseDashboardLaneConfigurationForm(formData);
  if (!lanes || error) {
    return redirect(`/data-tools?error=${encodeURIComponent(error || "Invalid dashboard lane settings")}`);
  }

  try {
    await saveDashboardLaneConfig(env, lanes, new Date().toISOString());
  } catch (saveError) {
    logError("dashboard_lanes.save_failed", saveError);
    return redirect("/data-tools?error=Failed+to+save+dashboard+lane+settings");
  }

  return redirect("/data-tools?notice=Dashboard+lane+settings+saved");
}

export async function handleResetDashboardLaneSettings(env: Env): Promise<Response> {
  try {
    await clearDashboardLaneConfig(env);
  } catch (clearError) {
    logError("dashboard_lanes.reset_failed", clearError);
    return redirect("/data-tools?error=Failed+to+reset+dashboard+lane+settings");
  }

  return redirect("/data-tools?notice=Dashboard+lane+settings+reset+to+defaults");
}
