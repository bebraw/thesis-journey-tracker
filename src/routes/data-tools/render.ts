import type { SessionUser } from "../../auth";
import type { Env } from "../../app-env";
import { getStoredDashboardLaneConfig, resolveDashboardLanesForApp } from "../../dashboard-lanes";
import { htmlResponse } from "../../http/response";
import { listStudents } from "../../students/store";
import { renderDataToolsPage } from "../../views";
import { isReplaceImportEnabled } from "./transfer";

export async function renderDataTools(url: URL, env: Env, sessionUser: SessionUser): Promise<Response> {
  const notice = url.searchParams.get("notice");
  const error = url.searchParams.get("error");
  const students = await listStudents(env.DB, { includeArchived: true });
  const logCount = students.reduce((total, student) => total + student.logCount, 0);
  const [storedDashboardLanes, dashboardLanes, supervisors] = await Promise.all([
    getStoredDashboardLaneConfig(env),
    resolveDashboardLanesForApp(env),
    env.DB.prepare("SELECT id, name FROM app_users WHERE can_supervise = 1 AND role = 'editor' AND disabled_at IS NULL ORDER BY name").all<{
      id: number;
      name: string;
    }>(),
  ]);

  return htmlResponse(
    renderDataToolsPage({
      viewer: sessionUser,
      supervisors: supervisors.results,
      notice,
      error,
      studentCount: students.length,
      logCount,
      replaceImportEnabled: isReplaceImportEnabled(env),
      dashboardLanes,
      storedDashboardLanesUpdatedAt: storedDashboardLanes?.updatedAt || null,
      usingDefaultDashboardLanes: !storedDashboardLanes,
    }),
  );
}
