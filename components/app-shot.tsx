import { ImageZoom } from "fumadocs-ui/components/image-zoom";
import shots from "@/lib/app-shots.json";

// A screenshot of the Andronix app 10 (see DOCS_SHOTS.md for the shot list).
// Files live in public/images/app10/<name>.png, captured at 1080x1920.
// lib/app-shots.json (written by scripts/app-shots-manifest.mjs at prebuild) lists the files that exist.
// Until a file is listed, nothing is rendered in production (no broken image) and a labelled
// placeholder is shown in development.
const available = new Set<string>(shots as string[]);

export default function AppShot({ name, alt }: { name: string; alt: string }) {
  if (!available.has(name)) {
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
      <ImageZoom src={`/images/app10/${name}.png`} alt={alt} width={200} height={356} />
    </div>
  );
}
