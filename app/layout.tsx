import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = "https://ai2048.roberfan.chatgpt.site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "2048 · 数字合成",
  description: "支持 4×4、5×5、6×6 与全盘 AI 挑战的经典 2048 数字合成游戏。",
  applicationName: "2048 · 数字合成",
  alternates: { canonical: "/" },
  keywords: ["2048", "数字游戏", "AI 2048", "益智游戏", "网页游戏"],
  robots: { index: true, follow: true },
  openGraph: {
    title: "2048 · 数字合成",
    description: "液态玻璃风格的 2048，支持多尺寸棋盘与全盘 AI 挑战。",
    type: "website",
    url: "/",
    siteName: "2048 · 数字合成",
    locale: "zh_CN",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "2048 · 数字合成",
    description: "液态玻璃风格的 2048，支持多尺寸棋盘与全盘 AI 挑战。",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: "#edf2f7",
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
