import { ArchivePicker } from "../content/panels/ArchiveShelf";
import type { ComponentType } from "react";
import { usePyfStore } from "./pyfactory/store";
import { useRlStore } from "./roguelike/store";
import { useEvoStore, type UpKey } from "./evolution/store";

const EVO_NAMES: Record<UpKey, string> = { atk: "공격력", pen: "방어관통", acc: "명중률", eva: "회피율", def: "방어력", hp: "체력" };

// 강화 버튼 반원: 오른쪽 공간(7~14열) 가운데를 중심으로, 아래로 볼록한 U자에 6개를 같은 간격으로(왼쪽 → 오른쪽)
const EVO_ARC: [UpKey, number, number][] = (["atk", "def", "pen", "hp", "acc", "eva"] as UpKey[]).map((k, i) => {
  const a = Math.PI - (i * Math.PI) / 5, cx = 11, cy = 3.6, r = 3.2; // 타일 단위
  return [k, Math.round((cx + r * Math.cos(a) - 0.5) * 4) / 4, Math.round((cy + r * Math.sin(a) - 0.5) * 4) / 4];
});

export type RoomId = "lobby" | "pyfactory" | "roguelike" | "evolution" | "archive";
export type Dir = "up" | "down" | "left" | "right";
export type ObjectKind = "miner" | "productor" | "start-button" | "incubator" | "bookshelf" | "pad";

export type ControlBadge = { key: string; label: string };

export type PanelContent = {
  title: string;
  lede: string;
  // 패널이 열릴 때마다 새로 마운트된다. 체험판 초기화는 이 컴포넌트의 useEffect에서.
  Body: ComponentType;
};

export type RoomObject = {
  id: string;
  col: number; // 왼쪽 위 타일 좌표. 가운데 정렬을 위해 소수(6.5 등)도 허용
  row: number; // 소수 허용(4.5 = 10행 방의 정중앙)
  w?: number;  // 가로 타일 수 (기본 1)
  kind: ObjectKind;
  label: string;
  action?: string; // 조작 배지 E 설명(없으면 "○○ 살펴보기")
} & (
  | { content: PanelContent; onActivate?: never }  // 클릭/E → 모달 패널
  | { onActivate: () => void; content?: never }    // 클릭/E → 체험판 고유 동작(예: py.Factory 코딩창)
);

export type Room = {
  name: string;
  summary: string; // 목록 뷰·로비 카드에 쓰는 한 줄 소개
  tag: string;     // 게임창 아래 안내 문구
  exits: Partial<Record<Dir, RoomId>>;
  objects: RoomObject[];
  controlsExtra: ControlBadge[];
};

export const ROOMS: Record<RoomId, Room> = {
  lobby: {
    name: "로비",
    summary: "네 개의 전시실로 이어지는 중앙 홀.",
    tag: "문을 클릭하거나 걸어가서 전시실로 들어가세요.",
    exits: { up: "pyfactory", right: "roguelike", left: "evolution", down: "archive" },
    objects: [],
    controlsExtra: [],
  },
  pyfactory: {
    name: "py.Factory 체험실",
    summary: "코드로 공장을 돌리는 자동화 게임. 채굴기·가공기를 직접 코딩.",
    tag: "채굴기·가공기를 클릭하거나, 가까이 가서 E를 눌러 코딩창을 여세요.",
    exits: { down: "lobby" },
    controlsExtra: [
      { key: "우클릭", label: "설치물 재가동" },
      { key: "F5", label: "코딩창 실행" },
    ],
    // 넓은 화면에서 코딩창이 게임창 오른쪽에 떠 있으므로 기계는 왼쪽 절반에 둔다 — 코드를 고치면서 작동을 볼 수 있게.
    objects: [
      {
        id: "pyfactory-miner", col: 3, row: 4.5, kind: "miner", label: "채굴기",
        onActivate: () => usePyfStore.getState().openCoding("miner"),
      },
      {
        id: "pyfactory-productor", col: 6, row: 4.5, kind: "productor", label: "가공기",
        onActivate: () => usePyfStore.getState().openCoding("productor"),
      },
    ],
  },
  roguelike: {
    name: "로그라이크 체험실",
    summary: "제작 중인 소규모 로그라이크. 바로 시작해서 한 판.",
    tag: "가운데 GAME START를 클릭하거나, 가까이 가서 E를 누르세요.",
    exits: { left: "lobby" },
    controlsExtra: [],
    objects: [{
      id: "roguelike-start", col: 6.5, row: 4.5, w: 3, kind: "start-button", label: "GAME START",
      onActivate: () => useRlStore.getState().start(), // 게임창이 그대로 로그라이크 화면이 된다
    }],
  },
  evolution: {
    name: "AI 진화 게임 체험실",
    summary: "기획 중인 AI 진화 게임. 곧 공개.",
    tag: "오른쪽 버튼으로 아군(초록)을 강화하고 전투 시작을 누르세요. 왼쪽 화면에서 적(빨강)과 싸웁니다.",
    exits: { right: "lobby" },
    controlsExtra: [],
    // 왼쪽 6칸은 화면 패널(maps.ts의 P), 오른쪽 8칸(7~14열)에 강화 버튼. 누르면 아군 강화(한 종류 3번, 합계는 적보다 1개 적게 — store.ts allyLimit)
    objects: [
      // 배치(사용자 지정, 2026-10-26): 맨 위 줄 전투 시작 · 정지 · 강화 초기화 → 그 아래 강화 6종을 반원(U자)으로 →
      // 오른쪽 위 구석에 전체 초기화(맨 위 줄과 두 칸 띄워 실수로 누르지 않게). 반원은 상성 짝끼리 붙여 둔다
      ...EVO_ARC.map(([k, col, row]) => ({
        id: `evo-${k}`, col, row, kind: "pad" as const,
        label: EVO_NAMES[k],
        action: `${EVO_NAMES[k]} 강화`,
        onActivate: () => useEvoStore.getState().upgrade(k),
      })),
      {
        id: "evo-start", col: 7, row: 1, kind: "pad", label: "전투 시작", action: "전투 시작",
        onActivate: () => useEvoStore.getState().start(),
      },
      {
        id: "evo-stop", col: 9, row: 1, kind: "pad", label: "정지", action: "전투 정지",
        onActivate: () => useEvoStore.getState().stop(),
      },
      {
        id: "evo-reset", col: 11, row: 1, kind: "pad", label: "강화 초기화", action: "강화 초기화(되돌려받기)",
        onActivate: () => useEvoStore.getState().refund(),
      },
      {
        id: "evo-resetall", col: 14, row: 1, kind: "pad", label: "전체 초기화", action: "진행도 전체 초기화",
        onActivate: () => useEvoStore.getState().resetAll(),
      },
    ],
  },
  archive: {
    name: "기획 자료실",
    summary: "직접 쓴 기획서와 분석글 모음.",
    tag: "책장을 클릭하거나, 가까이 가서 E를 누르세요.",
    exits: { up: "lobby" },
    controlsExtra: [],
    objects: [{
      id: "archive-shelf", col: 7, row: 4.5, w: 2, kind: "bookshelf", label: "책장",
      // 팝업에서는 고르기만 하고, 문서는 게임창 아래 자료실 페이지에서 넓게 열린다(사용자 요청)
      content: { title: "기획 자료실", lede: "문서를 고르면 게임창 아래에서 넓게 열립니다.", Body: ArchivePicker },
    }],
  },
};

export const ROOM_ORDER: RoomId[] = ["lobby", "pyfactory", "roguelike", "evolution", "archive"];
export const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };
export const DIR_VEC: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

export const isRoomId = (v: string): v is RoomId => Object.hasOwn(ROOMS, v);

/** from 방에서 to 방으로 바로 이어지는 문의 방향. 인접하지 않으면 null. */
export function exitDir(from: RoomId, to: RoomId): Dir | null {
  const exits = ROOMS[from].exits;
  return (Object.keys(exits) as Dir[]).find((d) => exits[d] === to) ?? null;
}

export const OBJECTS_BY_ID: Record<string, RoomObject> = Object.fromEntries(
  ROOM_ORDER.flatMap((id) => ROOMS[id].objects.map((o) => [o.id, o])),
);

// 목록 뷰: 탐험 없이 어느 전시실로든 바로 간다. 방마다 전시가 하나라 방 단위로 보여준다.
export const DESTINATIONS = ROOM_ORDER.map((id) => ({ room: id, label: ROOMS[id].name, lede: ROOMS[id].summary }));
