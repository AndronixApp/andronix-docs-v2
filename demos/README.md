# Terminal demos

Short recordings of the real `andronix` installer for the docs, made with [VHS](https://github.com/charmbracelet/vhs). Each `*.tape` is one demo, and `render.sh` renders them into `public/demos/<name>.webm`, `.mp4` and `.jpg` (the poster, the last frame). Pages show them with `<TerminalDemo name="…" command="…" />` (`components/terminal-demo.tsx`), which loads a video only once it scrolls into view.

```sh
demos/render.sh                 # every demo, about 15 minutes
demos/render.sh doctor clean    # only these
```

Needs Docker, Go, ffmpeg and a checkout of andronix-distros (`ANDRONIX_DISTROS`, default `~/andronix/andronix-distros`).

## The output is real

`render.sh` builds the installer from andronix-distros: tag `v2.0.1` for most demos, `v2.0.0` for the update demo, and branch `next-2.0.2` for `andronix report` (labelled installer 2.0.2). It runs it in a Termux-like Linux box (`Dockerfile`): VHS's official image, plus a non-root user, Termux's own proot fork, and Geist Mono. This box mirrors andronix-distros' `tests/Dockerfile`. Every line on screen is what the installer printed. The only stand-ins:

- **Termux:X11:** Xvfb stands in for the `termux-x11` server (`fake-termux-x11`, the same as andronix-distros' `tests/x11`). The Termux:X11 app itself needs a phone.
- **Long waits:** the install demo hides about two minutes of package installs with VHS's `Hide`/`Show`, and the update demo hides the package downloads the same way.
- **The self-update:** installer 2.0.1 isn't on `dl.andronix.app/bin/latest` yet, so `render.sh` serves it from a local mirror in the box (`ANDRONIX_MIRROR`). The update demo runs installer 2.0.0 on a Debian that 2.0.0 installed.
- **The old Modded copy:** `andronix remove legacy-ubuntu-kde --legacy` needs the files the 8.x app's Modded script left in Termux's home (`~/androkde-fs`, `~/androkde-binds`, `~/start-androkde.sh`, as `moddedos-scripts/V3/kde_mod.sh` wrote them). `render.sh` stages them, with a copy of the Debian image as the old rootfs, so the sizes shown are that copy's.
- **The machine:** facts such as the kernel in `andronix report` are the recording box's, not a phone's. For the same reason there's no `andronix doctor` demo on the pages: in this box it would show Android "SDK 0" and no Termux. `doctor.tape` is kept for a recording on a phone or the emulator.

## Privacy

The box's user is `user`, its hostname `android`, and the prompt is Termux's `~ $`. Telemetry is off (`ANDRONIX_NO_TELEMETRY=1`) and the production download resolver isn't asked (`ANDRONIX_NO_RESOLVE=1`). No tokens or install IDs are used. The demo password is `demo1234` and shows only as dots.

## Look

`settings.tape` sets it for every demo: the Andronix theme (background `#19120E`, cursor `#E8791E`, text and ANSI colours from `app/andronix-tokens.css`), Geist Mono at 22 px, 940 × 1000: 60 columns by 28 rows, like Termux on a phone. 24 fps.

## App tutorial GIFs

App 10's tutorial card (`CardTutorialGifViewer`, URLs from Remote Config) shows cuts of the same recordings as GIFs. The app loads them with Coil, which animates WebP only on Android 9+ (API 24 to 27 get `GifDecoder`), so they're GIFs: 540 px wide, 12 fps, sped up to about 15 s, looping. They go to `demos/out/app/` (not committed; the lead uploads them):

```sh
for spec in install:1.6 desktop:1.5; do n=${spec%%:*}; sp=${spec##*:}
  ffmpeg -y -i public/demos/$n.mp4 -vf "setpts=PTS/$sp,fps=12,scale=540:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle" -loop 0 demos/out/app/$n.gif
done
```
