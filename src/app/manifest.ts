import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GECKO LAB 브리딩 연구소", short_name: "GECKO LAB",
    description: "유전형과 혈통을 유지하는 크레스티드 게코 브리딩 게임",
    start_url: "/", scope: "/", display: "standalone", orientation: "portrait-primary",
    lang: "ko", background_color: "#0c1420", theme_color: "#0c1420",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
