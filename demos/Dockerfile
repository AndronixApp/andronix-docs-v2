# VHS (charmbracelet/vhs) in a Termux-like Linux box, for the docs' terminal
# demos. Mirrors andronix-distros tests/Dockerfile and tests/x11: a non-root
# user, Termux's own proot fork, and Xvfb standing in for termux-x11.
# Built and used by demos/render.sh. Not shipped.
FROM debian:13 AS proot
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends \
      git ca-certificates make gcc gawk libc6-dev libtalloc-dev >/dev/null
RUN git clone --depth 1 https://github.com/termux/proot /proot && \
    make -s -C /proot/src proot HAS_LOADER_32BIT=

FROM ghcr.io/charmbracelet/vhs:v0.12.1
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends \
      libtalloc2 curl ca-certificates xz-utils procps xvfb fontconfig busybox >/dev/null && \
    rm -rf /var/lib/apt/lists/*
COPY --from=proot /proot/src/proot /usr/local/bin/proot
COPY fake-termux-x11 /usr/local/bin/termux-x11
# Geist Mono, the docs' code font.
RUN mkdir -p /usr/share/fonts/truetype/geist && cd /usr/share/fonts/truetype/geist && \
    for w in Regular Bold; do \
      curl -fsSL -o GeistMono-$w.ttf "https://cdn.jsdelivr.net/npm/geist@1.4.2/dist/fonts/geist-mono/GeistMono-$w.ttf"; \
    done && fc-cache -f >/dev/null
# A neutral user: frames show ~ and "user", never a real name or path.
RUN useradd -m -s /bin/bash user
USER user
WORKDIR /home/user
# No telemetry, and no calls to the production download resolver.
ENV TERM=xterm-256color LANG=C.UTF-8 COLORTERM=truecolor \
    ANDRONIX_NO_TELEMETRY=1 ANDRONIX_NO_RESOLVE=1 PATH=/home/user/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ENTRYPOINT []
