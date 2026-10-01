import "./global.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import { Analytics } from "@/components/analytics";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import type { Metadata } from "next";
import { OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/seo";

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
  alternates: {
    types: { "application/rss+xml": [{ url: "/blog/rss.xml", title: "Andronix blog" }] },
  },
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

export const viewport = {
  themeColor: "#19120E",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${jakarta.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body>
        <RootProvider theme={{ defaultTheme: "dark", forcedTheme: "dark", enableSystem: false }} search={{ options: { type: "static" } }}>{children}</RootProvider>
        <Analytics clientId={process.env.OPENPANEL_WEB_CLIENT_ID} />
      </body>
    </html>
  );
}
