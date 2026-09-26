# Docs information architecture: proposal

Sept 26, 2026. **Implemented** on branch `docs/new-installer`, as the lead asked:
- the structure below;
- every redirect, all checked (78 of 78 old URLs, with and without a trailing slash, land on a working page);
- the installer 2.0.0 content.

The four questions at the end are still open, and the pages use the defaults listed there.

The HTML version, with the sidebars side by side, is `docs-ia-proposal.html` in this folder.

## The problem

Today's sidebar is a flat list of 35 pages under seven headings, which follow the old site's filing (Installation, Desktop & GUI, Software, Termux, Help). Three things go wrong for a reader:

- **No path.** There's no "what's next?" Termux setup sits under "Termux", after the install guide that needs it.
- **Mixed eras in the same list.** Andronix 2.0 pages sit next to retired material (window managers, XSDL, old installs), so a new user can't tell what applies.
- **Scattered topics.**
  - Backups and updates only exist inside the CLI reference.
  - Troubleshooting is split across Help, Termux and "Android 12 and Newer".
  - Termux:X11 and dev packs (both final in installer 2.0.0) have no page at all.

## The new sidebar

It's built around the user journey. The four numbered steps are the beginner path; everything after them is looked up when needed.

```
Welcome                                   /
Step 1 · Start here
  What is Andronix                        /start-here/what-is-andronix
  Requirements                            /start-here/requirements            NEW
  Install Termux                          /start-here/install-termux
Step 2 · Install a distro
  Choose a distro and desktop             /install/choose                     NEW
  Install with the app                    /install/with-the-app
  Install without the app                 /install/without-the-app            NEW
  Uninstall a distro                      /install/uninstall
Step 3 · Start the desktop
  Termux:X11 (the desktop path)           /desktop/termux-x11                 NEW
Step 4 · Use it
  Install apps                            /use/apps
  Dev packs                               /use/dev-packs                      NEW
  Sound                                   /use/sound
  Phone storage                           /use/storage
  Back up and restore                     /use/backups                        NEW
  Keep it updated                         /use/updates                        NEW
  Make it faster                          /use/performance                    NEW
  SSH                                     /use/ssh
Modded OS
  Editions (Modded 2.0 and Classic)       /modded-os/modded-os                (URL kept)
  Install Modded OS                       /modded-os/modded-os-installation   (URL kept)
Troubleshooting
  The install fails or stops              /troubleshooting/install
  Process completed (signal 9)            /troubleshooting/signal-9
  The desktop is black, slow or closes    /troubleshooting/desktop            NEW
  Termux errors                           /troubleshooting/termux
  FAQ                                     /troubleshooting/faq
Reference
  The andronix command                    /reference/andronix-command
  Supported distros                       /reference/distros
  Desktops                                /reference/desktops
  Other ways to connect (VNC)             /reference/vnc
  Limitations                             /reference/limitations
About
  Account deletion                        /account/deletion                   (URL kept: linked from the app)
  Andronix and open source                /miscellaneous/open-source          (URL kept)
  Termux security                         /security/termux                    (URL kept)
Pre-2.0 archive (collapsed)
  Installs from before 2.0                /pre-2.0/older-installs
  Old install guides (VNC, sound, storage) /pre-2.0/old-install-guides        NEW (merged sections)
  Window managers                         /pre-2.0/window-managers
  XSDL                                    /pre-2.0/xsdl
Blog (collapsed)                          /blog/...                           (URLs kept)
```

### How it's built in Fumadocs

- **Folders.** One folder per group (`start-here/`, `install/`, `desktop/`, `use/`, `troubleshooting/`, `reference/`, `pre-2.0/`). Each has a `meta.json` with a `title` ("Step 1 · Start here") and page order.
- **Collapsed by default:** `pre-2.0/` and `blog/` get `"defaultOpen": false`.
- **About.** `account/`, `miscellaneous/` and `security/` don't move. The root `meta.json` lists them under an "About" separator, so their URLs stay put. `/account/deletion` is linked from the app and the Play listing.
- **"Next:" card.** A `<NextStep>` card sits at the end of every page in Steps 1 to 4. It links the obvious next page, with an optional "or" link for a branch (for example, "Next: Start the desktop · or: Uninstall"). Fumadocs' own prev/next footer stays for everything else.

The path through the journey:

```
What is Andronix → Requirements → Install Termux → Choose → Install with the app (or without)
→ Termux:X11 → Install apps → Dev packs → Sound → Storage → Backups → Updates → Make it faster
```

## Every page: keep / merge / rewrite / archive / delete

| Page (today) | Decision | New place | Why |
|---|---|---|---|
| Get Started with Andronix (`/`) | rewrite | `/` | The home becomes "Welcome": what Andronix is in two lines, then Step 1 to 4 cards. |
| How Andronix Works | rewrite | Start here › What is Andronix | Friendlier intro: Termux, proot, the andronix command, desktops. The technical part stays short. |
| Limitations | keep | Reference › Limitations | Reference material, not a step. |
| Android 12 and Newer | rewrite | Troubleshooting › Process completed (signal 9) | Named after the symptom people search for. Adds the Android 14+ switch. |
| Installing a Distro | rewrite (app flow later) | Step 2 › Install with the app | The app-flow parts wait for ui's redesign (TODOs are in place). The "without the app" section moves out. |
| Supported Distros | keep | Reference › Supported distros | Lookup table. A short "which one?" moves to the new Choose page. |
| Uninstalling a Distro | keep (app flow later) | Step 2 › Uninstall a distro | |
| Installs from Before Andronix 2.0 | archive | Pre-2.0 › Installs from before 2.0 | Only for old installs. |
| Modded OS | keep | Modded OS › Editions | Already covers Modded 2.0 and Classic. |
| Installing Modded OS | keep (app flow later) | Modded OS › Install | Classic flow, unchanged for buyers. |
| The andronix Command | rewrite | Reference › The andronix command | Adds `desktop`, `pack` and `telemetry` (final in 2.0.0). The long how-to sections move to Step 4 pages and the reference links to them. |
| Desktop Environments | keep | Reference › Desktops | Availability, screenshots. The "light profile" section moves to Make it faster; the "which one" advice moves to Choose. |
| Window Managers (retired) | archive | Pre-2.0 › Window managers | Retired in 2.0; old app keys now install XFCE with a notice. |
| VNC Basics | rewrite | Reference › Other ways to connect (VNC) | Owner decision: Termux:X11 is the desktop path; VNC is for other devices. "VNC on an old install" moves to the archive. |
| XSDL Basics (outdated) | archive | Pre-2.0 › XSDL | Untested with 2.0. Termux:X11 replaces it. |
| Browsers | merge | Step 4 › Install apps | Firefox is preinstalled now. The remaining commands (Chromium, per-distro) fit one page. |
| IDEs | merge | Step 4 › Install apps (and Dev packs) | VS Code / IntelliJ steps go into Install apps. Language toolchains are now dev packs. |
| LibreOffice | merge | Step 4 › Install apps | Two commands; not worth a page. |
| GIMP | merge | Step 4 › Install apps | Same. |
| Migrating Termux to F-Droid | rewrite | Step 1 › Install Termux | "Which Termux, where from", before the install. The `#manual-method` anchor is kept (the website links to it). |
| "Cannot Link Executable" Error | merge | Troubleshooting › Termux errors | With the other Termux errors (old `pkg`, `andronix: command not found`). |
| SSH Basics | keep | Step 4 › SSH | |
| Termux Security | keep | About › Termux security (URL kept) | Not part of the journey. |
| Troubleshooting Installs | rewrite (split) | Troubleshooting › The install fails / The desktop is black, slow or closes | Split by symptom: install problems vs desktop problems. Adds the Android 9 black desktop, the Termux:X11 black screen, and the kernel warning. |
| Accessing Internal Storage | rewrite | Step 4 › Phone storage | The new-install part stays; the old-install steps move to the archive. |
| Fixing Sound | rewrite | Step 4 › Sound | Sound is automatic in 2.0.0 (andronix installs and starts PulseAudio). The old steps move to the archive. |
| FAQ | rewrite | Troubleshooting › FAQ | Drops the answers now covered by symptom pages; keeps the Classic Modded ones. |
| Account Deletion | keep | About (URL kept) | Linked from the app and Play. |
| Andronix & Open Source | keep | About (URL kept) | |
| Blog (4 posts + index) | keep | Blog, collapsed | History. URLs kept. |
| *(new)* Requirements | new | Step 1 | Android version, CPU, free space, RAM, which Termux, kernel note for desktops. |
| *(new)* Choose a distro and desktop | new | Step 2 | A recommendation first (Debian or Ubuntu + XFCE), then when to pick others. |
| *(new)* Install without the app | new | Step 2 | The `get.sh` one-liner, from the install guide's section. |
| *(new)* Termux:X11 | new | Step 3 | `andronix desktop`, the app download, stop, known limits. |
| *(new)* Dev packs | new | Step 4 | `andronix pack add python/node/java/go/db`, the PostgreSQL helper. |
| *(new)* Back up and restore | new | Step 4 | From the CLI reference, as a task page. |
| *(new)* Keep it updated | new | Step 4 | `andronix update`, what it updates. |
| *(new)* Make it faster | new | Step 4 | The light profile (`andronix tune`), picking a lighter desktop, Termux:X11 vs VNC. |
| *(new)* Old install guides | new (merge) | Pre-2.0 | The "on an old install" sections from VNC, Sound and Storage, in one place. |

Nothing is deleted outright. Every merged or moved page redirects to its new home.

## URL plan

> **Update (Sept 26):** the docs are now versioned. Old URLs that were live on the old site go to their copy under `/v8` (App 8.x (Classic)), not to the new pages. See DOCS_STATUS.md, "Versioned docs". The table below is the original plan.

**Rule:** new URLs follow the new folders. Every old URL gets a permanent (308) redirect in `next.config.mjs`. OpenNext passes Next's `redirects()` through on Cloudflare. Browsers keep `#anchors` across a redirect, and moved pages keep their heading names, so deep links like `#vnc-on-other-devices` still land.

| Old URL | Redirects to |
|---|---|
| `/get-started/how-does-andronix-work` | `/start-here/what-is-andronix` |
| `/get-started/limitations` | `/reference/limitations` |
| `/android-12/andronix-on-android-12-and-beyond` | `/troubleshooting/signal-9` |
| `/unmodded-distros/unmodded-os-installation` | `/install/with-the-app` |
| `/unmodded-distros/distros` | `/reference/distros` |
| `/unmodded-distros/unmodded-os-uninstallation` | `/install/uninstall` |
| `/unmodded-distros/older-installs` | `/pre-2.0/older-installs` |
| `/andronix-cli/andronix-cli` | `/reference/andronix-command` |
| `/desktop-environments/desktop-environments` | `/reference/desktops` |
| `/window-managers/window-managers` | `/pre-2.0/window-managers` |
| `/vnc/vnc-basics`, `/desktop/vnc` | `/reference/vnc` |
| `/xsdl/xsdl-basics` | `/pre-2.0/xsdl` |
| `/software/browsers`, `/software/IDEs`, `/software/libre-office`, `/software/gimp` | `/use/apps` (each with its section anchor) |
| `/termux/migrating-to-f-droid` | `/start-here/install-termux` |
| `/termux/cannot-link-executable` | `/troubleshooting/termux` |
| `/ssh/ssh-basics` | `/use/ssh` |
| `/troubleshoot/install-problems` | `/troubleshooting/install` |
| `/troubleshoot/internal-storage` | `/use/storage` |
| `/troubleshoot/sound` | `/use/sound` |
| `/faq/faq` | `/troubleshooting/faq` |
| `/installations/non-modded-os` (old site, still linked) | `/install/with-the-app` |
| `/installations/modded-os` (old site, still linked) | `/modded-os/modded-os-installation` |
| Folder URLs (`/software`, `/termux`, `/troubleshoot`, ...) | the folder's first new page |

- **Kept as they are:**
  - `/`
  - `/account/deletion`
  - `/miscellaneous/open-source`
  - `/security/termux`
  - `/modded-os/*`
  - `/blog/*`
- **Inbound links checked:**
  - app (`LinkHub.kt`): `/account/deletion`
  - app and plans: `/android-12/...`
  - website: `/software/browsers`, `/termux/migrating-to-f-droid#manual-method` and the two `/installations/*`
  - installer: root only
- **Existing bug to fix at the same time:** `next.config.mjs` redirects `/blog/v7-0/` to `/blog/andronix-v7` and `/blog/v6-0/` to `/blog/andronix-v6`, but those targets don't exist (the pages are `v7-0` and `v6-0`). With a trailing slash, those URLs 404 today. Drop both rules.
- **Check after the move:**
  - a script requests every old URL on the built site and expects a 308 to a 200;
  - the existing internal link checker covers the new pages.

## Content rewrites in the same pass (installer 2.0.0 is final)

- **Termux:X11** (`andronix desktop`, `start --x11`, `desktop stop`) gets its own page, plus a mention in the step list.
- **proot:** the installer installs it itself (step "Installing proot"). Drop "run `pkg install proot -y` first".
- **Sound:** PulseAudio is installed and started automatically. The Sound page becomes short.
- **Dev packs:** `andronix pack` gets a page, and a row in the reference.
- **Telemetry:** the first-run notice and `andronix telemetry off|on|status` go in the reference, with what is and isn't sent.
- **Old app keys:** LXDE installs LXQt; Enlightenment and the window managers install XFCE, with a notice. The WM archive page says so.
- **Old kernels:** desktops warn on kernels older than 4.8. Android 9 on kernel 4.4 shows a black XFCE (known issue); the command line works. This goes on the desktop troubleshooting page.
- **Play Store Termux:** it now works with the installer (tested on Android 11 and 16). The Install Termux page says which Termux builds work. This needs a decision from you; see question 1.

App-flow pages (screens, button names, screenshots) stay as they are, with their TODOs, until ui's app redesign is final. Then they get one rewrite pass with fresh emulator screenshots.

## Questions

1. **Which Termux do we recommend?** F-Droid, GitHub, or the new Play Store build? The installer passes on all three (Play needs Android 11+).
2. ~~Desktop default~~ **Decided by the owner:** Termux:X11 is the desktop path. Step 3 covers Termux:X11 only, and VNC moves to Reference as "Other ways to connect".
3. **Merging the software pages** into one "Install apps" page: OK, or keep one page per app for search traffic? The redirects keep the old URLs working either way.
4. **Step titles:** "Step 1 · Start here" in the sidebar, or plain "Start here" with the number only on the page?

**Defaults used until you decide:**
1. The Termux table stays neutral: F-Droid, GitHub, and Play on Android 11 and newer.
2. (Decided) Step 3 is Termux:X11 only.
3. The software pages are merged.
4. The sidebar uses "Step N · …".
