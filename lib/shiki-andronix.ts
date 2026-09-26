// Andronix 2.0 code theme for Shiki. Colours are the design tokens
// (andronix-tokens.css): commands in light orange, options in tonal brown,
// strings in olive, comments muted, everything else on-surface.
const t = {
  bg: "#0F0A07", // --andronix-code-bg
  fg: "#F2DFD4", // --andronix-on-surface
  variant: "#D6C2B5", // --andronix-on-surface-variant
  muted: "#A8958A", // --andronix-on-surface-muted
  primary: "#FFB689", // --andronix-primary
  secondary: "#E4BFA8", // --andronix-secondary
  tertiary: "#BFD39A", // --andronix-tertiary
  error: "#FFB4AB", // --andronix-error
};

export const andronixTheme = {
  name: "andronix",
  type: "dark" as const,
  colors: {
    "editor.background": t.bg,
    "editor.foreground": t.fg,
  },
  tokenColors: [
    { settings: { foreground: t.fg } },
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: t.muted } },
    {
      scope: ["entity.name.command", "entity.name.function", "support.function", "support.function.builtin", "keyword", "storage"],
      settings: { foreground: t.primary },
    },
    { scope: ["constant.other.option", "variable.parameter", "variable.other", "variable"], settings: { foreground: t.secondary } },
    { scope: ["string", "punctuation.definition.string"], settings: { foreground: t.tertiary } },
    { scope: ["constant.numeric", "constant.language", "support.constant"], settings: { foreground: t.secondary } },
    { scope: ["keyword.operator", "punctuation"], settings: { foreground: t.variant } },
    { scope: ["entity.name.tag", "meta.tag"], settings: { foreground: t.primary } },
    { scope: ["entity.other.attribute-name", "support.type.property-name"], settings: { foreground: t.secondary } },
    { scope: ["invalid"], settings: { foreground: t.error } },
  ],
};
