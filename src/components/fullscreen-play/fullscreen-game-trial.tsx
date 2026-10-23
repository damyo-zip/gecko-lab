"use client";

import { useEffect, useRef, useState } from "react";
import HardcoreHub from "@/components/hardcore/hub";
import styles from "./fullscreen-game-trial.module.css";

type Stage = "ready" | "starting" | "playing";

/**
 * Keep the document and its root element in place when the game starts.
 * Navigating to "/" after requesting fullscreen would exit fullscreen.
 */
export default function FullscreenGameTrial() {
  const [stage, setStage] = useState<Stage>("ready");
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === document.documentElement);
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  function enterFullscreen() {
    if (pending.current) return;
    if (typeof document.documentElement.requestFullscreen !== "function") {
      setError("이 브라우저는 전체화면 기능을 지원하지 않아. 일반 화면으로 플레이할 수 있어.");
      return;
    }

    // Must run immediately in a real button-click handler to preserve user activation.
    pending.current = true;
    const firstStart = stage !== "playing";
    if (firstStart) setStage("starting");
    setError("");

    try {
      const request = document.documentElement.requestFullscreen();
      Promise.resolve(request)
        .then(() => {
          if (document.fullscreenElement !== document.documentElement) {
            setError("전체화면 요청 후 전체화면 상태가 확인되지 않았어. 일반 화면으로 플레이하거나 다시 시도해 줘.");
            if (firstStart) setStage("ready");
            return;
          }
          setFullscreen(true);
          // The actual game mounts in the SAME document, with no URL navigation.
          setStage("playing");
        })
        .catch((reason: unknown) => {
          setError(reason instanceof Error ? `전체화면 요청 실패: ${reason.message}` : "브라우저가 전체화면 요청을 차단했어.");
          if (firstStart) setStage("ready");
        })
        .finally(() => { pending.current = false; });
    } catch (reason) {
      pending.current = false;
      setError(reason instanceof Error ? `전체화면 요청 실패: ${reason.message}` : "전체화면 요청을 실행할 수 없어.");
      if (firstStart) setStage("ready");
    }
  }

  if (stage === "playing") {
    return <>
      <HardcoreHub />
      {!fullscreen && <div className={styles.resume} role="status" data-testid="fullscreen-exited">
        <span>전체화면이 해제됐어.</span>
        <button type="button" onClick={enterFullscreen} data-testid="fullscreen-reenter">다시 전체화면</button>
        {error && <small role="alert">{error}</small>}
      </div>}
    </>;
  }

  return <main className={styles.shell} data-testid="fullscreen-play-entry">
    <div className={styles.frame}>
      <div className={styles.top}><span>GECKO LAB</span><span>FULLSCREEN / TRIAL</span></div>
      <div className={styles.hero}>
        <p className={styles.eyebrow}>A NEW BREEDING WORLD</p>
        <img src="/ui/home-wordmark.svg" width={290} height={48} alt="GECKO LAB" />
        <p className={styles.subtitle}>나만의 크레스티드 게코 브리딩 연구소</p>
        <div className={styles.icon}><img src="/icons/icon-192.png" alt="" width={112} height={112}/></div>
        <p className={styles.eyebrow}>COLLECT · BREED · DISCOVER</p>
      </div>
      <section className={styles.panel}>
        <div className={styles.section}>01 / KAKAOTALK GAME MODE</div>
        <h1>전체화면으로 게임 시작</h1>
        <p>카카오톡 주소창과 하단 메뉴를 숨기고, 페이지를 이동하지 않은 상태에서 바로 게코랩을 실행해 봐.</p>
        <button type="button" className={styles.primary} onClick={enterFullscreen} disabled={stage === "starting"} data-testid="fullscreen-start">
          {stage === "starting" ? "전체화면으로 전환 중…" : "⛶ 전체화면으로 시작"}
        </button>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <button type="button" className={styles.secondary} onClick={() => setStage("playing")} data-testid="normal-start">
          일반 화면으로 플레이
        </button>
        <p className={styles.note}>전체화면에서는 휴대폰의 시계와 홈·뒤로가기 버튼까지 숨겨질 수 있어. 종료하려면 화면 위에서 아래로 쓸어내려 시스템 탐색을 이용해 줘.</p>
        <p className={styles.save}>기존 게임 저장을 그대로 사용해. 설치나 별도의 계정은 필요 없어. 카톡과 다른 브라우저 사이의 저장은 공유되지 않을 수 있어.</p>
      </section>
      <footer className={styles.footer}><span>EXPERIMENT ONLY</span><span>NO GAME RULE CHANGES</span></footer>
    </div>
  </main>;
}
