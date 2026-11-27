import type { Metadata, Viewport } from "next";
import { Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";

const zen = Zen_Maru_Gothic({
  weight: ["400", "700"],
  subsets: ["latin", "japanese"],
  preload: false,
  display: "swap",
  variable: "--font-zen",
});

export const metadata: Metadata = {
  title: "ぷちぷち",
  description: "触って、鳴らして、育てる。ASMRオブジェクトで遊ぶ小さなアプリ。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#10243a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={zen.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
