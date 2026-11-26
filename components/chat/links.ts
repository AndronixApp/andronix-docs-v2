// Links an assistant reply may carry (build plan 1.11): exact hosts only. Anything else renders
// as text. Relative paths count as docs.andronix.app paths.

const GITHUB_REPOS = ["/AndronixApp/andronix-distros", "/termux/termux-x11"];
// Repos where only the releases pages are allowed (the docs send people there for the APK).
const GITHUB_RELEASES_ONLY = ["/termux/termux-app"];
const RELEASES = /^\/releases(\/(latest|tag\/[\w.\-+]+|download\/[\w.\-+]+\/[\w.\-+]+))?\/?$/;

export function isAllowedLink(href: string): boolean {
  if (href.startsWith("/") && !href.startsWith("//")) return /^\/[\w\-./#?=&%]*$/.test(href);
  let u: URL;
  try { u = new URL(href); } catch { return false; }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
  const host = u.hostname.toLowerCase();
  if (host === "docs.andronix.app" || host === "andronix.app" || host === "dl.andronix.app") return true;
  // The Termux page on F-Droid (docs: install Termux from F-Droid). Added 2026-11-26 with dl.andronix.app
  // and Termux's GitHub releases (lead decision; the docs cite all three).
  if (host === "f-droid.org") return /^\/(en\/)?packages\/com\.termux\/?$/.test(u.pathname) && !u.search;
  if (host === "play.google.com") {
    return u.pathname === "/store/apps/details" && u.searchParams.get("id") === "studio.com.techriz.andronix" && [...u.searchParams.keys()].every((k) => k === "id" || k === "hl");
  }
  if (host === "github.com") {
    const rel = GITHUB_RELEASES_ONLY.find((r) => u.pathname.toLowerCase().startsWith(r.toLowerCase() + "/"));
    if (rel) return RELEASES.test(u.pathname.slice(rel.length));
    const repo = GITHUB_REPOS.find((r) => u.pathname === r || u.pathname.toLowerCase().startsWith(r.toLowerCase() + "/"));
    if (!repo) return u.pathname === "" ? false : GITHUB_REPOS.some((r) => u.pathname.toLowerCase() === r.toLowerCase());
    const rest = u.pathname.slice(repo.length);
    // the repo page (readme), its releases, and README files
    return rest === "" || rest === "/" || RELEASES.test(rest) || /^\/blob\/[\w.\-]+\/README(\.md)?$/i.test(rest);
  }
  return false;
}

/** A source chip's short label: the path without the host (docs.andronix.app/use/vnc → /use/vnc). */
export function shortPath(url: string): string {
  try { const u = new URL(url); return u.hostname === "docs.andronix.app" ? u.pathname : u.hostname + u.pathname; } catch { return url; }
}
