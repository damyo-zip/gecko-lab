"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { drawSprite } from "@/engine/canvas";
import { LAYER_ORDER, type GeckoSpecimen, type LayerName } from "@/engine/model";
import { renderSprite } from "@/engine/render";
import type { GrowthStage } from "@/game/model";
import styles from "./sprite-canvas.module.css";

const GROWTH_SCALE: Record<GrowthStage,number> = {hatchling:.5,juvenile:.75,adult:1};

export function SpriteCanvas({ specimen, scale = 1, enabled = LAYER_ORDER, testId,growthStage }: {
  specimen: GeckoSpecimen; scale?: 1 | 3 | 4; enabled?: readonly LayerName[]; testId?: string;growthStage?:GrowthStage;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const sprite = useMemo(() => renderSprite(specimen, enabled), [specimen, enabled]);
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      if (canvas.current) drawSprite(canvas.current, sprite, scale);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "스프라이트를 표시할 수 없습니다.");
    }
  }, [sprite, scale]);
  if (error) return <p role="alert">{error}</p>;
  return <canvas ref={canvas} width={96 * scale} height={96 * scale}
    className={growthStage?styles.growth:undefined} data-growth-stage={growthStage}
    style={{ width: 96 * scale, height: 96 * scale,...(growthStage?{"--growth-scale":GROWTH_SCALE[growthStage]}:{}) } as CSSProperties} data-testid={testId} data-renderer-version={sprite.version}
    role="img" aria-label={specimen.name + " 픽셀 스프라이트, 시드 " + specimen.seed} />;
}
