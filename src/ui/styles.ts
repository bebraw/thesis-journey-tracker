import type { BadgeVariant, ButtonVariant } from "./types";

export const BODY_CLASS = "min-h-full bg-app-canvas text-app-text dark:bg-app-canvas-dark dark:text-app-text-dark";
export const BODY_CLASS_LOGIN = "h-full bg-app-canvas text-app-text dark:bg-app-canvas-dark dark:text-app-text-dark";
export const PAGE_WRAP = "mx-auto max-w-layout space-y-stack px-page-x py-page-y sm:px-page-x-sm lg:px-page-x-lg";
export const PAGE_WRAP_NARROW = "mx-auto max-w-layout-narrow space-y-stack px-page-x py-page-y sm:px-page-x-sm lg:px-page-x-lg";
export const HEADER_CARD =
  "flex flex-col gap-panel-sm rounded-panel border border-app-line bg-app-surface p-panel-sm shadow-panel dark:border-app-line-dark dark:bg-app-surface-dark sm:flex-row sm:items-center sm:justify-between";
export const SURFACE_CARD =
  "rounded-panel border border-app-line bg-app-surface p-panel dark:border-app-line-dark dark:bg-app-surface-dark";
export const SURFACE_CARD_SM =
  "rounded-card border border-app-line bg-app-surface p-panel-sm dark:border-app-line-dark dark:bg-app-surface-dark";
export const SOFT_SURFACE_CARD =
  "rounded-card border border-app-line bg-app-surface-soft p-stack-xs text-sm dark:border-app-line-dark dark:bg-app-surface-soft-dark/70";
export const EMPTY_STATE_CARD =
  "rounded-control border border-app-line p-stack-xs text-sm text-app-text-soft dark:border-app-line-dark dark:text-app-text-soft-dark";
export const LOGIN_CARD =
  "w-full rounded-panel border border-app-line bg-app-surface p-panel-lg shadow-elevated dark:border-app-line-dark dark:bg-app-surface-dark";
export const SUBTLE_TEXT = "text-sm text-app-text-soft dark:text-app-text-soft-dark";
export const MUTED_TEXT = "text-sm text-app-text-muted dark:text-app-text-muted-dark";
export const MUTED_TEXT_XS = "text-xs text-app-text-muted dark:text-app-text-muted-dark";
export const TOPIC_TEXT = "mt-1 text-sm font-medium text-app-text-soft dark:text-app-text-soft-dark";
export const TOPIC_TEXT_SM = "mt-1 text-xs font-medium text-app-text-soft dark:text-app-text-soft-dark";
export const FIELD_LABEL = "mb-1 block text-app-text-soft dark:text-app-text-soft-dark";
export const FORM_LABEL = "block min-w-0 text-sm";
export const FILTER_LABEL = "text-xs font-medium text-app-text-soft dark:text-app-text-soft-dark";
export const FIELD_CONTROL =
  "min-w-0 max-w-full w-full rounded-control border border-app-field bg-app-surface px-control-x py-control-y text-app-text dark:border-app-field-dark dark:bg-app-surface-soft-dark dark:text-app-text-dark";
export const FIELD_CONTROL_SM = `${FIELD_CONTROL} text-sm`;
export const FIELD_CONTROL_WITH_MARGIN = `mt-1 ${FIELD_CONTROL_SM}`;
export const FOCUS_RING =
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-app-surface-dark";
export const TEXT_LINK = `underline-offset-2 hover:underline ${FOCUS_RING}`;
export const STATUS_BADGE = "rounded-control px-badge-pill-x py-badge-pill-y text-xs";
export const THEME_TOGGLE_BUTTON = `inline-flex items-center justify-center rounded-control border border-app-field p-control-y text-sm font-medium text-app-text hover:bg-app-surface-soft dark:border-app-field-dark dark:text-app-text-dark dark:hover:bg-app-surface-soft-dark ${FOCUS_RING}`;
export const DANGER_PANEL =
  "rounded-panel border border-app-danger-line bg-app-danger-soft/60 p-panel-sm dark:border-app-danger-soft-dark/60 dark:bg-app-danger-soft-dark/30";
export const DANGER_TITLE = "text-lg font-semibold text-app-danger-text dark:text-app-danger-text-dark";
export const DANGER_TEXT = "mt-1 text-sm text-app-danger-text dark:text-app-danger-text-dark";
export const EMPTY_DASHED_CARD =
  "rounded-card border border-dashed border-app-line-strong px-control-x py-panel-sm text-xs text-app-text-muted dark:border-app-line-dark-strong dark:text-app-text-muted-dark";
export const TABLE_HEADER_ROW = "text-left text-xs uppercase tracking-wide text-app-text-muted dark:text-app-text-muted-dark";
export const TABLE_CELL = "px-cell-x py-cell-y align-top";
export const FORM_STACK = "mt-stack-xs space-y-stack-xs";
export const PANEL_STACK = "space-y-stack";
export const SECTION_STACK_SM = "space-y-stack-xs";
export const DISCLOSURE =
  "rounded-card border border-app-line bg-app-surface-soft/70 dark:border-app-line-dark dark:bg-app-surface-soft-dark/40";
export const DISCLOSURE_SUMMARY = `flex cursor-pointer list-none items-center justify-between gap-stack-xs rounded-card px-panel-sm py-stack-xs text-lg font-semibold marker:content-[''] hover:bg-app-surface-soft dark:hover:bg-app-surface-soft-dark/50 ${FOCUS_RING}`;
export const DISCLOSURE_CONTENT = "px-panel-sm pb-panel-sm";

export const ALERT_CLASS_MAP = {
  success:
    "rounded-control border border-app-success-line bg-app-success-soft px-control-x py-control-y text-sm text-app-success-text dark:border-app-success-line-dark/40 dark:bg-app-success-soft-dark/30 dark:text-app-success-text-dark",
  error:
    "rounded-control border border-app-danger-line bg-app-danger-soft px-control-x py-control-y text-sm text-app-danger-text dark:border-app-danger-line-dark/40 dark:bg-app-danger-soft-dark/30 dark:text-app-danger-text-dark",
} as const;

export const MEETING_STATUS_BADGE_CLASS_MAP = {
  not_booked: "bg-app-line px-badge-pill-x py-badge-pill-y text-app-text-soft dark:bg-app-line-dark dark:text-app-text-soft-dark",
  overdue:
    "bg-app-danger-soft px-badge-pill-x py-badge-pill-y text-app-danger-text dark:bg-app-danger-soft-dark/40 dark:text-app-danger-text-dark",
  within_2_weeks:
    "bg-app-warning px-badge-pill-x py-badge-pill-y text-app-warning-text dark:bg-app-warning-soft-dark/40 dark:text-app-warning-text-dark",
  scheduled:
    "bg-app-success-soft px-badge-pill-x py-badge-pill-y text-app-success-text dark:bg-app-success-soft-dark/40 dark:text-app-success-text-dark",
} as const;

export function getMeetingStatusBadgeClass(statusId: string): string {
  return (
    MEETING_STATUS_BADGE_CLASS_MAP[statusId as keyof typeof MEETING_STATUS_BADGE_CLASS_MAP] ?? MEETING_STATUS_BADGE_CLASS_MAP.not_booked
  );
}

export const BUTTON_CLASS_MAP: Record<ButtonVariant, string> = {
  neutral: `rounded-control border border-app-field px-control-x py-control-y text-sm font-medium text-app-text hover:bg-app-surface-soft dark:border-app-field-dark dark:text-app-text-dark dark:hover:bg-app-surface-soft-dark ${FOCUS_RING}`,
  primary: `rounded-control bg-app-brand px-control-x py-control-y text-sm font-medium text-white hover:bg-app-brand-strong ${FOCUS_RING}`,
  primaryBlock: `w-full rounded-control bg-app-brand px-panel-sm py-control-y text-sm font-semibold text-white hover:bg-app-brand-strong ${FOCUS_RING}`,
  successBlock:
    "w-full rounded-control bg-app-success px-panel-sm py-control-y text-sm font-semibold text-white hover:bg-app-success-strong focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-success focus-visible:ring-offset-2 dark:focus-visible:ring-offset-app-surface-dark",
  dangerBlock:
    "w-full rounded-control bg-app-danger px-panel-sm py-control-y text-sm font-semibold text-white hover:bg-app-danger-strong focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-danger focus-visible:ring-offset-2 dark:focus-visible:ring-offset-app-surface-dark",
  inline: `rounded-control border border-app-field px-badge-x py-badge-pill-y text-xs text-app-text hover:bg-app-surface-soft dark:border-app-field-dark dark:text-app-text-dark dark:hover:bg-app-surface-soft-dark/70 ${FOCUS_RING}`,
};

export const BADGE_CLASS_MAP: Record<BadgeVariant, string> = {
  neutral:
    "rounded-control bg-app-line px-badge-x py-badge-y text-xs text-app-text-soft dark:bg-app-line-dark dark:text-app-text-soft-dark",
  mock: "rounded-control bg-app-mock-soft px-badge-x py-badge-y text-xs text-app-mock-text dark:bg-app-mock-soft-dark/50 dark:text-app-mock-text-dark",
  count:
    "shrink-0 rounded-full bg-app-surface-soft px-badge-pill-x py-badge-pill-y text-xs font-semibold text-app-text-soft dark:bg-app-line-dark dark:text-app-text-soft-dark",
};
