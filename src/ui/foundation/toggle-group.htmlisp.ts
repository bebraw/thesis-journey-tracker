import { mergeHtmlispAttributeMaps, renderEscapedHTMLisp } from "../../htmlisp";
import { mergeClasses } from "../helpers";
import { FOCUS_RING, TOGGLE_BUTTON_META, TOGGLE_BUTTON_SEGMENTED } from "../styles";
import type { ToggleGroupOptions } from "./toggle-group.types";

export function renderToggleGroup(options: ToggleGroupOptions): string {
  const {
    items,
    className,
    buttonClassName = TOGGLE_BUTTON_SEGMENTED,
    metaClassName = TOGGLE_BUTTON_META,
  } = options;

  const normalizedItems = items.map((item) => ({
    label: item.label,
    pressed: item.pressed ? "true" : "false",
    metaVisible: Boolean(item.meta),
    meta: item.meta || "",
    attributesMap: mergeHtmlispAttributeMaps(
      item.attrs,
      {
        type: "button",
        class: mergeClasses(buttonClassName, FOCUS_RING),
        "aria-pressed": item.pressed ? "true" : "false",
      },
    ),
  }));

  return renderEscapedHTMLisp(
    `<div &class="className">
      <fragment &foreach="items as item">
        <button &attrs="item.attributesMap">
          <span class="leading-tight" &children="item.label"></span>
          <span
            &visibleIf="item.metaVisible"
            &class="metaClassName"
            &children="item.meta"
          ></span>
        </button>
      </fragment>
    </div>`,
    {
      className,
      items: normalizedItems,
      metaClassName,
    },
  );
}
