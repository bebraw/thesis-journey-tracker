export const DASHBOARD_BOOTSTRAP_SECTION = `
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
