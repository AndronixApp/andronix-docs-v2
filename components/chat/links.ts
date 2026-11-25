// Links an assistant reply may carry (build plan 1.11): exact hosts only. Anything else renders
// as text. Relative paths count as docs.andronix.app paths.

const GITHUB_REPOS = ["/AndronixApp/andronix-distros", "/termux/termux-x11"];

export function isAllowedLink(href: string): boolean {
  if (href.startsWith("/") && !href.startsWith("//")) return /^\/[\w\-./#?=&%]*$/.test(href);
  let u: URL;
  try { u = new URL(href); } catch { return false; }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
  const host = u.hostname.toLowerCase();
  if (host === "docs.andronix.app" || host === "andronix.app") return true;
  if (host === "play.google.com") {
    return u.pathname === "/store/apps/details" && u.searchParams.get("id") === "studio.com.techriz.andronix" && [...u.searchParams.keys()].every((k) => k === "id" || k === "hl");
  }
  if (host === "github.com") {
    const repo = GITHUB_REPOS.find((r) => u.pathname === r || u.pathname.toLowerCase().startsWith(r.toLowerCase() + "/"));
    if (!repo) return u.pathname === "" ? false : GITHUB_REPOS.some((r) => u.pathname.toLowerCase() === r.toLowerCase());
    const rest = u.pathname.slice(repo.length);
    // the repo page (readme), its releases, and README files
    return rest === "" || rest === "/" || /^\/releases(\/(latest|tag\/[\w.\-+]+|download\/[\w.\-+]+\/[\w.\-+]+))?\/?$/.test(rest) || /^\/blob\/[\w.\-]+\/README(\.md)?$/i.test(rest);
  }
  return false;
}

/** A source chip's short label: the path without the host (docs.andronix.app/use/vnc → /use/vnc). */
export function shortPath(url: string): string {
  try { const u = new URL(url); return u.hostname === "docs.andronix.app" ? u.pathname : u.hostname + u.pathname; } catch { return url; }
}
