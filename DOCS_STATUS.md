# Docs status: new installer

## Release candidate (overnight, Sept 27)

- **Static export (Sept 28, after Error 1027):** the OpenNext build ran a Worker for every page view, and Next 16's segment prefetch (`Next-Router-Segment-Prefetch: /_tree`) looped against it, about 190 requests a second per open tab (11,684 requests from one local page view in 30 s). That used up the Free plan's 100k Worker requests a day, and lead rolled back to the old docs. The docs are now a static export (`output: 'export'`, `out/`) served only by Workers Static Assets: no Worker script, static search index (browser-side), redirects in `public/_redirects` (generated from lib/redirects.mjs), `html_handling = auto-trailing-slash`, `404-page`. Locally: 3 visits made 280 requests, all static, 0 Worker invocations, and the loop is gone. `@opennextjs/cloudflare` and `open-next.config.ts` are unused now; remove them once the static setup is live.
- **Every docs URL app 10 links to** (app-wt-ui 1fdc54ea and v8.1-new-installer ae3228d3, LinkHub/constants), 28 including anchors, returns 200 with its anchor present. Checked on the Next build and on the Cloudflare Worker bundle (`wrangler dev --local`).
  - The list includes `/troubleshooting/install#the-installer-warns-about-an-old-kernel`, `/troubleshooting/signal-9#android-14-and-newer`, `/blog/andronix-2-0` and `/account/deletion`.
  - They're 404 on the live site only because this build isn't deployed.
- **Old kernels:** rewritten to match installer 2f71d91 (below 4.8, every desktop stays black in Termux:X11 and VNC alike; the warning shows before install, `andronix desktop` and `vncserver-start`; use `--de none`). This is on install troubleshooting, Requirements and desktop troubleshooting, and linked from the blog and changelog known issues.
- **Signal 9:** covers Android 12/12L/13 (adb, including from the phone) and 14+ (Developer options › Apps › Disable child process restrictions, verified on Android 16).
- **Fixed a deploy bug:** `<AppShot>` rendered nothing in the Worker build, because it checked the filesystem. It now reads `lib/app-shots.json`, written at prebuild by `scripts/app-shots-manifest.mjs` and committed. Verified in `wrangler dev`: screenshots render, and `/_next/image` returns 200.
- **Scripts:** `deploy`, `upload` and `preview` now run the manifest and the App 10 link check first.
- **`DEPLOY.md`:** the exact Cloudflare steps: prerequisites, the build-time `OPENPANEL_WEB_CLIENT_ID`, noting the current version, the local Worker check, staging with `pnpm run upload` (no traffic) plus a preview URL, promoting the tested version with `wrangler versions deploy <id>@100%`, a smoke test, rollback with `wrangler rollback <id>`, and the note that cached 308s survive a rollback. The wrangler and OpenNext command syntax was checked against the installed CLIs.
- **Needs the owner:**
  1. The `OPENPANEL_WEB_CLIENT_ID` value for the build.
  2. The merge of `docs/new-installer` into `master`, then the deploy (docs before app 10 and the website banner).
  3. Whether preview URLs are enabled on the `andronix-docs-v2` Worker, for staging.
  4. The release date: set `RELEASE_DATE` in `lib/release.mjs`, the one place for the blog post, blog index and changelog. It shows as the token `RELEASE_DATE` until then, and `pnpm run deploy` refuses to run while it's the placeholder.
  5. `app10-premium` and the Play shots come from the Play internal-test build.
  6. The open IA questions (Termux recommendation, step titles).
- **`andronix doctor`** is documented in the CLI reference, badged "installer 2.0.1+" (it ships once feat-compat merges). It's also in the quick reference and in install troubleshooting's "Still stuck?" list. There's a TODO to drop the note after the release.
- **Modded edition ids** (installer 2.0.1+, andronix-distros 330608e): the CLI reference has an edition-id table, "one install per distro" (`--reinstall` replaces after asking) and `andronix remove <edition-id> [--yes] [--legacy]` with the v8 folders `--legacy` deletes. The Modded install page has a "Remove a Modded OS" section and the one-install-per-distro note; uninstall links to it. Badged "installer 2.0.1+", with TODOs to drop the badges after the release.
- **Report a problem** (owner: the support system launches with Andronix 2.0): new page `/troubleshooting/report-a-problem` (app form from feat/report-problem strings; `andronix report` badged installer 2.0.2+ per the support-desk reports-v1 contract; data section from that contract's redaction and 90-day retention). Linked from troubleshooting install/desktop/signal-9/termux/FAQ and the CLI reference (doctor, plus an `andronix report` section). TODOs: where the app opens the form, and an AppShot (not wired in the app yet); confirm the installer version with distros; recheck the data section once POST /v1/reports ships. Owner/lead: the account deletion page doesn't mention reports yet; add them once products-api erasure covers them.
- **2.0 pricing** (owner decisions, Sept 28, presentation revised the same day): no price table and no local prices; owner discounts as percentages (Premium owners 30% off the Modded Pass\*, Modded 2.0 edition owners 40% off\*, rounded down). The Modded OS page's [Prices](/modded-os/modded-os#prices) section, the blog, the changelog and FAQ 11 show only the Modded Pass $6.99\*, the early bird ($4.49 for the first 4 days, until `EARLY_BIRD_END`), Andronix Complete as best value, the two owner discounts, and the purchasing-power-parity footnote (discounts apply to the local price). Classic buyers keep 4 editions free as "Archived — yours to keep", with no Modded 2.0 discount. The early-bird end date is one constant, `EARLY_BIRD_END` in lib/release.mjs (placeholder `{EARLY_BIRD_END}`), rendered on the Prices section, the blog post and the changelog; `pnpm run deploy` refuses to run until it's set. Plan icons (icon-2.0/plans a714321, 48 dp, dark and light variants) sit next to each plan line via `<PlanRow>` on the Prices section, the blog and the changelog.
- **Terminal demos** (owner request, style approved Sept 28): VHS recordings of the real installer (2.0.1; 2.0.0 then 2.0.1 for update; the next-2.0.2 branch for report), 60 columns like Termux on a phone, Andronix theme, Geist Mono. `demos/*.tape` plus `demos/render.sh` (Docker box, see demos/README.md for what's real and the few stand-ins: Xvfb for termux-x11, a local mirror for the 2.0.1 self-update, a staged old Modded copy). Output: `public/demos/<name>.webm/.mp4/.jpg`, shown with `<TerminalDemo>` (lazy, loops muted in view, reduced motion shows controls, full-screen button). On: install/without-the-app, desktop/termux-x11, use/updates, reference/andronix-command (clean), modded-os-installation (remove --legacy), troubleshooting/report-a-problem. Also documented `andronix clean` (installer 2.0.1+), which the reference lacked. No `andronix doctor` demo: in the box it shows the box's facts (Android SDK 0, no Termux, no fixes); it needs a phone or the emulator.
- **`andronix report`** (installer 2.0.2+, from andronix-distros next-2.0.2 4171afe) is fully documented on the report page and in the CLI reference: the error-box hint, what's collected and redacted, the consent prompt, the app handoff (24-hour draft), sending without the app, `--message`, running inside a distro with `--open <AX-ID>` in Termux, `--dry-run` and exit codes (0/1/130). Two app shots from ui's report-10 frames, cropped to 1080×1920: `app10-report-installer-attached` (frame 12) and `app10-report-sent` (frame 16). Their sample data shows installer 2.0.3; retake if that matters. There's no per-command `--help` for report (it prints the general help).


## Termux:X11 extra-keys bar (lead/x11, Sept 26)

- **Where the line went:** Step 3 (Termux:X11 > The first time you open it) and desktop troubleshooting now say: "Andronix hides Termux:X11's extra-keys bar the first time you start a desktop so the bottom panel shows. Swipe down with three fingers in Termux:X11 to bring it back (or turn it on in Termux:X11 settings)."
- **Installer version:** the behaviour is installer commit 8a9b1de. It's on master and `feat-x11-audio`, after the live 2.0.0 (`Version = "2.0.0-dev"`), so it arrives with the next installer build. Until then, the bar isn't hidden automatically; the three-finger swipe and the setting still apply.

## App-10 screenshot refresh: prepared, not captured (lead, Sept 26)

- **Shot list:** `DOCS_SHOTS.md` has 22 app shots and 4 Termux shots. For each: file name, docs page and place, screen, account state (free / Pass / Premium / past buyer), step and alt text. It also has the capture settings: Android 16 emulator at 1080 × 1920, font 1.0, English, SystemUI demo mode, seeded accounts. The Play Store suggestion is 8 shots from the same set; 1080 × 1920 keeps them within Play's 2:1 limit.
- **Pages:** the App 10 pages (`(latest)`) now use `<AppShot name="..." alt="..." />` (`components/app-shot.tsx`) instead of the Andronix 7 screenshots. It renders the image once `public/images/app10/<name>.png` exists. Until then it shows nothing in production and a labelled placeholder in development.
  - Tested: with no files the pages render no shot; with a file in place it renders through next/image.
  - The build stays green either way.
- **Pages covered:** Install with the app, Uninstall, Installing Modded OS, Modded OS Editions, Start the desktop (Termux:X11), Install Termux, Account Deletion, Process completed (signal 9), Other ways to connect (the Termux vncserver shot), and the Andronix 2.0 blog post.
- **Left as they are:**
  - `content/docs/v8`;
  - the RealVNC viewer shots;
  - the Classic Modded wizard's Termux screenshots. Those steps' text gets rewritten in the app-flow pass (`termux-modded-first-boot` is listed).
- **After capture:** drop the files into `public/images/app10/`, build, and check each page once. The app-flow text (button names, step wording) is rewritten in the same pass.


## Versioned docs: App 10 and App 8.x (Classic) (lead, Sept 26)

- **Chosen: Fumadocs' built-in versioning** (`"root": "version"`), inside this site. It works in the installed fumadocs-ui/core 16.15.14, the latest (`pnpm outdated` shows no newer fumadocs-ui, fumadocs-core or fumadocs-mdx; fumadocs-mdx 15.4.5 is also the latest). The old MDX compiled as it is, with no porting, so the separate v8.docs.andronix.app branch plan isn't needed.
- **Layout:**
  - `content/docs/(latest)/`: the new docs, root type `version`, titled "App 10". The `(latest)` folder group isn't part of URLs, so every new-docs URL is unchanged.
  - `content/docs/v8/`: a copy of `master` (the live docs), root type `version`, titled "App 8.x (Classic)", served under `/v8/...`.
    - Its `blog/` and `account/` are left out: they're shared, one copy in the latest docs.
    - Every page has a warning callout on top: "You are reading docs for Andronix app 8.x. Update to app 10 for the new installer: Start here".
    - Its internal links are rewritten to `/v8/...` (96 links).
    - Otherwise the content is as it was, except for one hidden anchor span (below).
- **Version menu:** Fumadocs shows it at the top of the sidebar. Switching keeps the same page when it exists in the other version (for example `/security/termux` and `/v8/security/termux`), and otherwise falls back to that version's index. It's styled as a surface pill.
- **8.x notes:** callouts on the home page and on "What is Andronix" point 8.x users to App 8.x (Classic).
- **Search:** it covers App 10 only (`app/api/search/route.ts` filters out `/v8` pages); a check of `?query=vnc` returned 91 results, none from v8.
- **Redirects** (`lib/redirects.mjs`): every URL that was live on the old site and is gone or moved in the new docs now 308s to **the same path under `/v8`**. These replace the earlier redirects to the new pages. There are 19 such pages:
  - `/android-12/andronix-on-android-12-and-beyond`, `/desktop-environments/desktop-environments`, `/faq/faq`;
  - `/get-started/how-does-andronix-work`, `/get-started/limitations`;
  - `/software/{IDEs,browsers,gimp,libre-office}`, `/ssh/ssh-basics`;
  - `/termux/cannot-link-executable`, `/termux/migrating-to-f-droid`;
  - `/troubleshoot/internal-storage`, `/troubleshoot/sound`;
  - `/unmodded-distros/unmodded-os-installation`, `/unmodded-distros/unmodded-os-uninstallation`;
  - `/vnc/vnc-basics`, `/window-managers/window-managers`, `/xsdl/xsdl-basics`.

  Also, `/introduction/what-andronix-is-not-capable-of` (linked by the v8 app, already a 404 on the live site) goes to `/v8/get-started/limitations`. URLs that were never live pages (folder URLs, `/installations/*`, `/desktop/vnc`) still go to the new pages.
- **Unchanged live URLs:** `/`, `/account/deletion`, `/blog/*`, `/miscellaneous/open-source`, `/modded-os/modded-os`, `/modded-os/modded-os-installation` and `/security/termux` stay in App 10.
- **Checks on the built site:**
  - `pnpm build` passes (70 static pages);
  - the link and anchor check passes (67 pages, 0 broken);
  - 82 of 82 redirect variants land on a 200;
  - the v8 app's docs URLs, anchors included, resolve. The one missing anchor, `#2-selection-️` (already broken on the live site), got a hidden span in the v8 copy.
- **v8 app (branch `8`, LinkHub.kt) docs URLs** and where they land:

  | App URL | Lands on |
  |---|---|
  | `/` | `/` (App 10 home, with the 8.x note) |
  | `/desktop-environments/desktop-environments` (+ `#which-de-should-i-choose`) | `/v8/desktop-environments/...` |
  | `/window-managers/window-managers` (+ `#which-wm-should-i-choose`) | `/v8/window-managers/...` |
  | `/unmodded-distros/unmodded-os-installation` (+ `#desktop-environment`, `#2-selection-️`, `#3-termux-execution-`, `#4-starting-distribution-️`, `#5-vnc-configuration-`) | `/v8/unmodded-distros/...` |
  | `/modded-os/modded-os-installation` (+ the same four anchors) | unchanged (Classic flow; the anchors exist) |
  | `/faq/faq` | `/v8/faq/faq` |
  | `/security/termux` | unchanged |
  | `/termux/migrating-to-f-droid#manual-method` | `/v8/termux/...` |
  | `/android-12/andronix-on-android-12-and-beyond` | `/v8/android-12/...` |
  | `/introduction/what-andronix-is-not-capable-of` | `/v8/get-started/limitations` |
  | `/account/deletion` | unchanged |

- **Action for android (app 10):** app 10's LinkHub (`v8.1-new-installer` and `ui-revamp`) still has some of the old constants, which would now open the 8.x docs. Repoint them:
  - `desktop-environments/...` to `/reference/desktops` (or `/install/choose`);
  - `window-managers/...` to `/pre-2.0/window-managers`;
  - `unmodded-distros/unmodded-os-installation` to `/install/with-the-app`;
  - `faq/faq` to `/troubleshooting/faq`;
  - `introduction/what-andronix-is-not-capable-of` to `/reference/limitations`.
- ~~Action for web~~ **Correction:** `/software/browsers` and `/termux/migrating-to-f-droid#manual-method` don't come from the website. They come from the v8.0 app's LinkHub (branch `8`), and sending 8.x users to `/v8` is correct.
  - App 10 content (`(latest)`, blog included) has **no** links to any removed or moved URL: a grep for every redirect source and old path found 0.
- **Build guard:** `scripts/check-latest-links.mjs` runs as `prebuild` and fails `pnpm build` if an App 10 page links to a path that only exists under `/v8`, or to an old URL that redirects there. Deliberate `/v8` links are allowed.
  - Tested: it passes on the real content (43 pages). A test link to `/software/browsers` fails the build with the file and the fix.
- **Superseded:** the IA proposal's URL table said old URLs go to the new pages. Now the old URLs that were live go to `/v8`.

## Operator name (owner, Sept 26)

- **The operator is "Amita Shukla".** The only "Devriz Technologies" mention in docs text was the "Anything more?" section of the 2021 blog post `blog/v6-0.mdx`, which is now removed. The old video thumbnail inside the collapsed "Older video" block stays, as allowed.

## Account deletion page (lead, Sept 26)

- **Links (lead, Sept 26, final):** the page links only https://andronix.app/legal/privacy-policy, which is live today and kept by the redesign, and which names the operator. The `/delete-account` link is dropped, because the page itself explains deletion. That avoids a deploy-order cycle: **the docs can deploy first**, before app 10.0 and before the website banner, with no link to a website page that isn't live yet.
  - **Also fixed for the same reason:** the blog post linked `https://andronix.app/supporters`, which returns 404 on the live site (it arrives with the redesign). It's now plain text: "an optional spot on the supporter wall on andronix.app".
  - **Checked Sept 26:** every `andronix.app` link in the docs resolves on the live site. `/legal/privacy-policy` 301s to `/legal/privacy-policy/`, which returns 200.

- **Checked against** products-api (`products-api-wt-entitlement`, 30c2a7d):
  - `account/accountDeletion.ts`, `firebase/accountDataStore.ts`, `account/sweep.ts`, `routes/v2/account.ts`;
  - `env.ts`: `PURCHASE_RETENTION_YEARS` defaults to **8**.
- **URL unchanged** (`/account/deletion`; the app's LinkHub links it).
- **How to delete:**
  - In the app (10.0+): it re-authenticates (10-minute recent sign-in), then deletes immediately.
  - By email: within 30 days, as before.
- **Deleted:**
  - the Auth user;
  - `users/{uid}` with saved commands, and the 4.x Premium flag (`users/properties/{uid}`);
  - the `supporters/{uid}` wall entry;
  - premiumID docs;
  - RTDB `os/*_users` legacy Modded grants;
  - donations;
  - the tokens-analytics and offline-analytics download counters;
  - `verifiedPurchases/{uid}`.

  The OpenPanel profile is queued for erasure (`analyticsErasures`).
- **Kept without identity** (keyed by sha256(uid + pepper)):
  - one `retainedPurchases` row per order (order ID, product, time, price, currency, country) until `retainUntil`, 8 years; the nightly sweep deletes expired rows;
  - `playTokens`, with the uid swapped for the hash, so a purchase can be re-linked by proving it again;
  - an `accountDeletions` log entry (hash + counts).
- **Also stated on the page:** installer telemetry and docs analytics aren't linked to an account.
- **TODOs:**
  - the exact in-app menu path;
  - confirm the production value of `PURCHASE_RETENTION_YEARS`;
  - ~~align 30 vs 90 days~~ **Owner decided: 30 days everywhere.** The page already says 30 days.

## Signal 9 page (owner question, Sept 26)

- **Kept, and rewritten short.** `/troubleshooting/signal-9` goes: the symptom first (`[Process completed (signal 9) - press Enter]`), why it happens, then one section per Android version:
  - **Android 11 and older:** not affected.
  - **Android 14+:** Developer options > **Disable child process restrictions**. No PC needed. Turning Developer options off turns this off again.
  - **Android 12, 12L and 13:** the `adb` commands (`device_config set_sync_disabled_for_tests persistent`, `device_config put activity_manager max_phantom_processes 2147483647`, and `settings put global settings_enable_monitor_phantom_procs false` for 12L and 13), plus how to undo them.
    - The page includes a caveat about what disabling config sync does.
    - It says where to run the commands: from a computer, or from the phone with Wireless debugging, using Termux's `android-tools` `adb pair`/`connect` or LADB/Shizuku (named neutrally).
    - The Feature flags switch on some stock 12L/13 phones is mentioned.
- **Sources:** checked against agnostic-apollo's Android-Docs page on phantom processes (linked on the page) and Termux issue #2366. The old step screenshots and the old video were removed.
- **Linked from** Step 3 (Termux:X11 › Good to know), from desktop troubleshooting (a new "The desktop disappears and Termux says signal 9" section), and, as before, from install troubleshooting, Requirements, the install guides, the FAQ and the sidebar banner.
- **Android 14+ switch: verified by x11 on the Android 16 emulator (Pixel/AOSP Settings).**
  - Path: Settings > System > Developer options > Apps > "Disable child process restrictions" (the summary wording is quoted on the page).
  - It survives a reboot (it sets `persist.sys.fflag.override.settings_enable_monitor_phantom_procs=false`).
  - **The `adb shell setprop` line is dropped:** x11 tested it and a normal adb shell fails with "Failed to set property".
  - The `adb` commands on the page (`settings put global settings_enable_monitor_phantom_procs false`, and `device_config put activity_manager max_phantom_processes 2147483647` for 12/13) are presented as Termux's and agnostic-apollo's documented advice, which we haven't verified.
  - The page notes that other brands may name or place it differently.
- **Still not tested by us:** the on-phone Wireless debugging route for Android 12 and 13.

## Modded OS and Premium marks (owner, Sept 26)

- **Files:** `~/andronix/icon-2.0/final/marks/svg/*` copied to `public/images/marks/`.
- **Component:** `components/marks.tsx` has `ModdedGlyph` and `PremiumGlyph` (currentColor, inlined) and `MarkTile` (the colour mark on its own tile: Modded on olive `--andronix-tertiary-container`, Premium on deep orange `--andronix-primary-container`, as the README specifies).
- **Where the new marks are:**
  - the home page's Modded OS card (it was the crown icon);
  - the top of the Modded OS Editions page;
  - the Modded OS 2.0 and Premium sections of the blog post;
  - the unused `intro_component` (its crown is gone; the Modded card uses the glyph).
- **What's left of the old icons:** the green shield+bolt only appears inside old app screenshots, which are already TODO for the app-redesign pass. No other crown or shield icons remain in the docs.

## Release comms (lead, Sept 26)

- **Blog post "Andronix 2.0":** `content/docs/blog/andronix-2-0.mdx`, at exactly `/blog/andronix-2-0`. It returns 200, and the trailing-slash form 308-redirects to it. The app's 10.0 changelog and the website banner link here.
  - Written only from the lead's shared facts file (`andronix-2.0-facts.md`), in the requested sections: what's new, free distros, the Termux:X11 desktop, Modded 2.0 / Classic / past buyers, Premium, app 10, privacy, known issues, how to upgrade.
  - It says plainly that Modded downloads were broken from June to September 2026 and are now fixed.
  - Images: the icon OG card, KDE on Ubuntu 26.04, XFCE in Termux:X11 on a phone, and Modded 2.0 Debian XFCE.
  - Added as the first blog card, and first in the blog sidebar.
- **Changelog:** `reference/changelog.mdx` (Reference > Changelog), with the 2.0.0 entries by area. It links the relevant docs pages.
- **TODOs:**
  - the release date: both pages say "September 2026";
  - app 10.0 screenshots in the post, once ui's redesign is final.
- **Author line:** the post is signed "The Andronix team" rather than a person. Change it if the owner wants their name.

## Icon 2.0, direction B: the only logo (owner, Sept 26)

- **Copied from `~/andronix/icon-2.0/final/`:**
  - `web/` into `public/`: `favicon.ico` (replaces the old one), `icon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-{192,512}.png`, `icon-maskable-{192,512}.png`, `mark.svg`;
  - `social/og-image-1200x630.png`, which replaces `og.png` (deleted).
- **Metadata** (`app/layout.tsx`): `icons` (ICO 48, SVG, apple-touch), `manifest: /site.webmanifest` (built from the icon agent's `site.webmanifest.json`, plus a name and start URL), `viewport.themeColor #19120E`, and the OG and Twitter images with their size and alt text.
- **Checked on the built site:** all the head tags render, and every file returns 200 with the right content type.
- **Nav bar:** `mark.svg` (22 px) sits before "andronix. DOCS".
- **Old logo files:** `public/logo-{dark,light}.svg` (the old "andronix.app/docs" text wordmark, unreferenced in the docs) now contain the new mark, so any outside link to them shows the new icon. The unused `components/logo.tsx` is deleted.
- **Page images:** every non-TODO page image was checked on a contact sheet (Termux dialogs, Android settings, the Classic Modded wizard, the RealVNC app, FAQ shots). None shows the old Andronix icon. The only images that do are the old app screenshots already marked `TODO(docs)` for the app-redesign pass.
- **Blog:** the posts' images (`images/blog/v6`, `v7`) are the history of those releases and are left as they are.

## Termux:X11 with F-Droid Termux: PASS (x11, Sept 26)

- **Test:** x11 ran F-Droid Termux 0.118.3 with Termux:X11 `termux-x11-universal-debug.apk` (GitHub nightly) against the live dl.andronix.app, on the Android 16 emulator. The result was a PASS (evidence: `feat-x11-audio` 093ce53, `tests/x11/emulator-20260926-fdroid/`).
- **Docs changes:**
  - The docs now say Termux:X11 works with every current Termux build (F-Droid, GitHub, Play), and both F-Droid TODOs are gone.
  - Step 3 has the two first-run tips: on Android 13+, tap Allow on the notifications box; if the app doesn't come to the front after "Desktop is running", open Termux:X11 from the app drawer. The same tips are on the desktop troubleshooting page.
  - Step 3 has x11's screenshot, `termux-x11-xfce-phone.jpg` (XFCE in Termux:X11 on Android 16, portrait).

## Analytics: OpenPanel (owner request, Sept 26)

- **Package:** `@openpanel/nextjs` 1.5.1, in `components/analytics.tsx`, mounted in `app/layout.tsx`.
- **Endpoints:** `apiUrl` is `https://events.andronix.app/api`. The SDK script loads from our own `https://events.andronix.app/op1.js` (it returns 200), not from openpanel.dev.
- **Client ID:** from the build environment, `OPENPANEL_WEB_CLIENT_ID` (the same "web" client as andronix.app; the owner is creating it). See `.env.example`. With no ID set, the docs build and run with no analytics code path.
  - It's read at build time: the pages are static.
  - **Set it in the Cloudflare build environment before deploying.**
- **Tracked:** screen views and outgoing links (the SDK's own), plus two custom events:
  - `copy_code`: `path`, `block` (the code block's position on the page) and `command` (the block's first non-comment line, up to 120 characters);
  - `docs_search`: `query` (lower-cased, up to 80 characters, sent once typing pauses for 1.2 s), `results` (how many showed) and `path`.
- **No feedback event:** the docs have no feedback widget, so there's nothing to send.
- **Privacy:**
  - Cookie-less: checked, 0 cookies after a session.
  - With Do Not Track or Global Privacy Control, nothing loads: checked, no script and no requests.
  - No user IDs or `identify` calls.
- **How it was tested:** a local build with a dummy client ID. Playwright intercepted every request to events.andronix.app, so nothing was sent for real. The run saw `screen_view`, `copy_code` and `docs_search` with the payloads above, and nothing went to openpanel.dev.
- **Privacy policy:** the draft is the web agent's `website-wt-redesign/design/legal-drafts.md` (outside this worktree). I sent web the paragraph below to add:
  > **Documentation site.** docs.andronix.app uses the same self-hosted OpenPanel analytics as andronix.app to see which pages are read, which commands are copied and what people search for, so we can improve the docs. It sets no cookies. It records page views, links you follow to other sites, the first line of a code block when you copy it, and the words you type into the docs search. It doesn't identify you. If your browser sends Do Not Track or Global Privacy Control, no analytics are loaded.

## Termux:X11 is the desktop path (owner decision, Sept 26)

- **Step 3 is Termux:X11 only.** `desktop/meta.json` lists just `termux-x11`. The journey pages (home, install with/without the app, What is Andronix, Install apps) point there, with `andronix desktop <distro>`. The "or: VNC" branches are removed.
- **VNC moved to Reference** as "Other ways to connect (VNC)" (`/reference/vnc`). A callout at the top of that page says Termux:X11 is the main way. `/desktop/vnc`, `/vnc/vnc-basics` and `/vnc` redirect there; 80 of 80 redirect variants pass.
- **Fact fix (lead):** Termux:X11 is only published on GitHub (`termux-x11-universal-debug.apk`, nightly). It isn't on F-Droid or Play (both return 404, checked Sept 26), and it works with the GitHub and Play Store builds of Termux.
  - Install Termux no longer says to get Termux:X11 "from the same source". The same-source rule is now only for plugins like Termux:API.
  - The Termux:X11 page names the APK.
  - F-Droid Termux + Termux:X11 isn't tested yet (TODO).
- **Note for android and ui:** the owner's brief says "F-Droid page matching the user's Termux source" for Termux:X11. That page doesn't exist, so the app should link the GitHub nightly release for every Termux source. App 10.0's Termux dialog (f39902b) says to use "the same source for add-ons like Termux:X11", which is wrong for Termux:X11.
- **IA proposal md and html** are updated (question 2 is now decided).

## Release order (lead, Sept 26): deploy the docs BEFORE the app 10.0 release

- **Why.** App 10.0's one-time Termux dialog opens `https://docs.andronix.app/start-here/install-termux` (android f39902b, `LinkHub.ANDRONIX_DOCS_TERMUX_INSTALL`). That page exists only on `docs/new-installer`. The live site returns 404 for it today (checked Sept 26).
- **On this branch** the URL returns 200, and the trailing-slash form 308-redirects to it.
- **Every other docs link in the app's `LinkHub.kt` resolves on this branch** (checked on the built site):
  - `/desktop-environments/...#which-de-should-i-choose` goes to `/reference/desktops`, and the anchor exists.
  - `/window-managers/...#which-wm-should-i-choose` goes to `/pre-2.0/window-managers`. The anchor is kept with a hidden span.
  - `/unmodded-distros/unmodded-os-installation` (plus `#desktop-environment` and `#2-selection-️`) goes to `/install/with-the-app`. Both anchors exist; the second one was already broken on the live site and is now restored.
  - `/faq/faq` goes to `/troubleshooting/faq`.
  - `/android-12/...` goes to `/troubleshooting/signal-9`.
  - `/modded-os/modded-os-installation`, `/security/termux`, `/account/deletion` and `/` are unchanged.
- **Install Termux** now says to install add-ons (Termux:API, Termux:X11) from the same source as Termux, matching the app's new dialog copy. It also notes that the F-Droid and GitHub builds are signed differently.


## Restructure and 2.0.0 content (Sept 26, lead's sequencing)

- **New structure.** The docs follow `DOCS_IA_PROPOSAL.md` (HTML: `docs-ia-proposal.html`):
  - Welcome, then Steps 1 to 4 (Start here, Install a distro, Start the desktop, Use it);
  - Modded OS, Troubleshooting (by symptom) and Reference;
  - an About group (URLs unchanged);
  - a collapsed Pre-2.0 archive, and the Blog.

  Folders use `meta.json` titles ("Step N · …"). Every page in Steps 1 to 4 ends with a `<NextStep>` card (`components/next-step.tsx`).
- **Redirects.**
  - `lib/redirects.mjs` holds 39 permanent redirects: every moved page, the old folder URLs, and the old site's `/installations/*`.
  - A script requested all 78 variants (with and without a trailing slash) on the built site, and each one ends on a 200 at the right page.
  - The two broken blog redirects were removed; `/blog/v7-0/` and `/blog/v6-0/` now work.
  - Unmoved URLs: `/account/deletion` (the app links to it), `/miscellaneous/open-source`, `/security/termux`, `/modded-os/*`, `/blog/*`.
- **New pages:** Requirements, Choose a distro and desktop, Install without the app, Termux:X11, Dev packs, Back up and restore, Keep it updated, Make it faster, The desktop is black/slow/closes, and Old install guides (the old VNC/sound/storage sections, moved into the archive).
- **Merged:**
  - Browsers, IDEs, LibreOffice and GIMP make one "Install apps" page, with `sudo`, the Java pack for IntelliJ, and Chromium commands.
  - Cannot Link Executable, the old Play Termux errors and "command not found" make "Termux errors".
- **Installer 2.0.0 content:**
  - `andronix desktop` / `--x11` / `desktop stop` (Termux:X11);
  - automatic PulseAudio (the Sound page is rewritten);
  - proot installed by the installer (the "pkg install proot first" step is gone, and the step list shows "Installing proot");
  - `andronix pack` and the `andronix-postgres` helper;
  - telemetry: what's sent, and how to turn it off;
  - LXDE maps to LXQt, and the WMs and Enlightenment map to XFCE;
  - the kernel < 4.8 warning and the Android 9 / kernel 4.4 black XFCE;
  - Play Store Termux works on Android 11 and newer.
- **App-flow pages are not rewritten** (Install with the app, Uninstall, Modded install, the app screenshots). They keep TODOs until ui's redesign is final, as the lead asked.
- **Checks:** `pnpm build` passes, the internal link and anchor check passes (41 pages, 0 broken), and the redirect check passes (78/78).

- **Live (Sept 26):** installer 2.0.0 is on `dl.andronix.app`. `https://dl.andronix.app/get.sh` returns 200 (`application/x-sh`), so the docs' one-line command points at a live file. The docs have no `pkg install proot` step anywhere, because the installer installs proot itself.

### Unverified in the new content

- **Termux:X11:** only passed on the Android 16 emulator. Real phones, LXQt/MATE/KDE on X11, and PulseAudio playback are still pending (installer STATUS).
- **The APK name** `termux-x11-universal-debug.apk` and the nightly release link are from the installer STATUS; the page has a TODO to pin the exact APK.
- **Dev packs:** Docker only (Debian 13 and Ubuntu 26.04 for python, node and db). java, go and the non-apt distros through the Go command are untested.
- **Install apps:**
  - The Chromium commands for Debian, Kali, Fedora, Arch and Alpine are from package knowledge, not tested.
  - `vscode_patch.sh` and `librepatch*.sh` were written for pre-2.0 root installs. The page runs them with `sudo`, untested (TODOs).
- **Telemetry wording** follows the installer's current payload, which is the client's proposal until play's schema is final.
- **"2 GB RAM"** for the command line in Requirements is based on the a12-2g emulator first-run passing.
- **The Android 14+ switch name** is still from general knowledge.


Sept 26, 2026. Branch `docs/new-installer`, committed locally. Nothing has been pushed or deployed. `pnpm build` passes (37 static pages), and a script checked every internal link and `#anchor` in `content/docs` (0 broken).

## Restyle: Andronix 2.0 design (Sept 26)

- **Tokens.** `app/andronix-tokens.css` is a verbatim copy of `app-wt-ui/design/tokens.css` (branch `ui-revamp`). `app/global.css` maps the tokens onto Fumadocs' variables. No new tokens were added.
- **Fonts.** Plus Jakarta Sans (400-800) and Geist Mono (500), both through `next/font`.
- **Dark only.** The theme is forced dark and the theme switch is removed.
- **No borders or shadows.** The border colour is transparent, and depth comes from bg -> surface -> surface-high.
- **Sidebar:** the active page is a deep-orange pill, and section labels are uppercase and muted. The search button is a surface pill.
- **Signal 9 banner:** a warn-container block.
- **Header:** "andronix." with a "DOCS" chip.
- **Code blocks:**
  - background is code-bg, radius 22, Geist Mono at 13.5px;
  - a custom Shiki theme (`lib/shiki-andronix.ts`): commands in primary, options in secondary, strings in tertiary, comments muted;
  - long lines wrap, so phones don't scroll sideways.
- **Callouts:** `components/callout.tsx` replaces Fumadocs' Callout with tonal blocks, each type using a container colour and its on-* partner:
  - info = surface
  - warning = warn-container
  - error = error-container
  - success = ok-container
  - idea = tertiary-container
- **Other elements:**
  - Tables: surface-high header, surface rows split by 2px page-colour gaps, rounded corners.
  - Inline code: surface-highest chips.
  - Cards: surface blocks with deep-orange icon tiles.
  - Badges: primary-container.
  - Video embeds: rounded.
- **Shared tokens:** the vendored tokens are re-synced with ui's additions. The Shiki theme now uses `var(--andronix-code-text|command|option|string|comment)` directly, so code colours follow `tokens.css`. The copy button's "copied" state uses `--andronix-ok`.
- **Content debt (lead, Sept 26):**
  - The Andronix 7 walkthrough videos on Installing a Distro and Installing Modded OS are now under a closed "Older video (Andronix 7)" block (`components/collapsed.tsx`).
  - App screenshots showing the Andronix 7 UI, including the retired Commands tab, are marked with a `TODO(docs)` listing the files, on:
    - Installing a Distro
    - Uninstalling a Distro
    - Installing Modded OS
    - VNC Basics

    The emulator agent will shoot the new screens once ui's redesign lands.
  - The docs text has no mentions of "Andronix Commands" or "Andronix Auto". They only appear inside the old screenshots.
  - Videos left as they are: Android 12 (phone settings, still valid), Desktop Environments (a general explainer) and Window Managers (a retired page).
- **Content change:** the CLI quick reference now puts each comment above its command instead of in an aligned column. The column read badly once lines wrapped on phones.
- **Screenshots:** before and after, for home, a guide and the CLI reference, at desktop and phone widths, are in the session scratchpad under `restyle-shots/`. They were taken with Chrome through playwright-core.

## App 10.0 and the no-app path (lead decision, Sept 26)

- **App version.** The app-based install and uninstall guides now require "the Andronix app 10.0 or newer (Andronix 2.0)". Supported Distros and the CLI reference mention 10.0 too. This answers question 11.
- **No-app path.** The one-line command is added to:
  - the install guide, in a new "Installing without the app" section with the distro and desktop names;
  - Supported Distros, above the per-distro commands;
  - the CLI reference, in a new "Getting andronix" section;
  - Troubleshooting, in a new "andronix: command not found" entry.

  The command:

  ```
  curl -fsSL https://dl.andronix.app/get.sh -o $PREFIX/tmp/get.sh && sh $PREFIX/tmp/get.sh install <distro> --de <de>
  ```

  The uninstall guide already had the no-app path, "Uninstalling from Termux" (`andronix remove`).
- **proot step, pending.** Installer 2.0.0 installs proot itself: the visible step "Installing proot", from `feat-proot-install`, which is merging into `release/2.0.0`. `get.sh` doesn't need to.
  - The docs keep "run `pkg install proot -y` first on a fresh Termux" until x11's final gate confirms it.
  - A `TODO(docs)` marks both places: the install guide's "Installing without the app" and the CLI reference's "Getting andronix".
  - After the gate, remove both, and consider adding "Installing proot" to the step lists on the install guide and the CLI page.
- **Unverified:** `https://dl.andronix.app/get.sh` is taken from your message. I didn't fetch it.
- **Pre-2.0 pages** stay as they are, marked for old installs.
- **Deploy timing:** superseded; see "Release order" at the top of this file.

## Naming: Andronix 2.0 (owner decision, Sept 26)

- **Release name.** User-facing text now says **Andronix 2.0** where it used to say "the new installer" or "the current installer". Older installs are "pre-2.0" or "before Andronix 2.0".
  - The Older Installs page is retitled "Installs from Before Andronix 2.0". The URL is unchanged.
  - `andronix list`'s own output string, "from the old installer", is quoted as it is.
- **Modded OS names.**
  - The new lineup is **Modded 2.0**, in the `## Modded 2.0` section (anchor `#modded-20`).
  - The four existing editions are **Classic**, in `## Classic editions` (anchor `#classic-editions`).
  - The Modded install guide, the old-install VNC section and the sound page now say "Classic".
- **CLI reference:** mentions Andronix 2.0 and `andronix version` (prints `andronix 2.0.0`).
- **Docs had no "v8.1" or "0.3.0" references**, so nothing to rename there. Blog posts were left alone.
- **App version.** The install and uninstall guides still say "Andronix version 7.0 or newer". Old app versions keep working through the shims. Should they say app 10.0 ("Andronix 2.0") instead? That depends on whether older apps show the new desktop options (KDE, no WMs). See question 11.

## Update after the lead's correction (Sept 26)

The lead reported that master had moved on. Changes since the first pass:

- **KDE Plasma is offered.** Plasma 6 over VNC, on Debian 13, Ubuntu 26.04 and Kali (the apt family only).
  - **Desktop Environments:** a KDE row in the comparison table, a KDE screenshot, what's turned off for VNC, the 4 GB RAM warning, and an availability table.
  - **Everywhere else:** "LXDE and KDE are no longer offered" is now "WMs and LXDE". The CLI `--de kde` row, Supported Distros, the install guide, the home page, the FAQ and the WM page all mention KDE.
  - The "KDE only in Modded" callout now points to the Ubuntu KDE Modded edition as the themed option.
- **Modded OS names the five new editions:** Ubuntu 26.04 XFCE, Ubuntu 26.04 KDE, Debian 13 XFCE, Manjaro XFCE (ARM) and Kali XFCE.
  - Still no dates or prices. The page says they're not released yet.
  - A preview of the new look (`debian-modded-xfce-desktop.png`, PASS) is labelled as a test build.
  - The 4 current editions are kept as "what you can buy today". The buyer install flow is still marked as unchanged.
- **CLI reference: new sections.**
  - **Updating:** `andronix update [<distro>]`, `--self`, `--no-self`.
  - **Backups:** `backup --to storage` writes to `Andronix/backups` in phone storage; `restore` with no file offers a picker; backups are portable.
  - **Tuning the desktop:** `tune --profile light|balanced`, automatic below 3 GB of RAM.
  - The quick reference and "where things live" are updated.
- **The light profile** is also on Desktop Environments ("Making a desktop lighter") and on Troubleshooting ("The desktop is slow"). KDE (about 2.5 GB) is added to the storage table.
- **Manjaro has no sudo** (`DISTRO_SUDO=none` on master). Supported Distros, the CLI's First login, the install guide and the FAQ now say to use `andronix start manjaro --root`. This wasn't in the lead's message; I found it in master's STATUS.md.
- **Void's TODO is removed.** Master embeds the `fchmodat2` preload shim, and Void passes on Android 16 (kernel 6.6).
- **MATE screenshot added** (`debian-mate-desktop.png`, Go binary PASS, after the caja fix).
- **Not documented, as asked:**
  - Termux:X11 and automatic PulseAudio (agent `x11`);
  - dev packs (in progress);
  - Modded delta updates (`update --manifest/--token`);
  - `install --modded --token`.

  The Fixing Sound page still says "pkg install pulseaudio, then andronix start starts it". Revisit that when `feat-x11-audio` lands.

## What changed (first pass)

### New pages

- **`andronix-cli/andronix-cli.mdx`, "The andronix Command":** the CLI reference. It covers:
  - distro names, CPU types and start scripts;
  - `install` and its options, the step list, and "run the same command again to resume";
  - first login (username, password, VNC password; root is locked, use `sudo`);
  - `start`, `list`, `remove`, `backup` and `restore`;
  - the commands inside a distro, where the files live, and which old commands still work.
- **`unmodded-distros/distros.mdx`, "Supported Distros":** one section per distro with version, CPUs, browser and its install, start and remove commands. Also a table of package-manager commands.
- **`unmodded-distros/older-installs.mdx`, "Installs from the Old Installer":**
  - how to tell which installer you used;
  - old versions and what replaces them;
  - installing next to an old install, and moving files across;
  - `andronix remove --legacy`, with links to the pages marked outdated.
- **`troubleshoot/install-problems.mdx`, "Troubleshooting Installs":** covers:
  - a stopped install (resume), signal 9, storage sizes, and `pkg` errors from old Termux;
  - download errors and the rate limit, an unsupported CPU;
  - the desktop not starting or closing with Termux, LAN access;
  - a forgotten password, sudo's audit-message noise, and where the logs are.

### Rewritten or updated

- **Installing a Distro:**
  - no window-manager path;
  - the new step list, "Create your user", and a start-command table with the Ubuntu button mapping;
  - how to start VNC, and a desktop screenshot.
- **Uninstalling a Distro:** the app flow is kept. Added an "Uninstalling from Termux" section (`andronix remove`, `--legacy`) and a warning to back up first.
- **Desktop Environments:**
  - XFCE, LXQt, MATE and CLI only on every distro, plus KDE Plasma on Debian, Ubuntu 26.04 and Kali, in a comparison table;
  - screenshots;
  - a note that WMs and LXDE are no longer offered;
  - the light profile, and how to change desktop (`--reinstall`).
- **VNC Basics:**
  - the new size menu (Enter picks Auto), and `vncserver-start 1920x1080`;
  - the "Desktop is running" box, and keeping Termux open;
  - `vncserver-stop` (Enter picks `:1`), and changing the VNC password;
  - `--lan`, with a security warning.
  - The old instructions moved to a "VNC on an old install" section, which is for Modded OS and old installs.
- **Accessing Internal Storage:** `/sdcard` is bound automatically after `termux-setup-storage`. It explains sharing extra folders with `~/<distro>-binds/`. The old steps are under "Storage on an old install".
- **Fixing Sound:** new installs only need `pkg install pulseaudio`, because `andronix start` starts it. The old steps are under "Sound on an old install".
- **Android 12 and Newer:** after the fix, re-run the install command to resume. Added the Android 14+ "Disable child process restrictions" switch.
- **Modded OS and Installing Modded OS:**
  - a "New Modded OS editions are coming" callout, and the five new editions (see the update above), with no dates;
  - the buyer install flow is marked as unchanged;
  - VNC links go to the old-install section.
- **Other pages:**
  - How Andronix Works: the `andronix` building block and what happens during an install.
  - Limitations: CPU availability per distro.
  - Home page: a "new installer" callout and a card for the CLI.
  - FAQ: the Kali answer is updated; three new entries (username instead of root, where the WMs went, old distros still work).
  - Browsers: Firefox is preinstalled, `sudo` on new installs, Alpine has Firefox now.
  - SSH: log in as your user, with `sudo`.
  - LibreOffice, IDEs and GIMP: dropped the XSDL links.

### Marked outdated (not deleted)

- **Window Managers:** titled "(retired)", with a callout pointing to Desktop Environments. Existing installs keep working.
- **XSDL Basics:** titled "(outdated)", with a callout saying it's untested with the new installer and to use VNC.
- **Old distro versions** (Ubuntu 18.04/20.04/22.04, Debian 10 and the rest): the Older Installs page covers them, and the old VNC, storage and sound steps sit in "old install" sections.

### Screenshots

These are in `public/images/new-installer/`. All are PASS results from the agents' `docs/screens/`.

| File | Source | Result |
|---|---|---|
| `debian-xfce-{desktop,menu,apps}.png` | master `docs/screens/` | PASS |
| `ubuntu-xfce-{desktop,menu}.png` | master | PASS |
| `fedora-xfce-desktop.jpg`, `fedora-lxqt-{desktop,menu}.jpg` | port-apt-dnf, `docs/ports/fedora.md` ("pass") | converted to JPEG (they were 500-700 KB PNGs) |
| `void-xfce-desktop.png` | port-pacman-apk-xbps `INDEX.md` | PASS (k<6.6) |
| `ubuntu-kde-{desktop,menu}.png` | master `INDEX.md` | PASS (Go binary) |
| `debian-mate-desktop.png` | master | PASS (Go binary, after the caja fix) |
| `debian-modded-xfce-desktop.png` | master, "Modded editions" | PASS (the locked Modded design) |

Master now has PASS shots for all 9 distros and every desktop. More could be added to Supported Distros (Kali, Arch, Manjaro, Alpine XFCE); I didn't add them. `ubuntu-kde-desktop.png` is copied but not referenced yet.

## Still a guess or unverified

These are written from the installer's code or design, but nobody has tested them on a phone. The installer's STATUS.md lists them as untested.

- **Sound:** `pkg install pulseaudio`, then `andronix start` starts PulseAudio. It's in the code (`proot.StartAudio`), but untested on Android.
- **`/sdcard` bound automatically:** it's in the code, but the Android binds are untested.
- **Wake lock:** "Andronix keeps your phone from putting Termux to sleep" (`termux-wake-lock`) is untested.
- **Low-space warning:** "The installer checks your free space and warns you" is untested.
- **Storage sizes** on Troubleshooting Installs:
  - Most figures come from the Kali and Fedora port tables and apt's Debian figure (CLI 240-355 MB, XFCE/LXQt 0.8-1.6 GB, MATE 1.5-1.8 GB). Other distros may differ.
  - KDE's "about 2.5 GB" is `DE_DISK_MB`.
- **Resumable download** comes from the design ("resumable downloads"). The resumed-download path is listed as untested.
- **Changing the VNC password** by deleting `~/.config/tigervnc/passwd` and re-running `vncserver-start`. This follows the code (it prompts when the file is missing) but hasn't been run.
- **Android 14+ "Disable child process restrictions" switch:** from general Android knowledge, not tested here.
- **Sharing folders via `~/<distro>-binds/`:** the old snippet format is honoured (smoke-tested in Docker), but my example path is untested on a phone.
- **Desktops per distro:**
  - XFCE, LXQt and MATE on all 9 distros are now backed by master's emulator matrix (36/36 free combos on Android 16).
  - **KDE on Debian 13 and Kali is untested.** Only Ubuntu 26.04 KDE has passed, in Docker, and none has run on a phone.
  - **KDE on Ubuntu 24.04:** the docs don't offer it. `kde.conf` is apt-wide, so the installer might accept `ubuntu24 --de kde`. Confirm it's meant to be excluded.
- **`andronix update`:** self-update against the real mirror is untested (nothing published yet).
- **`backup --to storage`:** Android's permission prompt through `termux-setup-storage` is untested; it was tested in Docker with `ANDRONIX_STORAGE`.
- **"Manjaro XFCE (ARM)"** as the Modded edition's version label is my wording. The lead only said "Manjaro XFCE".

## TODOs left in the pages

These are MDX comments, `{/* TODO(docs): ... */}`, so readers don't see them. Search for `TODO(docs)`.

1. **Window Managers:** what the app's old WM buttons do after launch.
2. **Uninstalling a Distro:** which command the app's Uninstall button copies.
3. **Older Installs:** the final name for an old launcher that clashes with a new one (currently `start-<distro>-old.sh`). The page says "kept under a different name".
4. **Modded OS:** whether old buyers get the new editions.
5. **Supported Distros, Manjaro:** the stale arm-stable branch (Firefox 123, no security updates).
6. **Desktop Environments:** does `install --de <other>` add a second desktop without `--reinstall`?
7. **Installing a Distro:** the YouTube video and the app's DE-selection screenshot show the old installer.
8. **XSDL:** test it with the new installer, then rewrite or retire the page. Termux:X11 may replace it once it lands.
9. **proot pre-step** (install guide, CLI reference): remove after x11's final gate confirms the installer installs proot.

The Void TODO and the MATE-screenshot TODO are resolved.

## Questions for you

1. **Old WM and LXDE buttons:** the docs tell people with an older app to "pick a desktop environment instead". Once you decide what those buttons do, should the docs say so?
2. **Uninstall button:** should the docs describe `andronix remove` as what the app runs?
3. **Old launcher rename:** OK to name `start-<distro>-old.sh` in the docs once it's final?
4. ~~Void on newer phones~~ Resolved by the preload shim on master.
5. **Manjaro ARM:** ship arm-stable (old packages) or arm-testing? Should the docs warn about the old packages?
6. **XSDL:** retire the page or test it? It's still in the sidebar, marked outdated.
7. **Videos:** the install and VNC walkthrough videos show the old installer. Are new recordings planned? I only added TODOs.
8. **Blog post:** do you want a "new installer" post in `blog/`? I didn't write one.
9. **Modded preview image:** OK to show the test-build screenshot of the new Modded look publicly, before release?
10. **KDE on Ubuntu 24.04:** excluded on purpose? The docs list KDE only for Debian 13, Ubuntu 26.04 and Kali, as you said.
11. ~~App version in the guides~~ Decided: app 10.0 or newer.
12. ~~proot in get.sh~~ Decided: the installer installs proot. The docs step comes out after x11's final gate.
