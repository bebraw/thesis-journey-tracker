import { BODY_CLASS_LOGIN, renderButton } from "../components";
import { type HtmlispComponents } from "../htmlisp";
import { escapeHtml } from "../utils";
import { renderDocument, renderView } from "./shared";
import { SUBTLE_TEXT } from "../components";

export function renderLoginPage(showError: boolean): string {
  const components: HtmlispComponents = {
    ErrorFlash:
      '<p &visibleIf="(get props visible)" role="alert" aria-live="assertive" class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-900/30 dark:text-rose-200" &children="(get props message)"></p>',
  };

  const bodyContent = renderView(
    `<main class="mx-auto flex h-full max-w-md items-center px-6">
      <section class="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <h1 class="text-2xl font-semibold">Thesis Journey Tracker</h1>
        <p &class="(get props subtleText)">Private advisor dashboard login</p>
        <ErrorFlash &visible="(get props showError)" &message="(get props errorMessage)"></ErrorFlash>
        <form action="/login" method="post" class="mt-6 space-y-4">
          <label class="block text-sm font-medium" for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-800" />
          <noop &children="(get props signInButtonHtml)"></noop>
        </form>
      </section>
    </main>`,
    {
      subtleText: escapeHtml(`mt-2 ${SUBTLE_TEXT}`),
      showError,
      errorMessage: escapeHtml("Invalid password. Please try again."),
      signInButtonHtml: renderButton({
        label: "Sign in",
        type: "submit",
        variant: "primaryBlock",
        className: "transition",
      }),
    },
    components,
  );

  return renderDocument(
    "Thesis Journey Tracker - Login",
    bodyContent,
    BODY_CLASS_LOGIN,
  );
}
