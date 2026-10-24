"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./fullscreen-probe.module.css";

type Measurement = {
  innerHeight: number;
  innerWidth: number;
  visualHeight: number;
  screenHeight: number;
  fullscreen: boolean;
  api: boolean;
  enabled: boolean;
};
type ProbeState = "ready" | "requesting" | "success" | "blocked" | "unsupported" | "exited";
type FullscreenMode = "show" | "default";

function measure(): Measurement {
  return {
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    visualHeight: Math.round(window.visualViewport?.height ?? window.innerHeight),
    screenHeight: window.screen.height,
    fullscreen: Boolean(document.fullscreenElement),
    api: typeof document.documentElement.requestFullscreen === "function",
    enabled: document.fullscreenEnabled,
  };
}

function environmentLabel(ua: string): string {
  const kakao = /kakaotalk/i.test(ua);
  const os = /android/i.test(ua) ? "Android" : /iphone|ipad|ipod/i.test(ua) ? "iOS" : "PC / 기타";
  return kakao ? `카카오톡 내장 브라우저 · ${os}` : `일반 브라우저 · ${os}`;
}

export default function FullscreenProbe() {
  const [initial, setInitial] = useState<Measurement | null>(null);
  const [current, setCurrent] = useState<Measurement | null>(null);
  const [environment, setEnvironment] = useState("확인 중");
  const [result, setResult] = useState<ProbeState>("ready");
  const [detail, setDetail] = useState("");
  const [copied, setCopied] = useState(false);
  const [requestedMode, setRequestedMode] = useState<FullscreenMode | null>(null);
  const refresh = useCallback(() => setCurrent(measure()), []);

  useEffect(() => {
    const first = measure();
    setInitial(first);
    setCurrent(first);
    setEnvironment(environmentLabel(navigator.userAgent));

    const onChange = () => {
      refresh();
      setResult(document.fullscreenElement ? "success" : "exited");
      setDetail(document.fullscreenElement ? "브라우저가 전체화면을 허용했습니다." : "전체화면이 종료되었습니다.");
    };
    const onError = () => {
      refresh();
      setResult("blocked");
      setDetail("fullscreenerror 이벤트가 발생했습니다. 카카오톡 또는 브라우저가 요청을 차단했을 수 있습니다.");
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("fullscreenerror", onError);
    window.addEventListener("resize", refresh);
    window.visualViewport?.addEventListener("resize", refresh);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("fullscreenerror", onError);
      window.removeEventListener("resize", refresh);
      window.visualViewport?.removeEventListener("resize", refresh);
    };
  }, [refresh]);

  function requestFullscreen(mode: FullscreenMode) {
    setCopied(false);
    setRequestedMode(mode);
    const method = document.documentElement.requestFullscreen;
    if (typeof method !== "function") {
      setResult("unsupported");
      setDetail("이 브라우저에는 requestFullscreen API가 없습니다. 페이지 코드만으로 주소창을 숨길 수 없습니다.");
      refresh();
      return;
    }

    // Call synchronously from the button event. No await/navigation before user activation.
    setResult("requesting");
    setDetail(mode === "show" ? "navigationUI: show 옵션으로 전체화면을 요청했습니다." : "기존 방식으로 전체화면을 요청했습니다.");
    try {
      const request = mode === "show"
        ? document.documentElement.requestFullscreen({ navigationUI: "show" })
        : document.documentElement.requestFullscreen();
      Promise.resolve(request).then(() => {
        refresh();
        if (document.fullscreenElement) {
          setResult("success");
          setDetail("전체화면 진입 성공. 안드로이드 상단 시계·배터리와 하단 홈·뒤로가기 버튼이 남아 있는지 확인해 주세요. navigationUI 옵션은 브라우저가 무시할 수 있습니다.");
        } else {
          setResult("blocked");
          setDetail("요청은 끝났지만 전체화면 상태가 확인되지 않았습니다.");
        }
      }).catch((error: unknown) => {
        refresh();
        setResult("blocked");
        setDetail(error instanceof Error ? `${error.name}: ${error.message}` : "전체화면 요청이 거부되었습니다.");
      });
    } catch (error) {
      refresh();
      setResult("blocked");
      setDetail(error instanceof Error ? `${error.name}: ${error.message}` : "전체화면 요청을 실행할 수 없습니다.");
    }
  }

  function exitFullscreen() {
    if (!document.fullscreenElement) return;
    void document.exitFullscreen().catch((error: unknown) => {
      setDetail(error instanceof Error ? error.message : "전체화면 종료에 실패했습니다.");
    });
  }

  async function copyResult() {
    const output = [
      "[GECKO LAB 전체화면 실험]",
      `환경: ${environment}`,
      `요청 방식: ${requestedMode === "show" ? 'navigationUI: show' : requestedMode === "default" ? "기존 요청(옵션 없음)" : "미요청"}`,
      `결과: ${result}`,
      `오류/안내: ${detail || "없음"}`,
      `API 지원: ${current?.api ? "예" : "아니오"} / fullscreenEnabled: ${current?.enabled ? "예" : "아니오"}`,
      `처음 화면 높이: ${initial?.innerHeight ?? "-"}px (visual ${initial?.visualHeight ?? "-"}px)`,
      `현재 화면 높이: ${current?.innerHeight ?? "-"}px (visual ${current?.visualHeight ?? "-"}px)`,
      `screen.height: ${current?.screenHeight ?? "-"}px`,
      `document.fullscreenElement: ${current?.fullscreen ? "있음" : "없음"}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
    } catch {
      setCopied(false);
      setDetail("카톡에서 결과 자동 복사가 제한됐습니다. 이 화면을 캡처해 공유해 주세요.");
    }
  }

  const changed = current && initial ? current.visualHeight - initial.visualHeight : null;
  const text = result === "success" ? "전체화면 API 성공" : result === "blocked" ? "전체화면 요청 차단" : result === "unsupported" ? "전체화면 API 미지원" : result === "requesting" ? "브라우저 응답 확인 중" : result === "exited" ? "전체화면 종료됨" : "버튼을 눌러 시험해 봐";

  return (
    <main className={styles.page} data-testid="fullscreen-test">
      <div className={styles.device}>
        <header className={styles.header}>
          <span>GECKO LAB</span>
          <span>DISPLAY / EXPERIMENT 01</span>
        </header>
        <div className={styles.content}>
          <div className={styles.intro}>
            <img src="/ui/home-wordmark.svg" width={250} height={40} alt="GECKO LAB" />
            <div className={styles.eyebrow}>KAKAOTALK FULLSCREEN PROBE</div>
            <h1>카톡 전체화면 시험</h1>
            <p>카카오톡에서 시스템 바 유지 옵션을 시험해 봐. 목표는 카톡의 주소창·하단 메뉴만 없애고, 휴대폰 상단 시계와 하단 홈·뒤로가기 버튼은 남기는 거야.</p>
          </div>

          <section className={styles.panel} aria-label="전체화면 제어">
            <div className={styles.environment}>{environment}</div>
            <div className={styles.result} data-state={result} role="status" data-testid="fullscreen-result">
              <span className={styles.dot} aria-hidden="true" />{text}
            </div>
            {current?.fullscreen ? (
              <button className={styles.primary} type="button" onClick={exitFullscreen} data-testid="exit-fullscreen">전체화면 종료</button>
            ) : (
              <div className={styles.actions}>
                <button className={styles.primary} type="button" onClick={() => requestFullscreen("show")} data-testid="request-fullscreen">⛶ 시스템 바 유지 시도 (show)</button>
                <button className={styles.secondary} type="button" onClick={() => requestFullscreen("default")} data-testid="request-fullscreen-default">기존 전체화면 방식과 비교</button>
              </div>
            )}
            {requestedMode && <p className={styles.mode} data-testid="requested-mode">요청 옵션: {requestedMode === "show" ? 'navigationUI: "show"' : "기본값 (옵션 없음)"}</p>}
            {detail && <p className={styles.details} data-testid="fullscreen-detail">{detail}</p>}
          </section>

          <section className={styles.panel} aria-label="화면 크기 측정">
            <div className={styles.sectionTitle}>SCREEN MEASUREMENT</div>
            <div className={styles.measureGrid}>
              <div><span>요청 전 높이</span><strong data-testid="height-before">{initial?.visualHeight ?? "—"} <small>px</small></strong></div>
              <div><span>현재 높이</span><strong data-testid="height-after">{current?.visualHeight ?? "—"} <small>px</small></strong></div>
              <div><span>높이 변화</span><strong data-testid="height-delta">{changed === null ? "—" : `${changed > 0 ? "+" : ""}${changed}`} <small>px</small></strong></div>
              <div><span>기기 화면</span><strong>{current?.screenHeight ?? "—"} <small>px</small></strong></div>
            </div>
            <div className={styles.diagnostics}>
              <span>requestFullscreen: {current ? current.api ? "지원" : "미지원" : "—"}</span>
              <span>fullscreenEnabled: {current ? String(current.enabled) : "—"}</span>
              <span>fullscreenElement: {current ? current.fullscreen ? "있음" : "없음" : "—"}</span>
            </div>
            <button className={styles.copy} type="button" onClick={() => void copyResult()} data-testid="copy-results">{copied ? "✓ 결과 복사 완료" : "결과 텍스트 복사"}</button>
          </section>

          <p className={styles.note}>중요: <code>navigationUI: "show"</code>는 요청 사항일 뿐이고, 안드로이드 상태 표시줄·내비게이션 바 유지를 보장하지 않아. API 성공 여부와 실제 시스템 바 표시 여부를 각각 확인해 줘.</p>
          <a className={styles.back} href="/start">← 설치 안내로 돌아가기</a>
        </div>
        <footer className={styles.footer}><span>TEST ONLY · GAME DATA UNTOUCHED</span><span>GECKO LAB</span></footer>
      </div>
    </main>
  );
}
