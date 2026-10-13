import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GECKO LAB — 스프라이트 연구실",
  description: "크레스티드 게코 96×96 픽셀 스프라이트와 외형 조합 테스트",
  applicationName: "GECKO LAB",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "GECKO LAB" },
  icons: { icon: "/icon.svg", apple: "/icons/icon-192.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#111b19", viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
