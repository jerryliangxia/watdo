import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fortune Teller",
  description:
    "Get predictions about your future with Apple-inspired simplicity",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
