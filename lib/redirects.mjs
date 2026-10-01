// Redirects for docs URLs that changed (see DOCS_IA_PROPOSAL.md and DOCS_STATUS.md, "App 8.x docs").

// Pages that were live on docs.andronix.app before Andronix 2.0 and are gone or moved in the new docs.
// They go to the same page in the App 8.x (Classic) docs under /v8 (content/docs/v8, a copy of master),
// because the v8.x app and older links expect that content. Keep them forever.
export const v8Redirects = [
  ['/desktop-environments/desktop-environments', '/v8/desktop-environments/desktop-environments'],
  ['/faq/faq', '/v8/faq/faq'],
  ['/get-started/how-does-andronix-work', '/v8/get-started/how-does-andronix-work'],
  ['/get-started/limitations', '/v8/get-started/limitations'],
  ['/software/IDEs', '/v8/software/IDEs'],
  ['/software/browsers', '/v8/software/browsers'],
  ['/software/gimp', '/v8/software/gimp'],
  ['/software/libre-office', '/v8/software/libre-office'],
  ['/ssh/ssh-basics', '/v8/ssh/ssh-basics'],
  ['/termux/cannot-link-executable', '/v8/termux/cannot-link-executable'],
  ['/termux/migrating-to-f-droid', '/v8/termux/migrating-to-f-droid'],
  ['/troubleshoot/internal-storage', '/v8/troubleshoot/internal-storage'],
  ['/troubleshoot/sound', '/v8/troubleshoot/sound'],
  ['/unmodded-distros/unmodded-os-installation', '/v8/unmodded-distros/unmodded-os-installation'],
  ['/unmodded-distros/unmodded-os-uninstallation', '/v8/unmodded-distros/unmodded-os-uninstallation'],
  ['/vnc/vnc-basics', '/v8/vnc/vnc-basics'],
  ['/window-managers/window-managers', '/v8/window-managers/window-managers'],
  ['/xsdl/xsdl-basics', '/v8/xsdl/xsdl-basics'],
  ['/introduction/what-andronix-is-not-capable-of', '/v8/get-started/limitations'],
];

// URLs that were never pages on the live site (folder URLs, the old site's /installations/*, and paths
// that only existed during the rewrite): they go to their place in the new docs.
export const legacyRedirects = [
  // The old Android 12 page is our best-ranking URL ("process completed signal 9"). Its fix applies to
  // every app version, so it goes to the current page (owner decision, Oct 1, 2026), not to /v8.
  ['/android-12/andronix-on-android-12-and-beyond', '/troubleshooting/signal-9'],
  ['/get-started', '/start-here/what-is-andronix'],
  ['/android-12', '/troubleshooting/signal-9'],
  ['/unmodded-distros/distros', '/reference/distros'],
  ['/unmodded-distros/older-installs', '/pre-2.0/older-installs'],
  ['/unmodded-distros', '/install/with-the-app'],
  ['/andronix-cli/andronix-cli', '/reference/andronix-command'],
  ['/andronix-cli', '/reference/andronix-command'],
  ['/desktop-environments', '/reference/desktops'],
  ['/window-managers', '/pre-2.0/window-managers'],
  ['/vnc', '/reference/vnc'],
  ['/desktop/vnc', '/reference/vnc'],
  ['/xsdl', '/pre-2.0/xsdl'],
  ['/software', '/use/apps'],
  ['/termux', '/start-here/install-termux'],
  ['/ssh', '/use/ssh'],
  ['/troubleshoot/install-problems', '/troubleshooting/install'],
  ['/troubleshoot', '/troubleshooting/install'],
  ['/faq', '/troubleshooting/faq'],
  ['/installations/non-modded-os', '/install/with-the-app'],
  ['/installations/modded-os', '/modded-os/modded-os-installation'],
  ['/installations', '/install/with-the-app'],
];

// The blog moved to the website (owner decision, Oct 1, 2026): every post keeps its slug at
// andronix.app/blog/<slug>, and the feed is andronix.app/blog/rss.xml. 301, other host.
export const externalRedirects = [
  ['/blog', 'https://andronix.app/blog'],
  ['/blog/*', 'https://andronix.app/blog/:splat'],
];
