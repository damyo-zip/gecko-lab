import type { Metadata } from "next";
import FullscreenGameTrial from "@/components/fullscreen-play/fullscreen-game-trial";

export const metadata: Metadata = {
  title: "GECKO LAB — 게임 시작",
  description: "게코랩을 전체화면으로 플레이하거나 앱으로 설치하세요.",
};

export default function FullscreenPlayPage() {
  return <FullscreenGameTrial />;
}
