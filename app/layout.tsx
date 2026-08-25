import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClueFy — Social Intelligence Platform",
  description: "Turn social conversations into clear, actionable intelligence.",
  icons: { icon: "/cluefy-favicon.png", shortcut: "/cluefy-favicon.png", apple: "/cluefy-favicon.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
