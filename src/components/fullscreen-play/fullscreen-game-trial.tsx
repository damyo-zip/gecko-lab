"use client";

import { useEffect, useRef, useState } from "react";
import HardcoreHub from "@/components/hardcore/hub";
import styles from "./fullscreen-game-trial.module.css";

type Stage = "ready" | "starting" | "playing";
interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

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
  const [promptEvent, setPromptEvent] = useState<InstallPrompt | null>(null);
  const [installBusy, setInstallBusy] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [installMessage, setInstallMessage] = useState("");

  useEffect(() => {
    const standalone = navigator as Navigator & { standalone?: boolean };
    if (window.matchMedia("(display-mode: standalone)").matches || standalone.standalone === true) {
      window.location.replace("/");
      return;
    }
    const onInstallReady = (event: Event) => { event.preventDefault(); setPromptEvent(event as InstallPrompt); };
    const onInstalled = () => { setInstalled(true); setPromptEvent(null); setInstallMessage("설치 완료. 홈 화면에서 실행하세요."); };
    window.addEventListener("beforeinstallprompt", onInstallReady);
    window.addEventListener("appinstalled", onInstalled);
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
      window.removeEventListener("beforeinstallprompt", onInstallReady);
      window.removeEventListener("appinstalled", onInstalled);
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
      setCopyMessage("주소를 복사했습니다.");
    } catch {
      setCopyMessage("주소 복사를 지원하지 않는 브라우저입니다.");
    }
  }

  function installOrExplain() {
    setInstallMessage("");
    setCopyMessage("");
    const direct = installContext.startsWith("kakao") || installContext === "ios" ? null : promptEvent;
    if (!direct) { setInstallHelpOpen(value => !value); return; }
    // The browser's install prompt must be invoked by this user click, not after navigation.
    setPromptEvent(null);
    setInstallHelpOpen(false);
    setInstallBusy(true);
    try {
      void direct.prompt()
        .then(() => direct.userChoice)
        .then(({ outcome }) => {
          if (outcome === "accepted") {
            setInstallMessage("설치를 진행합니다. 홈 화면에서 실행하세요.");
          } else {
            setInstallMessage("설치가 취소되었습니다.");
            setInstallHelpOpen(true);
          }
        })
        .catch(() => { setInstallMessage("브라우저 메뉴에서 설치해 주세요."); setInstallHelpOpen(true); })
        .finally(() => setInstallBusy(false));
    } catch {
      setInstallBusy(false);
      setInstallMessage("브라우저 메뉴에서 설치해 주세요.");
      setInstallHelpOpen(true);
    }
  }

  function enterFullscreen() {
    if (pending.current) return;
    if (typeof document.documentElement.requestFullscreen !== "function") {
      setError("전체화면을 지원하지 않습니다. 앱 설치 방법을 확인해 주세요.");
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
            setError("전체화면을 시작하지 못했습니다. 다시 시도하거나 앱 설치 방법을 확인해 주세요.");
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
      <div className={styles.hero}>
        <img src="/ui/home-wordmark.svg" width={290} height={48} alt="GECKO LAB" />
        <p className={styles.subtitle}>크레스티드 게코 브리딩 연구소</p>
        <div className={styles.icon}><img src="/icons/icon-192.png" alt="" width={112} height={112}/></div>
      </div>
      <section className={styles.panel}>
        <h1>게임 시작</h1>
        <p className={styles.intro}>전체화면으로 플레이하거나 앱으로 설치하세요.</p>
        <button type="button" className={styles.primary} onClick={enterFullscreen} disabled={stage === "starting"} data-testid="fullscreen-start">
          {stage === "starting" ? "전체화면 전환 중…" : "⛶ 전체화면으로 시작"}
        </button>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {!installed && <button type="button" className={styles.secondary} onClick={installOrExplain} disabled={installBusy} data-testid="install-help-toggle" aria-expanded={installHelpOpen} aria-controls="fullscreen-install-guide">
          {installBusy ? "설치 확인 중…" : installContext.startsWith("kakao") || installContext === "ios" ? "앱 설치 방법" : "앱 설치하기"}
        </button>}
        {installHelpOpen && !installed && <section id="fullscreen-install-guide" className={styles.installGuide} aria-label="앱 설치 안내" data-testid="install-help-guide">
          <div className={styles.installGuideTitle}><strong>앱 설치 안내</strong><button type="button" aria-label="설치 안내 닫기" onClick={() => setInstallHelpOpen(false)}>×</button></div>
          {installContext.startsWith("kakao") ? <>
            <p>카카오톡 메뉴에서 <strong>다른 브라우저로 열기</strong>를 선택하세요.</p>
            <p>{installContext === "kakao-ios" ? <>Safari: 공유 → <strong>홈 화면에 추가</strong></> : <>Chrome: 메뉴(⋮) → <strong>앱 설치</strong></>}</p>
          </> : installContext === "ios" ? (
            <p>Safari: 공유 → <strong>홈 화면에 추가</strong></p>
          ) : (
            <p>Chrome 또는 Edge: 메뉴(⋮) → <strong>앱 설치</strong> 또는 홈 화면에 추가</p>
          )}
          {installUrl && <button type="button" className={styles.copyButton} onClick={() => void copyInstallUrl()} data-testid="copy-install-url">설치 주소 복사</button>}
          {copyMessage && <p className={styles.copyMessage} role="status">{copyMessage}</p>}
        </section>}
        {installMessage && <p className={styles.installMessage} role="status">{installMessage}</p>}
        <p className={styles.save}>카카오톡과 설치 앱의 저장 데이터는 공유되지 않을 수 있습니다.</p>
      </section>
    </div>
  </main>;
}
