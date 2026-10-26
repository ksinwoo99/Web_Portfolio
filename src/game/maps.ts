import { TILE } from "./constants";
import type { RoomId } from "./rooms";

// 타일맵 기호: # 벽 / . 바닥 / D 문 / P 화면 패널(막힘 — 엔진이 한 덩어리 화면으로 그린다) / 나머지는 바닥 취급
// 16×10. 문은 2칸 폭(사용자 요청 — 들어가기 편하게). 위·아래 문은 7~8열, 좌우 문은 4~5행 — 둘 다 정중앙
export const MAPS: Record<RoomId, string[]> = {
  lobby: [
    "#######DD#######",
    "#..............#",
    "#..............#",
    "#..............#",
    "D..............D",
    "D..............D",
    "#..............#",
    "#..............#",
    "#..............#",
    "#######DD#######",
  ],
  pyfactory: [
    "################",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#######DD#######",
  ],
  roguelike: [
    "################",
    "#..............#",
    "#..............#",
    "#..............#",
    "D..............#",
    "D..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "################",
  ],
  evolution: [
    "################",
    "#PPPPPP........#",
    "#PPPPPP........#",
    "#PPPPPP........#",
    "#PPPPPP........D",
    "#PPPPPP........D",
    "#PPPPPP........#",
    "#PPPPPP........#",
    "#PPPPPP........#",
    "################",
  ],
  archive: [
    "#######DD#######",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "################",
  ],
};

export type Rect = { x: number; y: number; w: number; h: number };

/** 방마다 화면 패널(P 타일)의 영역. 없으면 null — 지금은 AI 진화 방 왼쪽 "인게임 화면"만 있다 */
export const PANEL_RECTS = Object.fromEntries(
  (Object.keys(MAPS) as RoomId[]).map((id) => {
    const cells: [number, number][] = [];
    MAPS[id].forEach((row, r) => [...row].forEach((t, c) => { if (t === "P") cells.push([c, r]); }));
    if (!cells.length) return [id, null];
    const cs = cells.map(([c]) => c), rs = cells.map(([, r]) => r);
    const c0 = Math.min(...cs), r0 = Math.min(...rs);
    return [id, { x: c0 * TILE, y: r0 * TILE, w: (Math.max(...cs) + 1 - c0) * TILE, h: (Math.max(...rs) + 1 - r0) * TILE }];
  }),
) as Record<RoomId, Rect | null>;

/** 패널 베젤 안쪽, 실제 화면 영역(엔진 drawPanel과 체험판 그리기가 같이 쓴다) */
export function panelScreen(pn: Rect): Rect {
  return { x: pn.x + 10, y: pn.y + 8, w: pn.w - 22, h: pn.h - 24 };
}
