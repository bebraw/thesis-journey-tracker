import type { Env } from "../../app-env";
import {
  clearDashboardLaneConfig,
  parseDashboardLaneConfigurationForm,
  saveDashboardLaneConfig,
} from "../../dashboard-lanes";
import { redirect } from "../../http/response";

export async function handleSaveDashboardLaneSettings(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();
  const { lanes, error } = parseDashboardLaneConfigurationForm(formData);
  if (!lanes || error) {
    return redirect(`/data-tools?error=${encodeURIComponent(error || "Invalid dashboard lane settings")}`);
  }

  try {
    await saveDashboardLaneConfig(env, lanes, new Date().toISOString());
  } catch (saveError) {
    console.error("Failed to save dashboard lane settings", saveError);
    return redirect("/data-tools?error=Failed+to+save+dashboard+lane+settings");
  }

  return redirect("/data-tools?notice=Dashboard+lane+settings+saved");
}

export async function handleResetDashboardLaneSettings(env: Env): Promise<Response> {
  try {
    await clearDashboardLaneConfig(env);
  } catch (clearError) {
    console.error("Failed to reset dashboard lane settings", clearError);
    return redirect("/data-tools?error=Failed+to+reset+dashboard+lane+settings");
  }

  return redirect("/data-tools?notice=Dashboard+lane+settings+reset+to+defaults");
}
