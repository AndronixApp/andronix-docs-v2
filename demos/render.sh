#!/usr/bin/env bash
# Renders the docs' terminal demos (demos/*.tape) with VHS, running the real
# andronix installer in a Termux-like Linux box (demos/Dockerfile).
#
#   demos/render.sh                    every demo
#   demos/render.sh install clean      only these (in this order)
#   demos/render.sh doctor             not in the default set: in this box it
#                                      shows the box's facts, not a phone's
#
# Needs docker, go, ffmpeg and a checkout of andronix-distros
# (ANDRONIX_DISTROS, default ~/andronix/andronix-distros). Writes
# public/demos/<name>.webm, .mp4 and .jpg (the poster: the last frame);
# the GIFs stay in demos/out/ (not committed).
set -euo pipefail
cd "$(dirname "$0")"
here=$PWD
D=${ANDRONIX_DISTROS:-$HOME/andronix/andronix-distros}
img=andronix-docs-vhs
demos=("$@")
[ ${#demos[@]} -gt 0 ] || demos=(install desktop remove-legacy clean report update)

# 1. The installers: the tagged releases, and the 2.0.2 branch for report.
mkdir -p .build out ../public/demos
build() { # build <git ref> <version>
    local src; src=$(mktemp -d)
    git -C "$D" archive "$1" | tar -x -C "$src"
    (cd "$src" && CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -trimpath -buildvcs=false \
        -ldflags "-s -w -X github.com/AndronixApp/andronix-distros/internal/app.Version=$2" \
        -o "$here/.build/andronix-$2" ./cmd/andronix)
    rm -rf "$src"
}
build v2.0.0 2.0.0
build v2.0.1 2.0.1
build next-2.0.2 2.0.2-dev

# 2. The recording box.
docker build -q -t "$img" . >/dev/null
box() { # box <name>: a fresh box with andronix 2.0.1 installed
    docker rm -f "$1" >/dev/null 2>&1 || true
    docker run -d --init --name "$1" --hostname android -v "$here":/demos "$img" sleep infinity >/dev/null
    docker exec "$1" sh -c 'mkdir -p ~/.local/bin && cp /demos/.build/andronix-2.0.1 ~/.local/bin/andronix'
}
sh_in() { docker exec "$1" bash -c "$2"; }
record() { # record <box> <tape> [docker exec env...]
    local b=$1 t=$2; shift 2
    echo "recording $t"
    docker exec -w /demos "$@" "$b" vhs "$t.tape" >"out/$t.log" 2>&1
    cp "out/$t.webm" "out/$t.mp4" ../public/demos/
    ffmpeg -loglevel error -y -sseof -0.2 -i "out/$t.mp4" -frames:v 1 -q:v 4 "../public/demos/$t.jpg"
}
main=andronix-docs-vhs-main
started=""
ensure_main() {
    [ -n "$started" ] && return
    box "$main"; started=1
    # The later demos need Debian with XFCE and a user; install it unless
    # the install demo does.
    case " ${demos[*]} " in *" install "*) ;; *)
        sh_in "$main" 'andronix install debian --de xfce --yes --no-start --plain >/dev/null && andronix start debian --root -- env ANDRONIX_USER_PASSWORD=demo1234 ANDRONIX_VNC_PASSWORD=demo1234 andronix setup-user --user user >/dev/null' ;;
    esac
}

for t in "${demos[@]}"; do
    case $t in
    install|desktop|doctor) ensure_main; record "$main" "$t" ;;
    clean)
        ensure_main
        record "$main" clean
        sh_in "$main" 'andronix remove fedora --yes >/dev/null 2>&1 || true' ;;
    remove-legacy)
        ensure_main
        # The copy the old (8.x) Modded script left in Termux's home
        # (moddedos-scripts V3/kde_mod.sh): ~/androkde-fs (here a copy of
        # the Debian image), ~/androkde-binds and its start-androkde.sh.
        sh_in "$main" 'cd && rm -rf androkde-fs androkde-binds && cp -a .andronix/distros/debian/rootfs androkde-fs &&
            mkdir -p androkde-binds && printf "%s\n" "#!/data/data/com.termux/files/usr/bin/bash" "cd \$(dirname \$0)" \
            "unset LD_PRELOAD" "command=\"proot\"" "command+=\" --link2symlink\"" "command+=\" -0\"" "command+=\" -r androkde-fs\"" \
            "command+=\" -b /dev\"" "command+=\" -b /proc\"" "command+=\" -w /root\"" > start-androkde.sh && chmod +x start-androkde.sh'
        record "$main" remove-legacy ;;
    report)
        ensure_main
        sh_in "$main" 'cp /demos/.build/andronix-2.0.2-dev ~/.local/bin/andronix'
        record "$main" report
        sh_in "$main" 'cp /demos/.build/andronix-2.0.1 ~/.local/bin/andronix' ;;
    update)
        # A Debian installed with 2.0.0 (no video codecs yet), updated by
        # 2.0.0's andronix update. 2.0.1 isn't on dl.andronix.app's
        # bin/latest yet, so a local mirror serves it (ANDRONIX_MIRROR).
        upd=andronix-docs-vhs-update
        box "$upd"
        sh_in "$upd" 'cp /demos/.build/andronix-2.0.0 ~/.local/bin/andronix &&
            andronix install debian --de xfce --yes --no-start --plain >/dev/null &&
            mkdir -p ~/mirror/bin/latest && cp /demos/.build/andronix-2.0.1 ~/mirror/bin/latest/andronix-linux-aarch64 &&
            cd ~/mirror/bin/latest && sha256sum andronix-linux-aarch64 > SHA256SUMS &&
            (busybox httpd -p 127.0.0.1:8088 -h ~/mirror)'
        record "$upd" update -e ANDRONIX_MIRROR=http://127.0.0.1:8088
        docker rm -f "$upd" >/dev/null ;;
    *) echo "unknown demo: $t" >&2; exit 1 ;;
    esac
done
[ -n "$started" ] && docker rm -f "$main" >/dev/null
ls -l ../public/demos/
