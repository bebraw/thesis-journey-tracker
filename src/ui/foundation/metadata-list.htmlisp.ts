import { mergeHtmlispAttributeMaps, renderEscapedHTMLisp } from "../../htmlisp";
import { mergeClasses } from "../helpers";
import { METADATA_GRID, METADATA_TERM, METADATA_TILE, METADATA_VALUE } from "../styles";
import type { MetadataListOptions } from "../types";

export function renderMetadataList(options: MetadataListOptions): string {
  const {
    items,
    className,
    itemClassName = METADATA_TILE,
    termClassName = METADATA_TERM,
    valueClassName = METADATA_VALUE,
    attrs,
  } = options;

  const attributesMap = mergeHtmlispAttributeMaps(
    attrs,
    { class: mergeClasses(METADATA_GRID, className) },
  );

  return renderEscapedHTMLisp(
    `<dl &attrs="attributesMap">
      <fragment &foreach="items as item">
        <div &class="itemClassName">
          <dt &class="termClassName" &children="item.label"></dt>
          <dd &class="valueClassName" &children="item.value"></dd>
        </div>
      </fragment>
    </dl>`,
    {
      attributesMap,
      items,
      itemClassName,
      termClassName,
      valueClassName,
    },
  );
}
