import { escapeHtml } from "./utils";

export type ButtonVariant =
  | "neutral"
  | "primary"
  | "primaryBlock"
  | "successBlock"
  | "dangerBlock"
  | "inline";

export type BadgeVariant = "neutral" | "mock" | "count";

export interface ButtonOptions {
  label: string;
  href?: string;
  type?: "button" | "submit" | "reset";
  variant?: ButtonVariant;
  className?: string;
  attributes?: string;
}

export interface BadgeOptions {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface FieldOptions {
  label: string;
  name?: string;
  id?: string;
  type?: string;
  value?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  wrapperClassName?: string;
  attributes?: string;
}

export interface SelectFieldOptions {
  label: string;
  name?: string;
  id?: string;
  options: SelectOption[];
  value?: string;
  className?: string;
  wrapperClassName?: string;
  attributes?: string;
}

export interface TextareaFieldOptions {
  label: string;
  name?: string;
  id?: string;
  value?: string;
  rows?: number;
  className?: string;
  wrapperClassName?: string;
  required?: boolean;
  attributes?: string;
}

export const BODY_CLASS =
  "min-h-full bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100";
export const BODY_CLASS_LOGIN =
  "h-full bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100";
export const PAGE_WRAP =
  "mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8";
export const PAGE_WRAP_NARROW =
  "mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8";
export const HEADER_CARD =
  "flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between";
export const SURFACE_CARD =
  "rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900";
export const SURFACE_CARD_SM =
  "rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900";
export const SUBTLE_TEXT = "text-sm text-slate-600 dark:text-slate-300";
export const MUTED_TEXT = "text-sm text-slate-500 dark:text-slate-300";
export const MUTED_TEXT_XS = "text-xs text-slate-500 dark:text-slate-300";
export const FIELD_LABEL = "mb-1 block text-slate-600 dark:text-slate-300";
export const FORM_LABEL = "block text-sm";
export const FILTER_LABEL =
  "text-xs font-medium text-slate-600 dark:text-slate-300";
export const FIELD_CONTROL =
  "w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800";
export const FIELD_CONTROL_SM = `${FIELD_CONTROL} text-sm`;
export const FIELD_CONTROL_WITH_MARGIN = `mt-1 ${FIELD_CONTROL_SM}`;
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900";
export const TEXT_LINK = `underline-offset-2 hover:underline ${FOCUS_RING}`;
export const STATUS_BADGE = "rounded px-2 py-1 text-xs";

const BUTTON_CLASS_MAP: Record<ButtonVariant, string> = {
  neutral: `rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800 ${FOCUS_RING}`,
  primary: `rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 ${FOCUS_RING}`,
  primaryBlock: `w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 ${FOCUS_RING}`,
  successBlock:
    "w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900",
  dangerBlock:
    "w-full rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900",
  inline: `rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800/70 ${FOCUS_RING}`,
};

const BADGE_CLASS_MAP: Record<BadgeVariant, string> = {
  neutral:
    "rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  mock: "rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200",
  count:
    "shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200",
};

function mergeClasses(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function renderAttributes(attributes?: string): string {
  return attributes ? ` ${attributes}` : "";
}

export function renderButton(options: ButtonOptions): string {
  const {
    label,
    href,
    type = "button",
    variant = "neutral",
    className,
    attributes,
  } = options;
  const mergedClassName = mergeClasses(BUTTON_CLASS_MAP[variant], className);

  if (href) {
    return `<a href="${escapeHtml(href)}" class="${mergedClassName}"${renderAttributes(attributes)}>${escapeHtml(label)}</a>`;
  }

  return `<button type="${type}" class="${mergedClassName}"${renderAttributes(attributes)}>${escapeHtml(label)}</button>`;
}

export function renderBadge(options: BadgeOptions): string {
  const { label, variant = "neutral", className } = options;
  return `<span class="${mergeClasses(BADGE_CLASS_MAP[variant], className)}">${escapeHtml(label)}</span>`;
}

export function renderCard(content: string, className?: string): string {
  return `<article class="${mergeClasses(SURFACE_CARD, className)}">${content}</article>`;
}

export function renderCompactCard(content: string, className?: string): string {
  return `<article class="${mergeClasses(SURFACE_CARD_SM, className)}">${content}</article>`;
}

export function renderFieldShell(
  label: string,
  controlHtml: string,
  wrapperClassName = FORM_LABEL,
): string {
  return `<label class="${wrapperClassName}"><span class="${FIELD_LABEL}">${escapeHtml(label)}</span>${controlHtml}</label>`;
}

export function renderInputField(options: FieldOptions): string {
  const {
    label,
    name,
    id,
    type = "text",
    value,
    required = false,
    placeholder,
    className = FIELD_CONTROL,
    wrapperClassName = FORM_LABEL,
    attributes,
  } = options;
  const attrs = [
    name ? `name="${escapeHtml(name)}"` : "",
    id ? `id="${escapeHtml(id)}"` : "",
    `type="${escapeHtml(type)}"`,
    value !== undefined ? `value="${escapeHtml(value)}"` : "",
    placeholder !== undefined ? `placeholder="${escapeHtml(placeholder)}"` : "",
    required ? "required" : "",
    `class="${className}"`,
    attributes || "",
  ]
    .filter(Boolean)
    .join(" ");
  return renderFieldShell(label, `<input ${attrs} />`, wrapperClassName);
}

export function renderSelectField(options: SelectFieldOptions): string {
  const {
    label,
    name,
    id,
    options: selectOptions,
    value,
    className = FIELD_CONTROL,
    wrapperClassName = FORM_LABEL,
    attributes,
  } = options;
  const optionMarkup = selectOptions
    .map((option) => {
      const selected = option.value === value ? " selected" : "";
      return `<option value="${escapeHtml(option.value)}"${selected}>${escapeHtml(option.label)}</option>`;
    })
    .join("");
  const attrs = [
    name ? `name="${escapeHtml(name)}"` : "",
    id ? `id="${escapeHtml(id)}"` : "",
    `class="${className}"`,
    attributes || "",
  ]
    .filter(Boolean)
    .join(" ");
  return renderFieldShell(
    label,
    `<select ${attrs}>${optionMarkup}</select>`,
    wrapperClassName,
  );
}

export function renderTextareaField(options: TextareaFieldOptions): string {
  const {
    label,
    name,
    id,
    value,
    rows = 3,
    className = FIELD_CONTROL,
    wrapperClassName = FORM_LABEL,
    required = false,
    attributes,
  } = options;
  const attrs = [
    name ? `name="${escapeHtml(name)}"` : "",
    id ? `id="${escapeHtml(id)}"` : "",
    `rows="${rows}"`,
    required ? "required" : "",
    `class="${className}"`,
    attributes || "",
  ]
    .filter(Boolean)
    .join(" ");
  return renderFieldShell(
    label,
    `<textarea ${attrs}>${escapeHtml(value || "")}</textarea>`,
    wrapperClassName,
  );
}
