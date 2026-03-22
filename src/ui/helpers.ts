import { escapeHtml } from "../utils";

export function mergeClasses(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function escapeOptional(value: string | undefined): string | undefined {
  return value === undefined ? undefined : escapeHtml(value);
}

export function fillTemplate(template: string, replacements: Record<string, string>): string {
  return Object.entries(replacements).reduce((output, [token, value]) => output.replaceAll(token, value), template);
}
