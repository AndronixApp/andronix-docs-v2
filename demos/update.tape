# andronix update on a Debian installed with installer 2.0.0: andronix
# updates itself to 2.0.1, then the distro, then adds the browser's video
# codecs (2.0.0 installed none). render.sh serves 2.0.1 from a local mirror
# (ANDRONIX_MIRROR) because it isn't on dl.andronix.app/bin/latest yet.
# The package steps run hidden (a fixed Sleep: VHS's Wait doesn't run
# while hidden).
Output out/update.webm
Output out/update.mp4
Output out/update.gif
Source settings.tape

Type "andronix version"
Enter
Sleep 1.2s
Type "andronix update"
Sleep 400ms
Enter
Sleep 8s
Hide
Sleep 100s
Show
Sleep 5s
