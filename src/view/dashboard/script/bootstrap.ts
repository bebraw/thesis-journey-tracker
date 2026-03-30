export const DASHBOARD_BOOTSTRAP_SECTION = `
syncDashboardDom();
applyFiltersFromLocation();
applyWorkspaceView();
applySortFromLocation();
refreshStudentTable();
syncInteractiveUrls();
setPanelVisibility(getSelectedStudentIdFromLocation() > 0);
setSelectionActionState(getSelectedStudentIdFromLocation());
applySelectedRowState(getSelectedStudentIdFromLocation());
applySelectedLaneState(getSelectedStudentIdFromLocation());
bindHistorySelection();
rebindDashboardUi();`;
