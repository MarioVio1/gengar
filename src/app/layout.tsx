import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stremio Discovery ITA - Addon con TMDB",
  description: "Addon Stremio con tutti i cataloghi TMDB: Trending, Top Rated, Hidden Gems, Best of Decade e Random Movie Night in italiano!",
  keywords: ["Stremio", "TMDB", "Addon", "Film", "Serie TV", "Streaming", "Italiano"],
  authors: [{ name: "Stremio Discovery ITA" }],
  icons: {
    icon: "https://www.stremio.com/website/stremio-logo-small.png",
  },
  openGraph: {
    title: "Stremio Discovery ITA",
    description: "Cataloghi TMDB in italiano per Stremio",
    siteName: "Stremio Discovery ITA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Stremio Discovery ITA",
    description: "Cataloghi TMDB in italiano per Stremio",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
