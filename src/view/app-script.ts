export const APP_INTERACTION_SCRIPT = `"use strict";

(function initializeApplication() {
  var root = document.documentElement;

  try {
    var storedTheme = localStorage.getItem("theme");
    if (storedTheme === "dark" || (!storedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      root.classList.add("dark");
    }
  } catch (_error) {
    // Theme persistence is optional when storage access is unavailable.
  }

  function initializeInteractions() {
    var themeToggle = document.getElementById("themeToggle");

    function syncThemeToggleAccessibility() {
      if (!themeToggle) return;
      var nextMode = root.classList.contains("dark") ? "light" : "dark";
      var label = "Switch to " + nextMode + " mode";
      themeToggle.setAttribute("title", label);
      themeToggle.setAttribute("aria-label", label);
    }

    syncThemeToggleAccessibility();
    if (themeToggle) {
      themeToggle.addEventListener("click", function toggleTheme() {
        root.classList.toggle("dark");
        try {
          localStorage.setItem("theme", root.classList.contains("dark") ? "dark" : "light");
        } catch (_error) {
          // The selected theme still applies for this page when storage is unavailable.
        }
        syncThemeToggleAccessibility();
      });
    }

    document.addEventListener("change", function submitAutomaticForm(event) {
      var control = event.target;
      if (!(control instanceof Element) || !control.hasAttribute("data-auto-submit")) return;
      var form = control.closest("form");
      if (form instanceof HTMLFormElement) form.requestSubmit();
    });

    document.addEventListener("submit", function confirmSensitiveAction(event) {
      var form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      var message = form.getAttribute("data-confirm-message");
      if (message && !window.confirm(message)) event.preventDefault();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeInteractions, { once: true });
  } else {
    initializeInteractions();
  }
}());
`;
