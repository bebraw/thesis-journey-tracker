export const DASHBOARD_DRAFT_SECTION = `
var studentDrafts = new Map();
var selectionRequest = 0;
var dashboardSaving = false;
var cohortScrollY = 0;

function getPanelStudentId() {
  var article = selectedStudentPanel && selectedStudentPanel.querySelector("[data-panel-student-id]");
  return article ? parseStudentId(article.getAttribute("data-panel-student-id")) : 0;
}

function readDraftValues(form) {
  var values = {};
  Array.prototype.forEach.call(form.elements, function (field) {
    if (!field.name || field.name === "returnTo" || field.type === "submit") return;
    values[field.name] = { value: field.value, checked: field.checked };
  });
  return values;
}

function captureStudentDrafts() {
  if (!selectedStudentPanel) return;
  var studentId = getPanelStudentId();
  if (!studentId) return;
  var drafts = studentDrafts.get(studentId) || {};
  selectedStudentPanel.querySelectorAll("form[data-student-draft]").forEach(function (form) {
    var kind = form.getAttribute("data-student-draft");
    var values = readDraftValues(form);
    if (JSON.stringify(values) !== form.getAttribute("data-draft-baseline")) {
      drafts[kind] = values;
    } else {
      delete drafts[kind];
    }
  });
  if (Object.keys(drafts).length) studentDrafts.set(studentId, drafts);
  else studentDrafts.delete(studentId);
  var status = selectedStudentPanel.querySelector("[data-draft-status]");
  if (status) status.textContent = Object.keys(drafts).length ? "Unsaved changes" : "";
}

function syncFollowUpField(form) {
  var choice = form.elements.namedItem("followUpAction");
  var field = form.elements.namedItem("nextMeetingAt");
  var wrapper = form.querySelector("[data-next-meeting-field]");
  if (!choice || !field || !wrapper) return;
  var needsMeeting = choice.value === "set";
  wrapper.classList.toggle("hidden", !needsMeeting);
  field.disabled = !needsMeeting;
  field.required = needsMeeting;
}

function bindStudentDrafts() {
  if (!selectedStudentPanel) return;
  var drafts = studentDrafts.get(getPanelStudentId()) || {};
  selectedStudentPanel.querySelectorAll("form[data-student-draft]").forEach(function (form) {
    if (form.hasAttribute("data-draft-baseline")) return;
    form.setAttribute("data-draft-baseline", JSON.stringify(readDraftValues(form)));
    var values = drafts[form.getAttribute("data-student-draft")];
    if (values) Object.keys(values).forEach(function (name) {
      var field = form.elements.namedItem(name);
      if (!field) return;
      field.value = values[name].value;
      if (typeof values[name].checked === "boolean") field.checked = values[name].checked;
    });
    form.addEventListener("input", captureStudentDrafts);
    form.addEventListener("change", function () { syncFollowUpField(form); captureStudentDrafts(); });
    syncFollowUpField(form);
  });
  captureStudentDrafts();
}

function discardSavedDraft(studentId, kind) {
  var drafts = studentDrafts.get(studentId);
  if (!drafts) return;
  delete drafts[kind];
  if (!Object.keys(drafts).length) studentDrafts.delete(studentId);
}

function bindDraftNavigationGuard() {
  window.addEventListener("beforeunload", function (event) {
    captureStudentDrafts();
    if (!studentDrafts.size) return;
    event.preventDefault();
    event.returnValue = "";
  });
  document.addEventListener("click", function (event) {
    var link = event.target.closest && event.target.closest("a[href]");
    if (!link || event.defaultPrevented || link.hasAttribute("data-inline-select") || link.target === "_blank") return;
    var url = new URL(link.href, window.location.href);
    if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;
    captureStudentDrafts();
    if (studentDrafts.size) {
      if (!window.confirm("Leave this page and discard unsaved changes?")) { event.preventDefault(); return; }
      studentDrafts.clear();
    }
  });
  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (event.defaultPrevented || form.hasAttribute("data-student-draft")) return;
    captureStudentDrafts();
    if (studentDrafts.size) {
      if (!window.confirm("Continue and discard unsaved changes?")) { event.preventDefault(); return; }
      studentDrafts.clear();
    }
  });
}
`;
