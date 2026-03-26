function joinScriptSections(sections: string[]): string {
  return `${sections.join("\n\n")}\n`;
}

const DASHBOARD_DOM_SECTION = `
var tableBody = document.getElementById("studentsTableBody");
var studentRows = Array.prototype.slice.call(document.querySelectorAll("[data-student-row]"));
var laneStudentCards = Array.prototype.slice.call(document.querySelectorAll("[data-lane-student-card]"));
var searchInput = document.getElementById("studentSearch");
var degreeFilter = document.getElementById("degreeFilter");
var phaseFilter = document.getElementById("phaseFilter");
var statusFilter = document.getElementById("statusFilter");
var sortButtons = Array.prototype.slice.call(document.querySelectorAll("[data-student-sort='1']"));
var studentResultsMeta = document.getElementById("studentResultsMeta");
var selectedStudentPanelShell = document.getElementById("selectedStudentPanelShell");
var selectedStudentPanel = document.getElementById("selectedStudentPanel");
var emptySelectedStudentPanelTemplate = document.getElementById("emptySelectedStudentPanelTemplate");
var toggleStudentPanelButton = document.getElementById("toggleStudentPanelButton");
var defaultSortKey = "nextMeeting";
var defaultSortDirection = "asc";
var currentSortKey = "nextMeeting";
var currentSortDirection = "asc";`;

const DASHBOARD_HELPERS_SECTION = `
function parseStudentId(value) {
  var parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function toTimestamp(value) {
  if (!value) return Number.NaN;
  var ts = Date.parse(value);
  return Number.isNaN(ts) ? Number.NaN : ts;
}

function statusPriority(statusId) {
  if (statusId === "overdue") return 0;
  if (statusId === "not_booked") return 1;
  if (statusId === "within_2_weeks") return 2;
  if (statusId === "scheduled") return 3;
  return 4;
}

function getSelectedStudentIdFromLocation() {
  return parseStudentId(new URL(window.location.href).searchParams.get("selected"));
}

function getDashboardUrl(selectedId) {
  var url = new URL(window.location.href);
  var searchValue = searchInput ? searchInput.value.trim() : "";
  var degreeValue = degreeFilter ? degreeFilter.value : "";
  var phaseValue = phaseFilter ? phaseFilter.value : "";
  var statusValue = statusFilter ? statusFilter.value : "";

  if (selectedId) {
    url.searchParams.set("selected", String(selectedId));
  } else {
    url.searchParams.delete("selected");
  }

  url.searchParams.delete("notice");
  url.searchParams.delete("error");

  if (searchValue) {
    url.searchParams.set("search", searchValue);
  } else {
    url.searchParams.delete("search");
  }

  if (degreeValue) {
    url.searchParams.set("degree", degreeValue);
  } else {
    url.searchParams.delete("degree");
  }

  if (phaseValue) {
    url.searchParams.set("phase", phaseValue);
  } else {
    url.searchParams.delete("phase");
  }

  if (statusValue) {
    url.searchParams.set("status", statusValue);
  } else {
    url.searchParams.delete("status");
  }

  if (currentSortKey !== defaultSortKey || currentSortDirection !== defaultSortDirection) {
    url.searchParams.set("sort", currentSortKey);
    url.searchParams.set("dir", currentSortDirection);
  } else {
    url.searchParams.delete("sort");
    url.searchParams.delete("dir");
  }

  return url;
}

function applyFiltersFromLocation() {
  var url = new URL(window.location.href);
  if (searchInput) searchInput.value = url.searchParams.get("search") || "";
  if (degreeFilter) degreeFilter.value = url.searchParams.get("degree") || "";
  if (phaseFilter) phaseFilter.value = url.searchParams.get("phase") || "";
  if (statusFilter) statusFilter.value = url.searchParams.get("status") || "";
}

function applySortFromLocation() {
  var url = new URL(window.location.href);
  var sortKey = url.searchParams.get("sort") || defaultSortKey;
  var sortDirection = url.searchParams.get("dir") === "desc" ? "desc" : "asc";
  var isKnownSortKey =
    sortKey === "student" ||
    sortKey === "degree" ||
    sortKey === "phase" ||
    sortKey === "target" ||
    sortKey === "nextMeeting" ||
    sortKey === "logs";

  currentSortKey = isKnownSortKey ? sortKey : defaultSortKey;
  currentSortDirection = sortDirection;
}

function syncFiltersToUrl() {
  var url = getDashboardUrl(getSelectedStudentIdFromLocation());
  window.history.replaceState(window.history.state, "", url.pathname + url.search);
}

function getRowStudentId(row) {
  return parseStudentId(row.getAttribute("data-student-id"));
}

function getLaneStudentId(card) {
  return parseStudentId(card.getAttribute("data-student-id"));
}

function isInlineSelectionTarget(target) {
  return Boolean(target && target.closest && target.closest("a[data-inline-select='1']"));
}

function isInteractiveChild(target) {
  return Boolean(target && target.closest && target.closest("button,input,select,textarea,label"));
}

function compareNullable(leftMissing, rightMissing) {
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;
  return 0;
}

function compareText(left, right) {
  return (left || "").localeCompare(right || "");
}

function compareNumber(left, right) {
  return left - right;
}

function compareRowsByKey(a, b, key, direction) {
  if (key === "student") {
    var nameComparison = compareText(a.getAttribute("data-name"), b.getAttribute("data-name"));
    return direction === "asc" ? nameComparison : nameComparison * -1;
  }

  if (key === "degree") {
    var degreeComparison = compareText(a.getAttribute("data-degree-label"), b.getAttribute("data-degree-label"));
    return direction === "asc" ? degreeComparison : degreeComparison * -1;
  }

  if (key === "phase") {
    var phaseComparison = compareText(a.getAttribute("data-phase-label"), b.getAttribute("data-phase-label"));
    return direction === "asc" ? phaseComparison : phaseComparison * -1;
  }

  if (key === "target") {
    var aTarget = a.getAttribute("data-target-date") || "";
    var bTarget = b.getAttribute("data-target-date") || "";
    var missingTargetComparison = compareNullable(!aTarget, !bTarget);
    if (missingTargetComparison !== 0) return missingTargetComparison;
    var targetComparison = toTimestamp(aTarget) - toTimestamp(bTarget);
    return direction === "asc" ? targetComparison : targetComparison * -1;
  }

  if (key === "logs") {
    var logComparison = compareNumber(
      Number.parseInt(a.getAttribute("data-log-count") || "0", 10),
      Number.parseInt(b.getAttribute("data-log-count") || "0", 10),
    );
    return direction === "asc" ? logComparison : logComparison * -1;
  }

  var aMeeting = a.getAttribute("data-next-meeting-date") || "";
  var bMeeting = b.getAttribute("data-next-meeting-date") || "";
  var missingMeetingComparison = compareNullable(!aMeeting, !bMeeting);
  if (missingMeetingComparison !== 0) return missingMeetingComparison;
  var meetingComparison = toTimestamp(aMeeting) - toTimestamp(bMeeting);
  return direction === "asc" ? meetingComparison : meetingComparison * -1;
}

function updateSortHeaders() {
  sortButtons.forEach(function (button) {
    var key = button.getAttribute("data-sort-key") || "";
    var isActive = key === currentSortKey;
    var indicator = button.querySelector("[data-sort-indicator='1']");
    var parentHeader = button.closest("th");

    button.setAttribute("aria-pressed", isActive ? "true" : "false");

    if (indicator) {
      indicator.textContent = isActive ? (currentSortDirection === "asc" ? "↑" : "↓") : "↕";
    }

    if (parentHeader) {
      parentHeader.setAttribute("aria-sort", isActive ? (currentSortDirection === "asc" ? "ascending" : "descending") : "none");
    }
  });
}

function setPanelVisibility(visible) {
  if (!selectedStudentPanelShell || !toggleStudentPanelButton) return;
  selectedStudentPanelShell.classList.toggle("hidden", !visible);
  toggleStudentPanelButton.textContent = visible ? "Hide editing panel" : "Show editing panel";
  toggleStudentPanelButton.setAttribute("aria-expanded", visible ? "true" : "false");
}`;

const DASHBOARD_FILTER_SECTION = `
function applyStudentSort() {
  if (!tableBody || studentRows.length === 0) return;

  studentRows.sort(function (a, b) {
    var comparison = compareRowsByKey(a, b, currentSortKey, currentSortDirection);
    if (comparison === 0) {
      comparison = compareText(a.getAttribute("data-name"), b.getAttribute("data-name"));
    }
    return comparison;
  });

  studentRows.forEach(function (row) {
    tableBody.appendChild(row);
  });

  updateSortHeaders();
}

function applyStudentFilters() {
  var query = searchInput ? searchInput.value.toLowerCase().trim() : "";
  var degree = degreeFilter ? degreeFilter.value : "";
  var phase = phaseFilter ? phaseFilter.value : "";
  var status = statusFilter ? statusFilter.value : "";
  var visibleCount = 0;

  studentRows.forEach(function (row) {
    var name = row.getAttribute("data-name") || "";
    var email = row.getAttribute("data-email") || "";
    var topic = row.getAttribute("data-topic") || "";
    var rowDegree = row.getAttribute("data-degree") || "";
    var rowPhase = row.getAttribute("data-phase") || "";
    var rowStatus = row.getAttribute("data-status-id") || "";

    var matchesQuery = !query || name.indexOf(query) !== -1 || email.indexOf(query) !== -1 || topic.indexOf(query) !== -1;
    var matchesDegree = !degree || rowDegree === degree;
    var matchesPhase = !phase || rowPhase === phase;
    var matchesStatus = !status || rowStatus === status;
    var visible = matchesQuery && matchesDegree && matchesPhase && matchesStatus;

    row.style.display = visible ? "" : "none";
    if (visible) visibleCount += 1;
  });

  if (studentResultsMeta) {
    studentResultsMeta.textContent = "Showing " + visibleCount + " of " + studentRows.length + " students";
  }
}

function refreshStudentTable() {
  applyStudentSort();
  applyStudentFilters();
}

function syncInteractiveUrls() {
  document.querySelectorAll("a[data-inline-select='1']").forEach(function (link) {
    var studentId = parseStudentId(link.getAttribute("data-student-id"));
    if (!studentId) return;
    var studentUrl = getDashboardUrl(studentId);
    link.setAttribute("href", studentUrl.pathname + studentUrl.search);
  });

  studentRows.forEach(function (row) {
    var studentId = getRowStudentId(row);
    var rowUrl = getDashboardUrl(studentId);
    row.setAttribute("data-select-href", rowUrl.pathname + rowUrl.search);
  });

  var selectedUrl = getDashboardUrl(getSelectedStudentIdFromLocation());
  document.querySelectorAll("#selectedStudentPanel input[name='returnTo']").forEach(function (input) {
    input.value = selectedUrl.pathname + selectedUrl.search;
  });
}

function updateDashboardFilters() {
  applyStudentFilters();
  syncFiltersToUrl();
  syncInteractiveUrls();
}`;

const DASHBOARD_SELECTION_SECTION = `
function applySelectedRowState(selectedId) {
  studentRows.forEach(function (row) {
    var isSelected = selectedId > 0 && getRowStudentId(row) === selectedId;
    row.classList.toggle("bg-app-brand-soft", isSelected);
    row.classList.toggle("dark:bg-app-brand-soft-dark/20", isSelected);
    row.classList.toggle("hover:bg-app-surface-soft", !isSelected);
    row.classList.toggle("dark:hover:bg-app-surface-soft-dark/35", !isSelected);
    row.setAttribute("aria-selected", isSelected ? "true" : "false");
  });
}

function applySelectedLaneState(selectedId) {
  laneStudentCards.forEach(function (card) {
    var isSelected = selectedId > 0 && getLaneStudentId(card) === selectedId;
    card.classList.toggle("ring-2", isSelected);
    card.classList.toggle("ring-app-brand-ring/60", isSelected);
    card.classList.toggle("dark:ring-app-brand-ring/40", isSelected);
    card.setAttribute("aria-selected", isSelected ? "true" : "false");
  });
}

function setEmptySelectedPanel() {
  if (!selectedStudentPanel || !emptySelectedStudentPanelTemplate) return;
  selectedStudentPanel.innerHTML = emptySelectedStudentPanelTemplate.innerHTML;
  applySelectedRowState(0);
  applySelectedLaneState(0);
}

async function selectStudentWithoutRefresh(studentId, pushHistory) {
  if (!studentId || !selectedStudentPanel) return;

  try {
    var selectedUrl = getDashboardUrl(studentId);
    var response = await fetch("/partials/student/" + studentId + selectedUrl.search, {
      headers: {
        "X-Requested-With": "fetch"
      }
    });

    if (!response.ok) {
      window.location.href = selectedUrl.pathname + selectedUrl.search;
      return;
    }

    selectedStudentPanel.innerHTML = await response.text();
    applySelectedRowState(studentId);
    applySelectedLaneState(studentId);
    syncInteractiveUrls();

    if (pushHistory) {
      window.history.pushState({ selectedId: studentId }, "", selectedUrl.pathname + selectedUrl.search);
    }
  } catch (_error) {
    var fallbackUrl = getDashboardUrl(studentId);
    window.location.href = fallbackUrl.pathname + fallbackUrl.search;
  }
}`;

const DASHBOARD_EVENT_SECTION = `
function bindInlineSelectionLinks() {
  document.querySelectorAll("a[data-inline-select='1']").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      var studentId = parseStudentId(link.getAttribute("data-student-id"));
      if (!studentId) return;
      void selectStudentWithoutRefresh(studentId, true);
    });
  });
}

function bindStudentRowSelection() {
  studentRows.forEach(function (row) {
    row.addEventListener("click", function (event) {
      var target = event.target;
      if (isInlineSelectionTarget(target) || isInteractiveChild(target)) {
        return;
      }
      void selectStudentWithoutRefresh(getRowStudentId(row), true);
    });

    row.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      void selectStudentWithoutRefresh(getRowStudentId(row), true);
    });
  });
}

function bindLaneSelection() {
  laneStudentCards.forEach(function (card) {
    card.addEventListener("click", function (event) {
      var target = event.target;
      if (isInlineSelectionTarget(target) || isInteractiveChild(target)) {
        return;
      }
      void selectStudentWithoutRefresh(getLaneStudentId(card), true);
    });

    card.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      void selectStudentWithoutRefresh(getLaneStudentId(card), true);
    });
  });
}

function bindHistorySelection() {
  window.addEventListener("popstate", function () {
    applyFiltersFromLocation();
    applySortFromLocation();
    refreshStudentTable();
    syncInteractiveUrls();
    var selectedId = getSelectedStudentIdFromLocation();
    if (!selectedId) {
      setEmptySelectedPanel();
      return;
    }
    void selectStudentWithoutRefresh(selectedId, false);
  });
}

function bindDashboardFilters() {
  if (searchInput) searchInput.addEventListener("input", updateDashboardFilters);
  if (degreeFilter) degreeFilter.addEventListener("change", updateDashboardFilters);
  if (phaseFilter) phaseFilter.addEventListener("change", updateDashboardFilters);
  if (statusFilter) statusFilter.addEventListener("change", updateDashboardFilters);
}

function bindStudentSort() {
  sortButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      var key = button.getAttribute("data-sort-key") || "";
      if (!key) return;

      if (currentSortKey === key) {
        currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
      } else {
        currentSortKey = key;
        currentSortDirection = "asc";
      }

      refreshStudentTable();
      syncFiltersToUrl();
      syncInteractiveUrls();
    });
  });
}

function bindPanelToggle() {
  if (!toggleStudentPanelButton || !selectedStudentPanelShell) return;
  toggleStudentPanelButton.addEventListener("click", function () {
    var isVisible = !selectedStudentPanelShell.classList.contains("hidden");
    setPanelVisibility(!isVisible);
  });
}`;

const DASHBOARD_BOOTSTRAP_SECTION = `
applyFiltersFromLocation();
applySortFromLocation();
refreshStudentTable();
syncInteractiveUrls();
setPanelVisibility(false);
applySelectedRowState(getSelectedStudentIdFromLocation());
applySelectedLaneState(getSelectedStudentIdFromLocation());
bindInlineSelectionLinks();
bindStudentRowSelection();
bindLaneSelection();
bindHistorySelection();
bindDashboardFilters();
bindStudentSort();
bindPanelToggle();`;

export const DASHBOARD_INTERACTION_SCRIPT = joinScriptSections([
  DASHBOARD_DOM_SECTION,
  DASHBOARD_HELPERS_SECTION,
  DASHBOARD_FILTER_SECTION,
  DASHBOARD_SELECTION_SECTION,
  DASHBOARD_EVENT_SECTION,
  DASHBOARD_BOOTSTRAP_SECTION,
]);

export function renderDashboardScriptTag(): string {
  return '<script src="/dashboard.js" defer></script>';
}
