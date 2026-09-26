import { existsSync } from "node:fs";
import { join } from "node:path";
import { ImageZoom } from "fumadocs-ui/components/image-zoom";

// A screenshot of the Andronix app 10 (see DOCS_SHOTS.md for the shot list).
// Files live in public/images/app10/<name>.png, captured at 1080x1920 after the UI freeze.
// Until a file exists, nothing is rendered in production (so the page never shows a broken image),
// and a labelled placeholder is shown in development.
export default function AppShot({ name, alt }: { name: string; alt: string }) {
  const src = `/images/app10/${name}.png`;
  let exists = false;
  try {
    exists = existsSync(join(process.cwd(), "public", src));
  } catch {
    exists = false;
  }
  if (!exists) {
    if (process.env.NODE_ENV === "production") return null;
    return (
      <div
        className="not-prose my-4 grid place-items-center p-4 text-center text-xs"
        style={{ width: 200, height: 356, background: "var(--andronix-surface)", color: "var(--andronix-on-surface-muted)", borderRadius: "var(--andronix-radius-tile)" }}
      >
        Screenshot pending: {name}.png
        <br />
        {alt}
      </div>
    );
  }
  return (
    <div className="my-4">
      <ImageZoom src={src} alt={alt} width={200} height={356} />
    </div>
  );
}
