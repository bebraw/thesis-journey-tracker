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

interface RenderableSelectOption {
  label: string;
  optionValue: string;
  selectedAttr?: string;
}

const BUTTON_LINK_TEMPLATE =
  '<a &href="(get props href)" &class="(get props className)"__EXTRA_ATTRIBUTES__ &children="(get props label)"></a>';
const BUTTON_TEMPLATE =
  '<button &type="(get props type)" &class="(get props className)"__EXTRA_ATTRIBUTES__ &children="(get props label)"></button>';
const BADGE_TEMPLATE =
  '<span &class="(get props className)" &children="(get props label)"></span>';
const CARD_TEMPLATE =
  '<article &class="(get props className)"><noop &children="(get props content)"></noop></article>';
const FIELD_SHELL_TEMPLATE =
  '<label &class="(get props wrapperClassName)"><span &class="(get props labelClassName)" &children="(get props label)"></span><noop &children="(get props controlHtml)"></noop></label>';
const INPUT_TEMPLATE = "<input__BASE_ATTRIBUTES____EXTRA_ATTRIBUTES__ />";
const SELECT_TEMPLATE =
  '<select__BASE_ATTRIBUTES____EXTRA_ATTRIBUTES__><noop &foreach="(get props options)"><option &value="(get props optionValue)" &selected="(get props selectedAttr)" &children="(get props label)"></option></noop></select>';
const TEXTAREA_TEMPLATE =
  '<textarea__BASE_ATTRIBUTES____EXTRA_ATTRIBUTES__ &children="(get props value)"></textarea>';

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
      fillTemplate(BUTTON_LINK_TEMPLATE, {
        __EXTRA_ATTRIBUTES__: extraAttributes,
      }),
      { className: mergedClassName, href: escapeHtml(href), label: safeLabel },
    );
  }

  return renderHTMLisp(
    fillTemplate(BUTTON_TEMPLATE, {
      __EXTRA_ATTRIBUTES__: extraAttributes,
    }),
    {
      className: mergedClassName,
      label: safeLabel,
      type: escapeHtml(type),
    },
  );
}

export function renderBadge(options: BadgeOptions): string {
  const { label, variant = "neutral", className } = options;

  return renderHTMLisp(BADGE_TEMPLATE, {
    className: escapeHtml(mergeClasses(BADGE_CLASS_MAP[variant], className)),
    label: escapeHtml(label),
  });
}

export function renderCard(content: string, className?: string): string {
  return renderHTMLisp(CARD_TEMPLATE, {
    className: escapeHtml(mergeClasses(SURFACE_CARD, className)),
    content,
  });
}

export function renderCompactCard(content: string, className?: string): string {
  return renderHTMLisp(CARD_TEMPLATE, {
    className: escapeHtml(mergeClasses(SURFACE_CARD_SM, className)),
    content,
  });
}

export function renderFieldShell(
  label: string,
  controlHtml: string,
  wrapperClassName = FORM_LABEL,
): string {
  return renderHTMLisp(FIELD_SHELL_TEMPLATE, {
    labelClassName: escapeHtml(FIELD_LABEL),
    label: escapeHtml(label),
    controlHtml,
    wrapperClassName: escapeHtml(wrapperClassName),
  });
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
    fillTemplate(INPUT_TEMPLATE, {
      __BASE_ATTRIBUTES__: baseAttributes,
      __EXTRA_ATTRIBUTES__: serializeHtmlispAttributes(extraAttributes),
    }),
  );

  return renderFieldShell(label, controlHtml, wrapperClassName);
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
    fillTemplate(SELECT_TEMPLATE, {
      __BASE_ATTRIBUTES__: baseAttributes,
      __EXTRA_ATTRIBUTES__: serializeHtmlispAttributes(extraAttributes),
    }),
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
    fillTemplate(TEXTAREA_TEMPLATE, {
      __BASE_ATTRIBUTES__: baseAttributes,
      __EXTRA_ATTRIBUTES__: serializeHtmlispAttributes(extraAttributes),
    }),
    { value: escapeHtml(value || "") },
  );

  return renderFieldShell(label, controlHtml, wrapperClassName);
}
