import type { SessionUser } from "../auth";
import { raw } from "../htmlisp";
import { PAGE_WRAP_NARROW, SUBTLE_TEXT, renderButton, renderCard, renderInputField } from "../ui";
import { renderAuthedPageDocument, renderView } from "./shared.htmlisp";

export function renderAccountPage(user: SessionUser, notice: string | null, error: string | null): string {
  const form = renderView(
    `<form action="/account" method="post" class="max-w-md space-y-3">
      <input type="hidden" name="originalName" &value="originalName" />
      <fragment &children="username"></fragment>
      <p id="username-help" &class="helpClass">After changing your username, sign in again on your other browsers.</p>
      <fragment &children="submit"></fragment>
    </form>`,
    {
      originalName: user.name,
      username: raw(
        renderInputField({
          label: "Username",
          name: "name",
          value: user.name,
          required: true,
          attrs: {
            pattern: ".{1,100}",
            title: "Use 1 to 100 characters.",
            autocomplete: "username",
            autocapitalize: "none",
            spellcheck: "false",
            "aria-describedby": "username-help",
          },
        }),
      ),
      helpClass: SUBTLE_TEXT,
      submit: raw(renderButton({ label: "Save username", type: "submit", variant: "primary" })),
    },
  );
  return renderAuthedPageDocument({
    documentTitle: "My account – Thesis Journey Tracker",
    headerTitle: "My account",
    headerDescription: "Update your sign-in username.",
    currentPage: "account",
    viewer: user,
    pageWrapClass: PAGE_WRAP_NARROW,
    sections: [renderCard(form)],
    notice,
    error,
  });
}
