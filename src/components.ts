import { escapeHtml } from "./utils";
import {
  buildHtmlispAttributes,
  getHtmlispAttributeValue,
  hasHtmlispBooleanAttribute,
  omitHtmlispAttributes,
  parseHtmlispAttributes,
  renderHTMLisp,
  serializeHtmlispAttributes,
} from "./htmlisp";

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
  "min-h-full bg-app-canvas text-app-text dark:bg-app-canvas-dark dark:text-app-text-dark";
export const BODY_CLASS_LOGIN =
  "h-full bg-app-canvas text-app-text dark:bg-app-canvas-dark dark:text-app-text-dark";
export const PAGE_WRAP =
  "mx-auto max-w-layout space-y-stack px-page-x py-page-y sm:px-page-x-sm lg:px-page-x-lg";
export const PAGE_WRAP_NARROW =
  "mx-auto max-w-layout-narrow space-y-stack px-page-x py-page-y sm:px-page-x-sm lg:px-page-x-lg";
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
export const SUBTLE_TEXT =
  "text-sm text-app-text-soft dark:text-app-text-soft-dark";
export const MUTED_TEXT =
  "text-sm text-app-text-muted dark:text-app-text-muted-dark";
export const MUTED_TEXT_XS =
  "text-xs text-app-text-muted dark:text-app-text-muted-dark";
export const TOPIC_TEXT =
  "mt-1 text-sm font-medium text-app-text-soft dark:text-app-text-soft-dark";
export const TOPIC_TEXT_SM =
  "mt-1 text-xs font-medium text-app-text-soft dark:text-app-text-soft-dark";
export const FIELD_LABEL =
  "mb-1 block text-app-text-soft dark:text-app-text-soft-dark";
export const FORM_LABEL = "block text-sm";
export const FILTER_LABEL =
  "text-xs font-medium text-app-text-soft dark:text-app-text-soft-dark";
export const FIELD_CONTROL =
  "w-full rounded-control border border-app-field bg-app-surface px-control-x py-control-y text-app-text dark:border-app-field-dark dark:bg-app-surface-soft-dark dark:text-app-text-dark";
export const FIELD_CONTROL_SM = `${FIELD_CONTROL} text-sm`;
export const FIELD_CONTROL_WITH_MARGIN = `mt-1 ${FIELD_CONTROL_SM}`;
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-app-surface-dark";
export const TEXT_LINK = `underline-offset-2 hover:underline ${FOCUS_RING}`;
export const STATUS_BADGE =
  "rounded-control px-badge-pill-x py-badge-pill-y text-xs";
export const THEME_TOGGLE_BUTTON = `inline-flex items-center justify-center rounded-control border border-app-field p-control-y text-sm font-medium text-app-text hover:bg-app-surface-soft dark:border-app-field-dark dark:text-app-text-dark dark:hover:bg-app-surface-soft-dark ${FOCUS_RING}`;
export const DANGER_PANEL =
  "rounded-panel border border-app-danger-line bg-app-danger-soft/60 p-panel-sm dark:border-app-danger-soft-dark/60 dark:bg-app-danger-soft-dark/30";
export const DANGER_TITLE =
  "text-lg font-semibold text-app-danger-text dark:text-app-danger-text-dark";
export const DANGER_TEXT =
  "mt-1 text-sm text-app-danger-text dark:text-app-danger-text-dark";
export const EMPTY_DASHED_CARD =
  "rounded-card border border-dashed border-app-line-strong px-control-x py-panel-sm text-xs text-app-text-muted dark:border-app-line-dark-strong dark:text-app-text-muted-dark";
export const TABLE_HEADER_ROW =
  "text-left text-xs uppercase tracking-wide text-app-text-muted dark:text-app-text-muted-dark";
export const TABLE_CELL = "px-cell-x py-cell-y align-top";
export const FORM_STACK = "mt-stack-xs space-y-stack-xs";
export const PANEL_STACK = "space-y-stack";
export const SECTION_STACK_SM = "space-y-stack-xs";

export const ALERT_CLASS_MAP = {
  success:
    "rounded-control border border-app-success-line bg-app-success-soft px-control-x py-control-y text-sm text-app-success-text dark:border-app-success-line-dark/40 dark:bg-app-success-soft-dark/30 dark:text-app-success-text-dark",
  error:
    "rounded-control border border-app-danger-line bg-app-danger-soft px-control-x py-control-y text-sm text-app-danger-text dark:border-app-danger-line-dark/40 dark:bg-app-danger-soft-dark/30 dark:text-app-danger-text-dark",
} as const;

export const MEETING_STATUS_BADGE_CLASS_MAP = {
  not_booked:
    "bg-app-line px-badge-pill-x py-badge-pill-y text-app-text-soft dark:bg-app-line-dark dark:text-app-text-soft-dark",
  overdue:
    "bg-app-danger-soft px-badge-pill-x py-badge-pill-y text-app-danger-text dark:bg-app-danger-soft-dark/40 dark:text-app-danger-text-dark",
  within_2_weeks:
    "bg-app-warning px-badge-pill-x py-badge-pill-y text-app-warning-text dark:bg-app-warning-soft-dark/40 dark:text-app-warning-text-dark",
  scheduled:
    "bg-app-success-soft px-badge-pill-x py-badge-pill-y text-app-success-text dark:bg-app-success-soft-dark/40 dark:text-app-success-text-dark",
} as const;

export function getMeetingStatusBadgeClass(statusId: string): string {
  return (
    MEETING_STATUS_BADGE_CLASS_MAP[
      statusId as keyof typeof MEETING_STATUS_BADGE_CLASS_MAP
    ] ?? MEETING_STATUS_BADGE_CLASS_MAP.not_booked
  );
}

const BUTTON_CLASS_MAP: Record<ButtonVariant, string> = {
  neutral: `rounded-control border border-app-field px-control-x py-control-y text-sm font-medium text-app-text hover:bg-app-surface-soft dark:border-app-field-dark dark:text-app-text-dark dark:hover:bg-app-surface-soft-dark ${FOCUS_RING}`,
  primary: `rounded-control bg-app-brand px-control-x py-control-y text-sm font-medium text-white hover:bg-app-brand-strong ${FOCUS_RING}`,
  primaryBlock: `w-full rounded-control bg-app-brand px-panel-sm py-control-y text-sm font-semibold text-white hover:bg-app-brand-strong ${FOCUS_RING}`,
  successBlock:
    "w-full rounded-control bg-app-success px-panel-sm py-control-y text-sm font-semibold text-white hover:bg-app-success-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-success focus-visible:ring-offset-2 dark:focus-visible:ring-offset-app-surface-dark",
  dangerBlock:
    "w-full rounded-control bg-app-danger px-panel-sm py-control-y text-sm font-semibold text-white hover:bg-app-danger-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-danger focus-visible:ring-offset-2 dark:focus-visible:ring-offset-app-surface-dark",
  inline: `rounded-control border border-app-field px-badge-x py-badge-pill-y text-xs text-app-text hover:bg-app-surface-soft dark:border-app-field-dark dark:text-app-text-dark dark:hover:bg-app-surface-soft-dark/70 ${FOCUS_RING}`,
};

const BADGE_CLASS_MAP: Record<BadgeVariant, string> = {
  neutral:
    "rounded-control bg-app-line px-badge-x py-badge-y text-xs text-app-text-soft dark:bg-app-line-dark dark:text-app-text-soft-dark",
  mock: "rounded-control bg-app-mock-soft px-badge-x py-badge-y text-xs text-app-mock-text dark:bg-app-mock-soft-dark/50 dark:text-app-mock-text-dark",
  count:
    "shrink-0 rounded-full bg-app-surface-soft px-badge-pill-x py-badge-pill-y text-xs font-semibold text-app-text-soft dark:bg-app-line-dark dark:text-app-text-soft-dark",
};

function mergeClasses(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function escapeOptional(value: string | undefined): string | undefined {
  return value === undefined ? undefined : escapeHtml(value);
}

function fillTemplate(
  template: string,
  replacements: Record<string, string>,
): string {
  return Object.entries(replacements).reduce(
    (output, [token, value]) => output.replaceAll(token, value),
    template,
  );
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

  const mergedClassName = escapeHtml(
    mergeClasses(BUTTON_CLASS_MAP[variant], className),
  );
  const extraAttributes = serializeHtmlispAttributes(
    parseHtmlispAttributes(attributes),
  );
  const safeLabel = escapeHtml(label);

  if (href) {
    return renderHTMLisp(
      fillTemplate(
        '<a &href="(get props href)" &class="(get props className)"__EXTRA_ATTRIBUTES__ &children="(get props label)"></a>',
        {
          __EXTRA_ATTRIBUTES__: extraAttributes,
        },
      ),
      { className: mergedClassName, href: escapeHtml(href), label: safeLabel },
    );
  }

  return renderHTMLisp(
    fillTemplate(
      '<button &type="(get props type)" &class="(get props className)"__EXTRA_ATTRIBUTES__ &children="(get props label)"></button>',
      {
        __EXTRA_ATTRIBUTES__: extraAttributes,
      },
    ),
    {
      className: mergedClassName,
      label: safeLabel,
      type: escapeHtml(type),
    },
  );
}

export function renderBadge(options: BadgeOptions): string {
  const { label, variant = "neutral", className } = options;

  return renderHTMLisp(
    '<span &class="(get props className)" &children="(get props label)"></span>',
    {
      className: escapeHtml(mergeClasses(BADGE_CLASS_MAP[variant], className)),
      label: escapeHtml(label),
    },
  );
}

export function renderCard(content: string, className?: string): string {
  return renderHTMLisp(
    '<article &class="(get props className)"><noop &children="(get props content)"></noop></article>',
    {
      className: escapeHtml(mergeClasses(SURFACE_CARD, className)),
      content,
    },
  );
}

export function renderCompactCard(content: string, className?: string): string {
  return renderHTMLisp(
    '<article &class="(get props className)"><noop &children="(get props content)"></noop></article>',
    {
      className: escapeHtml(mergeClasses(SURFACE_CARD_SM, className)),
      content,
    },
  );
}

export function renderFieldShell(
  label: string,
  controlHtml: string,
  wrapperClassName = FORM_LABEL,
): string {
  return renderHTMLisp(
    '<label &class="(get props wrapperClassName)"><span &class="(get props labelClassName)" &children="(get props label)"></span><noop &children="(get props controlHtml)"></noop></label>',
    {
      labelClassName: escapeHtml(FIELD_LABEL),
      label: escapeHtml(label),
      controlHtml,
      wrapperClassName: escapeHtml(wrapperClassName),
    },
  );
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

  const parsedAttributes = parseHtmlispAttributes(attributes);
  const resolvedType =
    getHtmlispAttributeValue(parsedAttributes, "type") ?? type;
  const resolvedRequired =
    required || hasHtmlispBooleanAttribute(parsedAttributes, "required");
  const extraAttributes = omitHtmlispAttributes(parsedAttributes, [
    "type",
    "name",
    "id",
    "value",
    "placeholder",
    "required",
    "class",
  ]);
  const baseAttributes = serializeHtmlispAttributes(
    buildHtmlispAttributes([
      { name: "name", value: escapeOptional(name) },
      { name: "id", value: escapeOptional(id) },
      { name: "type", value: escapeHtml(resolvedType) },
      { name: "value", value: escapeOptional(value) },
      { name: "placeholder", value: escapeOptional(placeholder) },
      { name: "class", value: escapeHtml(className) },
      { name: "required", value: resolvedRequired ? true : undefined },
    ]),
  );

  const controlHtml = renderHTMLisp(
    fillTemplate("<input__BASE_ATTRIBUTES____EXTRA_ATTRIBUTES__ />", {
      __BASE_ATTRIBUTES__: baseAttributes,
      __EXTRA_ATTRIBUTES__: serializeHtmlispAttributes(extraAttributes),
    }),
  );

  return renderFieldShell(label, controlHtml, wrapperClassName);
}

export function renderSelectField(options: SelectFieldOptions): string {
  interface RenderableSelectOption {
    label: string;
    optionValue: string;
    selectedAttr?: string;
  }

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

  const parsedAttributes = parseHtmlispAttributes(attributes);
  const extraAttributes = omitHtmlispAttributes(parsedAttributes, [
    "name",
    "id",
    "class",
  ]);
  const normalizedOptions: RenderableSelectOption[] = selectOptions.map(
    (option) => ({
      label: escapeHtml(option.label),
      optionValue: escapeHtml(option.value),
      selectedAttr: option.value === value ? "selected" : undefined,
    }),
  );
  const baseAttributes = serializeHtmlispAttributes(
    buildHtmlispAttributes([
      { name: "name", value: escapeOptional(name) },
      { name: "id", value: escapeOptional(id) },
      { name: "class", value: escapeHtml(className) },
    ]),
  );

  const controlHtml = renderHTMLisp(
    fillTemplate(
      '<select__BASE_ATTRIBUTES____EXTRA_ATTRIBUTES__><noop &foreach="(get props options)"><option &value="(get props optionValue)" &selected="(get props selectedAttr)" &children="(get props label)"></option></noop></select>',
      {
        __BASE_ATTRIBUTES__: baseAttributes,
        __EXTRA_ATTRIBUTES__: serializeHtmlispAttributes(extraAttributes),
      },
    ),
    { options: normalizedOptions },
  );

  return renderFieldShell(label, controlHtml, wrapperClassName);
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

  const parsedAttributes = parseHtmlispAttributes(attributes);
  const resolvedRequired =
    required || hasHtmlispBooleanAttribute(parsedAttributes, "required");
  const resolvedRows =
    getHtmlispAttributeValue(parsedAttributes, "rows") ?? String(rows);
  const extraAttributes = omitHtmlispAttributes(parsedAttributes, [
    "name",
    "id",
    "rows",
    "required",
    "class",
  ]);
  const baseAttributes = serializeHtmlispAttributes(
    buildHtmlispAttributes([
      { name: "name", value: escapeOptional(name) },
      { name: "id", value: escapeOptional(id) },
      { name: "rows", value: escapeHtml(resolvedRows) },
      { name: "class", value: escapeHtml(className) },
      { name: "required", value: resolvedRequired ? true : undefined },
    ]),
  );

  const controlHtml = renderHTMLisp(
    fillTemplate(
      '<textarea__BASE_ATTRIBUTES____EXTRA_ATTRIBUTES__ &children="(get props value)"></textarea>',
      {
        __BASE_ATTRIBUTES__: baseAttributes,
        __EXTRA_ATTRIBUTES__: serializeHtmlispAttributes(extraAttributes),
      },
    ),
    { value: escapeHtml(value || "") },
  );

  return renderFieldShell(label, controlHtml, wrapperClassName);
}
