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
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [installContext, setInstallContext] = useState<"kakao-android" | "kakao-ios" | "android" | "ios" | "other">("other");
  const [installUrl, setInstallUrl] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const pending = useRef(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const kakao = /kakaotalk/i.test(ua);
    const ios = /iphone|ipad|ipod/i.test(ua);
    setInstallContext(kakao ? (ios ? "kakao-ios" : "kakao-android") : ios ? "ios" : /android/i.test(ua) ? "android" : "other");
    setInstallUrl(new URL("/", window.location.href).toString());
    const root = document.documentElement;
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previousTheme = themeMeta?.getAttribute("content") ?? null;
    const previousRootBackground = root.style.backgroundColor;
    const sync = () => {
      const active = document.fullscreenElement === root;
      setFullscreen(active);
      root.classList.toggle("kakao-fullscreen-inset", active);
      // A best-effort WebView/system inset tint, not a way to paint native UI.
      root.style.backgroundColor = active ? "#0b141d" : previousRootBackground;
      if (themeMeta) themeMeta.setAttribute("content", active ? "#0b141d" : (previousTheme ?? "#0c1420"));
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      root.classList.remove("kakao-fullscreen-inset");
      root.style.backgroundColor = previousRootBackground;
      if (themeMeta) {
        if (previousTheme === null) themeMeta.removeAttribute("content");
        else themeMeta.setAttribute("content", previousTheme);
      }
    };
  }, []);

  async function copyInstallUrl() {
    try {
      await navigator.clipboard.writeText(installUrl);
      setCopyMessage("설치 주소를 복사했어. 외부 브라우저에 붙여넣어 줘.");
    } catch {
      setCopyMessage("자동 복사가 제한됐어. 아래 주소를 길게 눌러 복사해 줘.");
    }
  }

  function enterFullscreen() {
    if (pending.current) return;
    if (typeof document.documentElement.requestFullscreen !== "function") {
      setError("이 브라우저는 전체화면을 지원하지 않아. 아래 앱 다운로드 방법을 확인해 줘.");
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
            setError("전체화면 상태가 확인되지 않았어. 다시 시도하거나 앱 다운로드 방법을 확인해 줘.");
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
        <button type="button" className={styles.secondary} onClick={() => { setInstallHelpOpen(x => !x); setCopyMessage(""); }} data-testid="install-help-toggle" aria-expanded={installHelpOpen} aria-controls="fullscreen-install-guide">
          ↓ 앱 다운로드 방법
        </button>
        {installHelpOpen && <section id="fullscreen-install-guide" className={styles.installGuide} aria-label="앱 설치 안내" data-testid="install-help-guide">
          <div className={styles.installGuideTitle}><strong>GECKO LAB 앱 설치하기</strong><button type="button" aria-label="설치 안내 닫기" onClick={() => setInstallHelpOpen(false)}>×</button></div>
          {installContext.startsWith("kakao") ? <>
            <p><b>1.</b> 카톡 브라우저 <strong>오른쪽 위 ▾ 또는 메뉴(⋮)</strong>에서 <strong>다른 브라우저로 열기</strong>를 선택해 줘. 메뉴 위치는 버전마다 달라.</p>
            <p><b>2.</b> {installContext === "kakao-ios"
              ? <>Safari의 <strong>공유 → 홈 화면에 추가</strong>를 선택해 줘.</>
              : <>Chrome의 <strong>메뉴(⋮) → 앱 설치 또는 홈 화면에 추가</strong>를 선택해 줘.</>}</p>
          </> : installContext === "ios" ? <>
            <p><b>1.</b> Safari에서 아래 주소를 열어 줘.</p><p><b>2.</b> <strong>공유 → 홈 화면에 추가 → 추가</strong>를 선택해 줘.</p>
          </> : installContext === "android" ? <>
            <p><b>1.</b> Chrome에서 아래 주소를 열어 줘.</p><p><b>2.</b> <strong>메뉴(⋮) → 앱 설치 또는 홈 화면에 추가</strong>를 선택해 줘.</p>
          </> : <p>Chrome 또는 Edge의 브라우저 메뉴에서 <strong>앱 설치</strong>를 선택해 줘. iPhone은 Safari에서 홈 화면에 추가할 수 있어.</p>}
          {installUrl && <div className={styles.installAddress}>
            <span aria-label="앱 설치 주소">{installUrl}</span>
            <button type="button" onClick={() => void copyInstallUrl()} data-testid="copy-install-url">주소 복사</button>
          </div>}
          {copyMessage && <p className={styles.copyMessage} role="status">{copyMessage}</p>}
          <p className={styles.installCaution}>설치는 무료야. 카톡에서 진행한 세이브가 설치한 앱으로 자동 이동하지 않을 수 있어. 오래 플레이한다면 처음부터 설치 후 시작하는 걸 추천해.</p>
        </section>}
        <p className={styles.note}>전체화면에서는 휴대폰의 시계와 홈·뒤로가기 버튼까지 숨겨질 수 있어. 종료하려면 화면 위에서 아래로 쓸어내려 시스템 탐색을 이용해 줘.</p>
        <p className={styles.save}>기존 게임 저장을 그대로 사용해. 설치나 별도의 계정은 필요 없어. 카톡과 다른 브라우저 사이의 저장은 공유되지 않을 수 있어.</p>
      </section>
      <footer className={styles.footer}><span>EXPERIMENT ONLY</span><span>NO GAME RULE CHANGES</span></footer>
    </div>
  </main>;
}
