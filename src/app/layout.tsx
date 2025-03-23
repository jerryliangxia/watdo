import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Toaster } from "react-hot-toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WatDo",
  description: "WatDo finds the best way to do something.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <nav className="fixed top-0 left-0 right-0 z-50 bg-black text-white p-2 flex justify-center space-x-6">
          <Link href="/" className="hover:text-blue-400">
            Graph Planner
          </Link>
          <Link href="/life-simulator" className="hover:text-blue-400">
            Life Simulator
          </Link>
        </nav>
        <main className="pt-10">{children}</main>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
