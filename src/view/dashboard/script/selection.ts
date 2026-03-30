export const DASHBOARD_SELECTION_SECTION = `
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
