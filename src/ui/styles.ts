import type { BadgeVariant } from "./app/badge.types";
import type { ButtonVariant } from "./foundation/button.types";

export const BODY_CLASS = "min-h-full bg-app-canvas text-app-text antialiased dark:bg-app-canvas-dark dark:text-app-text-dark";
export const BODY_CLASS_LOGIN = "h-full bg-app-canvas text-app-text antialiased dark:bg-app-canvas-dark dark:text-app-text-dark";
export const PAGE_WRAP = "mx-auto max-w-layout space-y-stack px-page-x py-page-y sm:px-page-x-sm lg:px-page-x-lg";
export const PAGE_WRAP_NARROW = "mx-auto max-w-layout-narrow space-y-stack px-page-x py-page-y sm:px-page-x-sm lg:px-page-x-lg";
export const HEADER_CARD =
  "sticky top-2 z-40 flex flex-col gap-badge-y overflow-visible rounded-panel border border-app-line bg-app-surface/92 px-panel-sm py-badge-pill-y shadow-panel backdrop-blur supports-[backdrop-filter]:bg-app-surface/88 dark:border-app-line-dark dark:bg-app-surface-dark/92 dark:supports-[backdrop-filter]:bg-app-surface-dark/84 sm:top-3 sm:flex-row sm:items-center sm:justify-between sm:gap-stack-xs sm:px-panel sm:py-badge-pill-y";
export const SURFACE_CARD =
  "rounded-panel border border-app-line bg-app-surface p-panel shadow-panel dark:border-app-line-dark dark:bg-app-surface-dark";
export const SURFACE_CARD_SM =
  "rounded-card border border-app-line bg-app-surface p-panel-sm shadow-panel dark:border-app-line-dark dark:bg-app-surface-dark";
export const INSET_SURFACE_CARD =
  "rounded-card border border-app-line bg-app-surface-soft/75 p-panel-sm dark:border-app-line-dark dark:bg-app-surface-soft-dark/35";
export const SOFT_SURFACE_CARD =
  "rounded-card border border-app-line bg-app-surface-soft px-panel-sm py-stack-xs text-sm dark:border-app-line-dark dark:bg-app-surface-soft-dark/80";
export const EMPTY_STATE_CARD =
  "rounded-card border border-dashed border-app-line-strong bg-app-surface-soft/75 px-panel-sm py-stack-xs text-sm text-app-text-soft dark:border-app-line-dark-strong dark:bg-app-surface-soft-dark/30 dark:text-app-text-soft-dark";
export const LOGIN_CARD =
  "w-full overflow-hidden rounded-panel border border-app-line bg-app-surface p-panel-lg shadow-elevated dark:border-app-line-dark dark:bg-app-surface-dark";
export const SUBTLE_TEXT = "text-sm leading-6 text-app-text-soft dark:text-app-text-soft-dark";
export const MUTED_TEXT = "text-sm leading-6 text-app-text-muted dark:text-app-text-muted-dark";
export const MUTED_TEXT_XS = "text-xs leading-5 text-app-text-muted dark:text-app-text-muted-dark";
export const TOPIC_TEXT = "mt-1 text-sm font-medium text-app-text-soft dark:text-app-text-soft-dark";
export const TOPIC_TEXT_SM = "mt-1 text-xs font-medium text-app-text-soft dark:text-app-text-soft-dark";
export const FIELD_LABEL = "mb-1 block text-app-text-soft dark:text-app-text-soft-dark";
export const FORM_LABEL = "block min-w-0 text-sm";
export const FILTER_LABEL =
  "text-[11px] font-semibold uppercase tracking-[0.16em] text-app-text-muted dark:text-app-text-muted-dark";
export const FIELD_CONTROL =
  "min-w-0 max-w-full w-full rounded-control border border-app-field bg-app-surface px-control-x py-control-y text-app-text shadow-sm transition outline-hidden placeholder:text-app-text-muted focus:border-app-brand focus-visible:ring-2 focus-visible:ring-app-brand/20 dark:border-app-field-dark dark:bg-app-surface-soft-dark dark:text-app-text-dark dark:placeholder:text-app-text-muted-dark";
export const FIELD_CONTROL_SM = `${FIELD_CONTROL} text-sm`;
export const FIELD_CONTROL_WITH_MARGIN = `mt-1 ${FIELD_CONTROL_SM}`;
export const FOCUS_RING =
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-app-surface-dark";
export const TEXT_LINK = `underline-offset-2 hover:underline ${FOCUS_RING}`;
export const STATUS_BADGE = "rounded-control px-badge-pill-x py-badge-pill-y text-xs";
export const THEME_TOGGLE_BUTTON = `inline-flex h-8 w-8 items-center justify-center rounded-full border border-app-field bg-app-surface text-sm font-medium text-app-text shadow-sm hover:bg-app-surface-soft dark:border-app-field-dark dark:bg-app-surface-dark dark:text-app-text-dark dark:hover:bg-app-surface-soft-dark sm:h-9 sm:w-9 ${FOCUS_RING}`;
export const TOGGLE_GROUP_SEGMENTED =
  "inline-flex items-center gap-1 rounded-control bg-app-surface-soft/45 p-0.5 dark:bg-app-surface-soft-dark/25";
export const TOGGLE_BUTTON_SEGMENTED =
  "rounded-control border border-transparent px-badge-pill-x py-badge-pill-y text-xs font-medium text-app-text transition hover:bg-app-surface hover:text-app-text aria-[pressed='true']:border-app-brand aria-[pressed='true']:bg-app-surface aria-[pressed='true']:text-app-brand-strong aria-[pressed='true']:shadow-sm dark:text-app-text-dark dark:hover:bg-app-surface-dark dark:hover:text-app-text-dark dark:aria-[pressed='true']:border-app-brand-ring dark:aria-[pressed='true']:bg-app-surface-dark dark:aria-[pressed='true']:text-app-brand-ring sm:text-sm";
export const TOGGLE_BUTTON_PANEL =
  "inline-flex min-w-[8.25rem] flex-col items-start rounded-control border border-app-field bg-app-surface px-control-x py-badge-pill-y text-left text-sm font-medium text-app-text shadow-sm transition hover:bg-app-surface-soft aria-[pressed='true']:border-app-brand aria-[pressed='true']:bg-app-brand-soft/70 dark:border-app-field-dark dark:bg-app-surface-dark dark:text-app-text-dark dark:hover:bg-app-surface-soft-dark dark:aria-[pressed='true']:border-app-brand-ring dark:aria-[pressed='true']:bg-app-brand-soft-dark/25";
export const TOGGLE_BUTTON_META = "mt-0.5 text-[11px] leading-tight font-medium text-app-text-muted dark:text-app-text-muted-dark";
export const DANGER_PANEL =
  "rounded-panel border border-app-danger-line bg-app-danger-soft/70 p-panel-sm dark:border-app-danger-soft-dark/60 dark:bg-app-danger-soft-dark/35";
export const DANGER_TITLE = "text-lg font-semibold text-app-danger-text dark:text-app-danger-text-dark";
export const DANGER_TEXT = "mt-1 text-sm text-app-danger-text dark:text-app-danger-text-dark";
export const DANGER_PANEL_COMPACT =
  "rounded-control border border-app-danger-line/70 bg-app-danger-soft/45 p-panel-sm dark:border-app-danger-line-dark/40 dark:bg-app-danger-soft-dark/20";
export const DANGER_TITLE_SM = "text-sm font-semibold text-app-danger-text dark:text-app-danger-text-dark";
export const DANGER_TEXT_SM = "mt-1 text-sm text-app-danger-text dark:text-app-danger-text-dark";
export const EMPTY_DASHED_CARD =
  "rounded-card border border-dashed border-app-line-strong bg-app-surface-soft/75 px-control-x py-panel-sm text-xs text-app-text-muted dark:border-app-line-dark-strong dark:bg-app-surface-soft-dark/25 dark:text-app-text-muted-dark";
export const TABLE_HEADER_ROW = "text-left text-[11px] uppercase tracking-[0.16em] text-app-text-muted dark:text-app-text-muted-dark";
export const TABLE_CELL = "px-cell-x py-cell-y align-top";
export const FORM_STACK = "mt-stack-xs space-y-stack-xs";
export const PANEL_STACK = "space-y-stack";
export const SECTION_STACK_SM = "space-y-stack-xs";
export const SECTION_HEADER_ROW = "flex flex-col gap-badge-y sm:flex-row sm:items-baseline sm:justify-between";
export const SECTION_META_TEXT = "text-xs font-medium text-app-text-muted dark:text-app-text-muted-dark";
export const METADATA_GRID = "grid grid-cols-1 gap-stack-xs sm:grid-cols-2";
export const METADATA_TILE =
  "rounded-card border border-app-line bg-app-surface-soft/70 px-panel-sm py-stack-xs text-sm dark:border-app-line-dark dark:bg-app-surface-soft-dark/40";
export const METADATA_TERM =
  "text-xs font-medium uppercase tracking-wide text-app-text-muted dark:text-app-text-muted-dark";
export const METADATA_VALUE = "mt-1 font-medium";
export const DISCLOSURE =
  "rounded-card border border-app-line bg-app-surface-soft/70 dark:border-app-line-dark dark:bg-app-surface-soft-dark/40";
export const DISCLOSURE_SUMMARY = `flex cursor-pointer list-none items-center justify-between gap-stack-xs rounded-card px-panel-sm py-stack-xs text-base font-semibold marker:content-[''] hover:bg-app-surface-soft dark:hover:bg-app-surface-soft-dark/50 ${FOCUS_RING}`;
export const DISCLOSURE_CONTENT = "px-panel-sm pb-panel-sm";

export const ALERT_CLASS_MAP = {
  success:
    "rounded-control border border-app-success-line bg-app-success-soft px-control-x py-control-y text-sm text-app-success-text dark:border-app-success-line-dark/40 dark:bg-app-success-soft-dark/30 dark:text-app-success-text-dark",
  error:
    "rounded-control border border-app-danger-line bg-app-danger-soft px-control-x py-control-y text-sm text-app-danger-text dark:border-app-danger-line-dark/40 dark:bg-app-danger-soft-dark/30 dark:text-app-danger-text-dark",
} as const;

export const ALERT_TOAST_SUCCESS =
  "pointer-events-auto flex items-start gap-badge-y rounded-panel border border-app-success-line bg-app-success-soft/96 px-panel-sm py-stack-xs text-sm text-app-success-text opacity-100 shadow-elevated transition duration-200 ease-out supports-[backdrop-filter]:bg-app-success-soft/86 dark:border-app-success-line-dark/45 dark:bg-app-success-soft-dark/88 dark:text-app-success-text-dark dark:supports-[backdrop-filter]:bg-app-success-soft-dark/78";
export const ALERT_TOAST_ERROR =
  "pointer-events-auto flex items-start gap-badge-y rounded-panel border border-app-danger-line bg-app-danger-soft/96 px-panel-sm py-stack-xs text-sm text-app-danger-text opacity-100 shadow-elevated transition duration-200 ease-out supports-[backdrop-filter]:bg-app-danger-soft/86 dark:border-app-danger-line-dark/45 dark:bg-app-danger-soft-dark/88 dark:text-app-danger-text-dark dark:supports-[backdrop-filter]:bg-app-danger-soft-dark/78";

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
  neutral: `rounded-control border border-app-field bg-app-surface px-control-x py-control-y text-sm font-medium text-app-text shadow-sm hover:bg-app-surface-soft dark:border-app-field-dark dark:bg-app-surface-dark dark:text-app-text-dark dark:hover:bg-app-surface-soft-dark ${FOCUS_RING}`,
  primary: `rounded-control bg-app-brand px-control-x py-control-y text-sm font-medium text-white shadow-sm hover:bg-app-brand-strong ${FOCUS_RING}`,
  primaryBlock: `w-full rounded-control bg-app-brand px-panel-sm py-control-y text-sm font-semibold text-white shadow-sm hover:bg-app-brand-strong ${FOCUS_RING}`,
  successBlock:
    "w-full rounded-control bg-app-success px-panel-sm py-control-y text-sm font-semibold text-white shadow-sm hover:bg-app-success-strong focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-success focus-visible:ring-offset-2 dark:focus-visible:ring-offset-app-surface-dark",
  dangerBlock:
    "w-full rounded-control bg-app-danger px-panel-sm py-control-y text-sm font-semibold text-white shadow-sm hover:bg-app-danger-strong focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-danger focus-visible:ring-offset-2 dark:focus-visible:ring-offset-app-surface-dark",
  inline: `rounded-control border border-app-field bg-app-surface px-badge-x py-badge-pill-y text-xs text-app-text shadow-sm hover:bg-app-surface-soft dark:border-app-field-dark dark:bg-app-surface-dark dark:text-app-text-dark dark:hover:bg-app-surface-soft-dark/70 ${FOCUS_RING}`,
};

export const BADGE_CLASS_MAP: Record<BadgeVariant, string> = {
  neutral:
    "rounded-control bg-app-line px-badge-x py-badge-y text-xs text-app-text-soft dark:bg-app-line-dark dark:text-app-text-soft-dark",
  mock: "rounded-control bg-app-mock-soft px-badge-x py-badge-y text-xs text-app-mock-text dark:bg-app-mock-soft-dark/50 dark:text-app-mock-text-dark",
  count:
    "shrink-0 rounded-full bg-app-surface-soft px-badge-pill-x py-badge-pill-y text-xs font-semibold text-app-text-soft dark:bg-app-line-dark dark:text-app-text-soft-dark",
};
