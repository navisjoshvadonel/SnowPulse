import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import AmbientBackground from "@/components/layout/AmbientBackground";

// NOTE: switched from next/font/google to the `geist` package.
// next/font/google fetches font files from fonts.googleapis.com at BUILD
// time — this breaks on any network-restricted CI runner or Docker
// build sandbox. The `geist` package ships the same fonts as local files,
// so the build never touches the network.
const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "SnowPulse AI — Executive Analytics Dashboard",
  description: "Modern Executive-Grade SnowPulse AI Analytics Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col text-white" style={{ background: "#0d0f14" }}>
        <AmbientBackground />
        {/* Page component handles its own TopNavBar, Sidebar, and SystemHealthFooter */}
        {children}
      </body>
    </html>
  );
}
