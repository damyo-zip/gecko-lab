import GameHub from "@/components/game/game-hub";
/** Isolated Phase 2 regression simulator; never writes the live game's active slot. */
export default function LegacyBreedingLab() { return <><aside className="hc-legacy-banner">Phase 2 테스트 시뮬레이터 · 정식 게임과 저장 공간이 분리됩니다.</aside><GameHub/></>; }
