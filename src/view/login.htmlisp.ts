import { ALERT_CLASS_MAP, BODY_CLASS_LOGIN, FIELD_CONTROL_SM, LOGIN_CARD, renderButton, SUBTLE_TEXT } from "../ui";
import { type HtmlispComponents } from "../htmlisp";
import { escapeHtml } from "../utils";
import { renderDocument, renderView } from "./shared.htmlisp";

export function renderLoginPage(errorState: "invalid" | "rate_limit" | "password_reset" | null, supportsMultipleAccounts = false): string {
  const errorMessage =
    errorState === "rate_limit"
      ? "Too many failed sign-in attempts. Please wait 15 minutes and try again."
      : errorState === "password_reset"
        ? "This account needs a password reset before it can be used on Cloudflare. Re-create the account with the latest account:create command."
      : supportsMultipleAccounts
        ? "Invalid name or password. Please try again."
        : "Invalid password. Please try again.";

  const components: HtmlispComponents = {
    ErrorFlash: `<p
      &visibleIf="(get props visible)"
      role="alert"
      aria-live="assertive"
      &class="(get props errorClass)"
      &children="(get props message)"
    ></p>`,
  };

  const bodyContent = renderView(
    `<main class="mx-auto flex h-full max-w-auth items-center px-page-x-sm">
      <section &class="(get props cardClass)">
        <h1 class="text-2xl font-semibold">Thesis Journey Tracker</h1>
        <p &class="(get props subtleText)" &children="(get props subtitle)"></p>
        <ErrorFlash &visible="(get props showError)" &message="(get props errorMessage)"></ErrorFlash>
        <form action="/login" method="post" class="mt-stack space-y-panel-sm">
          <label &visibleIf="(get props showNameField)" class="block text-sm font-medium" for="name">Name</label>
          <input
            &visibleIf="(get props showNameField)"
            id="name"
            name="name"
            type="text"
            autocomplete="username"
            autocapitalize="words"
            required
            &class="(get props passwordFieldClass)"
          />
          <label class="block text-sm font-medium" for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required &class="(get props passwordFieldClass)" />
          <noop &children="(get props signInButtonHtml)"></noop>
        </form>
      </section>
    </main>`,
    {
      cardClass: escapeHtml(LOGIN_CARD),
      errorClass: escapeHtml(ALERT_CLASS_MAP.error),
      passwordFieldClass: escapeHtml(`${FIELD_CONTROL_SM} outline-hidden ring-app-brand focus:ring-2`),
      subtleText: escapeHtml(`mt-2 ${SUBTLE_TEXT}`),
      showNameField: supportsMultipleAccounts,
      showError: Boolean(errorState),
      errorMessage: escapeHtml(errorMessage),
      signInButtonHtml: renderButton({
        label: "Sign in",
        type: "submit",
        variant: "primaryBlock",
        className: "transition",
      }),
      subtitle: escapeHtml(supportsMultipleAccounts ? "Private supervision dashboard login for assigned accounts" : "Private advisor dashboard login"),
    },
    components,
  );

  return renderDocument("Thesis Journey Tracker - Login", bodyContent, BODY_CLASS_LOGIN);
}
