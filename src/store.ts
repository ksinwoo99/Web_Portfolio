import { create } from "zustand";
import { OBJECTS_BY_ID, exitDir, isRoomId, type Dir, type RoomId } from "./game/rooms";

/*
 * 화면(HUD·패널·목록·방 페이지)에 드러나는 게임 상태만 여기에 둔다.
 * 플레이어 좌표처럼 매 프레임 바뀌는 값은 엔진 내부에 두고 리렌더를 일으키지 않는다.
 */

export function roomFromHash(hash: string): RoomId | null {
  const m = hash.match(/^#\/room\/(\w+)/);
  return m && isRoomId(m[1]) ? m[1] : null;
}

type GameState = {
  room: RoomId;
  // 직전 방 이동의 방향. 이웃한 방으로 옮겼을 때만 값이 있고, 게임창·방 페이지·배경이
  // 모두 이 방향으로 "카메라가 이동하는" 연출을 한다. 목록 뷰로 먼 방에 가면 null.
  moveDir: Dir | null;
  nearObjectId: string | null;
  /** 방 플러그인이 E로 할 일(예: py.Factory 자원 줍기). 있으면 조작 배지 E 설명이 이걸로 바뀐다 */
  nearHint: string | null;
  openObjectId: string | null;
  listOpen: boolean;

  enterRoom: (room: RoomId) => void;
  setNearObject: (id: string | null) => void;
  setNearHint: (hint: string | null) => void;
  interact: () => void;
  /** Q: 가까운 오브젝트의 보조 동작(onAlt — 예: AI 진화 방 강화 1 빼기) */
  interactAlt: () => void;
  openObject: (id: string) => void;
  openList: () => void;
  closeSheets: () => void;
};

export const isLocked = (s: Pick<GameState, "openObjectId" | "listOpen">) =>
  s.openObjectId !== null || s.listOpen;

export const useGameStore = create<GameState>()((set, get) => ({
  room: roomFromHash(location.hash) ?? "lobby",
  moveDir: null,
  nearObjectId: null,
  nearHint: null,
  openObjectId: null,
  listOpen: false,

  enterRoom: (room) => {
    const cur = get().room;
    if (room === cur) return;
    set({ room, moveDir: exitDir(cur, room), nearObjectId: null, nearHint: null });
  },
  setNearObject: (id) => {
    if (get().nearObjectId !== id) set({ nearObjectId: id });
  },
  setNearHint: (hint) => {
    if (get().nearHint !== hint) set({ nearHint: hint });
  },
  interact: () => {
    const s = get();
    if (isLocked(s) || !s.nearObjectId) return;
    s.openObject(s.nearObjectId);
  },
  interactAlt: () => {
    const s = get();
    if (isLocked(s) || !s.nearObjectId) return;
    OBJECTS_BY_ID[s.nearObjectId]?.onAlt?.();
  },
  openObject: (id) => {
    const o = OBJECTS_BY_ID[id];
    if (o?.onActivate) { set({ listOpen: false }); o.onActivate(); return; }
    set({ openObjectId: id, listOpen: false });
  },
  openList: () => set({ listOpen: true }),
  closeSheets: () => set({ openObjectId: null, listOpen: false }),
}));
