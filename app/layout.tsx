import "./global.css";
import { RootProvider } from "fumadocs-ui/provider";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata = {
  title: {
    template: "%s - Andronix Docs",
    default: "Andronix Documentation",
  },
  description:
    "Andronix lets you install Linux distributions like Ubuntu, Debian, and Manjaro on non-rooted Android devices. Read our documentation for step-by-step instructions.",
  metadataBase: new URL("https://docs.andronix.app"),
  openGraph: {
    title: "Andronix Documentation",
    description:
      "Andronix lets you install Ubuntu, Debian, and Manjaro on non-rooted Android devices. Our documentation provides step-by-step instructions and troubleshooting tips to help you set up your Linux environment quickly and easily. Experience the power of Linux on your mobile device with Andronix.",
    url: "https://docs.andronix.app/",
    images: "/og.png",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Andronix Documentation",
    description:
      "Andronix lets you install Ubuntu, Debian, and Manjaro on non-rooted Android devices. Our documentation provides step-by-step instructions and troubleshooting tips to help you set up your Linux environment quickly and easily. Experience the power of Linux on your mobile device with Andronix.",
    images: "/og.png",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body>
        <RootProvider theme={{ defaultTheme: "Darl" }}>{children}</RootProvider>
      </body>
    </html>
  );
}
