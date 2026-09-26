// Andronix 2.0 code theme for Shiki. Colours are the shared code-syntax
// tokens from andronix-tokens.css (--andronix-code-*), so app, docs and web
// match; Shiki passes the var() values straight through to the page.
const v = (name: string) => `var(--andronix-${name})`;

export const andronixTheme = {
  name: "andronix",
  type: "dark" as const,
  colors: {
    "editor.background": v("code-bg"),
    "editor.foreground": v("code-text"),
  },
  tokenColors: [
    { settings: { foreground: v("code-text") } },
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: v("code-comment") } },
    {
      scope: ["entity.name.command", "entity.name.function", "support.function", "support.function.builtin", "keyword", "storage"],
      settings: { foreground: v("code-command") },
    },
    { scope: ["constant.other.option", "variable.parameter", "variable.other", "variable"], settings: { foreground: v("code-option") } },
    { scope: ["string", "punctuation.definition.string"], settings: { foreground: v("code-string") } },
    { scope: ["constant.numeric", "constant.language", "support.constant"], settings: { foreground: v("code-option") } },
    { scope: ["keyword.operator", "punctuation"], settings: { foreground: v("on-surface-variant") } },
    { scope: ["entity.name.tag", "meta.tag"], settings: { foreground: v("code-command") } },
    { scope: ["entity.other.attribute-name", "support.type.property-name"], settings: { foreground: v("code-option") } },
    { scope: ["invalid"], settings: { foreground: v("error") } },
  ],
};
