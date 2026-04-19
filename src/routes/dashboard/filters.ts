import type { DashboardFilters } from "../../view/types";

const DEFAULT_DASHBOARD_SORT_KEY = "nextMeeting";
const DEFAULT_DASHBOARD_SORT_DIRECTION: DashboardFilters["sortDirection"] = "asc";
const DEFAULT_DASHBOARD_VIEW_MODE: DashboardFilters["viewMode"] = "list";
const DASHBOARD_SORT_KEYS = new Set(["student", "degree", "phase", "target", "nextMeeting", "logs"]);

export function getDashboardFilters(searchParams: URLSearchParams): DashboardFilters {
  const rawSortKey = searchParams.get("sort") || "";
  const rawSortDirection = searchParams.get("dir") === "desc" ? "desc" : "asc";
  const sortKey = DASHBOARD_SORT_KEYS.has(rawSortKey) ? rawSortKey : DEFAULT_DASHBOARD_SORT_KEY;

  return {
    search: (searchParams.get("search") || "").trim(),
    degree: searchParams.get("degree") || "",
    phase: searchParams.get("phase") || "",
    status: searchParams.get("status") || "",
    viewMode:
      searchParams.get("view") === "phases"
        ? "phases"
        : searchParams.get("view") === "gantt"
          ? "gantt"
          : DEFAULT_DASHBOARD_VIEW_MODE,
    sortKey,
    sortDirection: rawSortDirection,
  };
}

export function buildDashboardPath(filters: DashboardFilters, options: { selectedId?: number; notice?: string; error?: string } = {}): string {
  const searchParams = new URLSearchParams();

  if (options.selectedId) {
    searchParams.set("selected", String(options.selectedId));
  }
  if (filters.search) {
    searchParams.set("search", filters.search);
  }
  if (filters.degree) {
    searchParams.set("degree", filters.degree);
  }
  if (filters.phase) {
    searchParams.set("phase", filters.phase);
  }
  if (filters.status) {
    searchParams.set("status", filters.status);
  }
  if (filters.viewMode !== DEFAULT_DASHBOARD_VIEW_MODE) {
    searchParams.set("view", filters.viewMode);
  }
  if (filters.sortKey !== DEFAULT_DASHBOARD_SORT_KEY || filters.sortDirection !== DEFAULT_DASHBOARD_SORT_DIRECTION) {
    searchParams.set("sort", filters.sortKey);
    searchParams.set("dir", filters.sortDirection);
  }
  if (options.notice) {
    searchParams.set("notice", options.notice);
  }
  if (options.error) {
    searchParams.set("error", options.error);
  }

  const query = searchParams.toString();
  return query ? `/?${query}` : "/";
}

export function appendDashboardMessage(pathname: string, options: { selectedId?: number; notice?: string; error?: string }): string {
  const url = new URL(pathname, "https://dashboard.local");
  return buildDashboardPath(getDashboardFilters(url.searchParams), options);
}

export async function getDashboardReturnPath(request: Request, options: { selectedId?: number } = {}): Promise<string> {
  const formData = await request.clone().formData();
  return buildDashboardPath(parseDashboardReturnTo(formData.get("returnTo")), {
    selectedId: options.selectedId,
  });
}

function parseDashboardReturnTo(rawValue: FormDataEntryValue | null): DashboardFilters {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return getDashboardFilters(new URLSearchParams());
  }

  try {
    const url = new URL(rawValue, "https://dashboard.local");
    if (url.pathname !== "/") {
      return getDashboardFilters(new URLSearchParams());
    }
    return getDashboardFilters(url.searchParams);
  } catch {
    return getDashboardFilters(new URLSearchParams());
  }
}
