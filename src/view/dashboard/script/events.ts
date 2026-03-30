export const DASHBOARD_EVENT_SECTION = `
function bindInlineSelectionLinks() {
  document.querySelectorAll("a[data-inline-select='1']").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      var studentId = parseStudentId(link.getAttribute("data-student-id"));
      if (!studentId) return;
      void selectStudentWithoutRefresh(studentId, true);
    });
  });
}

function bindStudentRowSelection() {
  studentRows.forEach(function (row) {
    row.addEventListener("click", function (event) {
      var target = event.target;
      if (isInlineSelectionTarget(target) || isInteractiveChild(target)) {
        return;
      }
      void selectStudentWithoutRefresh(getRowStudentId(row), true);
    });

    row.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      void selectStudentWithoutRefresh(getRowStudentId(row), true);
    });
  });
}

function bindLaneSelection() {
  laneStudentCards.forEach(function (card) {
    card.addEventListener("click", function (event) {
      var target = event.target;
      if (isInlineSelectionTarget(target) || isInteractiveChild(target)) {
        return;
      }
      void selectStudentWithoutRefresh(getLaneStudentId(card), true);
    });

    card.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      void selectStudentWithoutRefresh(getLaneStudentId(card), true);
    });
  });
}

function bindHistorySelection() {
  window.addEventListener("popstate", function () {
    applyFiltersFromLocation();
    applySortFromLocation();
    refreshStudentTable();
    syncInteractiveUrls();
    var selectedId = getSelectedStudentIdFromLocation();
    if (!selectedId) {
      setEmptySelectedPanel();
      return;
    }
    void selectStudentWithoutRefresh(selectedId, false);
  });
}

function bindDashboardFilters() {
  if (searchInput) searchInput.addEventListener("input", updateDashboardFilters);
  if (degreeFilter) degreeFilter.addEventListener("change", updateDashboardFilters);
  if (phaseFilter) phaseFilter.addEventListener("change", updateDashboardFilters);
  if (statusFilter) statusFilter.addEventListener("change", updateDashboardFilters);
}

function bindStudentSort() {
  sortButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      var key = button.getAttribute("data-sort-key") || "";
      if (!key) return;

      if (currentSortKey === key) {
        currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
      } else {
        currentSortKey = key;
        currentSortDirection = "asc";
      }

      refreshStudentTable();
      syncFiltersToUrl();
      syncInteractiveUrls();
    });
  });
}

function bindPanelToggle() {
  if (!toggleStudentPanelButton || !selectedStudentPanelShell) return;
  toggleStudentPanelButton.addEventListener("click", function () {
    var isVisible = !selectedStudentPanelShell.classList.contains("hidden");
    setPanelVisibility(!isVisible);
  });
}

function bindDashboardToasts() {
  var toasts = Array.prototype.slice.call(document.querySelectorAll("[data-dashboard-toast='1']"));

  toasts.forEach(function (toast) {
    if (toast.getAttribute("data-toast-bound") === "1") return;
    toast.setAttribute("data-toast-bound", "1");

    var dismissButton = toast.querySelector("[data-toast-dismiss='1']");
    if (dismissButton) {
      dismissButton.addEventListener("click", function () {
        dismissDashboardToast(toast);
      });
    }

    if (toast.getAttribute("data-toast-kind") === "notice") {
      window.setTimeout(function () {
        dismissDashboardToast(toast);
      }, 3200);
    }
  });

  if (toasts.length > 0) {
    clearDashboardMessageParams();
  }
}

function bindInlineStudentUpdateForm() {
  if (!selectedStudentPanel) return;

  var updateForm = selectedStudentPanel.querySelector("form[action^='/actions/update-student/']");
  if (!updateForm || updateForm.getAttribute("data-inline-bound") === "1") return;

  updateForm.setAttribute("data-inline-bound", "1");
  updateForm.addEventListener("submit", function (event) {
    event.preventDefault();

    var form = event.currentTarget;
    var action = form.getAttribute("action");
    if (!action) {
      form.submit();
      return;
    }

    var selectedId = getSelectedStudentIdFromLocation();
    var panelWasVisible = selectedStudentPanelShell ? !selectedStudentPanelShell.classList.contains("hidden") : false;
    var openSummaries = collectOpenPanelDetails();
    var submitButton = form.querySelector("button[type='submit']");
    var originalDisabled = submitButton ? submitButton.disabled : false;

    if (submitButton) {
      submitButton.disabled = true;
    }

    fetch(action, {
      method: "POST",
      headers: {
        "X-Requested-With": "fetch"
      },
      body: new FormData(form)
    })
      .then(function (response) {
        var responseUrl = new URL(response.url, window.location.origin);

        if (!response.ok || responseUrl.pathname !== "/") {
          window.location.href = responseUrl.pathname + responseUrl.search;
          return null;
        }

        return response.text().then(function (htmlText) {
          applyDashboardHtml(htmlText, response.url, {
            selectedId: selectedId,
            panelWasVisible: panelWasVisible,
            openSummaries: openSummaries
          });
        });
      })
      .catch(function () {
        form.submit();
      })
      .finally(function () {
        if (submitButton) {
          submitButton.disabled = originalDisabled;
        }
      });
  });
}

function bindInlineLogEntryForm() {
  if (!selectedStudentPanel) return;

  var addLogForm = selectedStudentPanel.querySelector("form[action^='/actions/add-log/']");
  if (!addLogForm || addLogForm.getAttribute("data-inline-bound") === "1") return;

  addLogForm.setAttribute("data-inline-bound", "1");
  addLogForm.addEventListener("submit", function (event) {
    event.preventDefault();

    var form = event.currentTarget;
    var action = form.getAttribute("action");
    if (!action) {
      form.submit();
      return;
    }

    var selectedId = getSelectedStudentIdFromLocation();
    var panelWasVisible = selectedStudentPanelShell ? !selectedStudentPanelShell.classList.contains("hidden") : false;
    var openSummaries = collectOpenPanelDetails();
    var submitButton = form.querySelector("button[type='submit']");
    var originalDisabled = submitButton ? submitButton.disabled : false;

    if (submitButton) {
      submitButton.disabled = true;
    }

    fetch(action, {
      method: "POST",
      headers: {
        "X-Requested-With": "fetch"
      },
      body: new FormData(form)
    })
      .then(function (response) {
        var responseUrl = new URL(response.url, window.location.origin);

        if (!response.ok || responseUrl.pathname !== "/") {
          window.location.href = responseUrl.pathname + responseUrl.search;
          return null;
        }

        return response.text().then(function (htmlText) {
          applyDashboardHtml(htmlText, response.url, {
            selectedId: selectedId,
            panelWasVisible: panelWasVisible,
            openSummaries: openSummaries
          });
        });
      })
      .catch(function () {
        form.submit();
      })
      .finally(function () {
        if (submitButton) {
          submitButton.disabled = originalDisabled;
        }
      });
  });
}`;
