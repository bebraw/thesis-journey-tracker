import { mergeHtmlispAttributeMaps, raw, renderEscapedHTMLisp } from "../../htmlisp";
import { mergeClasses } from "../helpers";
import { DISCLOSURE, DISCLOSURE_CONTENT, DISCLOSURE_SUMMARY } from "../styles";
import type { DisclosureOptions } from "./disclosure.types";

export function renderDisclosure(options: DisclosureOptions): string {
  const {
    summary,
    content,
    className,
    summaryClassName,
    contentClassName,
    attrs,
  } = options;

  const attributesMap = mergeHtmlispAttributeMaps(
    attrs,
    { class: mergeClasses(DISCLOSURE, className) },
  );

  return renderEscapedHTMLisp(
    `<details &attrs="attributesMap">
      <summary &class="summaryClassName" &children="summary"></summary>
      <div &class="contentClassName">
        <fragment &children="content"></fragment>
      </div>
    </details>`,
    {
      attributesMap,
      summaryClassName: mergeClasses(DISCLOSURE_SUMMARY, summaryClassName),
      summary,
      contentClassName: mergeClasses("pt-stack-xs", DISCLOSURE_CONTENT, contentClassName),
      content: raw(content),
    },
  );
}
