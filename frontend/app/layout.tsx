import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Layout Components
import AmbientBackground from "@/components/layout/AmbientBackground";
import TopNavBar from "@/components/layout/TopNavBar";
import Sidebar from "@/components/layout/Sidebar";
import SystemHealthFooter from "@/components/layout/SystemHealthFooter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
        <Sidebar />
        
        {/* Main Content Area - padded to avoid nav/sidebar/footer */}
        <main className="flex-1 relative z-10 pt-[64px] pb-[48px] pl-[64px] lg:pl-[220px] transition-all duration-300">
          {children}
        </main>
        
        <SystemHealthFooter />
      </body>
    </html>
  );
}
