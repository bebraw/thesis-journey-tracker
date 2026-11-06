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
  const [storedDashboardLanes, dashboardLanes] = await Promise.all([getStoredDashboardLaneConfig(env), resolveDashboardLanesForApp(env)]);

  return htmlResponse(
    renderDataToolsPage({
      viewer: {
        name: sessionUser.name,
        role: sessionUser.role,
      },
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
