export const DASHBOARD_SELECTION_SECTION = `
function revealSelectedPanel() {
  if (!selectedStudentPanelShell) return;
  setPanelVisibility(true);

  if (window.matchMedia("(max-width: 1279px)").matches) {
    selectedStudentPanelShell.scrollIntoView({
      behavior: "smooth",
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
    card.classList.toggle("border-app-brand", isSelected);
    card.classList.toggle("dark:border-app-brand-ring", isSelected);
    card.classList.toggle("bg-app-brand-soft/80", isSelected);
    card.classList.toggle("dark:bg-app-brand-soft-dark/20", isSelected);
    card.classList.toggle("border-app-line", !isSelected);
    card.classList.toggle("dark:border-app-line-dark", !isSelected);
    card.classList.toggle("bg-app-surface", !isSelected);
    card.classList.toggle("dark:bg-app-surface-dark", !isSelected);
    card.classList.toggle("hover:border-app-line-strong", !isSelected);
    card.classList.toggle("hover:bg-app-surface-soft", !isSelected);
    card.classList.toggle("dark:hover:border-app-line-dark-strong", !isSelected);
    card.classList.toggle("dark:hover:bg-app-surface-soft-dark/40", !isSelected);
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

function setEmptySelectedPanel() {
  if (!selectedStudentPanel || !emptySelectedStudentPanelTemplate) return;
  selectedStudentPanel.innerHTML = emptySelectedStudentPanelTemplate.innerHTML;
  syncDashboardDom();
  setActiveSelectedStudentTool("");
  applySelectedRowState(0);
  applySelectedLaneState(0);
}

function clearSelectedStudentSelection(pushHistory) {
  var clearedUrl = getDashboardUrl(0);
  setEmptySelectedPanel();
  setPanelVisibility(false);
  syncInteractiveUrls();

  if (pushHistory) {
    window.history.pushState({ selectedId: 0 }, "", clearedUrl.pathname + clearedUrl.search);
  }
}

async function selectStudentWithoutRefresh(studentId, pushHistory) {
  if (!studentId || !selectedStudentPanel) return;
  if (studentId === getSelectedStudentIdFromLocation()) {
    clearSelectedStudentSelection(pushHistory);
    return;
  }

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
    syncDashboardDom();
    applySelectedRowState(studentId);
    applySelectedLaneState(studentId);
    setActiveSelectedStudentTool("");
    revealSelectedPanel();
    syncInteractiveUrls();
    bindCloseSelectedPanel();
    bindSelectedStudentToolToggle();
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
