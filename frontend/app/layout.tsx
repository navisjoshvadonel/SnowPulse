import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

// Layout Components
import AmbientBackground from "@/components/layout/AmbientBackground";
import TopNavBar from "@/components/layout/TopNavBar";
import SystemHealthFooter from "@/components/layout/SystemHealthFooter";

// NOTE: switched from next/font/google to the `geist` package.
// next/font/google fetches font files from fonts.googleapis.com at BUILD
// time — this breaks on any network-restricted CI runner or Docker
// build sandbox (exactly what was failing here). The `geist` package
// ships the same fonts as local files, so the build never touches the
// network.
const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "SnowPulse Dashboard",
  description: "Modern Executive-Grade AI Analytics",
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
      <body className="min-h-full flex flex-col text-white bg-black">
        <AmbientBackground />
        <TopNavBar />
        
        {/* Main Content Area - padded to avoid nav/footer */}
        <main className="flex-1 relative z-10 pt-[64px] pb-[48px] transition-all duration-300">
          {children}
        </main>
        
        <SystemHealthFooter />
      </body>
    </html>
  );
}
