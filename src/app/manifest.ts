import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GECKO LAB 스프라이트 연구실", short_name: "GECKO LAB",
    description: "96×96 크레스티드 게코 픽셀 렌더링 테스트",
    start_url: "/", scope: "/", display: "standalone", orientation: "portrait-primary",
    lang: "ko", background_color: "#0e1615", theme_color: "#111b19",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
