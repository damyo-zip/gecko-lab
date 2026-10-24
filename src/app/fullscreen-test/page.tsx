import type { Metadata } from "next";
import FullscreenProbe from "@/components/fullscreen-probe/fullscreen-probe";

export const metadata: Metadata = {
  title: "GECKO LAB — 카카오톡 전체화면 실험",
  description: "카카오톡 내장 브라우저의 전체화면 요청과 실제 가용 화면 높이를 측정합니다.",
};

export default function FullscreenTestPage() {
  return <FullscreenProbe />;
}
