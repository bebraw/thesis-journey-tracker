export const DASHBOARD_DOM_SECTION = `
var tableBody = null;
var studentRows = [];
var mobileStudentCardList = null;
var mobileStudentCards = [];
var laneStudentCards = [];
var phaseLanes = [];
var workspaceViewButtons = [];
var workspaceListView = null;
var workspacePhaseView = null;
var searchInput = null;
var degreeFilter = null;
var phaseFilter = null;
var statusFilter = null;
var sortButtons = [];
var studentResultsMeta = null;
var activeDashboardFilters = null;
var selectedStudentPanelShell = null;
var selectedStudentPanel = null;
var selectedStudentHeading = null;
var emptySelectedStudentPanelTemplate = null;
var selectedStudentToolButtons = [];
var selectedStudentToolPanels = [];
var toggleStudentPanelButton = null;
var closeSelectedStudentPanelButton = null;
var defaultSortKey = "nextMeeting";
var defaultSortDirection = "asc";
var currentSortKey = "nextMeeting";
var currentSortDirection = "asc";

function syncDashboardDom() {
  tableBody = document.getElementById("studentsTableBody");
  studentRows = Array.prototype.slice.call(document.querySelectorAll("[data-student-row]"));
  mobileStudentCardList = document.getElementById("mobileStudentCardList");
  mobileStudentCards = Array.prototype.slice.call(document.querySelectorAll("[data-mobile-student-card]"));
  laneStudentCards = Array.prototype.slice.call(document.querySelectorAll("[data-lane-student-card]"));
  phaseLanes = Array.prototype.slice.call(document.querySelectorAll("[data-phase-lane]"));
  workspaceViewButtons = Array.prototype.slice.call(document.querySelectorAll("[data-workspace-view-button]"));
  workspaceListView = document.getElementById("workspaceListView");
  workspacePhaseView = document.getElementById("workspacePhaseView");
  searchInput = document.getElementById("studentSearch");
  degreeFilter = document.getElementById("degreeFilter");
  phaseFilter = document.getElementById("phaseFilter");
  statusFilter = document.getElementById("statusFilter");
  sortButtons = Array.prototype.slice.call(document.querySelectorAll("[data-student-sort='1']"));
  studentResultsMeta = document.getElementById("studentResultsMeta");
  activeDashboardFilters = document.getElementById("activeDashboardFilters");
  selectedStudentPanelShell = document.getElementById("selectedStudentPanelShell");
  selectedStudentPanel = document.getElementById("selectedStudentPanel");
  selectedStudentHeading = selectedStudentPanel
    ? selectedStudentPanel.querySelector("[data-selected-student-heading='1']")
    : null;
  emptySelectedStudentPanelTemplate = document.getElementById("emptySelectedStudentPanelTemplate");
  selectedStudentToolButtons = selectedStudentPanel
    ? Array.prototype.slice.call(selectedStudentPanel.querySelectorAll("[data-selected-tool-button='1']"))
    : [];
  selectedStudentToolPanels = selectedStudentPanel
    ? Array.prototype.slice.call(selectedStudentPanel.querySelectorAll("[data-selected-tool-panel='1']"))
    : [];
  toggleStudentPanelButton = document.getElementById("toggleStudentPanelButton");
  closeSelectedStudentPanelButton = document.getElementById("closeSelectedStudentPanelButton");
}`;
