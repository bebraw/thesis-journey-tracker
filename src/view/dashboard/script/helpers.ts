export const DASHBOARD_HELPERS_SECTION = `
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
  var viewMode = getWorkspaceViewFromLocation();

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

  if (viewMode !== "list") {
    url.searchParams.set("view", viewMode);
  } else {
    url.searchParams.delete("view");
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

function getWorkspaceViewFromLocation() {
  var view = new URL(window.location.href).searchParams.get("view");
  return view === "phases" || view === "gantt" ? view : "list";
}

function applyWorkspaceView() {
  var currentView = getWorkspaceViewFromLocation();

  if (workspaceListView) {
    workspaceListView.classList.toggle("hidden", currentView !== "list");
  }
  if (workspacePhaseView) {
    workspacePhaseView.classList.toggle("hidden", currentView !== "phases");
  }
  if (workspaceGanttView) {
    workspaceGanttView.classList.toggle("hidden", currentView !== "gantt");
  }

  workspaceViewButtons.forEach(function (button) {
    var buttonView = button.getAttribute("data-workspace-view-button") || "list";
    button.setAttribute("aria-pressed", buttonView === currentView ? "true" : "false");
  });
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

function getMobileCardStudentId(card) {
  return parseStudentId(card.getAttribute("data-student-id"));
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

function setSubmitButtonBusy(submitButton, loadingLabel) {
  if (!submitButton) return null;

  var previousState = {
    disabled: submitButton.disabled,
    text: submitButton.textContent || ""
  };

  submitButton.disabled = true;
  submitButton.textContent = loadingLabel;
  submitButton.classList.add("opacity-70", "cursor-wait");

  return previousState;
}

function restoreSubmitButton(submitButton, previousState) {
  if (!submitButton || !previousState) return;
  submitButton.disabled = previousState.disabled;
  submitButton.textContent = previousState.text;
  submitButton.classList.remove("opacity-70", "cursor-wait");
}

function setPanelVisibility(visible) {
  if (!selectedStudentPanelShell) return;
  selectedStudentPanelShell.classList.toggle("hidden", !visible);
  if (toggleStudentPanelButton) {
    toggleStudentPanelButton.textContent = visible ? "Hide details" : "Show details";
    toggleStudentPanelButton.setAttribute("aria-expanded", visible ? "true" : "false");
  }
}

function focusSelectedStudentSummary() {
  if (!selectedStudentHeading || !selectedStudentPanelShell || selectedStudentPanelShell.classList.contains("hidden")) return;
  selectedStudentHeading.focus({ preventScroll: true });
}

function getActiveSelectedStudentTool() {
  var activeButton = selectedStudentToolButtons.find(function (button) {
    return button.getAttribute("aria-pressed") === "true";
  });
  return activeButton ? activeButton.getAttribute("data-tool-key") || "" : "";
}

function setActiveSelectedStudentTool(toolKey) {
  selectedStudentToolButtons.forEach(function (button) {
    var isActive = Boolean(toolKey) && button.getAttribute("data-tool-key") === toolKey;
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  selectedStudentToolPanels.forEach(function (panel) {
    var isActive = Boolean(toolKey) && panel.getAttribute("data-tool-key") === toolKey;
    panel.classList.toggle("hidden", !isActive);
  });
}

function replaceDashboardSection(nextDocument, id) {
  var currentSection = document.getElementById(id);
  var nextSection = nextDocument.getElementById(id);
  if (!currentSection || !nextSection) return;
  currentSection.outerHTML = nextSection.outerHTML;
}

function rebindDashboardUi() {
  bindInlineSelectionLinks();
  bindStudentRowSelection();
  bindMobileStudentCardSelection();
  bindLaneSelection();
  bindGanttSelection();
  bindWorkspaceViewToggle();
  bindDashboardFilters();
  bindStudentSort();
  bindPanelToggle();
  bindCloseSelectedPanel();
  bindSelectedStudentToolToggle();
  bindInlineStudentUpdateForm();
  bindInlineLogEntryForm();
  bindDashboardToasts();
}

function applyDashboardHtml(htmlText, nextUrl, options) {
  var parser = new DOMParser();
  var nextDocument = parser.parseFromString(htmlText, "text/html");
  var selectedId = options && options.selectedId ? options.selectedId : getSelectedStudentIdFromLocation();
  var panelWasVisible = options && options.panelWasVisible ? true : false;
  var activeTool = (options && options.activeTool) || "";
  var focusSummary = options && options.focusSummary ? true : false;

  replaceDashboardSection(nextDocument, "dashboardFlashMessages");
  replaceDashboardSection(nextDocument, "dashboardWorkspace");

  if (nextUrl) {
    var url = new URL(nextUrl, window.location.origin);
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
  }

  syncDashboardDom();
  applyFiltersFromLocation();
  applyWorkspaceView();
  applySortFromLocation();
  refreshStudentTable();
  syncInteractiveUrls();
  setPanelVisibility(panelWasVisible);
  applySelectedRowState(selectedId);
  applySelectedLaneState(selectedId);
  setActiveSelectedStudentTool(activeTool);
  rebindDashboardUi();
  if (focusSummary) {
    focusSelectedStudentSummary();
  }
}`;
