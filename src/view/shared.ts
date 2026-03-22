import {
  BODY_CLASS,
  FOCUS_RING,
  HEADER_CARD,
  SUBTLE_TEXT,
  renderButton,
} from "../components";
import { type HtmlispComponents, renderHTMLisp } from "../htmlisp";
import { escapeHtml } from "../utils";

const THEME_BOOTSTRAP_SCRIPT = `<script>
      (function applyTheme() {
        var stored = localStorage.getItem("theme");
        if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
          document.documentElement.classList.add("dark");
        }
      }());
    </script>`;

export const THEME_TOGGLE_SCRIPT = `<script>
    var themeToggle = document.getElementById("themeToggle");
    var root = document.documentElement;

    function syncThemeToggleAccessibility() {
      var nextMode = root.classList.contains("dark") ? "light" : "dark";
      var label = "Switch to " + nextMode + " mode";
      themeToggle.setAttribute("title", label);
      themeToggle.setAttribute("aria-label", label);
    }

    syncThemeToggleAccessibility();

    themeToggle.addEventListener("click", function () {
      root.classList.toggle("dark");
      localStorage.setItem("theme", root.classList.contains("dark") ? "dark" : "light");
      syncThemeToggleAccessibility();
    });
  </script>`;

export function renderView(
  htmlInput: string,
  props: Record<string, unknown> = {},
  components: HtmlispComponents = {},
): string {
  return renderHTMLisp(htmlInput, props, components);
}

export function renderDocument(
  title: string,
  bodyContent: string,
  bodyClass = BODY_CLASS,
): string {
  const components: HtmlispComponents = {
    Document: `<!doctype html>
<html lang="en" class="h-full">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title &children="(get props title)"></title>
    <noop &children="(get props themeBootstrapScript)"></noop>
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body &class="(get props bodyClass)">
    <noop &children="(get props bodyContent)"></noop>
  </body>
</html>`,
  };

  return renderView(
    '<Document &title="(get props title)" &bodyClass="(get props bodyClass)" &bodyContent="(get props bodyContent)" &themeBootstrapScript="(get props themeBootstrapScript)"></Document>',
    {
      title: escapeHtml(title),
      bodyClass: escapeHtml(bodyClass),
      bodyContent,
      themeBootstrapScript: THEME_BOOTSTRAP_SCRIPT,
    },
    components,
  );
}

export function renderFlashMessages(
  notice: string | null,
  error: string | null,
): string {
  const components: HtmlispComponents = {
    NoticeFlash:
      '<p &visibleIf="(get props visible)" role="status" aria-live="polite" class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/30 dark:text-emerald-200" &children="(get props message)"></p>',
    ErrorFlash:
      '<p &visibleIf="(get props visible)" role="alert" aria-live="assertive" class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-900/30 dark:text-rose-200" &children="(get props message)"></p>',
  };

  return renderView(
    '<noop><NoticeFlash &visible="(get props noticeVisible)" &message="(get props noticeMessage)"></NoticeFlash><ErrorFlash &visible="(get props errorVisible)" &message="(get props errorMessage)"></ErrorFlash></noop>',
    {
      noticeVisible: Boolean(notice),
      noticeMessage: escapeHtml(notice || ""),
      errorVisible: Boolean(error),
      errorMessage: escapeHtml(error || ""),
    },
    components,
  );
}

export function renderAuthedPageHeader(
  title: string,
  description: string,
  actionsHtml: string,
): string {
  const components: HtmlispComponents = {
    ThemeToggleButton: `<button
    id="themeToggle"
    type="button"
    title="Switch to dark mode"
    aria-label="Switch to dark mode"
    &class="(get props className)"
  >
    <svg class="h-5 w-5 text-slate-700 dark:hidden dark:text-slate-200" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-9-9 7 7 0 0 0 9 9Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <svg class="hidden h-5 w-5 text-slate-700 dark:block dark:text-slate-200" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.64 5.64l1.41 1.41M16.95 16.95l1.41 1.41M18.36 5.64l-1.41 1.41M7.05 16.95l-1.41 1.41" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </svg>
  </button>`,
    AuthHeader: `<header &class="(get props headerClass)">
    <div>
      <h1 class="text-xl font-semibold" &children="(get props title)"></h1>
      <p &class="(get props descriptionClass)" &children="(get props description)"></p>
    </div>
    <div class="flex flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
      <noop &children="(get props actionsHtml)"></noop>
      <ThemeToggleButton &className="(get props themeToggleClass)" />
      <form action="/logout" method="post">
        <noop &children="(get props logoutButtonHtml)"></noop>
      </form>
    </div>
  </header>`,
  };

  return renderView(
    '<AuthHeader &headerClass="(get props headerClass)" &title="(get props title)" &description="(get props description)" &descriptionClass="(get props descriptionClass)" &actionsHtml="(get props actionsHtml)" &themeToggleClass="(get props themeToggleClass)" &logoutButtonHtml="(get props logoutButtonHtml)"></AuthHeader>',
    {
      headerClass: escapeHtml(HEADER_CARD),
      title: escapeHtml(title),
      description: escapeHtml(description),
      descriptionClass: escapeHtml(SUBTLE_TEXT),
      actionsHtml,
      themeToggleClass: escapeHtml(
        `inline-flex items-center justify-center rounded-md border border-slate-300 p-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800 ${FOCUS_RING}`,
      ),
      logoutButtonHtml: renderButton({
        label: "Log out",
        type: "submit",
        variant: "neutral",
      }),
    },
    components,
  );
}
