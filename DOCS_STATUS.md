# Docs status: new installer

Sept 26, 2026. Branch `docs/new-installer`, committed locally. Nothing has been pushed or deployed. `pnpm build` passes (37 static pages), and a script checked every internal link and `#anchor` in `content/docs` (0 broken).

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
11. **App version in the guides:** keep "Andronix 7.0 or newer", or require app 10.0 (Andronix 2.0) for the new desktop choices?
