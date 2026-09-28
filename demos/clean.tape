# andronix clean (installer 2.0.1+): an install stopped halfway (Ctrl+C
# during the download) leaves its download in the cache; andronix clean
# frees it. Ctrl+C comes after the download (a hidden wait), while the
# image is being unpacked. clean keeps anything written in the last 2 minutes (a download
# that may still be running), so the demo cuts over a 2-minute wait.
Output out/clean.webm
Output out/clean.mp4
Output out/clean.gif
Source settings.tape

Type "andronix install fedora --de none"
Sleep 400ms
Enter
Sleep 5s
Hide
Sleep 10s
Show
Ctrl+C
Sleep 2s
Hide
Sleep 130s
Show
Type "andronix clean"
Sleep 400ms
Enter
Sleep 4s
