# Shared look for every demo (Source'd by each tape): the Andronix theme,
# Geist Mono, about 60 columns, like Termux on a phone, and a neutral Termux-style prompt.
Set Shell "bash"
Set FontFamily "Geist Mono"
Set FontSize 22
Set LineHeight 1.25
Set Width 940
Set Height 1000
Set Padding 32
Set Margin 0
Set BorderRadius 0
Set WindowBar ""
Set CursorBlink false
Set TypingSpeed 45ms
Set Framerate 24
Set PlaybackSpeed 1
Set WaitTimeout 30m
Set Theme { "name": "Andronix", "background": "#19120E", "foreground": "#F2DFD4", "cursor": "#E8791E", "selection": "#3A2A20", "black": "#19120E", "red": "#FFB4AB", "green": "#8FD6A5", "yellow": "#FFB689", "blue": "#E4BFA8", "magenta": "#FFB689", "cyan": "#BFD39A", "white": "#D6C2B5", "brightBlack": "#A08D82", "brightRed": "#FFB4AB", "brightGreen": "#8FD6A5", "brightYellow": "#E8791E", "brightBlue": "#E4BFA8", "brightMagenta": "#FFB689", "brightCyan": "#BFD39A", "brightWhite": "#F2DFD4" }

# Termux's "~ $" prompt, in the docs' prompt colour; then a clean screen.
Hide
Type "export PS1='\[\e[38;2;255;182;137m\]~ $\[\e[0m\] ' HISTFILE=/dev/null; cd; clear"
Enter
Show
