// A small, safe markdown reader for assistant replies (build plan 1.11 rendering rules).
// It never produces HTML: the result is a tree React renders as text, so raw HTML in a reply
// shows as text. Images render as their alt text. Links are kept only for allowed hosts
// (links.ts); everything else becomes text.

export type Inline =
  | { t: "text"; v: string }
  | { t: "code"; v: string }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "link"; href: string; c: Inline[] };

export type Block =
  | { t: "p"; c: Inline[] }
  | { t: "h"; c: Inline[] }
  | { t: "ol"; start: number; items: Inline[][] }
  | { t: "ul"; items: Inline[][] }
  | { t: "code"; lang: string; text: string; closed: boolean };

const FENCE = /^\s*(```+|~~~+)\s*([\w+-]*)\s*$/;
const OL = /^\s*(\d{1,3})[.)]\s+(.*)$/;
const UL = /^\s*[-*+]\s+(.*)$/;
const H = /^\s{0,3}#{1,6}\s+(.*)$/;

export function parseBlocks(src: string, isAllowedLink: (href: string) => boolean): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: Block[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) { out.push({ t: "p", c: parseInline(para.join("\n"), isAllowedLink) }); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = FENCE.exec(line);
    if (fence) {
      flush();
      const marker = fence[1];
      const body: string[] = [];
      let closed = false;
      for (i++; i < lines.length; i++) {
        if (lines[i].trim().startsWith(marker[0].repeat(3)) && lines[i].trim().replace(/[`~]/g, "") === "") { closed = true; break; }
        body.push(lines[i]);
      }
      out.push({ t: "code", lang: fence[2] || "", text: body.join("\n"), closed });
      continue;
    }
    if (!line.trim()) { flush(); continue; }
    const h = H.exec(line);
    if (h) { flush(); out.push({ t: "h", c: parseInline(h[1], isAllowedLink) }); continue; }
    const ol = OL.exec(line);
    const ul = UL.exec(line);
    if (ol || ul) {
      flush();
      const ordered = !!ol;
      const items: Inline[][] = [];
      const start = ol ? Number(ol[1]) : 1;
      for (; i < lines.length; i++) {
        const m = ordered ? OL.exec(lines[i]) : UL.exec(lines[i]);
        if (m) { items.push(parseInline(ordered ? m[2] : m[1], isAllowedLink)); continue; }
        // a continuation line (indented, non-empty) joins the item before it
        if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && !FENCE.test(lines[i]) && items.length) {
          items[items.length - 1] = [...items[items.length - 1], { t: "text", v: " " }, ...parseInline(lines[i].trim(), isAllowedLink)];
          continue;
        }
        break;
      }
      i--;
      out.push(ordered ? { t: "ol", start, items } : { t: "ul", items });
      continue;
    }
    para.push(line.replace(/^\s{0,3}>\s?/, ""));
  }
  flush();
  return out;
}

export function parseInline(src: string, isAllowedLink: (href: string) => boolean): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const pushText = () => { if (text) { out.push({ t: "text", v: text }); text = ""; } };
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\" && i + 1 < src.length && /[\\`*_[\]()!#]/.test(src[i + 1])) { text += src[i + 1]; i += 2; continue; }
    if (ch === "`") {
      const end = src.indexOf("`", i + 1);
      if (end > i) { pushText(); out.push({ t: "code", v: src.slice(i + 1, end) }); i = end + 1; continue; }
    }
    if ((ch === "*" || ch === "_") && src[i + 1] === ch) {
      const end = src.indexOf(ch + ch, i + 2);
      if (end > i + 2) { pushText(); out.push({ t: "strong", c: parseInline(src.slice(i + 2, end), isAllowedLink) }); i = end + 2; continue; }
    }
    if ((ch === "*" || ch === "_") && src[i + 1] && src[i + 1] !== " ") {
      const end = src.indexOf(ch, i + 1);
      const prev = src[i - 1];
      if (end > i + 1 && (ch === "*" || !prev || !/\w/.test(prev))) { pushText(); out.push({ t: "em", c: parseInline(src.slice(i + 1, end), isAllowedLink) }); i = end + 1; continue; }
    }
    if (ch === "!" && src[i + 1] === "[") {
      const m = /^!\[([^\]]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/.exec(src.slice(i));
      if (m) { text += m[1]; i += m[0].length; continue; } // images: alt text only
    }
    if (ch === "[") {
      const m = /^\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/.exec(src.slice(i));
      if (m) {
        pushText();
        const inner = parseInline(m[1], isAllowedLink);
        if (isAllowedLink(m[2])) out.push({ t: "link", href: m[2], c: inner });
        else out.push(...inner);
        i += m[0].length;
        continue;
      }
    }
    text += ch;
    i++;
  }
  pushText();
  return out;
}

export const inlineText = (c: Inline[]): string => c.map((x) => ("v" in x ? x.v : inlineText(x.c))).join("");
