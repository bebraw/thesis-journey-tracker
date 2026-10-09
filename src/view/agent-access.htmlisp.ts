import type { SessionUser } from "../auth";
import type { AgentTokenSummary } from "../agent/tokens";
import { raw } from "../htmlisp";
import {
  SURFACE_CARD,
  FIELD_CONTROL,
  PAGE_WRAP_NARROW,
  renderButton,
  renderInputField,
  renderSelectField,
  renderTextareaField,
} from "../ui";
import { renderAuthedPageDocument, renderView } from "./shared.htmlisp";

export function renderAgentAccessPage(
  user: SessionUser,
  tokens: AgentTokenSummary[],
  origin: string,
  secret: string | null,
  error: string | null,
): string {
  const access =
    user.role === "readonly"
      ? "Read-only: search students and read their details, meeting notes, and phase history."
      : "Editor: read and update students, record notes, and manage internal meeting schedules.";
  const setup = secret
    ? renderView(
        `<section &class="card"><h2 class="text-lg font-semibold">Connect Codex</h2>
    <p class="mt-2 text-sm">Copy this into your Codex configuration file (~/.codex/config.toml), then restart Codex. This token is shown only now. Keep the file private; anyone with the token has your account's access.</p>
    <fragment &children="config"></fragment>
    <fragment &children="copy"></fragment>
    <p class="mt-3 text-sm">In Codex, try: “Find Nghi Tran and show the next meeting.”</p>
    <a href="/agent-access" class="mt-3 inline-block text-sm underline">Done — hide token</a></section>`,
        {
          card: SURFACE_CARD,
          copy: raw(
            renderButton({
              label: "Copy Codex configuration",
              type: "button",
              variant: "primary",
              className: "mt-3",
              attrs: { "data-copy-field": "codexConfig" },
            }),
          ),
          config: raw(
            renderTextareaField({
              label: "Codex configuration — select and copy",
              name: "codexConfig",
              value: `[mcp_servers.thesis_tracker]\nurl = ${JSON.stringify(`${origin}/mcp`)}\nhttp_headers = { Authorization = ${JSON.stringify(`Bearer ${secret}`)} }\n`,
              rows: 5,
              className: `${FIELD_CONTROL} font-mono`,
              attrs: { readonly: true, spellcheck: "false", autocomplete: "off" },
            }),
          ),
        },
      )
    : "";
  const create = renderView(
    `<section &class="card"><h2 class="text-lg font-semibold">Create an access token</h2>
    <p class="mt-2 text-sm" &children="access"></p>
    <p class="mt-2 text-sm">Each person signs in with their own account and creates their own token. Professor accounts retain readonly access through MCP.</p>
    <form action="/agent-access" method="post" class="mt-4 space-y-3"><fragment &children="name"></fragment><fragment &children="expiry"></fragment><fragment &children="submit"></fragment></form></section>`,
    {
      card: SURFACE_CARD,
      access,
      name: raw(
        renderInputField({
          label: "Token name",
          name: "name",
          value: "Codex",
          required: true,
          className: FIELD_CONTROL,
          attrs: { maxlength: "100" },
        }),
      ),
      expiry: raw(
        renderSelectField({
          label: "Expires after",
          name: "days",
          value: "90",
          className: FIELD_CONTROL,
          options: [30, 90, 365].map((days) => ({ value: String(days), label: `${days} days` })),
        }),
      ),
      submit: raw(renderButton({ label: "Create token and show setup", type: "submit", variant: "primary" })),
    },
  );
  const now = new Date().toISOString();
  const rows = tokens
    .map((token) =>
      renderView(
        `<li class="flex flex-wrap items-center justify-between gap-3 border-t border-app-line py-3 dark:border-app-line-dark"><div><p class="text-sm font-medium" &children="name"></p><p class="text-xs text-app-text-muted dark:text-app-text-muted-dark" &children="status"></p></div><form &visibleIf="active" action="/agent-access" method="post"><input type="hidden" name="action" value="revoke"/><input type="hidden" name="tokenId" &value="id"/><fragment &children="revoke"></fragment></form></li>`,
        {
          name: token.name,
          status: token.revoked_at ? "Revoked" : token.expires_at <= now ? "Expired" : `Expires ${token.expires_at.slice(0, 10)}`,
          active: !token.revoked_at && token.expires_at > now,
          id: token.id,
          revoke: raw(renderButton({ label: "Revoke", type: "submit", variant: "neutral" })),
        },
      ),
    )
    .join("");
  const existing = renderView(
    `<section &class="card"><h2 class="text-lg font-semibold">Your tokens</h2><p class="mt-2 text-sm">Revoke a token to disconnect that client immediately. Tokens use your current account role and remain active when you log out.</p><ul class="mt-3" &children="rows"></ul><p &visibleIf="empty" class="mt-3 text-sm">No tokens created yet.</p></section>`,
    { card: SURFACE_CARD, rows: raw(rows), empty: tokens.length === 0 },
  );
  return renderAuthedPageDocument({
    documentTitle: "Thesis Journey Tracker - Agent Access",
    headerTitle: "Agent access",
    headerDescription: "Connect Codex to student data through MCP.",
    currentPage: "agent-access",
    viewer: user,
    pageWrapClass: PAGE_WRAP_NARROW,
    sections: [setup, create, existing],
    error,
  });
}
