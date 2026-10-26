export const TILE = 24;
export const COLS = 16;
export const ROWS = 10; // 짝수 — 2칸짜리 좌우 문을 정중앙에 두려고 9에서 10으로(사용자 제안, 2026-10-08)
export const VW = COLS * TILE; // 384
export const VH = ROWS * TILE; // 240

// 대시 속도(px/s) — 허브와 로그라이크가 같은 값을 쓴다(사용자 요청: "같은 느낌으로, 더 빠르게"). 거리만 각자 다르다
export const DASH_SPEED = 900;
// 대시 잔상이 남는 시간(초)
export const DASH_TRAIL_S = 0.15;
