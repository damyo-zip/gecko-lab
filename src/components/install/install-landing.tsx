"use client";

import { useEffect, useState } from "react";
import { OfflineShell } from "@/components/hardcore/offline";
import styles from "./install-landing.module.css";

type Environment = "checking" | "kakao-android" | "kakao-ios" | "ios" | "android" | "desktop";
type InstallChoice = { outcome: "accepted" | "dismissed"; platform: string };
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<InstallChoice>;
}

function getEnvironment(userAgent: string): Environment {
  const kakao = /kakaotalk/i.test(userAgent);
  const ios = /iphone|ipad|ipod/i.test(userAgent);
  if (kakao) return ios ? "kakao-ios" : "kakao-android";
  if (ios) return "ios";
  return /android/i.test(userAgent) ? "android" : "desktop";
}

export default function InstallLanding() {
  const [environment, setEnvironment] = useState<Environment>("checking");
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    if (window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true) {
      window.location.replace("/");
      return;
    }

    setEnvironment(getEnvironment(navigator.userAgent));
    setShareUrl(window.location.origin + "/start");
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setMessage("설치가 완료됐어! 홈 화면의 GECKO LAB 아이콘으로 시작해 줘.");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const isKakao = environment === "kakao-android" || environment === "kakao-ios";
  const isIos = environment === "ios" || environment === "kakao-ios";

  async function requestInstall() {
    setMessage("");
    if (isKakao || !installPrompt) {
      setGuideOpen(true);
      return;
    }
    const prompt = installPrompt;
    setInstallPrompt(null);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") {
        setMessage("설치를 승인했어. 홈 화면에 생성된 아이콘으로 게임을 실행해 줘.");
      } else {
        setMessage("설치하지 않아도 웹에서 체험할 수 있어.");
        setGuideOpen(true);
      }
    } catch {
      setMessage("이 브라우저에서 설치창을 열지 못했어. 아래 수동 설치 방법을 확인해 줘.");
      setGuideOpen(true);
    }
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(window.location.origin + "/start");
      setCopied(true);
      setMessage("공유 주소를 복사했어. 외부 브라우저에 붙여넣어 열어 줘.");
    } catch {
      setCopied(false);
      setMessage("주소 자동 복사가 제한되어 있어. 위 주소를 길게 눌러 복사해 줘.");
    }
  }

  return (
    <main className={styles.shell} data-testid="install-landing">
      <OfflineShell />
      <div className={styles.screen}>
        <div className={styles.topLine}>
          <span>GECKO LAB / FIELD ENTRY</span>
          <span className={styles.topLight}>● ONLINE</span>
        </div>

        <div className={styles.hero}>
          <div className={styles.eyebrow}>YOUR OWN BREEDING LAB</div>
          <img className={styles.wordmark} src="/ui/home-wordmark.svg" alt="GECKO LAB" width={300} height={48} />
          <p className={styles.subtitle}>나만의 크레스티드 게코 브리딩 연구소</p>
          <div className={styles.artFrame}>
            <img src="/icons/icon-192.png" alt="게코랩 앱 아이콘" width={110} height={110} />
          </div>
          <div className={styles.artCaption}>COLLECT · BREED · DISCOVER</div>
        </div>

        <section className={styles.panel} aria-labelledby="install-heading">
          <div className={styles.sectionLabel}>01 / START YOUR LAB</div>
          <h1 id="install-heading">앱으로 설치하고 시작하기</h1>
          <p className={styles.description}>
            홈 화면에서 바로 실행하고, 주소창 없이 더 몰입해서 플레이해 봐.
          </p>

          {isKakao && <p className={styles.kakaoNotice}>
            카카오톡으로 접속했어. 앱 설치는 크롬 또는 사파리에서 진행하면 돼.
          </p>}

          <button className={styles.primary} type="button" onClick={requestInstall} disabled={environment === "checking" || installed} data-testid="install-action">
            <span aria-hidden="true">↓</span>
            {installed ? "앱 설치 완료" : isKakao ? "앱 설치 방법 보기" : "앱 설치하기"}
            <span aria-hidden="true">›</span>
          </button>

          <a className={styles.secondary} href="/" data-testid="play-in-browser">설치 없이 웹에서 플레이 <span aria-hidden="true">→</span></a>

          {message && <p className={styles.message} role="status">{message}</p>}

          {guideOpen && (
            <div className={styles.guide} data-testid="install-guide">
              <div className={styles.guideTitle}>설치 안내 <button type="button" onClick={() => setGuideOpen(false)} aria-label="설치 안내 닫기">×</button></div>
              {isKakao ? (
                <>
                  <p><b>1.</b> 카카오톡 화면의 메뉴(⋯)에서 <strong>다른 브라우저로 열기</strong>를 선택해 줘.</p>
                  <p><b>2.</b> {isIos ? "Safari의 공유 메뉴 → 홈 화면에 추가" : "Chrome 메뉴(⋮) → 앱 설치 또는 홈 화면에 추가"}를 선택해 줘.</p>
                  <p>메뉴를 찾기 어렵다면 아래 주소를 복사해서 {isIos ? "Safari" : "Chrome"}에서 열어 줘.</p>
                </>
              ) : isIos ? (
                <><p><b>1.</b> Safari에서 이 주소를 열어 줘.</p><p><b>2.</b> 공유 버튼 → <strong>홈 화면에 추가</strong> → 추가를 선택해 줘.</p></>
              ) : environment === "android" ? (
                <><p><b>1.</b> Chrome에서 이 주소를 열어 줘.</p><p><b>2.</b> 브라우저 메뉴(⋮)의 <strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong>를 선택해 줘.</p></>
              ) : (
                <p>Chrome 또는 Edge의 주소창에 있는 설치 아이콘이나 브라우저 메뉴의 <strong>앱 설치</strong>를 확인해 줘. 지원되지 않는 환경이라면 웹에서 바로 플레이할 수 있어.</p>
              )}
              {shareUrl && <div className={styles.copyRow}>
                <span className={styles.copyUrl} aria-label="설치 주소">{shareUrl}</span>
                <button type="button" onClick={copyAddress}>{copied ? "복사됨" : "주소 복사"}</button>
              </div>}
            </div>
          )}
          <p className={styles.saveNote}>※ 카카오톡에서 플레이한 저장 데이터는 설치한 앱으로 자동 이동하지 않을 수 있어. 설치 후 시작하는 걸 권장해.</p>
        </section>

        <footer className={styles.footer}><span>EST. GECKO LAB</span><span>BREED WITH CARE ✣</span></footer>
      </div>
    </main>
  );
}
