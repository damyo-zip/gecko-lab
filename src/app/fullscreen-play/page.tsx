import type { Metadata } from "next";
import FullscreenGameTrial from "@/components/fullscreen-play/fullscreen-game-trial";

export const metadata: Metadata = {
  title: "GECKO LAB — 카카오톡 전체화면 플레이",
  description: "카카오톡 주소창과 하단 메뉴를 숨기고 게코랩을 플레이하는 실험 화면입니다.",
};

export default function FullscreenPlayPage() {
  return <FullscreenGameTrial />;
}
