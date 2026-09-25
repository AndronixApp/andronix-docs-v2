# Docs status: new installer

Sept 26, 2026. Branch `docs/new-installer`, committed locally. Nothing has been pushed or deployed. `pnpm build` passes (37 static pages), and a script checked every internal link and `#anchor` in `content/docs` (0 broken).

## What changed

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
  - XFCE, LXQt, MATE and CLI only, on every distro, in a comparison table;
  - screenshots;
  - a note that WMs, LXDE and KDE are no longer offered;
  - how to change desktop (`--reinstall`).
- **VNC Basics:**
  - the new size menu (Enter picks Auto), and `vncserver-start 1920x1080`;
  - the "Desktop is running" box, and keeping Termux open;
  - `vncserver-stop` (Enter picks `:1`), and changing the VNC password;
  - `--lan`, with a security warning.
  - The old instructions moved to a "VNC on an old install" section, which is for Modded OS and old installs.
- **Accessing Internal Storage:** `/sdcard` is bound automatically after `termux-setup-storage`. It explains sharing extra folders with `~/<distro>-binds/`. The old steps are under "Storage on an old install".
- **Fixing Sound:** new installs only need `pkg install pulseaudio`, because `andronix start` starts it. The old steps are under "Sound on an old install".
- **Android 12 and Newer:** after the fix, re-run the install command to resume. Added the Android 14+ "Disable child process restrictions" switch.
- **Modded OS and Installing Modded OS:** a "New Modded OS editions are coming" callout, with no dates or editions named. The buyer install flow is marked as unchanged. VNC links go to the old-install section.
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

Not used:

- **Kali XFCE:** it passes, but the shots are root sessions on a black background.
- **Kali LXQt:** "!" emblems on the desktop icons.
- **MATE:** caja keeps exiting, so there are no icons and no wallpaper.
- **Arch, Manjaro, Alpine:** screenshots exist, but they have no PASS row in `INDEX.md`.
- **The modded Debian screen:** FAIL.

## Still a guess or unverified

These are written from the installer's code or design, but nobody has tested them on a phone. The installer's STATUS.md lists them as untested.

- **Sound:** `pkg install pulseaudio`, then `andronix start` starts PulseAudio. It's in the code (`proot.StartAudio`), but untested on Android.
- **`/sdcard` bound automatically:** it's in the code, but the Android binds are untested.
- **Wake lock:** "Andronix keeps your phone from putting Termux to sleep" (`termux-wake-lock`) is untested.
- **Low-space warning:** "The installer checks your free space and warns you" is untested.
- **Storage sizes** on Troubleshooting Installs come from the Kali and Fedora port tables and apt's Debian figure (CLI 240-355 MB, XFCE/LXQt 0.8-1.6 GB, MATE 1.5-1.8 GB). Other distros may differ.
- **Resumable download** comes from the design ("resumable downloads"). The resumed-download path is listed as untested.
- **Changing the VNC password** by deleting `~/.config/tigervnc/passwd` and re-running `vncserver-start`. This follows the code (it prompts when the file is missing) but hasn't been run.
- **Android 14+ "Disable child process restrictions" switch:** from general Android knowledge, not tested here.
- **Sharing folders via `~/<distro>-binds/`:** the old snippet format is honoured (smoke-tested in Docker), but my example path is untested on a phone.
- **"Every distro offers XFCE, LXQt and MATE":**
  - This is per your decision.
  - Debian and Ubuntu LXQt/MATE only exist on the port-apt-dnf branch (as apt package lists), not on master yet.
  - Arch, Manjaro and Alpine have no PASS row yet.
  - MATE has the caja quirk on Kali and Fedora.
- **Distro sections** for Kali, Arch, Manjaro and Alpine rely on port notes, not on a PASS screen row.

## TODOs left in the pages

These are MDX comments, `{/* TODO(docs): ... */}`, so readers don't see them. Search for `TODO(docs)`.

1. **Window Managers:** what the app's old WM buttons do after launch.
2. **Uninstalling a Distro:** which command the app's Uninstall button copies.
3. **Older Installs:** the final name for an old launcher that clashes with a new one (currently `start-<distro>-old.sh`). The page says "kept under a different name".
4. **Modded OS:** which editions come first, and whether old buyers get them.
5. **Supported Distros, Manjaro:** the stale arm-stable branch (Firefox 123, no security updates).
6. **Supported Distros, Void:** xbps fails under proot on Linux 6.6+ kernels (fchmodat2).
7. **Desktop Environments:** a MATE screenshot. Also: does `install --de <other>` add a second desktop without `--reinstall`?
8. **Installing a Distro:** the YouTube video and the app's DE-selection screenshot show the old installer.
9. **XSDL:** test it with the new installer, then rewrite or retire the page.

## Questions for you

1. **Old WM and LXDE buttons:** the docs tell people with an older app to "pick a desktop environment instead". Once you decide what those buttons do, should the docs say so?
2. **Uninstall button:** should the docs describe `andronix remove` as what the app runs?
3. **Old launcher rename:** OK to name `start-<distro>-old.sh` in the docs once it's final?
4. **Void on newer phones:** until proot handles `fchmodat2`, should Supported Distros warn Android 15+ users away from Void, or will the installer refuse it on those phones?
5. **Manjaro ARM:** ship arm-stable (old packages) or arm-testing? Should the docs warn about the old packages?
6. **XSDL:** retire the page or test it? It's still in the sidebar, marked outdated.
7. **Videos:** the install and VNC walkthrough videos show the old installer. Are new recordings planned? I only added TODOs.
8. **Blog post:** do you want a "new installer" post in `blog/`? I didn't write one.
