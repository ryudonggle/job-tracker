import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_KR, IBM_Plex_Mono } from "next/font/google";
import RegisterSW from "@/components/RegisterSW";
import "./globals.css";

const plex = IBM_Plex_Sans_KR({ weight: ["400", "500", "600", "700"], subsets: ["latin"], preload: false, variable: "--font-plex" });
const plexMono = IBM_Plex_Mono({ weight: ["500", "600"], subsets: ["latin"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "공고 트래커",
  description: "신입 데이터 분석·엔지니어 공고 수집, 적합도, 마감 일정",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "공고 트래커", statusBarStyle: "default" },
  icons: { icon: [{ url: "/icons/favicon-32.png", sizes: "32x32" }, { url: "/icons/icon-192.png", sizes: "192x192" }], apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#151716" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${plex.variable} ${plexMono.variable}`}>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
