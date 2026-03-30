export const DASHBOARD_BOOTSTRAP_SECTION = `
syncDashboardDom();
applyFiltersFromLocation();
applyWorkspaceView();
applySortFromLocation();
refreshStudentTable();
syncInteractiveUrls();
setPanelVisibility(getSelectedStudentIdFromLocation() > 0);
applySelectedRowState(getSelectedStudentIdFromLocation());
applySelectedLaneState(getSelectedStudentIdFromLocation());
bindHistorySelection();
rebindDashboardUi();`;
