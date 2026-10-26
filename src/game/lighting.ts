import { VW, VH } from "./constants";
import type { Palette } from "./palette";

/*
 * 조명·후처리 층(2026-10-15 그래픽 개선 B안). 도트 그림을 화면 캔버스로 확대한 뒤 그 위에 칠한다.
 * - 조명 맵: 어두운 바탕(--light-ambient)에 광원을 더해(lighter) 만든 뒤 화면에 곱한다(multiply) — 검정은 검정으로 남고 빛 색이 물든다
 * - 번짐(bloom): 작은 광원 둘레에 한 번 더 더한다
 * - 먼지: 천천히 떠오르는 작은 점. 비네트: 가장자리를 어둡게
 * 조명 맵은 가상 해상도의 2배로 그리고 부드럽게 늘린다 — 빛은 픽셀 계단이 없어야 자연스럽다.
 */

/** x, y, r은 가상 좌표(384×240). a는 세기(0~1) */
export type Light = { x: number; y: number; r: number; color: string; a: number; bloom?: boolean };

const LM = 2; // 조명 맵 배율

function rgb(hex: string) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? [...h].map((c) => c + c).join("") : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

export function createLighting(P: Palette, reduceMotion: boolean) {
  const lm = document.createElement("canvas");
  lm.width = VW * LM;
  lm.height = VH * LM;
  const l = lm.getContext("2d")!;
  const cache = new Map<string, string>();
  const c = (hex: string) => cache.get(hex) ?? (cache.set(hex, rgb(hex)), cache.get(hex)!);
  const dust = Array.from({ length: 34 }, () => ({
    x: Math.random() * VW, y: Math.random() * VH, v: 2 + Math.random() * 5, ph: Math.random() * 6, big: Math.random() < 0.3,
  }));

  /** boost: 바탕 밝기를 올린다(0~1) — 로그라이크처럼 화면 전체가 잘 보여야 하는 곳 */
  return function apply(view: CanvasRenderingContext2D, W: number, H: number, lights: Light[], now: number, boost = 0) {
    const s = W / VW;

    l.globalCompositeOperation = "source-over";
    l.fillStyle = P.lightAmbient;
    l.fillRect(0, 0, lm.width, lm.height);
    l.globalCompositeOperation = "lighter";
    if (boost > 0) {
      l.fillStyle = `rgba(255,255,255,${boost})`;
      l.fillRect(0, 0, lm.width, lm.height);
    }
    for (const L of lights) {
      const x = L.x * LM, y = L.y * LM, r = L.r * LM;
      const g = l.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${c(L.color)},${L.a})`);
      g.addColorStop(0.5, `rgba(${c(L.color)},${L.a * 0.4})`);
      g.addColorStop(1, `rgba(${c(L.color)},0)`);
      l.fillStyle = g;
      l.fillRect(x - r, y - r, r * 2, r * 2);
    }

    view.save();
    view.imageSmoothingEnabled = true;
    view.globalCompositeOperation = "multiply";
    view.drawImage(lm, 0, 0, W, H);

    view.globalCompositeOperation = "lighter";
    for (const L of lights) {
      if (!L.bloom) continue;
      const x = L.x * s, y = L.y * s, r = Math.min(L.r * 0.45, 26) * s;
      const g = view.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${c(L.color)},${0.35 * L.a})`);
      g.addColorStop(1, `rgba(${c(L.color)},0)`);
      view.fillStyle = g;
      view.fillRect(x - r, y - r, r * 2, r * 2);
    }
    if (!reduceMotion) {
      for (const d of dust) {
        const y = (((d.y - (now / 1000) * d.v) % VH) + VH) % VH;
        const x = d.x + Math.sin(now / 1100 + d.ph) * 6;
        view.fillStyle = `rgba(${c(P.lightWarm)},${0.1 + 0.08 * Math.sin(now / 600 + d.ph)})`;
        const size = Math.max(1, Math.round(s)) * (d.big ? 2 : 1);
        view.fillRect(Math.round(x * s), Math.round(y * s), size, size);
      }
    }

    view.globalCompositeOperation = "source-over";
    const v = view.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.68);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,.5)");
    view.fillStyle = v;
    view.fillRect(0, 0, W, H);
    view.restore();
  };
}
