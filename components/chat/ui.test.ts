import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fitWithin, THUMB_EDGE, VIEW_EDGE } from "./images.ts";

const css = readFileSync(new URL("../../app/(docs)/chat/chat.css", import.meta.url), "utf8");
const rule = (sel: string) => {
  const i = css.indexOf(`${sel} {`);
  assert.ok(i >= 0, `rule ${sel} exists`);
  return css.slice(i, css.indexOf("}", i));
};

test("image previews keep the aspect ratio: a tall phone screenshot isn't cropped to its top", () => {
  // the Redmi screenshot from the in-app prod test is 1080 x 2424
  assert.deepEqual(fitWithin(1080, 2424, THUMB_EDGE), { w: 86, h: 192 });
  assert.deepEqual(fitWithin(1080, 2424, VIEW_EDGE), { w: 570, h: 1280 });
  assert.deepEqual(fitWithin(300, 120, VIEW_EDGE), { w: 300, h: 120 }, "never upscaled");
  assert.deepEqual(fitWithin(0, 0, THUMB_EDGE), { w: 1, h: 1 });
});

test("thumbnail tiles show the whole image (contain on a dark tile) and open the viewer", () => {
  assert.match(rule(".chat-image-thumb"), /object-fit: contain/);
  assert.doesNotMatch(rule(".chat-image-thumb"), /object-fit: cover/);
  assert.match(rule(".chat-image-tile"), /background: #0b0908/);
  assert.match(rule(".chat-image-tile"), /cursor: zoom-in/);
  assert.match(rule(".chat-viewer"), /position: fixed/);
  const view = readFileSync(new URL("./chat-view.tsx", import.meta.url), "utf8");
  assert.match(view, /<ImageTile [^>]*onOpen=\{\(\) => setViewer\(/, "a sent tile opens the viewer");
  assert.match(view, /\{viewer && <ImageViewer /);
});

test("the composer dock never covers the end of an answer", () => {
  const dock = rule(".chat-dock");
  assert.match(dock, /position: sticky; bottom: 0/);
  assert.match(dock, /background: var\(--andronix-bg/, "opaque: text doesn't show through");
  assert.match(css, /html:has\(\.chat-dock\) \{ scroll-padding-bottom: calc\(var\(--chat-dock-h/, "the list's scroll area is padded by the dock's height");
  assert.doesNotMatch(rule(".chat-composer"), /position: sticky/, "only the dock is sticky");
  const view = readFileSync(new URL("./chat-view.tsx", import.meta.url), "utf8");
  assert.match(view, /setProperty\("--chat-dock-h"/, "the page measures the dock");
});
