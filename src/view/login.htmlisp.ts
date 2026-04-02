import { ALERT_CLASS_MAP, BODY_CLASS_LOGIN, LOGIN_CARD } from "../ui/app";
import { FIELD_CONTROL_SM, SUBTLE_TEXT, renderButton } from "../ui/foundation";
import { raw, type HtmlispComponents } from "../htmlisp";
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
      &visibleIf="visible"
      role="alert"
      aria-live="assertive"
      &class="errorClass"
      &children="message"
    ></p>`,
  };

  const bodyContent = renderView(
    `<main class="mx-auto flex h-full max-w-auth items-center px-page-x-sm">
      <section &class="cardClass">
        <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-text-muted dark:text-app-text-muted-dark">Private Thesis Supervision</p>
        <h1 class="mt-3 text-3xl font-semibold">Thesis Journey Tracker</h1>
        <p &class="subtleText" &children="subtitle"></p>
        <ErrorFlash &visible="showError" &message="errorMessage" &errorClass="errorClass"></ErrorFlash>
        <form action="/login" method="post" class="mt-stack space-y-panel-sm">
          <label &visibleIf="showNameField" class="block text-sm font-medium" for="name">Name</label>
          <input
            &visibleIf="showNameField"
            id="name"
            name="name"
            type="text"
            autocomplete="username"
            autocapitalize="words"
            required
            &class="passwordFieldClass"
          />
          <label class="block text-sm font-medium" for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required &class="passwordFieldClass" />
          <fragment &children="signInButtonHtml"></fragment>
        </form>
      </section>
    </main>`,
    {
      cardClass: LOGIN_CARD,
      errorClass: ALERT_CLASS_MAP.error,
      passwordFieldClass: `${FIELD_CONTROL_SM} outline-hidden ring-app-brand focus:ring-2`,
      subtleText: `mt-2 max-w-sm ${SUBTLE_TEXT}`,
      showNameField: supportsMultipleAccounts,
      showError: Boolean(errorState),
      errorMessage,
      signInButtonHtml: raw(renderButton({
        label: "Sign in",
        type: "submit",
        variant: "primaryBlock",
        className: "transition",
      })),
      subtitle:
        supportsMultipleAccounts
          ? "Sign in with your assigned account to review students, meetings, and supervision history."
          : "Sign in to open the supervision dashboard for your current thesis cohort.",
    },
    components,
  );

  return renderDocument("Thesis Journey Tracker - Login", bodyContent, BODY_CLASS_LOGIN);
}
