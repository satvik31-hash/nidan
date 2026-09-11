import type { Metadata, Viewport } from "next";
import { OfflineIndicator } from "@/components/offline";
import { getLocale } from "@/lib/auth";
import { LOCALE_TAGS, RTL_LOCALES } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nidan — your health record, in your pocket",
  description:
    "A consent-aware clinical record and case-taking platform for Indian hospitals. Structured case sheets, ABDM-ready records, and consent enforced in the database.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Nidan", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  // The app is light unless the viewer opts into dark, so the browser chrome
  // should be light too rather than tracking the OS.
  themeColor: "#FBFCFD",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The whole document is tagged with the reader's language, not just the
  // strings: it drives font fallback, hyphenation, and what a screen reader
  // sounds like. Telugu read aloud in an English voice is unusable.
  const locale = await getLocale();

  return (
    <html
      lang={LOCALE_TAGS[locale]}
      dir={RTL_LOCALES.has(locale) ? "rtl" : "ltr"}
      suppressHydrationWarning
    >
      <head>
        {/* A humanist sans with clear numerals and unambiguous 1 l I / 0 O.
            Dosages get misread. The Devanagari and Telugu faces ship alongside
            it so Hindi and Telugu are set in the same typeface rather than
            whatever the OS falls back to. Loaded at runtime with a real
            fallback stack, so an offline demo still renders correctly. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+Devanagari:wght@400;500;600;700&family=Noto+Sans+Telugu:wght@400;500;600;700&display=swap"
        />
        <style>{`:root { --font-plex: "IBM Plex Sans", "IBM Plex Sans Devanagari", "Noto Sans Telugu"; }`}</style>
        {/* Restore the viewer's saved text size and theme before first paint,
            so the patient app never flashes at the wrong size. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var s=localStorage.getItem('nidan-scale');if(s)document.documentElement.style.setProperty('--scale',s);var t=localStorage.getItem('nidan-theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}`,
          }}
        />
      </head>
      <body>
        {children}
        <OfflineIndicator />
      </body>
    </html>
  );
}
