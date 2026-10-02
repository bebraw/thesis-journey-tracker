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
      var studentId = getRowStudentId(row);
      void selectStudentWithoutRefresh(studentId, true);
    });

    row.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      var studentId = getRowStudentId(row);
      void selectStudentWithoutRefresh(studentId, true);
    });
  });
}

function bindMobileStudentCardSelection() {
  mobileStudentCards.forEach(function (card) {
    card.addEventListener("click", function (event) {
      var target = event.target;
      if (isInlineSelectionTarget(target) || isInteractiveChild(target)) {
        return;
      }
      var studentId = getMobileCardStudentId(card);
      void selectStudentWithoutRefresh(studentId, true);
    });

    card.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      var studentId = getMobileCardStudentId(card);
      void selectStudentWithoutRefresh(studentId, true);
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
      var studentId = getLaneStudentId(card);
      void selectStudentWithoutRefresh(studentId, true);
    });

    card.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      var studentId = getLaneStudentId(card);
      void selectStudentWithoutRefresh(studentId, true);
    });
  });
}

function bindGanttSelection() {
  ganttStudentRows.forEach(function (row) {
    row.addEventListener("click", function (event) {
      var target = event.target;
      if (isInlineSelectionTarget(target) || isInteractiveChild(target)) {
        return;
      }
      var studentId = getRowStudentId(row);
      void selectStudentWithoutRefresh(studentId, true);
    });

    row.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      var studentId = getRowStudentId(row);
      void selectStudentWithoutRefresh(studentId, true);
    });
  });
}

function bindHistorySelection() {
  window.addEventListener("popstate", function () {
    applyFiltersFromLocation();
    applyWorkspaceView();
    applySortFromLocation();
    refreshStudentTable();
    syncInteractiveUrls();
    var selectedId = getSelectedStudentIdFromLocation();
    if (!selectedId) {
      captureStudentDrafts();
      setEmptySelectedPanel();
      setPanelVisibility(false);
      return;
    }
    void selectStudentWithoutRefresh(selectedId, false);
  });
}

function bindWorkspaceViewToggle() {
  workspaceViewButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      var nextView = button.getAttribute("data-workspace-view-button") || "list";
      var url = getDashboardUrl(getSelectedStudentIdFromLocation());

      if (nextView === "phases") {
        url.searchParams.set("view", "phases");
      } else if (nextView === "gantt") {
        url.searchParams.set("view", "gantt");
      } else {
        url.searchParams.delete("view");
      }

      window.history.replaceState(window.history.state, "", url.pathname + url.search);
      applyWorkspaceView();
      syncInteractiveUrls();
    });
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

function bindCloseSelectedPanel() {
  if (!closeSelectedStudentPanelButton) return;
  closeSelectedStudentPanelButton.addEventListener("click", function () { clearSelectedStudentSelection(true); });
  selectedStudentPanel.querySelectorAll("[data-back-to-students]").forEach(function (button) {
    button.addEventListener("click", function () { clearSelectedStudentSelection(true); });
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

function bindInlineStudentUpdateForm() { bindInlineDraftSave("edit"); }
function bindInlineLogEntryForm() { bindInlineDraftSave("log"); }

function bindInlineDraftSave(kind) {
  if (!selectedStudentPanel) return;
  var form = selectedStudentPanel.querySelector("form[data-student-draft='" + kind + "']");
  if (!form || form.getAttribute("data-inline-bound") === "1") return;
  form.setAttribute("data-inline-bound", "1");
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (dashboardSaving) return;
    captureStudentDrafts();
    var studentId = getPanelStudentId();
    var body = new FormData(form);
    selectionRequest += 1;
    var button = form.querySelector("button[type='submit']");
    var buttonState = setSubmitButtonBusy(button, "Saving…");
    var fields = Array.prototype.map.call(form.elements, function (field) {
      var state = { field: field, disabled: field.disabled };
      field.disabled = true;
      return state;
    });
    dashboardSaving = true;
    form.setAttribute("aria-busy", "true");
    try {
      var response = await fetch(form.action, { method: "POST", headers: { "X-Requested-With": "fetch" }, body: body });
      var responseUrl = new URL(response.url, window.location.origin);
      if (!response.ok || responseUrl.pathname !== "/") throw new Error("Could not save. Your draft is still here.");
      var htmlText = await response.text();
      var failed = responseUrl.searchParams.has("error");
      if (!failed && !responseUrl.searchParams.has("notice")) throw new Error("Could not confirm the save. Check the history before retrying.");
      if (failed) {
        var errorDocument = new DOMParser().parseFromString(htmlText, "text/html");
        replaceDashboardSection(errorDocument, "dashboardFlashMessages");
        bindDashboardToasts();
      } else {
        discardSavedDraft(studentId, kind);
        applyDashboardHtml(htmlText, response.url, { selectedId: studentId, panelWasVisible: true, focusSummary: true });
      }
    } catch (error) {
      var message = form.querySelector("[data-save-error]");
      if (!message) { message = document.createElement("p"); message.setAttribute("role", "alert"); form.appendChild(message); }
      message.className = "text-sm text-app-danger-text dark:text-app-danger-text-dark";
      message.textContent = error instanceof TypeError ? "Could not confirm the save. Your draft is still here. Check the history before retrying." : error.message || "Could not confirm the save. Check the history before retrying.";
    } finally {
      dashboardSaving = false;
      form.removeAttribute("aria-busy");
      fields.forEach(function (state) { state.field.disabled = state.disabled; });
      restoreSubmitButton(button, buttonState);
    }
  });
}`;
