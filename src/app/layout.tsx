/**
 * input: AppLayout
 * output: Root HTML and Body with global AppLayout
 * pos: Next.js App Router Root Layout
 * 
 * 架构说明：接管全站的最外层<html>与<body>，在此层级注入三栏布局AppLayout。
 * 从而确保即使在不同路由切换时，侧边栏和对话面板的状态不会丢失。一旦被修改请同步更新我。
 */
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppLayout } from "@/components/layout/AppLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ReadPilot - The Digital Archivist",
  description: "AI 驱动的交互式阅读理解工具，让经典不再难读",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden m-0 p-0">
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
