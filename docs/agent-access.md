# Codex And Recurring Meetings

## Connect Codex

Sign in to the tracker and open **Agent access** (under **More** for editor accounts). This page is also available to readonly accounts, including Professor.

1. Name your token, choose its expiry, and select **Create token and show setup**.
2. Select **Copy Codex configuration** and paste the block into your personal `~/.codex/config.toml`. Replace an existing `[mcp_servers.thesis_tracker]` block instead of adding a duplicate.
3. Restart Codex. Ask it to find a student and show their next meeting.
4. Select **Done — hide token** in the tracker. The plaintext token is only shown in the creation response; it cannot be recovered later. Create a replacement if needed.

The copied configuration contains a credential. Keep it in your private personal configuration, with file permissions restricted to your user; do not commit it to a repository or share it with another person. Advanced setups can use `bearer_token_env_var` instead of the static Authorization header. Codex's [official MCP documentation](https://developers.openai.com/codex/mcp/) describes shared configuration, HTTP headers, and environment-based credentials.

No local server, repository checkout, or OpenAI API key is required. The app serves a stateless Streamable HTTP MCP endpoint at `/mcp`, supporting protocol revisions `2025-03-26`, `2025-06-18`, and `2025-11-25`. Clients offering another version negotiate a supported version during initialization. Server-push SSE, resources, prompts, and OAuth discovery are not implemented.

## Access And Revocation

Each token belongs to the account that created it. Tokens carry that account's current role, checked on every request:

| Account role         | Tools                                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| readonly (Professor) | `list_students`, `get_student`                                                                                                                            |
| editor (Advisor)     | Read tools, plus `create_student`, `update_student`, `set_meeting_schedule`, `set_next_meeting`, `add_meeting_note`, `archive_student`, `restore_student` |

The server rejects write calls from readonly accounts even if a client constructs them manually. Access covers the same shared student dataset as the dashboard, including internal notes; Professor access is readonly, not a reduced set of fields. Account role changes apply immediately and account deletion invalidates associated tokens.

Tokens expire after 30, 90, or 365 days. **Your tokens → Revoke** disconnects a client immediately. Logging out of the browser leaves agent tokens active. The database stores only SHA-256 hashes of randomly generated 256-bit token secrets. Account credentials and tokens are excluded from student JSON exports and backups.

Browser forms still require same-origin requests. `/mcp` authenticates only bearer tokens, never browser cookies, and rejects foreign Origin headers. All request bodies are limited to 64 KiB. Tool schemas reject unknown fields and invalid inputs. No tool sends email or calendar invitations, runs SQL supplied by the client, deletes records permanently, or replaces the dataset.

## Internal Repeating Meetings

In a student's **Edit details**, set **Next meeting**, **Repeat meeting**, **Meeting timezone**, and optionally **Repeat until**. The next-meeting input uses the chosen schedule timezone when repeating. The UI offers weekly through every four weeks; MCP supports intervals of 1–52 weeks. End dates are inclusive. Clearing the next meeting or choosing **Not booked** when saving a note stops the repeating schedule.

The stored schedule anchors the weekday and local time, so Friday 14:00 in `Europe/Helsinki` stays 14:00 after a clock change. Recording a note with **Continue repeating schedule**, or calling `add_meeting_note` with the default `followUpAction: "keep"`, advances to the first occurrence after the recorded meeting. Historical notes preserve a later booking. Missed meetings remain overdue until a note or schedule adjustment is saved; the clock alone does not mark meetings complete.

If an occurrence falls in a skipped hour when daylight saving starts, that occurrence is skipped instead of moving the agreed local time. A first meeting in such a skipped hour is rejected.

`set_next_meeting` can override one occurrence while retaining the repeating anchor. A null next meeting stops the schedule. `set_meeting_schedule` replaces the anchor and sets the first occurrence as the next meeting. Repeating schedules survive student export, restore, and automated backups. They do not create Google Calendar entries.

Example request to Codex:

> Find Nghi Tran. Set an internal weekly meeting starting 16 October 2026 at 14:00 Europe/Helsinki, with no end date.

The corresponding `set_meeting_schedule` arguments, after resolving the exact student ID:

```json
{
  "studentId": 6,
  "schedule": {
    "startLocal": "2026-10-16T14:00",
    "timeZone": "Europe/Helsinki",
    "intervalWeeks": 1,
    "untilDate": null
  }
}
```

Timestamps for one-off meetings and notes require an explicit UTC `Z` or numeric timezone offset. Schedule anchors use a local datetime and a separate IANA timezone.

## Deploying This Feature

Apply migration `0005_recurring_meetings_and_agent_tokens.sql` before deploying the new Worker. It adds an optional student schedule column and the token table without changing existing records. No new Worker bindings or secrets are needed.
