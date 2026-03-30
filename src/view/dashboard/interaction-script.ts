function joinScriptSections(sections: string[]): string {
  return `${sections.join("\n\n")}\n`;
}

const DASHBOARD_DOM_SECTION = `
var tableBody = null;
var studentRows = [];
var laneStudentCards = [];
var searchInput = null;
var degreeFilter = null;
var phaseFilter = null;
var statusFilter = null;
var sortButtons = [];
var studentResultsMeta = null;
var selectedStudentPanelShell = null;
var selectedStudentPanel = null;
var emptySelectedStudentPanelTemplate = null;
var toggleStudentPanelButton = null;
var defaultSortKey = "nextMeeting";
var defaultSortDirection = "asc";
var currentSortKey = "nextMeeting";
var currentSortDirection = "asc";

function syncDashboardDom() {
  tableBody = document.getElementById("studentsTableBody");
  studentRows = Array.prototype.slice.call(document.querySelectorAll("[data-student-row]"));
  laneStudentCards = Array.prototype.slice.call(document.querySelectorAll("[data-lane-student-card]"));
  searchInput = document.getElementById("studentSearch");
  degreeFilter = document.getElementById("degreeFilter");
  phaseFilter = document.getElementById("phaseFilter");
  statusFilter = document.getElementById("statusFilter");
  sortButtons = Array.prototype.slice.call(document.querySelectorAll("[data-student-sort='1']"));
  studentResultsMeta = document.getElementById("studentResultsMeta");
  selectedStudentPanelShell = document.getElementById("selectedStudentPanelShell");
  selectedStudentPanel = document.getElementById("selectedStudentPanel");
  emptySelectedStudentPanelTemplate = document.getElementById("emptySelectedStudentPanelTemplate");
  toggleStudentPanelButton = document.getElementById("toggleStudentPanelButton");
}`;

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

function clearDashboardMessageParams() {
  var url = new URL(window.location.href);
  if (!url.searchParams.has("notice") && !url.searchParams.has("error")) return;
  url.searchParams.delete("notice");
  url.searchParams.delete("error");
  window.history.replaceState(window.history.state, "", url.pathname + url.search);
}

function dismissDashboardToast(toast) {
  if (!toast || toast.getAttribute("data-toast-closing") === "1") return;

  toast.setAttribute("data-toast-closing", "1");
  toast.classList.add("translate-y-2", "opacity-0");
  window.setTimeout(function () {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 220);
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
  toggleStudentPanelButton.textContent = visible ? "Hide details panel" : "Show details panel";
  toggleStudentPanelButton.setAttribute("aria-expanded", visible ? "true" : "false");
}

function replaceDashboardSection(nextDocument, id) {
  var currentSection = document.getElementById(id);
  var nextSection = nextDocument.getElementById(id);
  if (!currentSection || !nextSection) return;
  currentSection.outerHTML = nextSection.outerHTML;
}

function collectOpenPanelDetails() {
  if (!selectedStudentPanel) return [];

  return Array.prototype.slice.call(selectedStudentPanel.querySelectorAll("details[open] > summary")).map(function (summary) {
    return (summary.textContent || "").trim();
  });
}

function restoreOpenPanelDetails(openSummaries) {
  if (!selectedStudentPanel || !openSummaries || openSummaries.length === 0) return;

  Array.prototype.slice.call(selectedStudentPanel.querySelectorAll("details > summary")).forEach(function (summary) {
    var summaryText = (summary.textContent || "").trim();
    if (openSummaries.indexOf(summaryText) === -1) return;
    var details = summary.closest("details");
    if (details) {
      details.open = true;
    }
  });
}

function rebindDashboardUi() {
  bindInlineSelectionLinks();
  bindStudentRowSelection();
  bindLaneSelection();
  bindDashboardFilters();
  bindStudentSort();
  bindPanelToggle();
  bindInlineStudentUpdateForm();
  bindInlineLogEntryForm();
  bindDashboardToasts();
}

function applyDashboardHtml(htmlText, nextUrl, options) {
  var parser = new DOMParser();
  var nextDocument = parser.parseFromString(htmlText, "text/html");
  var selectedId = options && options.selectedId ? options.selectedId : getSelectedStudentIdFromLocation();
  var panelWasVisible = options && options.panelWasVisible ? true : false;
  var openSummaries = (options && options.openSummaries) || [];

  replaceDashboardSection(nextDocument, "dashboardFlashMessages");
  replaceDashboardSection(nextDocument, "dashboardMetrics");
  replaceDashboardSection(nextDocument, "dashboardPhaseLanes");
  replaceDashboardSection(nextDocument, "dashboardWorkspace");

  if (nextUrl) {
    var url = new URL(nextUrl, window.location.origin);
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
  }

  syncDashboardDom();
  applyFiltersFromLocation();
  applySortFromLocation();
  refreshStudentTable();
  syncInteractiveUrls();
  setPanelVisibility(panelWasVisible);
  applySelectedRowState(selectedId);
  applySelectedLaneState(selectedId);
  restoreOpenPanelDetails(openSummaries);
  rebindDashboardUi();
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
    var notes = row.getAttribute("data-notes") || "";
    var rowDegree = row.getAttribute("data-degree") || "";
    var rowPhase = row.getAttribute("data-phase") || "";
    var rowStatus = row.getAttribute("data-status-id") || "";

    var matchesQuery = !query || name.indexOf(query) !== -1 || email.indexOf(query) !== -1 || topic.indexOf(query) !== -1 || notes.indexOf(query) !== -1;
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
    bindInlineStudentUpdateForm();
    bindInlineLogEntryForm();

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
}

function bindDashboardToasts() {
  var toasts = Array.prototype.slice.call(document.querySelectorAll("[data-dashboard-toast='1']"));

  toasts.forEach(function (toast) {
    if (toast.getAttribute("data-toast-bound") === "1") return;
    toast.setAttribute("data-toast-bound", "1");

    var dismissButton = toast.querySelector("[data-toast-dismiss='1']");
    if (dismissButton) {
      dismissButton.addEventListener("click", function () {
        dismissDashboardToast(toast);
      });
    }

    if (toast.getAttribute("data-toast-kind") === "notice") {
      window.setTimeout(function () {
        dismissDashboardToast(toast);
      }, 3200);
    }
  });

  if (toasts.length > 0) {
    clearDashboardMessageParams();
  }
}

function bindInlineStudentUpdateForm() {
  if (!selectedStudentPanel) return;

  var updateForm = selectedStudentPanel.querySelector("form[action^='/actions/update-student/']");
  if (!updateForm || updateForm.getAttribute("data-inline-bound") === "1") return;

  updateForm.setAttribute("data-inline-bound", "1");
  updateForm.addEventListener("submit", function (event) {
    event.preventDefault();

    var form = event.currentTarget;
    var action = form.getAttribute("action");
    if (!action) {
      form.submit();
      return;
    }

    var selectedId = getSelectedStudentIdFromLocation();
    var panelWasVisible = selectedStudentPanelShell ? !selectedStudentPanelShell.classList.contains("hidden") : false;
    var openSummaries = collectOpenPanelDetails();
    var submitButton = form.querySelector("button[type='submit']");
    var originalDisabled = submitButton ? submitButton.disabled : false;

    if (submitButton) {
      submitButton.disabled = true;
    }

    fetch(action, {
      method: "POST",
      headers: {
        "X-Requested-With": "fetch"
      },
      body: new FormData(form)
    })
      .then(function (response) {
        var responseUrl = new URL(response.url, window.location.origin);

        if (!response.ok || responseUrl.pathname !== "/") {
          window.location.href = responseUrl.pathname + responseUrl.search;
          return null;
        }

        return response.text().then(function (htmlText) {
          applyDashboardHtml(htmlText, response.url, {
            selectedId: selectedId,
            panelWasVisible: panelWasVisible,
            openSummaries: openSummaries
          });
        });
      })
      .catch(function () {
        form.submit();
      })
      .finally(function () {
        if (submitButton) {
          submitButton.disabled = originalDisabled;
        }
      });
  });
}

function bindInlineLogEntryForm() {
  if (!selectedStudentPanel) return;

  var addLogForm = selectedStudentPanel.querySelector("form[action^='/actions/add-log/']");
  if (!addLogForm || addLogForm.getAttribute("data-inline-bound") === "1") return;

  addLogForm.setAttribute("data-inline-bound", "1");
  addLogForm.addEventListener("submit", function (event) {
    event.preventDefault();

    var form = event.currentTarget;
    var action = form.getAttribute("action");
    if (!action) {
      form.submit();
      return;
    }

    var selectedId = getSelectedStudentIdFromLocation();
    var panelWasVisible = selectedStudentPanelShell ? !selectedStudentPanelShell.classList.contains("hidden") : false;
    var openSummaries = collectOpenPanelDetails();
    var submitButton = form.querySelector("button[type='submit']");
    var originalDisabled = submitButton ? submitButton.disabled : false;

    if (submitButton) {
      submitButton.disabled = true;
    }

    fetch(action, {
      method: "POST",
      headers: {
        "X-Requested-With": "fetch"
      },
      body: new FormData(form)
    })
      .then(function (response) {
        var responseUrl = new URL(response.url, window.location.origin);

        if (!response.ok || responseUrl.pathname !== "/") {
          window.location.href = responseUrl.pathname + responseUrl.search;
          return null;
        }

        return response.text().then(function (htmlText) {
          applyDashboardHtml(htmlText, response.url, {
            selectedId: selectedId,
            panelWasVisible: panelWasVisible,
            openSummaries: openSummaries
          });
        });
      })
      .catch(function () {
        form.submit();
      })
      .finally(function () {
        if (submitButton) {
          submitButton.disabled = originalDisabled;
        }
      });
  });
}`;

const DASHBOARD_BOOTSTRAP_SECTION = `
syncDashboardDom();
applyFiltersFromLocation();
applySortFromLocation();
refreshStudentTable();
syncInteractiveUrls();
setPanelVisibility(false);
applySelectedRowState(getSelectedStudentIdFromLocation());
applySelectedLaneState(getSelectedStudentIdFromLocation());
bindHistorySelection();
rebindDashboardUi();`;

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
