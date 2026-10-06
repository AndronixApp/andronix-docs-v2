# Deploying docs.andronix.app

The docs are a Next.js 16 + Fumadocs site, built as a **static export** (`out/`) and served entirely by **Workers Static Assets** (wrangler 4).
- Worker: `andronix-docs-v2` (`wrangler.toml`). It has no script: every page, prefetch file, the search index (`/api/search`, searched in the browser) and the redirects (`out/_redirects`, written from `lib/redirects.mjs`) are static assets, so visits never count as Worker requests.
- Why: the earlier OpenNext build ran a Worker for every page view, and Next 16's segment prefetch looped against it (about 190 requests a second per open tab), which used up the Free plan's 100k daily Worker requests (Error 1027).
- The custom domain `docs.andronix.app` is attached to the Worker in the Cloudflare dashboard; it isn't in `wrangler.toml`.

**Release order (blog move, Oct 2026):** deploy the website with `/blog` **before** the docs build that 301s `/blog/*` to andronix.app. Earlier: deploy the docs **before** app 10.0 and before the website's Andronix 2.0 banner. Both link to docs pages that only exist in this build (for example `/start-here/install-termux`, `/troubleshooting/signal-9`, `/blog/andronix-2-0`). The docs link only to website pages that are already live (`/legal/privacy-policy`), so there's no cycle.

## 0. Before you start

```sh
node --version                           # 20 or newer (24 is fine)
pnpm install --frozen-lockfile
pnpm exec wrangler whoami                # logged in to the Andronix Cloudflare account?
# or, non-interactive: export CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=...
```

- **Build from the release commit.** Merge `docs/new-installer` into `master` first (reviewed PR), then deploy from `master` so the live site matches the default branch.
- **Release date.** Set `RELEASE_DATE` in `lib/release.mjs` (for example `'October 2, 2026'`). It fills in the blog post, the blog index and the changelog. While it's still the placeholder `RELEASE_DATE`, `pnpm run deploy` refuses to run (`scripts/check-release-date.mjs`). `pnpm build` and `pnpm run upload` still work, for staging.
- **Early bird end date.** Set `EARLY_BIRD_END` in `lib/release.mjs` too (when the Modded Pass early-bird price ends, 4 days after launch). It fills in the Modded OS Prices table, the blog post and the changelog. `pnpm run deploy` refuses to run while it's still `{EARLY_BIRD_END}`.
- **Analytics client ID: nothing to set.** The public OpenPanel "web" client id (`b798ebe6-278f-4cd0-beb3-8759abd175f1`, shared with andronix.app) is committed in `.env.production`, and Next.js reads it at build time, so every build has analytics on. An `OPENPANEL_WEB_CLIENT_ID` in the environment overrides it (set it to an empty value to build without analytics).

## 1. Note the current live version (for rollback)

```sh
pnpm exec wrangler deployments list --name andronix-docs-v2
```

Write down the version ID of the active deployment. That's what you roll back to.

## 2. Build and check locally

```sh
pnpm build                               # prebuild checks (screenshots, App 10 links, _redirects), then the export into out/
pnpm exec wrangler dev --port 8799 --local
```

Then, in another terminal, run the smoke test (section 5) against `http://localhost:8799`. Stop `wrangler dev` when it passes.

`wrangler.toml` has `[build] command = "pnpm build"`, so `wrangler deploy`, `wrangler versions upload` and `wrangler dev` always build first, and a version can never be uploaded from a stale `out/`. The `pnpm run deploy` (plus the release-date check), `pnpm run upload` and `pnpm run preview` scripts (always with `run`: plain `pnpm deploy` is a different, built-in pnpm command) just call them, so the same checks (`scripts/app-shots-manifest.mjs`, `scripts/check-latest-links.mjs`, `scripts/write-redirects.mjs`) run before every build. The build fails if an App 10 page links to a URL that only exists in the App 8.x docs.

While someone reviews on a local `next dev`, build with `NEXT_DIST_DIR=.next-check pnpm build` so the dev server's `.next` isn't disturbed; the export still lands in `out/`. Serve it with `pnpm exec wrangler dev --port 8799 --local` (`next start` doesn't serve a static export).

## 3. Staging: upload without going live

```sh
pnpm run upload
```

This builds and uploads a **new version without routing traffic to it** (`wrangler versions upload`). It prints the version ID and, if preview URLs are enabled on the Worker, a preview URL like `https://<id-prefix>-andronix-docs-v2.<account>.workers.dev`.

Run the smoke test (section 5) against the preview URL, and look at the pages with the owner.

## 4. Go live

Promote the **exact version you tested**:

```sh
pnpm exec wrangler versions deploy <version-id>@100% --name andronix-docs-v2
```

Promoting an uploaded version this way skips the release-date check, so make sure `lib/release.mjs` had the real date when you ran `pnpm run upload`.

To build and deploy in one step instead: `pnpm run deploy` (not `pnpm deploy`). That skips staging, so use it only for a hotfix.

Then run the smoke test (section 5) against `https://docs.andronix.app`.

If the zone has Cloudflare cache rules for `docs.andronix.app`, purge the cache for the host (Caching › Purge › Custom: hostname). Workers Static Assets are served per version and don't need a purge.

## 5. Smoke test

```sh
BASE=https://docs.andronix.app   # or http://localhost:8799, or the preview URL
# Every docs URL app 10 links to (app-wt-ui LinkHub), plus the key pages: expect 200
for p in / /start-here/install-termux /start-here/requirements /install/with-the-app /install/without-the-app \
  /desktop/termux-x11 /reference/desktops /reference/vnc /reference/limitations /reference/andronix-command \
  /modded-os/modded-os-installation /pre-2.0/window-managers /security/termux /troubleshooting/faq \
  /troubleshooting/install /troubleshooting/signal-9 /account/deletion /v8 /sitemap.xml /robots.txt \
  /images/app10/app10-home.png /og-image-1200x630.png "/api/search?query=termux"; do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$BASE$p")" "$p"
done
# Old URLs that the v8.x app and search engines use: expect 308 to /v8/...
# (except /android-12/andronix-on-android-12-and-beyond: 308 to /troubleshooting/signal-9)
for p in /unmodded-distros/unmodded-os-installation /faq/faq /android-12/andronix-on-android-12-and-beyond \
  /termux/migrating-to-f-droid /desktop-environments/desktop-environments /window-managers/window-managers; do
  printf '%s %s -> %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$BASE$p")" "$p" "$(curl -s -o /dev/null -w '%{redirect_url}' "$BASE$p")"
done
```

```sh
# The blog moved to the website: expect 301 to https://andronix.app/blog/...
for p in /blog /blog/andronix-2-0 /blog/rss.xml; do
  printf '%s %s -> %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$BASE$p")" "$p" "$(curl -s -o /dev/null -w '%{redirect_url}' "$BASE$p")"
done
```

All 200s, all old URLs 308 to their `/v8/...` page (the Android 12 page to `/troubleshooting/signal-9`), and the blog URLs 301 to andronix.app. The full redirect list is `lib/redirects.mjs`. Also open two or three pages in a browser and check that screenshots load and that the sidebar version menu switches between App 10 and App 8.x.

## 6. Rollback

```sh
pnpm exec wrangler rollback <version-id-from-step-1> --name andronix-docs-v2
```

Or in the dashboard: Workers & Pages › `andronix-docs-v2` › Deployments › the previous version › Rollback. This restores that version's code and static files at once. Rolling back to a version from before the static export (for example the first 2.0 OpenNext version) brings back the Worker script and its prefetch loop; roll back only to static versions, or to the pre-2.0 site.

**Rollback can't undo cached redirects.** Visitors' browsers cache the new site's permanent (308) redirects. After a rollback, someone who already visited an old URL may keep being sent to `/v8/...`, which doesn't exist on the old site, until they clear their cache. If a rollback is likely, stage longer (section 3) before going live.

## 7. After the deploy

- Tell the lead: the app 10 release and the website banner can go ahead.
- Check that the Worker's request count stays near zero for a day (Workers & Pages › `andronix-docs-v2` › Metrics): asset requests don't count toward the Workers request limit.
- Watch analytics at events.andronix.app (if the client ID was set): page views should appear within minutes.
