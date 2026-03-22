import {
  ALERT_CLASS_MAP,
  BODY_CLASS_LOGIN,
  FIELD_CONTROL_SM,
  LOGIN_CARD,
  renderButton,
} from "../ui";
import { type HtmlispComponents } from "../htmlisp";
import { escapeHtml } from "../utils";
import { renderDocument, renderView } from "./shared";
import { SUBTLE_TEXT } from "../ui";

export function renderLoginPage(showError: boolean): string {
  const components: HtmlispComponents = {
    ErrorFlash:
      '<p &visibleIf="(get props visible)" role="alert" aria-live="assertive" &class="(get props errorClass)" &children="(get props message)"></p>',
  };

  const bodyContent = renderView(
    `<main class="mx-auto flex h-full max-w-auth items-center px-page-x-sm">
      <section &class="(get props cardClass)">
        <h1 class="text-2xl font-semibold">Thesis Journey Tracker</h1>
        <p &class="(get props subtleText)">Private advisor dashboard login</p>
        <ErrorFlash &visible="(get props showError)" &message="(get props errorMessage)"></ErrorFlash>
        <form action="/login" method="post" class="mt-stack space-y-panel-sm">
          <label class="block text-sm font-medium" for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required &class="(get props passwordFieldClass)" />
          <noop &children="(get props signInButtonHtml)"></noop>
        </form>
      </section>
    </main>`,
    {
      cardClass: escapeHtml(LOGIN_CARD),
      errorClass: escapeHtml(ALERT_CLASS_MAP.error),
      passwordFieldClass: escapeHtml(
        `${FIELD_CONTROL_SM} outline-none ring-app-brand focus:ring-2`,
      ),
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
