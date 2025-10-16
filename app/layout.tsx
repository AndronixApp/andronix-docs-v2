import './global.css';
import { RootProvider } from 'fumadocs-ui/provider';
import { Banner } from 'fumadocs-ui/components/banner';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata = {
  title: {
    template: '%s - Andronix Docs',
    default: 'Andronix Documentation',
  },
  description: 'Andronix lets you install Linux distributions like Ubuntu, Debian, and Manjaro on non-rooted Android devices. Read our documentation for step-by-step instructions.',
  metadataBase: new URL('https://docs.andronix.app'),
  openGraph: {
    title: 'Andronix Documentation',
    description: 'Andronix lets you install Ubuntu, Debian, and Manjaro on non-rooted Android devices. Our documentation provides step-by-step instructions and troubleshooting tips to help you set up your Linux environment quickly and easily. Experience the power of Linux on your mobile device with Andronix.',
    url: 'https://docs.andronix.app/',
    images: '/og.png',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Andronix Documentation',
    description: 'Andronix lets you install Ubuntu, Debian, and Manjaro on non-rooted Android devices. Our documentation provides step-by-step instructions and troubleshooting tips to help you set up your Linux environment quickly and easily. Experience the power of Linux on your mobile device with Andronix.',
    images: '/og.png',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body>
        <Banner
          id="android-12-fix"
          variant="rainbow"
          rainbowColors={[
            'rgba(255,100,0, 0.5)',
            'rgba(255,100,0, 0.5)',
            'transparent',
            'rgba(255,100,0, 0.5)',
            'transparent',
            'rgba(255,100,0, 0.5)',
            'transparent',
          ]}
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-center sm:text-left">
            <span className="font-medium">🚨 Resolve <strong>Process completed (signal 9)</strong> error</span>
            <span className="hidden sm:inline">→</span>
            <a
              href="/android-12/andronix-on-android-12-and-beyond"
              className="underline hover:text-white transition-colors"
            >
              Read the fix
            </a>
          </div>
        </Banner>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
