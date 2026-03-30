export const DASHBOARD_FILTER_SECTION = `
function createFilterChip(label, clearKey, clearAll) {
  var button = document.createElement("button");
  button.type = "button";
  button.className =
    clearAll
      ? "rounded-control border border-app-field bg-app-surface px-badge-x py-badge-pill-y text-xs font-medium text-app-text shadow-sm hover:bg-app-surface-soft dark:border-app-field-dark dark:bg-app-surface-dark dark:text-app-text-dark dark:hover:bg-app-surface-soft-dark/70"
      : "rounded-control bg-app-brand-soft px-badge-x py-badge-pill-y text-xs font-medium text-app-text shadow-sm hover:bg-app-brand-soft/80 dark:bg-app-brand-soft-dark/25 dark:text-app-text-dark dark:hover:bg-app-brand-soft-dark/35";
  button.textContent = label;
  button.addEventListener("click", function () {
    clearDashboardFilter(clearKey);
  });
  return button;
}

function clearDashboardFilter(key) {
  if (key === "all") {
    if (searchInput) searchInput.value = "";
    if (degreeFilter) degreeFilter.value = "";
    if (phaseFilter) phaseFilter.value = "";
    if (statusFilter) statusFilter.value = "";
  } else if (key === "search" && searchInput) {
    searchInput.value = "";
  } else if (key === "degree" && degreeFilter) {
    degreeFilter.value = "";
  } else if (key === "phase" && phaseFilter) {
    phaseFilter.value = "";
  } else if (key === "status" && statusFilter) {
    statusFilter.value = "";
  }

  updateDashboardFilters();
}

function renderActiveFilterSummary() {
  if (!activeDashboardFilters) return;

  var activeFilters = [];
  var searchValue = searchInput ? searchInput.value.trim() : "";
  var degreeValue = degreeFilter ? degreeFilter.value : "";
  var phaseValue = phaseFilter ? phaseFilter.value : "";
  var statusValue = statusFilter ? statusFilter.value : "";

  if (searchValue) activeFilters.push({ key: "search", label: 'Search: "' + searchValue + '"' });
  if (degreeValue && degreeFilter && degreeFilter.selectedOptions[0]) activeFilters.push({ key: "degree", label: "Degree: " + degreeFilter.selectedOptions[0].textContent });
  if (phaseValue && phaseFilter && phaseFilter.selectedOptions[0]) activeFilters.push({ key: "phase", label: "Phase: " + phaseFilter.selectedOptions[0].textContent });
  if (statusValue && statusFilter && statusFilter.selectedOptions[0]) activeFilters.push({ key: "status", label: "Status: " + statusFilter.selectedOptions[0].textContent });

  activeDashboardFilters.innerHTML = "";

  if (activeFilters.length === 0) {
    activeDashboardFilters.classList.add("hidden");
    return;
  }

  activeDashboardFilters.classList.remove("hidden");

  var label = document.createElement("p");
  label.className = "text-xs font-medium uppercase tracking-wide text-app-text-muted dark:text-app-text-muted-dark";
  label.textContent = "Active filters";
  activeDashboardFilters.appendChild(label);

  var chipRow = document.createElement("div");
  chipRow.className = "mt-badge-y flex flex-wrap gap-badge-y";
  activeFilters.forEach(function (activeFilter) {
    chipRow.appendChild(createFilterChip(activeFilter.label, activeFilter.key, false));
  });
  chipRow.appendChild(createFilterChip("Clear filters", "all", true));
  activeDashboardFilters.appendChild(chipRow);
}

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

  if (mobileStudentCardList && mobileStudentCards.length > 0) {
    mobileStudentCards.sort(function (a, b) {
      var comparison = compareRowsByKey(a, b, currentSortKey, currentSortDirection);
      if (comparison === 0) {
        comparison = compareText(a.getAttribute("data-name"), b.getAttribute("data-name"));
      }
      return comparison;
    });

    mobileStudentCards.forEach(function (card) {
      mobileStudentCardList.appendChild(card);
    });
  }

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
    var matchingCard = mobileStudentCards.find(function (card) {
      return getMobileCardStudentId(card) === getRowStudentId(row);
    });

    row.style.display = visible ? "" : "none";
    if (matchingCard) {
      matchingCard.style.display = visible ? "" : "none";
    }
    if (visible) visibleCount += 1;
  });

  if (studentResultsMeta) {
    studentResultsMeta.textContent = "Showing " + visibleCount + " of " + studentRows.length + " students";
  }

  renderActiveFilterSummary();
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

  mobileStudentCards.forEach(function (card) {
    var studentId = getMobileCardStudentId(card);
    var cardUrl = getDashboardUrl(studentId);
    card.setAttribute("data-select-href", cardUrl.pathname + cardUrl.search);
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
