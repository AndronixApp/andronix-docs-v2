"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";

// A recorded terminal demo (demos/*.tape, rendered by demos/render.sh into
// public/demos/<name>.webm/.mp4 plus a poster of the last frame). Nothing
// loads until it scrolls into view; it then plays muted on a loop, and
// pauses off screen. With reduced motion it shows the poster and controls.
// The recordings are 60 columns (Termux on a phone), so the figure is
// phone-width on wide screens too.
export default function TerminalDemo({
  name,
  command,
  label,
}: {
  name: string;
  command: string;
  label?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(rm);
    if (rm || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.35 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  const fullscreen = () => {
    const v = ref.current as
      | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
      | null;
    if (!v) return;
    if (v.requestFullscreen) v.requestFullscreen().catch(() => v.webkitEnterFullscreen?.());
    else v.webkitEnterFullscreen?.();
  };

  return (
    <figure className="not-prose mx-auto my-6 w-full max-w-[520px]">
      <div
        className="relative overflow-hidden"
        style={{ borderRadius: "var(--andronix-radius-card)", background: "#19120E" }}
      >
        <video
          ref={ref}
          className="block h-auto w-full"
          width={940}
          height={1000}
          poster={`/demos/${name}.jpg`}
          preload="none"
          muted
          loop
          playsInline
          controls={reduced}
          aria-label={`Terminal recording: ${command}`}
        >
          <source src={`/demos/${name}.webm`} type="video/webm" />
          <source src={`/demos/${name}.mp4`} type="video/mp4" />
        </video>
        <button
          type="button"
          onClick={fullscreen}
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: "rgba(25,18,14,.72)", color: "var(--andronix-on-surface)" }}
          aria-label="Full screen"
          title="Full screen"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
      <figcaption
        className="mt-2 flex flex-wrap items-center gap-2 text-sm"
        style={{ color: "var(--andronix-on-surface-variant)" }}
      >
        <code className="font-mono" style={{ color: "var(--andronix-on-surface)" }}>
          {command}
        </code>
        {label ? (
          <span
            className="inline-flex h-5 items-center rounded-full px-2 text-[11px] font-bold"
            style={{
              background: "var(--andronix-primary-container)",
              color: "var(--andronix-on-primary-container)",
            }}
          >
            {label}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
