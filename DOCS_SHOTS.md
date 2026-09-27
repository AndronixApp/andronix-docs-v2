# App 10 screenshot shot list

## Capture status (ui-revamp 5b2cd649, installer v2.0.1, Sept 26)

**Committed:** every shot the App 10 pages use, all 1080 × 1920, 24-bit, no alpha.
- **App:**
  - `app10-home`, `-distro-list`, `-interface-picker`, `-desktop-picker` (retake, now with KDE Plasma)
  - `app10-termux-step`, `-termux-step-uninstall`, `-install-result`, `-uninstall-sheet`
  - `app10-start-desktop`, `-start-desktop-get-x11`, `-phantom-tip`
  - `app10-modded-editions`, `-modded-editions-owned`, `-modded-classic` (retake: Classic editions only)
  - `app10-modded-termux-step`, `app10-premium`, `-premium-owner`, `-delete-account`, `-settings-analytics`
- **Termux:**
  - `termux-install-running`: retake, release v2.0.1 banner, fresh install.
  - `termux-create-user`.
  - `termux-x11-desktop`: XFCE full screen in Termux:X11 with the extra-keys bar hidden. It now replaces `new-installer/termux-x11-xfce-phone.jpg` on Step 3 and in the blog post.

**Kept on purpose:**
- `app10-premium` is the earlier, scrolled capture. The unscrolled retake's hero reads "Test purchase (fake Play)" and isn't used. Retake from the Play internal-test build (with the Play Store shots).
- `app10-modded-editions` shows Get pills instead of prices (fake Play). It's fine for the docs; the Play shots come from the internal-test build.

**Dropped:**
- `termux-modded-first-boot`: it needs a real bucket. Its spot is removed; the page points to the free Create your user step instead.
- `app10-termux-sources`, `app10-modded-edition-unpaid`, `app10-modded-edition-owned`: those screens don't exist in the frozen UI.
- `termux-vncserver-start`: App 10 uses Termux:X11.

**Noted:**
- `app10-termux-step-uninstall` shows `andronix remove debian --legacy`, which is intentional and documented.
- `app10-premium-owner` shows `andronix update --channel stable`, which is documented.
- `app10-phantom-tip` says "How to fix it", which the docs text matches.

## How to capture

- **Device:** the Android 16 emulator (Pixel, Google APIs).
- **Screen size:** set the display to **1080 × 1920** (`adb shell wm size 1080x1920`, density 420) so the same files also meet the Play Store's rule that the long side is at most twice the short side. A native 1080 × 2400 capture is 2.22:1 and Play rejects it.
- **Settings:** font scale 1.0, English (US), dark (the app is dark only).
- **Clean status bar:** SystemUI demo mode (`adb shell settings put global sysui_demo_allowed 1`, then `am broadcast -a com.android.systemui.demo -e command enter`, and set clock 1200, full battery, full wifi, no notifications).
- **Seeded accounts** (dev stack):
  - **Free:** signed in, no purchases.
  - **Pass:** owns the Modded Pass.
  - **Premium:** owns Premium.
  - **Past buyer:** owns a Classic edition (legacy grant).
- **Files:** save as PNG, 24-bit, no alpha, to `public/images/app10/<name>.png` in the docs repo.
  - The pages already point at these names through `<AppShot name="..." />`, which renders nothing in production until the file exists. Dropping the files in is all it takes.
  - Termux shots use the same size and folder.

## App shots

| # | File | Docs page (place) | Screen | Account state | Step | Alt text | Play listing |
|---|---|---|---|---|---|---|---|
| 1 | `app10-home.png` | Install with the app (step 1); Uninstall (step 1); blog | Home tab, blocks for Linux Distribution, Modded OS, Premium | Free (signed in, no purchases) | Open the app | The Andronix app's Home screen, with the Linux Distribution block | yes |
| 2 | `app10-distro-list.png` | Install with the app (Selection); Uninstall (Select distribution) | Linux Distribution list: the 9 free distros, one-line summaries | Free | Pick a distro | The list of free Linux distros in the Andronix app | yes |
| 3 | `app10-interface-picker.png` | Install with the app (Select the UI) | Desktop environment or command line choice for Debian | Free | Choose desktop or command line | Choosing between a desktop and the command line for Debian |  |
| 4 | `app10-desktop-picker.png` | Install with the app (Desktop Environment) | Desktop list for Debian: XFCE, LXQt, MATE, KDE Plasma | Free | Choose a desktop | Choosing XFCE, LXQt, MATE or KDE Plasma for Debian | yes |
| 5 | `app10-termux-step.png` | Install with the app (Termux Execution); Uninstall (Termux) | Termux step with the display command `andronix install debian --de xfce`, Copy and Open Termux | Free | Copy the command and open Termux | The Termux step, showing the andronix install command with Copy and Open Termux buttons | yes |
| 6 | `app10-install-result.png` | Install with the app (Finish the Process) | Install result dialog, success (plus the result notification if it fits) | Free | After the install finishes | The install result: Debian 13 with XFCE installed |  |
| 7 | `app10-start-desktop.png` | Install with the app (Start the desktop); Start the desktop (Termux:X11); blog | Start the desktop step: Termux:X11 Installed badge, `andronix desktop debian` with Copy, Open Termux, keep-running tip, 'Other ways to connect (VNC)' link | Free, Termux:X11 installed | Open the desktop | The Start the desktop step, with Termux:X11 installed and the andronix desktop command | yes |
| 8 | `app10-start-desktop-get-x11.png` | Start the desktop (Termux:X11, Set it up once) | Start the desktop step before Termux:X11 is installed: 'Get Termux:X11 · From GitHub' | Free, Termux:X11 not installed | Get the Termux:X11 app | The Start the desktop step asking you to get Termux:X11 from GitHub |  |
| 9 | `app10-uninstall-sheet.png` | Uninstall (Long press on distribution) | Long-press sheet on a distro with Uninstall | Free, Debian installed | Long-press the distro | The long-press sheet for Debian with the Uninstall option |  |
| 10 | `app10-termux-step-uninstall.png` | Uninstall (Paste and Execute) | Termux step in uninstall mode (the remove command) | Free, Debian installed | Copy the uninstall command | The Termux step with the uninstall command |  |
| 12 | `app10-modded-editions.png` | Modded OS Editions; blog | Modded tab: the 5 Modded 2.0 editions with prices, Pass offer | Free | Browse editions | The Modded tab with the five Modded 2.0 editions and their prices | yes |
| 13 | `app10-modded-editions-owned.png` | Modded OS Editions (Modded 2.0) | Modded tab with Owned badges on all 5 editions | Modded Pass owner | Browse editions | The Modded tab for a Modded Pass owner, every edition marked Owned | yes |
| 14 | `app10-modded-classic.png` | Modded OS Editions (Classic editions) | Classic section: the 4 Classic editions, free for past buyers | Past buyer (Classic Ubuntu XFCE) | Browse editions | The Classic Modded editions for a past buyer |  |
| 17 | `app10-modded-termux-step.png` | Installing Modded OS (Termux Execution) | Termux step with the masked Modded command (`--token ••••`), Copy and Open Termux | Modded Pass owner | Copy the command | The Termux step for a Modded edition, with the token hidden |  |
| 18 | `app10-premium.png` | Blog (Premium); Modded OS Editions | Premium screen: price, 30% off the Pass, early access, download limits, supporter wall | Free | Open Premium | The Premium screen with its perks and price | yes |
| 19 | `app10-premium-owner.png` | Blog (Premium) | Premium screen for an owner: perks unlocked, supporter wall option | Premium owner | Open Premium | The Premium screen for a Premium owner |  |
| 20 | `app10-phantom-tip.png` | Process completed (signal 9) | The Android 16 signal 9 tip on the Start the desktop step, with 'How to fix it' | Free, Android 16 | Shown when signal 9 is likely | The app's tip about Android stopping Termux, with a Fix this button |  |
| 21 | `app10-delete-account.png` | Account Deletion (How to delete) | Profile/Settings with Delete account, and the re-authentication prompt | Free | Delete account | Deleting your account from the Andronix app |  |
| 22 | `app10-settings-analytics.png` | Account Deletion (What isn't linked); blog (Privacy) | Settings with the Share usage analytics switch | Free | Settings | The Share usage analytics switch in Settings |  |

## Termux shots (not the app)

These show the installer in Termux. They don't depend on the app UI, so they can be taken any time.

| File | Docs page (place) | Screen | Note |
|---|---|---|---|
| `termux-install-running.png` | Install with the app (Wait); Install without the app | Termux: the installer's step list mid-install (Debian 13 + XFCE), progress bar visible | Termux, not the app; can be captured now |
| `termux-create-user.png` | Install with the app (Create your user) | Termux: the first-boot user form (username, password, desktop password) | Termux, can be captured now |
| `termux-x11-desktop.png` | (only if a page needs one; none does today: Step 3 uses `new-installer/termux-x11-xfce-phone.jpg`) | Termux:X11 showing the XFCE desktop, 1080 × 1920, demo-mode status bar | Replaces the dropped `termux-vncserver-start` (App 10 uses Termux:X11; VNC is only an "Other ways" link) |

**Already current, keep:**
- `new-installer/termux-x11-xfce-phone.jpg` (XFCE in Termux:X11, from x11's F-Droid run);
- the desktop screenshots in `new-installer/`;
- the RealVNC viewer shots on the VNC page (third-party app).

**Not app 10 pages:** `content/docs/v8` (App 8.x Classic) keeps its old screenshots as they are.

## Play Store listing: reuse the same set

> **Update (lead):** the 8 Play Store shots will be taken later from the real Play internal-test build, where prices show. Use the list below as the plan; the docs keep the price-less captures.

Suggested phone screenshots, in order. All are 1080 × 1920, so they fit Play's size and 2:1 limits:

1. `app10-home`: Linux on your phone, no root.
2. `app10-distro-list`: 9 distros.
3. `app10-desktop-picker`: XFCE, LXQt, MATE, KDE Plasma.
4. `app10-termux-step`: one command.
5. `new-installer/termux-x11-xfce-phone`: a real desktop on the phone. Re-take it at 1080 × 1920 with the demo-mode status bar, or crop it.
6. `app10-start-desktop`: one tap to the desktop.
7. `app10-modded-editions-owned` or `app10-modded-editions`: Modded OS 2.0.
8. `app10-premium`.

Play allows 2 to 8 phone screenshots, JPEG or 24-bit PNG without alpha, with each side between 320 and 3840 px and the long side no more than twice the short side. Check the Play Console's current rules when uploading. Captions and a device frame, if wanted, come from the listing design, not these raw files.

## Report a problem (added Sept 27)

- `app10-report-installer-attached.png`: ui's `test-results/report-10-12-handoff.png`, cropped to 1080 × 1920 (rows 90–2010, status bar dropped), 24-bit.
- `app10-report-sent.png`: ui's `test-results/report-10-16-handoff-real-sent.png`, same crop.
