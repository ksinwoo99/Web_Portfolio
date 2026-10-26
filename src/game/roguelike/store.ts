import { create } from "zustand";
import { rollChoices, type Choice } from "./items";

/*
 * 로그라이크 한 판의 화면 상태(진행 단계·레벨업 선택지·결과). 체력·적·투사체처럼 매 프레임
 * 바뀌는 값은 game.ts 안에 있고 캔버스 HUD로 그린다.
 */

export type Phase = "idle" | "playing" | "levelup" | "paused" | "over";

const HIGH_SCORE_KEY = "rl-highscore"; // 원본의 SaveGame 슬롯 대신 — 방문자 브라우저에만 남는다

function loadHighScore() {
  try { return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0; } catch { return 0; }
}

// cleared: 1분 생존 데모를 끝까지 버텼는지(사망이면 false)
type Result = { score: number; time: number; level: number; cleared: boolean; newRecord: boolean };

type RlState = {
  phase: Phase;
  runId: number; // 시작할 때마다 증가 — game.ts가 보고 월드를 새로 만든다
  owned: Record<string, number>; // 아이템 id → 보유 레벨
  choices: Choice[];
  selected: number;
  choiceLevel: number;
  highScore: number;
  result: Result | null;

  start: () => void;
  quit: () => void;
  togglePause: () => void;
  offerLevelUp: (level: number) => boolean;
  move: (delta: number) => void;
  select: (i: number) => void;
  choose: (i: number) => void;
  gameOver: (r: Omit<Result, "newRecord">) => void;
};

export const useRlStore = create<RlState>()((set, get) => ({
  phase: "idle",
  runId: 0,
  owned: {},
  choices: [],
  selected: 0,
  choiceLevel: 1,
  highScore: loadHighScore(),
  result: null,

  start: () => set((s) => ({ phase: "playing", runId: s.runId + 1, owned: {}, choices: [], result: null })),
  quit: () => set({ phase: "idle", choices: [] }),
  togglePause: () => {
    const p = get().phase;
    if (p === "playing") set({ phase: "paused" });
    else if (p === "paused") set({ phase: "playing" });
  },

  // 뽑을 선택지가 없으면(전부 만렙) 팝업 없이 넘어간다 — 원본 HandleLevelUp과 같다.
  // 원본의 "5레벨마다 특수 선택지"는 웹판에서 제외(사용자 결정) — 매 레벨 기본 선택지만 나온다.
  offerLevelUp: (level) => {
    const choices = rollChoices(get().owned);
    if (!choices.length) return false;
    set({ phase: "levelup", choices, selected: 0, choiceLevel: level });
    return true;
  },
  move: (delta) => {
    const n = get().choices.length;
    if (n) set((s) => ({ selected: (s.selected + delta + n) % n }));
  },
  select: (i) => { if (i >= 0 && i < get().choices.length) set({ selected: i }); },
  choose: (i) => {
    const c = get().choices[i];
    if (!c || get().phase !== "levelup") return;
    set((s) => ({ owned: { ...s.owned, [c.itemId]: c.level }, choices: [], phase: "playing" }));
  },

  gameOver: (r) => {
    const newRecord = r.score > get().highScore;
    if (newRecord) {
      try { localStorage.setItem(HIGH_SCORE_KEY, String(r.score)); } catch { /* 저장 불가 환경은 무시 */ }
    }
    set((s) => ({ phase: "over", result: { ...r, newRecord }, highScore: Math.max(s.highScore, r.score) }));
  },
}));
