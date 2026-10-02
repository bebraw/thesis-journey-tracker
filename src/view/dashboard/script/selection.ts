export const DASHBOARD_SELECTION_SECTION = `
function revealSelectedPanel() {
  if (!selectedStudentPanelShell) return;
  setPanelVisibility(true);

  if (window.matchMedia("(max-width: 1099px)").matches) {
    selectedStudentPanelShell.scrollIntoView({
      behavior: "instant",
      block: "start"
    });
  }
}

function applySelectedRowState(selectedId) {
  studentRows.forEach(function (row) {
    var isSelected = selectedId > 0 && getRowStudentId(row) === selectedId;
    row.classList.toggle("bg-app-brand-soft", isSelected);
    row.classList.toggle("dark:bg-app-brand-soft-dark/20", isSelected);
    row.classList.toggle("hover:bg-app-surface-soft", !isSelected);
    row.classList.toggle("dark:hover:bg-app-surface-soft-dark/35", !isSelected);
    row.setAttribute("aria-selected", isSelected ? "true" : "false");
  });

  mobileStudentCards.forEach(function (card) {
    var isSelected = selectedId > 0 && getMobileCardStudentId(card) === selectedId;
    card.classList.toggle("bg-app-brand-soft", isSelected);
    card.classList.toggle("dark:bg-app-brand-soft-dark/20", isSelected);
    card.classList.toggle("hover:bg-app-surface-soft", !isSelected);
    card.classList.toggle("dark:hover:bg-app-surface-soft-dark/35", !isSelected);
    card.setAttribute("aria-selected", isSelected ? "true" : "false");
  });
}

function applySelectedLaneState(selectedId) {
  laneStudentCards.forEach(function (card) {
    var isSelected = selectedId > 0 && getLaneStudentId(card) === selectedId;
    card.classList.toggle("border-app-brand", isSelected);
    card.classList.toggle("dark:border-app-brand-ring", isSelected);
    card.classList.toggle("border-app-line", !isSelected);
    card.classList.toggle("dark:border-app-line-dark", !isSelected);
    card.classList.toggle("bg-app-surface-soft", true);
    card.classList.toggle("dark:bg-app-surface-soft-dark/70", true);
    card.classList.toggle("hover:border-app-line-strong", !isSelected);
    card.classList.toggle("hover:bg-app-surface", !isSelected);
    card.classList.toggle("dark:hover:border-app-line-dark-strong", !isSelected);
    card.classList.toggle("dark:hover:bg-app-surface-dark", !isSelected);
    card.classList.toggle("bg-app-brand-soft", false);
    card.classList.toggle("dark:bg-app-brand-soft-dark/30", false);
    card.classList.toggle("shadow-sm", false);
    card.setAttribute("aria-selected", isSelected ? "true" : "false");
  });
}

function applySelectedGanttState(selectedId) {
  ganttStudentRows.forEach(function (row) {
    var isSelected = selectedId > 0 && getRowStudentId(row) === selectedId;
    row.classList.toggle("border-app-brand", isSelected);
    row.classList.toggle("dark:border-app-brand-ring", isSelected);
    row.classList.toggle("bg-app-brand-soft/80", isSelected);
    row.classList.toggle("dark:bg-app-brand-soft-dark/20", isSelected);
    row.classList.toggle("border-app-line", !isSelected);
    row.classList.toggle("dark:border-app-line-dark", !isSelected);
    row.classList.toggle("bg-app-surface", !isSelected);
    row.classList.toggle("dark:bg-app-surface-dark", !isSelected);
    row.classList.toggle("hover:border-app-line-strong", !isSelected);
    row.classList.toggle("hover:bg-app-surface-soft", !isSelected);
    row.classList.toggle("dark:hover:border-app-line-dark-strong", !isSelected);
    row.classList.toggle("dark:hover:bg-app-surface-soft-dark/40", !isSelected);
    row.setAttribute("aria-selected", isSelected ? "true" : "false");
  });
}

function setEmptySelectedPanel() {
  if (!selectedStudentPanel || !emptySelectedStudentPanelTemplate) return;
  captureStudentDrafts();
  selectionRequest += 1;
  selectedStudentPanel.innerHTML = emptySelectedStudentPanelTemplate.innerHTML;
  syncDashboardDom();
  applySelectedRowState(0);
  applySelectedLaneState(0);
  applySelectedGanttState(0);
}

function clearSelectedStudentSelection(pushHistory) {
  if (dashboardSaving) return;
  var previousId = getPanelStudentId();
  var clearedUrl = getDashboardUrl(0);
  setEmptySelectedPanel();
  setPanelVisibility(false);
  if (pushHistory) window.history.pushState({ selectedId: 0 }, "", clearedUrl.pathname + clearedUrl.search);
  syncInteractiveUrls();
  var narrow = window.matchMedia("(max-width: 1099px)").matches;
  var selector = window.matchMedia("(max-width: 639px)").matches ? "[data-mobile-student-card]" : "[data-student-row]";
  var previousRow = document.querySelector(selector + "[data-student-id='" + previousId + "']");
  if (previousRow && previousRow.style.display !== "none") previousRow.focus({ preventScroll: true });
  else if (searchInput) searchInput.focus({ preventScroll: true });
  if (narrow) window.scrollTo({ top: cohortScrollY, behavior: "instant" });
}

async function selectStudentWithoutRefresh(studentId, pushHistory) {
  if (!studentId || !selectedStudentPanel || dashboardSaving) return;
  if (studentId === getPanelStudentId()) {
    revealSelectedPanel();
    focusSelectedStudentSummary();
    return;
  }
  captureStudentDrafts();
  if (!getPanelStudentId()) cohortScrollY = window.scrollY;
  var requestId = ++selectionRequest;
  var selectedUrl = getDashboardUrl(studentId);
  try {
    var response = await fetch("/partials/student/" + studentId + selectedUrl.search, {
      headers: { "X-Requested-With": "fetch" }
    });
    if (!response.ok || new URL(response.url).pathname !== "/partials/student/" + studentId) throw new Error("Could not open student");
    var htmlText = await response.text();
    if (requestId !== selectionRequest) return;
    captureStudentDrafts();
    selectedStudentPanel.innerHTML = htmlText;
    if (pushHistory) window.history.pushState({ selectedId: studentId }, "", selectedUrl.pathname + selectedUrl.search);
    syncDashboardDom();
    applySelectedRowState(studentId);
    applySelectedLaneState(studentId);
    applySelectedGanttState(studentId);
    revealSelectedPanel();
    syncInteractiveUrls();
    bindCloseSelectedPanel();
    bindInlineStudentUpdateForm();
    bindInlineLogEntryForm();
    bindStudentDrafts();
    focusSelectedStudentSummary();
  } catch (_error) {
    if (requestId !== selectionRequest) return;
    if (!studentDrafts.size || window.confirm("Could not open the student. Reload the page and discard unsaved changes?")) {
      studentDrafts.clear();
      window.location.href = selectedUrl.pathname + selectedUrl.search;
    }
  }
}`;
