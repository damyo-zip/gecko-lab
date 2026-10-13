import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GECKO LAB — 브리딩 연구소",
  description: "유전 확률을 확인하고 여러 세대의 크레스티드 게코를 브리딩하는 로컬 모바일 게임",
  applicationName: "GECKO LAB",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "GECKO LAB" },
  icons: { icon: "/icon.svg", apple: "/icons/icon-192.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#111b19", viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
