import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "2048 · 数字合成",
  description: "支持 4×4、5×5、6×6 与全盘 AI 挑战的经典 2048 数字合成游戏。",
  openGraph: {
    title: "2048 · 数字合成",
    description: "液态玻璃风格的 2048，支持多尺寸棋盘与全盘 AI 挑战。",
    type: "website",
    images: ["https://ai2048.roberfan.chatgpt.site/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "2048 · 数字合成",
    description: "液态玻璃风格的 2048，支持多尺寸棋盘与全盘 AI 挑战。",
    images: ["https://ai2048.roberfan.chatgpt.site/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
