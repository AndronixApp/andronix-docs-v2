import { ImageZoom } from "fumadocs-ui/components/image-zoom";
import type { ReactNode } from "react";

// A screenshot from public/images/<dir>/<name>.jpg (tap to zoom). Portrait phone
// shots render 220 px wide, landscape and tablet shots up to the column width.
// Sizes are the files' pixel sizes, so the layout doesn't jump while they load.
const SIZES: Record<string, [number, number]> = {
  "standalone/black-gpu-off": [1400, 646],
  "standalone/gpu-off-banner-beta8": [1400, 646],
  "standalone/black-safe-mode": [1400, 646],
  "standalone/black-vnc": [1400, 646],
  "standalone/desktop-size": [1600, 1000],
  "standalone/desktop-toolbar": [1600, 738],
  "standalone/extra-keys": [720, 1600],
  "standalone/fold-tabletop": [1000, 1200],
  "standalone/gpu-off-sheet": [720, 1560],
  "standalone/loading-1": [720, 1560],
  "standalone/loading-2": [720, 1560],
  "standalone/loading-3": [720, 1560],
  "standalone/mouse-mode": [720, 1600],
  "standalone/pin-dialog": [720, 1560],
  "standalone/pin-launched": [720, 1560],
  "standalone/safe-mode-sheet": [720, 1560],
  "standalone/settings-linux": [654, 640],
  "standalone/tablet-home": [1600, 1000],
  "standalone/toolbar-hardware-keyboard": [1400, 646],
  "standalone/your-linux": [720, 1560],
};

export function Shot({ name, alt, caption }: { name: string; alt: string; caption?: string }) {
  const [w, h] = SIZES[name] ?? [1200, 800];
  const portrait = h > w * 1.3;
  const width = portrait ? 220 : Math.min(640, w);
  return (
    <figure className="not-prose my-4" style={{ width, maxWidth: "100%" }}>
      <ImageZoom src={`/images/${name}.jpg`} alt={alt} width={width} height={Math.round((width * h) / w)} className="rounded-xl" />
      {caption ? (
        <figcaption className="mt-2 text-sm" style={{ color: "var(--andronix-on-surface-variant)" }}>
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

// Phone screenshots side by side (they wrap on narrow screens).
export function Shots({ children }: { children: ReactNode }) {
  return <div className="not-prose my-4 flex flex-wrap items-start gap-4">{children}</div>;
}
