export function renderDashboardTitle(name: string) {
  const plainTypeScriptText = `This should stay plain TypeScript: ${name}`;

  const template = `<section &class="(get props className)">
    <h1 &children="(get props title)"></h1>
    <noop &visibleIf="(get props hasSubtitle)">
      <p &children="(get props subtitle)"></p>
    </noop>
  </section>`;

  return renderView(template, {
    className: "rounded-xl",
    title: `Dashboard for ${name}`,
    hasSubtitle: true,
    subtitle: plainTypeScriptText,
  });
}

export function renderInline() {
  return renderView(
    `<article &class="(get props cardClass)">
      <slot name="content"><noop &children="(get props content)"></noop></slot>
    </article>`,
    {
      cardClass: "bg-white",
      content: "Inline example",
    },
  );
}
