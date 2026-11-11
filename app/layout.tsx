import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SAXN Music Delivery Portal", template: "%s | SAXN" },
  description: "Private, studio-grade delivery for SAXN music production and audio engineering projects.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#100B08", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
