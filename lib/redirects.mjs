// Redirects for docs URLs that changed (see DOCS_IA_PROPOSAL.md and DOCS_STATUS.md, "App 8.x docs").

// Pages that were live on docs.andronix.app before Andronix 2.0 and are gone or moved in the new docs.
// They go to the same page in the App 8.x (Classic) docs under /v8 (content/docs/v8, a copy of master),
// because the v8.x app and older links expect that content. Keep them forever.
export const v8Redirects = [
  ['/desktop-environments/desktop-environments', '/v8/desktop-environments/desktop-environments'],
  ['/faq/faq', '/v8/faq/faq'],
  ['/termux/migrating-to-f-droid', '/v8/termux/migrating-to-f-droid'],
  ['/unmodded-distros/unmodded-os-installation', '/v8/unmodded-distros/unmodded-os-installation'],
  ['/window-managers/window-managers', '/v8/window-managers/window-managers'],
  ['/introduction/what-andronix-is-not-capable-of', '/v8/get-started/limitations'],
];

// URLs that were never pages on the live site (folder URLs, the old site's /installations/*, and paths
// that only existed during the rewrite): they go to their place in the new docs.
export const legacyRedirects = [
  // The old Android 12 page is our best-ranking URL ("process completed signal 9"). Its fix applies to
  // every app version, so it goes to the current page (owner decision, Oct 1, 2026), not to /v8.
  ['/android-12/andronix-on-android-12-and-beyond', '/troubleshooting/signal-9'],
  // Old pages that search engines still list and the v8.x app doesn't link to: straight to the
  // current page on the same topic (indexing audit, Oct 2, 2026). The v8.x app's own links still go to /v8.
  ['/get-started/how-does-andronix-work', '/start-here/what-is-andronix'],
  ['/get-started/limitations', '/reference/limitations'],
  ['/software/IDEs', '/use/apps'],
  ['/software/browsers', '/use/apps'],
  ['/software/gimp', '/use/apps'],
  ['/software/libre-office', '/use/apps'],
  ['/ssh/ssh-basics', '/use/ssh'],
  ['/termux/cannot-link-executable', '/troubleshooting/termux'],
  ['/troubleshoot/internal-storage', '/use/storage'],
  ['/troubleshoot/sound', '/use/sound'],
  ['/unmodded-distros/unmodded-os-uninstallation', '/install/uninstall'],
  ['/vnc/vnc-basics', '/reference/vnc'],
  ['/xsdl/xsdl-basics', '/pre-2.0/older-installs'],
  ['/get-started', '/start-here/what-is-andronix'],
  ['/android-12', '/troubleshooting/signal-9'],
  ['/unmodded-distros/distros', '/reference/distros'],
  ['/unmodded-distros/older-installs', '/pre-2.0/older-installs'],
  ['/unmodded-distros', '/install/with-the-app'],
  ['/andronix-cli/andronix-cli', '/reference/andronix-command'],
  ['/andronix-cli', '/reference/andronix-command'],
  ['/desktop-environments', '/reference/desktops'],
  ['/window-managers', '/pre-2.0/older-installs#window-managers'],
  ['/vnc', '/reference/vnc'],
  ['/desktop/vnc', '/reference/vnc'],
  ['/xsdl', '/pre-2.0/older-installs'],
  ['/software', '/use/apps'],
  ['/termux', '/start-here/install-termux'],
  ['/ssh', '/use/ssh'],
  ['/troubleshoot/install-problems', '/troubleshooting/install'],
  ['/troubleshoot', '/troubleshooting/install'],
  ['/faq', '/troubleshooting/faq'],
  ['/installations/non-modded-os', '/install/with-the-app'],
  ['/installations/modded-os', '/modded-os/modded-os-installation'],
  ['/installations', '/install/with-the-app'],
  // GitBook-era URLs (2020-2021) still in the Wayback Machine and in old links (audit Oct 2, 2026)
  ['/andronix-on-android-12-and-beyond', '/troubleshooting/signal-9'],
  ['/1.0/*', '/reference/vnc'],
  ['/hardware/internal-storage', '/use/storage'],
  ['/hardware/sound', '/use/sound'],
  ['/installations/modded-os/*', '/modded-os/modded-os-installation'],
  ['/installations/non-modded-os/*', '/reference/distros'],
  ['/installations/offline-installtion', '/install/without-the-app'],
  ['/introduction/where-to-begin', '/start-here/what-is-andronix'],
  ['/introduction', '/start-here/what-is-andronix'],
  ['/uninstallation/uninstallation', '/install/uninstall'],
  ['/uninstallation', '/install/uninstall'],
  ['/unmodded-distros/desktop-environments/desktop-environments.md', '/reference/desktops'],
  ['/unmodded-distros/window-managers/window-managers.md', '/pre-2.0/older-installs#window-managers'],
  ['/vnc/ssh-basics', '/use/ssh'],
  ['/hardware', '/use/storage'],
  // after the exact /software/... pages above: other old software pages (blender, ides/*, libreoffice)
  ['/software/*', '/use/apps'],
];

// The blog moved to the website (owner decision, Oct 1, 2026): every post keeps its slug at
// andronix.app/blog/<slug>, and the feed is andronix.app/blog/rss.xml. 301, other host.
export const externalRedirects = [
  ['/blog', 'https://andronix.app/blog'],
  // Each old post's /blog/<post>/ straight to the post without the slash: one hop (the website
  // answers /x/ with a 307). Exact rules: a placeholder rule here stops /blog/* from matching.
  ...['andronix-2-0', 'andronix-maintainers', 'andronix-termux-and-f-droid', 'v6-0', 'v7-0']
    .map((slug) => [`/blog/${slug}/`, `https://andronix.app/blog/${slug}`]),
  ['/blog/*', 'https://andronix.app/blog/:splat'],
];

// The 10.1 beta docs lived under /beta until 10.1 launched (#155); they are now the current docs,
// at the same paths without /beta. The 10.1 betas link /beta pages, so keep these forever.
export const betaRedirects = [
  ['/beta', '/'],
  ['/beta/*', '/:splat'],
];

// Pages removed in the 10.1 docs cleanup (#155 page audit, owner OK 2026-10-11). Each goes to the
// current page on the same topic, so search results and old links don't 404.
export const removedPageRedirects = [
  ['/v8/android-12/andronix-on-android-12-and-beyond', '/troubleshooting/signal-9'],
  ['/v8/get-started/how-does-andronix-work', '/start-here/what-is-andronix'],
  ['/v8/unmodded-distros/unmodded-os-uninstallation', '/install/uninstall'],
  ['/v8/termux/cannot-link-executable', '/troubleshooting/termux'],
  ['/v8/ssh/ssh-basics', '/use/ssh'],
  ['/v8/troubleshoot/sound', '/use/sound'],
  ['/v8/vnc/vnc-basics', '/reference/vnc'],
  ['/v8/troubleshoot/internal-storage', '/use/storage'],
  ['/v8/xsdl/xsdl-basics', '/pre-2.0/older-installs'],
  ['/v8/software/libre-office', '/use/apps'],
  ['/v8/software/browsers', '/use/apps'],
  ['/v8/software/IDEs', '/use/apps'],
  ['/v8/software/gimp', '/use/apps'],
  ['/v8/miscellaneous/open-source', '/miscellaneous/open-source'],
  ['/v8/security/termux', '/start-here/install-termux'],
  ['/security/termux', '/start-here/install-termux'],
  ['/v10/security/termux', '/start-here/install-termux'],
  ['/pre-2.0/xsdl', '/pre-2.0/older-installs'],
  ['/pre-2.0/window-managers', '/pre-2.0/older-installs#window-managers'],
];

// Docs pages that moved off the docs site, and old addresses for the legal pages (they were 404s).
export const offsiteRedirects = [
  ['/reference/changelog', 'https://andronix.app/changelog'],
  ['/releases', 'https://andronix.app/changelog'],
  ['/privacy', 'https://andronix.app/legal/privacy-policy'],
  ['/privacy-policy', 'https://andronix.app/legal/privacy-policy'],
  ['/terms', 'https://andronix.app/legal/terms-conditions'],
  ['/terms-of-use', 'https://andronix.app/legal/terms-conditions'],
  ['/policies/terms-of-service', 'https://andronix.app/legal/terms-conditions'],
];
