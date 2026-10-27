import type { RoomId } from "./rooms";

/*
 * 방마다 놓는 장식(상호작용 없음). 그래픽 개선 B안(2026-10-15)에서 빈 방이 휑해 보이지 않게 추가.
 * - rug: 바닥에 깔림, 밟고 지나갈 수 있다(소수 좌표 허용)
 * - plant / crate: 한 칸을 막는다(엔진 충돌·길찾기에 들어간다) — 문 앞이나 전시물 사이엔 두지 말 것
 * - lamp: 위 벽(row 0)에 붙는 벽등. 조명 층의 광원이 된다
 */

export type Decor =
  | { kind: "rug"; col: number; row: number; w: number; h: number }
  | { kind: "plant" | "crate" | "lamp"; col: number; row: number };

const corners = (kind: "plant" | "crate"): Decor[] => [
  { kind, col: 1, row: 1 }, { kind, col: 14, row: 1 }, { kind, col: 1, row: 8 }, { kind, col: 14, row: 8 },
];
const lamps: Decor[] = [{ kind: "lamp", col: 3, row: 0 }, { kind: "lamp", col: 12, row: 0 }];

export const DECOR: Record<RoomId, Decor[]> = {
  lobby: [{ kind: "rug", col: 5, row: 3, w: 6, h: 4 }, ...corners("plant"), ...lamps],
  // 코딩창이 오른쪽 위를 덮으니 상자는 아래쪽에
  pyfactory: [
    { kind: "crate", col: 1, row: 8 }, { kind: "crate", col: 2, row: 8 }, { kind: "crate", col: 1, row: 7 },
    { kind: "crate", col: 14, row: 8 }, ...lamps,
  ],
  roguelike: [{ kind: "rug", col: 5.5, row: 3.5, w: 5, h: 3 }, ...corners("plant"), ...lamps],
  // 왼쪽은 화면 패널이라 오른쪽 공간에만
  evolution: [
    { kind: "lamp", col: 9, row: 0 }, { kind: "lamp", col: 13, row: 0 },
  ],
  archive: [{ kind: "rug", col: 5, row: 3.5, w: 6, h: 3 }, ...corners("plant"), ...lamps],
};
