import { TILE } from "./constants";
import type { Palette } from "./palette";

/*
 * 허브·체험판이 같이 쓰는 도트 그림(2026-10-15 그래픽 개선 B안의 "그림" 절반 — 나머지 절반은 lighting.ts).
 * 이미지 파일 없이 fillRect만 쓴다. 입체감은 윗면 하이라이트 · 아래/오른쪽 음영 · 먹색 외곽선 세 가지로 낸다.
 */

export type Px = (x: number, y: number, w: number, h: number, color: string) => void;
export type Facing = "up" | "down" | "left" | "right";

const SHADOW = "rgba(0,0,0,.32)";

/** 좌표마다 고정된 0~1 난수 — 바닥 얼룩이 매 프레임 같은 자리에 찍히게 */
export function hash2(a: number, b: number) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 바닥 타일: 체크무늬 + 윗/왼 하이라이트 + 아래/오른 음영 + 잔 얼룩 */
export function floorTile(px: Px, P: Palette, x: number, y: number, c: number, r: number) {
  px(x, y, TILE, TILE, (r + c) % 2 ? P.floorA : P.floorB);
  px(x, y, TILE, 1, P.floorHi);
  px(x, y, 1, TILE, P.floorHi);
  px(x, y + TILE - 1, TILE, 1, P.floorLo);
  px(x + TILE - 1, y, 1, TILE, P.floorLo);
  for (let i = 0; i < 3; i++) {
    const h = hash2(c * 7 + i, r * 13 - i);
    if (h > 0.7) continue;
    px(x + 2 + Math.floor(hash2(c, r + i * 31) * 19), y + 2 + Math.floor(hash2(r, c + i * 17) * 19), 1, 1, h < 0.35 ? P.floorHi : P.floorLo);
  }
}

export type WallSide = "top" | "bottom" | "left" | "right";

/**
 * 벽 타일. 위 벽은 앞면이 보이는 3/4 시점(윗면 + 판넬 + 걸레받이),
 * 아래·좌우 벽은 방 쪽으로 윗면 테두리만 보인다.
 */
export function wallTile(px: Px, P: Palette, x: number, y: number, side: WallSide, c: number) {
  px(x, y, TILE, TILE, P.wallSide);
  if (side === "top") {
    px(x, y, TILE, 6, P.wallTop);
    px(x, y + 6, TILE, 1, P.wallHi);
    px(x + 2, y + 9, TILE - 4, TILE - 15, P.wallFace);      // 판넬
    px(x + 2, y + 9, TILE - 4, 1, P.wallHi);
    if (c % 2 === 0) px(x, y + 8, 1, TILE - 12, P.outline);  // 판넬 이음매
    px(x, y + TILE - 4, TILE, 4, P.void2);                  // 걸레받이
  } else if (side === "bottom") {
    px(x, y, TILE, 5, P.wallTop);
    px(x, y, TILE, 1, P.wallHi);
    if (c % 2 === 0) px(x, y + 7, 1, TILE - 7, P.void2);
  } else {
    const inner = side === "left" ? x + TILE - 6 : x;      // 방 쪽 가장자리
    px(inner, y, 6, TILE, P.wallTop);
    px(side === "left" ? inner : inner + 5, y, 1, TILE, P.wallHi);
    if (c % 2 === 0) px(x + (side === "left" ? 4 : 10), y, 6, 1, P.void2);
  }
}

/** 벽이 바닥에 드리우는 그림자(위 벽은 깊게, 옆 벽은 얕게). 방 크기는 cols×rows 타일 */
export function wallShadows(px: Px, cols: number, rows: number) {
  const x0 = TILE, x1 = (cols - 1) * TILE, y0 = TILE, y1 = (rows - 1) * TILE;
  px(x0, y0, x1 - x0, 5, "rgba(0,0,0,.34)");
  px(x0, y0 + 5, x1 - x0, 4, "rgba(0,0,0,.14)");
  px(x0, y0, 4, y1 - y0, "rgba(0,0,0,.2)");
  px(x1 - 4, y0, 4, y1 - y0, "rgba(0,0,0,.2)");
}

/**
 * 캐릭터(허브·로그라이크 공용). (cx, cy)는 발밑 중심 근처 — 허브 충돌 박스 중심과 같은 기준.
 * 외곽선 · 몸통 명암 · 머리카락 하이라이트 · 볼터치, 방향마다 눈/머리 모양이 다르다.
 */
export function drawHero(px: Px, P: Palette, cx: number, cy: number, facing: Facing, bob: number) {
  const x = Math.round(cx - 6), y = Math.round(cy - 12) + bob;
  px(x - 1, y + 20, 14, 4, SHADOW);
  // 몸통
  px(x, y + 11, 12, 10, P.outline);
  px(x + 1, y + 12, 10, 8, P.metal);
  px(x + 1, y + 12, 3, 8, P.metalHi);
  px(x + 8, y + 12, 3, 8, P.wallFace);
  // 머리
  px(x + 1, y + 1, 10, 12, P.outline);
  px(x + 2, y + 2, 8, 10, P.ink);
  px(x + 8, y + 3, 2, 8, P.skinShade);
  // 머리카락
  px(x + 1, y - 1, 10, 5, P.outline);
  px(x + 2, y, 8, 4, P.brass);
  px(x + 2, y, 8, 1, P.hairHi);
  if (facing === "down") {
    px(x + 2, y + 3, 2, 2, P.brass);
    px(x + 3, y + 6, 2, 2, P.void);
    px(x + 7, y + 6, 2, 2, P.void);
    px(x + 3, y + 9, 1, 1, P.blush);
    px(x + 8, y + 9, 1, 1, P.blush);
  } else if (facing === "up") {
    px(x + 2, y + 2, 8, 8, P.brass);   // 뒷머리
    px(x + 2, y + 2, 8, 1, P.hairHi);
    px(x + 4, y + 9, 4, 1, P.brassDark);
  } else if (facing === "left") {
    px(x + 7, y + 2, 3, 7, P.brass);
    px(x + 3, y + 6, 2, 2, P.void);
    px(x + 3, y + 9, 1, 1, P.blush);
  } else {
    px(x + 2, y + 2, 3, 7, P.brass);
    px(x + 7, y + 6, 2, 2, P.void);
    px(x + 8, y + 9, 1, 1, P.blush);
  }
  // 발
  px(x + 2, y + 20, 3, 3, P.void2);
  px(x + 7, y + 20, 3, 3, P.void2);
}

/* ---------- 소품 ---------- */

/** 러그: 두 겹 테두리 + 가운데 점 무늬 */
export function rug(px: Px, P: Palette, x: number, y: number, w: number, h: number) {
  px(x, y, w, h, P.carpetDark);
  px(x + 2, y + 2, w - 4, h - 4, P.carpet);
  px(x + 5, y + 5, w - 10, h - 10, P.carpetDark);
  px(x + 6, y + 6, w - 12, h - 12, P.carpet);
  for (let i = 14; i < w - 14; i += 16) px(x + i, y + Math.floor(h / 2) - 2, 4, 4, P.carpetHi);
}

/** 화분(한 칸, 바닥에 놓임) */
export function plant(px: Px, P: Palette, x: number, y: number) {
  const ox = x + 6, oy = y + 6;
  px(ox - 1, oy + 15, 14, 4, SHADOW);
  px(ox - 1, oy + 7, 14, 11, P.outline);
  px(ox, oy + 8, 12, 9, P.brassDark);
  px(ox, oy + 8, 12, 2, P.brass);
  px(ox + 2, oy + 10, 8, 1, P.carpetDark);
  px(ox + 5, oy - 2, 2, 10, P.leafDark);
  px(ox + 1, oy, 5, 5, P.leaf);
  px(ox + 6, oy - 4, 5, 5, P.jade);
  px(ox + 3, oy - 6, 4, 4, P.leaf);
  px(ox + 7, oy + 1, 4, 4, P.leafDark);
}

/** 나무 상자(한 칸) */
export function crate(px: Px, P: Palette, x: number, y: number) {
  px(x + 1, y + TILE - 4, TILE - 2, 4, SHADOW);
  px(x + 2, y + 1, TILE - 4, TILE - 4, P.outline);
  px(x + 3, y + 2, TILE - 6, TILE - 6, P.carpetHi);
  px(x + 3, y + 2, TILE - 6, 2, P.brass);
  px(x + 3, y + 2, 2, TILE - 6, P.carpetDark);
  px(x + TILE - 5, y + 2, 2, TILE - 6, P.carpetDark);
  px(x + 3, y + TILE / 2 - 1, TILE - 6, 2, P.carpetDark);
}

/** 위 벽에 붙은 벽등(벽 타일 위에 그린다) */
export function wallLamp(px: Px, P: Palette, x: number, y: number) {
  px(x + 7, y + 8, 10, 8, P.outline);
  px(x + 8, y + 9, 8, 5, P.metal);
  px(x + 8, y + 9, 8, 1, P.metalHi);
  px(x + 9, y + 14, 6, 3, P.lightWarm);
}
