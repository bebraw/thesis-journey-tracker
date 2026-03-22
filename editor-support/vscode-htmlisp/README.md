# HTMLisp Language Support For VS Code

This extension adds:

- syntax highlighting for standalone `.htmlisp` and `.hisp` files
- a dedicated `TypeScript HTMLisp` mode for `.htmlisp.ts` files
- bracket pairing for tags and expressions
- best-effort highlighting for HTMLisp-like template literals inside JavaScript and TypeScript files

## Supported Syntax

- HTML-like tags
- component tags such as `<SiteLink />`
- special tags like `noop` and `slot`
- expression-bound attributes such as `&children`, `&foreach`, and `&visibleIf`
- comment-style metadata attributes such as `__reference`
- Lisp-style expressions inside quoted attribute values
- TypeScript as the outer language for `.htmlisp.ts` files

## Running Locally

1. Open this folder in VS Code:

```text
editor-support/vscode-htmlisp
```

2. Press `F5` to launch an Extension Development Host.

3. In the new VS Code window:

- open an `.htmlisp` file, or
- open a `.htmlisp.ts` file such as `samples/dashboard.htmlisp.ts`, or
- open a TypeScript file containing HTMLisp template literals

## TypeScript HTMLisp Mode

Use the dedicated `TypeScript HTMLisp` mode for files ending in `.htmlisp.ts`.

It is intended for TypeScript-heavy files that embed HTMLisp templates and should:

- preserve normal TypeScript highlighting outside template strings
- apply HTMLisp highlighting inside template literals that begin with markup
- avoid treating ordinary TypeScript strings as HTMLisp

TSX-style support is intentionally out of scope for this first version.

## Packaging Later

If you want to package or publish the extension later, use the extension folder as the package root and build a VSIX with `vsce`.
