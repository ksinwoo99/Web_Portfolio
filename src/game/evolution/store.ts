import { create } from "zustand";

/*
 * AI 진화 체험판(사용자 기획, 2026-10-26~27) — 화면에 드러나는 상태만.
 * 왼쪽 화면 패널에서 아군(초록) 15 vs 적(빨강) 15가 자동으로 싸우고, 플레이어는 오른쪽 공간의 강화 버튼으로 아군을 강화한다.
 * - 강화 7종: 공격(공격력·방어관통) / 방어(방어력·체력) / 명중(회피율·스플래시·명중률). 한 종류 최대 3번
 * - 라운드 4개: 강화 수 아군/적 5/5 · 6/6 · 7/7, 마지막만 7/8(사용자 지정, 2026-10-27)
 * - 전투는 플레이어가 "전투 시작"을 눌러야 시작. 한쪽이 전멸하면 결과를 보여 주고 대기로. 이기면 다른 랜덤 강화를 가진 적으로 교체
 * 정해지지 않았던 부분(웹에서 정함 — 사용자 확인됨 2026-10-26): 이기면 아군 강화를 돌려받아 새 적에 맞춰 다시 짠다,
 * 지면 같은 적과 강화 그대로 다시 싸운다, 강화 초기화 버튼으로 언제든 강화를 돌려받을 수 있다.
 */

export type UpKey = "atk" | "pen" | "def" | "hp" | "eva" | "spl" | "acc";
export type Levels = Record<UpKey, number>;

/*
 * 상성(사용자 지정, 2026-10-27): 방어력 ▶ 공격력 ▶ 체력 ▶ 방어관통 ▶ 방어력, 회피율 ▶ 스플래시 ▶ 명중률 ▶ 회피율 (▶ 쪽을 이김).
 * 효율은 "유리 1.5 : 불리 1" — 이기는 강화 1단계가 상대의 지는 강화 1.5단계를 무력화한다(`effLevels`).
 * 그 위에 강화마다 상성과 별개인 기본 효과가 있다(아래 수치). 이 방식으로 계산해 보니(공격 속도·피해·체력으로 쓰러뜨리는 속도 비교)
 * 같은 단계 상성 9쌍은 이기는 쪽이 1.18~2.1배, 상성 없는 쌍은 0.9~1.1배, 관통 2단계가 방어력 3단계를 1.6배로 이긴다.
 * (처음엔 피해·체력에 그대로 더하고 빼는 방식이었는데, 방어력이 기본 피해까지 깎아 상성과 무관하게 너무 셌고
 *  회피율이 스플래시를 못 이겨서 바꿨다)
 */
export const BEATS: Record<UpKey, UpKey> = {
  def: "atk", atk: "hp", hp: "pen", pen: "def",
  eva: "spl", spl: "acc", acc: "eva",
};
export const COUNTER_RATIO = 1.5;

// 기본 효과(웹 전용 수치). 기본 체력 120 · 공격력 20
export const BASE_HP = 120, BASE_ATK = 20;
export const ATK_PER = 6;       // 피해 +6
export const PEN_PER = 6;       // 관통 피해 +6
export const DEF_PER = 0.15;    // 받는 피해 −15%(최소 25%까지)
export const HP_PER = 30;       // 체력 +30
export const EVA_PER = 0.15;    // 공격 15% 회피(최대 90%)
// 맞힌 적에게서 가장 가까운 다른 적 1명에게 피해의 30% 추가 공격(사용자 지정, 2026-10-27 — 처음엔 반경 안 전부라 몰려 있으면 너무 셌다).
// 30%면 같은 단계 공격력과 맞먹는다(계산 1.0배)
export const SPL_PER = 0.3;
export const SPL_EVA_MULT = 2;  // 스플래시는 회피율에 더 크게 영향받는다 — 주변 피해는 상대 회피율의 2배 확률로 빗나감(사용자 지정)
export const ACC_PER = 0.25;    // 25% 확률로 약점 명중(피해 2배)

export const UPGRADES: { key: UpKey; name: string; group: "공격" | "방어" | "명중"; desc: (lv: number) => string }[] = [
  { key: "atk", name: "공격력", group: "공격", desc: (l) => `피해 +${ATK_PER * l}` },
  { key: "pen", name: "방어관통", group: "공격", desc: (l) => `관통 피해 +${PEN_PER * l}` },
  { key: "def", name: "방어력", group: "방어", desc: (l) => `받는 피해 −${Math.round(DEF_PER * l * 100)}%` },
  { key: "hp", name: "체력", group: "방어", desc: (l) => `체력 +${HP_PER * l}` },
  { key: "eva", name: "회피율", group: "명중", desc: (l) => `공격 ${Math.round(EVA_PER * l * 100)}% 회피` },
  { key: "spl", name: "스플래시", group: "명중", desc: (l) => `가장 가까운 다른 적 1명에게 피해 ${Math.round(SPL_PER * l * 100)}%` },
  { key: "acc", name: "명중률", group: "명중", desc: (l) => `${Math.round(ACC_PER * l * 100)}% 확률 약점 명중(피해 2배)` },
];
/** 버튼·표·정보창 묶음(사용자 지정, 2026-10-27): 공격 / 방어 / 명중 */
export const GROUPS: { name: string; keys: UpKey[] }[] = [
  { name: "공격", keys: ["atk", "pen"] },
  { name: "방어", keys: ["def", "hp"] },
  { name: "명중", keys: ["eva", "spl", "acc"] },
];
export const NAME: Record<UpKey, string> = Object.fromEntries(UPGRADES.map((u) => [u.key, u.name])) as Record<UpKey, string>;

/** 상성 적용 후 단계: 내 강화 Y의 단계에서, 상대가 가진 "Y를 이기는 강화" 단계 × 1.5를 뺀다 */
export function effLevels(me: Levels, op: Levels): Levels {
  const e = { ...me };
  for (const w of Object.keys(BEATS) as UpKey[]) {
    const l = BEATS[w];
    e[l] = Math.max(0, me[l] - COUNTER_RATIO * op[w]);
  }
  return e;
}

/** 정보창·방 소개에 쓰는 상성 */
export const COUNTER_TEXT = ["방어력 ▶ 공격력 ▶ 체력 ▶ 방어관통 ▶ 방어력", "회피율 ▶ 스플래시 ▶ 명중률 ▶ 회피율"];
export const MAX_PER = 3;
/** 마지막 라운드(사용자 지정, 2026-10-27). 강화 수 아군/적 5/5 · 6/6 · 7/7 · 7/8 */
export const FINAL_ROUND = 4;
const enemyBudget = (round: number) => [5, 6, 7, 8][Math.min(round, FINAL_ROUND) - 1];
/** 아군 강화 합계 한도: 적과 같게, 마지막 라운드만 적보다 1개 적게 */
export const allyLimit = (round: number) => [5, 6, 7, 7][Math.min(round, FINAL_ROUND) - 1];
export const UNITS_PER_SIDE = 15; // 사용자 지정(2026-10-27, 처음엔 10)

const ZERO: Levels = { atk: 0, pen: 0, def: 0, hp: 0, eva: 0, spl: 0, acc: 0 };
export const total = (l: Levels) => (Object.values(l) as number[]).reduce((a, b) => a + b, 0);

/** 라운드별 적 강화 개수만큼 랜덤 배분(한 종류 최대 3) */
function rollEnemy(round: number): Levels {
  const l = { ...ZERO };
  let budget = enemyBudget(round);
  while (budget > 0) {
    const open = (Object.keys(l) as UpKey[]).filter((k) => l[k] < MAX_PER);
    l[open[Math.floor(Math.random() * open.length)]]++;
    budget--;
  }
  return l;
}

export type PadKey = UpKey | "reset" | "start" | "stop" | "resetAll";
type Press = { seq: number; key: PadKey; msg: string; ok: boolean };
/** ready 대기(배치만, 싸우지 않음) → fight 전투 → result 승패 표시 → ready. 마지막 라운드를 이기면 cleared(완전 초기화로만 다시) */
export type Phase = "ready" | "fight" | "result" | "cleared";

type EvoState = {
  round: number;
  attempts: number;
  losses: number;
  phase: Phase;
  /** 바뀔 때마다 화면 패널의 유닛을 처음 배치로 되돌린다(정지·결과 후·초기화) */
  formation: number;
  enemy: Levels;
  ally: Levels;
  alive: { ally: number; enemy: number };
  result: "win" | "lose" | null;
  press: Press;
  upgrade: (k: UpKey) => void;
  refund: () => void;
  setAlive: (ally: number, enemy: number) => void;
  endBattle: (win: boolean) => void;
  nextBattle: () => void;
  start: () => void;
  stop: () => void;
  resetAll: () => void;
};

const say = (s: EvoState, key: PadKey, msg: string, ok: boolean): Pick<EvoState, "press"> =>
  ({ press: { seq: s.press.seq + 1, key, msg, ok } });

export const useEvoStore = create<EvoState>()((set, get) => ({
  round: 1,
  attempts: 0,
  losses: 0,
  phase: "ready",
  formation: 0,
  enemy: rollEnemy(1),
  ally: { ...ZERO },
  alive: { ally: UNITS_PER_SIDE, enemy: UNITS_PER_SIDE },
  result: null,
  press: { seq: 0, key: "atk", msg: "", ok: true },

  upgrade: (k) => {
    const s = get(), name = NAME[k];
    const fail = s.phase === "cleared" ? "모든 라운드 클리어"
      : s.ally[k] >= MAX_PER ? `${name}은 최대 ${MAX_PER}번`
      : total(s.ally) >= allyLimit(s.round) ? "진화 포인트가 없어요" : "";
    if (fail) { set({ press: { seq: s.press.seq + 1, key: k, msg: fail, ok: false } }); return; }
    set({ ally: { ...s.ally, [k]: s.ally[k] + 1 }, press: { seq: s.press.seq + 1, key: k, msg: `+${name}`, ok: true } });
  },
  refund: () => {
    const s = get();
    set({ ally: { ...ZERO }, press: { seq: s.press.seq + 1, key: "reset", msg: total(s.ally) ? "강화 초기화" : "초기화할 강화 없음", ok: total(s.ally) > 0 } });
  },
  setAlive: (ally, enemy) => {
    const a = get().alive;
    if (a.ally !== ally || a.enemy !== enemy) set({ alive: { ally, enemy } });
  },
  endBattle: (win) => set((s) => ({ phase: "result", result: win ? "win" : "lose", losses: s.losses + (win ? 0 : 1) })),
  // 결과 표시가 끝나면 대기로. 이기면 새 적·강화 환불, 지면 같은 적·강화 그대로
  nextBattle: () => {
    const s = get();
    const base = { phase: "ready" as const, result: null, formation: s.formation + 1 };
    if (s.result === "win" && s.round >= FINAL_ROUND) set({ ...base, phase: "cleared" });
    else if (s.result === "win") set({ ...base, round: s.round + 1, enemy: rollEnemy(s.round + 1), ally: { ...ZERO } });
    else set(base);
  },
  start: () => {
    const s = get();
    if (s.phase === "fight") { set(say(s, "start", "이미 전투 중", false)); return; }
    if (s.phase === "result") return;
    if (s.phase === "cleared") { set(say(s, "start", "전체 초기화로 다시", false)); return; }
    set({ phase: "fight", attempts: s.attempts + 1, ...say(s, "start", "전투 시작!", true) });
  },
  stop: () => {
    const s = get();
    if (s.phase !== "fight") { set(say(s, "stop", "진행 중인 전투 없음", false)); return; }
    set({ phase: "ready", formation: s.formation + 1, ...say(s, "stop", "전투 정지", true) });
  },
  resetAll: () => {
    const s = get();
    set({
      round: 1, attempts: 0, losses: 0, phase: "ready", result: null, formation: s.formation + 1,
      enemy: rollEnemy(1), ally: { ...ZERO }, ...say(s, "resetAll", "처음부터 다시", true),
    });
  },
}));
