# andronix report --dry-run (installer 2.0.2, pre-release build): a command
# fails, its error box points to andronix report, and --dry-run prints the
# redacted report without sending anything.
Output out/report.webm
Output out/report.mp4
Output out/report.gif
Source settings.tape

Type "andronix install alpine --de kde"
Sleep 400ms
Enter
Sleep 4s
Type "andronix report --dry-run | head -26"
Sleep 400ms
Enter
Sleep 8s
