import "./global.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import { OpenPanelComponent } from "@openpanel/nextjs";
import { DocsEvents } from "@/components/analytics";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import type { Metadata } from "next";
import { OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/seo";
import { SEASON, SALE } from "@/lib/season.mjs";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-geist-mono",
});

const DESCRIPTION =
  "Guides for Andronix 2.0: install Debian, Ubuntu, Kali, Fedora, Arch and more on Android without root, open a full desktop with Termux:X11, and fix common errors.";

export const metadata: Metadata = {
  title: {
    template: "%s - Andronix Docs",
    default: "Andronix Docs: Linux on Android without root",
  },
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "Andronix Docs: Linux on Android without root",
    description: DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    images: [OG_IMAGE],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Andronix Docs: Linux on Android without root",
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

// Analytics: our self-hosted OpenPanel (events.andronix.app), the same 'web' client as
// andronix.app, through OpenPanel's official Next.js component. Cookie-less (the SDK sets no
// cookies). Left out when the build has no client id. With Do Not Track or Global Privacy
// Control on, the filter drops every event, so nothing is sent.
const OPENPANEL_CLIENT_ID = process.env.OPENPANEL_WEB_CLIENT_ID;
const RESPECT_OPT_OUT =
  "function(){var n=navigator;return !(n.doNotTrack==='1'||window.doNotTrack==='1'||n.globalPrivacyControl===true)}";

export const viewport = {
  themeColor: "#19120E",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${jakarta.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Halloween look (#189): sets html[data-season] before first paint, only inside SEASON's dates */}
        {(SEASON.active || SALE.active) && (
          <script src="/season.js" data-name={SEASON.name} data-id={SEASON.id} data-level={SEASON.level} data-favicon={SEASON.favicon} data-start={SEASON.active ? SEASON.start : undefined} data-end={SEASON.end} data-sale={SALE.active ? SALE.name : undefined} data-sale-start={SALE.start} data-sale-end={SALE.end} />
        )}
      </head>
      <body>
        <RootProvider theme={{ defaultTheme: "dark", forcedTheme: "dark", enableSystem: false }} search={{ options: { type: "static" } }}>{children}</RootProvider>
        {OPENPANEL_CLIENT_ID && (
          <>
            <OpenPanelComponent
              apiUrl="https://events.andronix.app/api"
              scriptUrl="https://events.andronix.app/op1.js"
              clientId={OPENPANEL_CLIENT_ID}
              trackScreenViews
              trackOutgoingLinks
              filter={RESPECT_OPT_OUT}
            />
            <DocsEvents />
          </>
        )}
      </body>
    </html>
  );
}
