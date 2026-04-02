import { htmlispToHTMLSync, raw } from "htmlisp";

import type { HtmlispAttributeMap, HtmlispComponents, HtmlispProps, HtmlispRenderOptions } from "./types";

const SAFE_ATTRIBUTE_NAME = /^[A-Za-z_:][-A-Za-z0-9_:.]*$/;

export function renderHTMLisp(
  htmlInput: string,
  props: HtmlispProps = {},
  components?: HtmlispComponents,
  renderOptions?: HtmlispRenderOptions,
): string {
  return htmlispToHTMLSync({ htmlInput, props, components, renderOptions });
}

export function renderEscapedHTMLisp(
  htmlInput: string,
  props: HtmlispProps = {},
  components?: HtmlispComponents,
): string {
  return renderHTMLisp(htmlInput, props, components, { escapeByDefault: true });
}

export function rawProps<T extends object>(props: T & Record<keyof T, string>): Record<keyof T, unknown> {
  return Object.fromEntries(
    Object.entries(props as Record<string, string>).map(([key, value]) => [key, raw(value)]),
  ) as Record<keyof T, unknown>;
}

export function mergeHtmlispAttributeMaps(...maps: Array<HtmlispAttributeMap | undefined>): HtmlispAttributeMap {
  return Object.fromEntries(
    maps
      .filter(Boolean)
      .flatMap((map) => Object.entries(map as HtmlispAttributeMap))
      .filter(([name, value]) => value !== undefined && value !== null && value !== false && SAFE_ATTRIBUTE_NAME.test(name)),
  );
}

export { raw };
