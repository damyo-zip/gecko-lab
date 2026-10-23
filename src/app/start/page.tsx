import type { Metadata } from "next";
import InstallLanding from "@/components/install/install-landing";

export const metadata: Metadata = {
  title: "GECKO LAB — 앱 설치",
  description: "게코랩을 홈 화면에 설치하고 브리딩 연구소를 시작하세요.",
};

export default function InstallStartPage() {
  return <InstallLanding />;
}
