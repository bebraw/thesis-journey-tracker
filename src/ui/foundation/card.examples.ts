import { raw, renderEscapedHTMLisp } from "../../htmlisp";
import type { UIExampleSection } from "../examples";
import { MUTED_TEXT_XS, SUBTLE_TEXT } from "../styles";
import { renderCard, renderCompactCard } from "./card.htmlisp";

export function getCardExamplesSection(): UIExampleSection {
  return {
    title: "Surfaces",
    description: "Cards help sections feel consistent while still allowing different densities.",
    contentHtml: renderEscapedHTMLisp(
      `<div class="mt-panel-sm grid gap-panel-sm">
        <fragment &children="compactCard"></fragment>
        <fragment &children="standardCard"></fragment>
      </div>`,
      {
        compactCard: raw(renderCompactCard(
          renderEscapedHTMLisp(
            `<div>
              <h3 class="text-sm font-semibold">Compact Card</h3>
              <p &class="mutedTextXs" &children="description"></p>
            </div>`,
            {
              mutedTextXs: `mt-1 ${MUTED_TEXT_XS}`,
              description: "Used for metrics and lane columns.",
            },
          ),
        )),
        standardCard: raw(renderCard(
          renderEscapedHTMLisp(
            `<div>
              <h3 class="text-sm font-semibold">Standard Card</h3>
              <p &class="subtleText" &children="description"></p>
            </div>`,
            {
              subtleText: `mt-1 ${SUBTLE_TEXT}`,
              description: "Used for larger panels like the student editor and form pages.",
            },
          ),
          "p-panel-sm",
        )),
      },
    ),
  };
}
