import type { Metadata } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import "./globals.css";
import { AppLayout } from "@/components/layout";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider } from "@/components/user/AuthProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  variable: "--font-condensed",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GIGROOM — 独立音乐演出发现社区",
  description:
    "GIGROOM 是面向中国独立音乐爱好者的演出发现与场次社区平台，发现演出、找同好、加入观演小屋。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body
        className={`${inter.variable} ${barlowCondensed.variable}`}
      >
        <div className="noise-overlay" aria-hidden="true" />
        <div className="relative z-10">
          <ToastProvider>
            <AuthProvider>
              <AppLayout>{children}</AppLayout>
            </AuthProvider>
          </ToastProvider>
        </div>
      </body>
    </html>
  );
}
