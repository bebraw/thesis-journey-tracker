export const DASHBOARD_FILTER_SECTION = `
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
