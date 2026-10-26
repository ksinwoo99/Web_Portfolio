import { create } from "zustand";

/*
 * AI 진화 체험판(사용자 기획, 2026-10-26) — 화면에 드러나는 상태만.
 * 왼쪽 화면 패널에서 아군(초록) 10 vs 적(빨강) 10이 자동으로 싸우고, 플레이어는 오른쪽 공간의 강화 버튼으로 아군을 강화한다.
 * - 강화 종류: 공격력 / 방어관통 / 명중률 / 회피율 / 방어력 / 체력. 한 종류 최대 3번, 합계 최대 5번
 * - 적은 랜덤 강화를 갖고 나오고 정보창(EvoHud)에 공개된다
 * - 전투는 자동으로 시작하지 않는다 — 플레이어가 "전투 시작"을 눌러야 한다(사용자 요청, 2026-10-26). "정지"는 진행 중인 전투를 멈추고
 *   대기로, "완전 초기화"는 라운드·시도·패배·강화를 전부 처음으로. 시도 횟수(시작을 누른 수)·패배 횟수를 센다
 * - 한쪽이 전멸하면 결과를 보여 주고 대기로 돌아간다. 이기면 다른 랜덤 강화를 가진 적으로 교체
 * 정해지지 않았던 부분(웹에서 정함 — 사용자 확인 전): 승리하면 아군 강화를 돌려받아 새 적에 맞춰 다시 짠다,
 * 지면 같은 적과 강화 그대로 다시 싸운다, 되돌리기 버튼으로 언제든 강화를 돌려받을 수 있다.
 */

export type UpKey = "atk" | "pen" | "acc" | "eva" | "def" | "hp";
export type Levels = Record<UpKey, number>;

export const UPGRADES: { key: UpKey; name: string; desc: (lv: number) => string }[] = [
  { key: "atk", name: "공격력", desc: (l) => `공격력 +${ATK_PER * l}` },
  { key: "pen", name: "방어관통", desc: (l) => `상대 방어력 ${PEN_PER * l} 무시` },
  { key: "acc", name: "명중률", desc: (l) => `상대 회피율 −${Math.round(ACC_PER * l * 100)}%p` },
  { key: "eva", name: "회피율", desc: (l) => `공격 ${Math.round(EVA_PER * l * 100)}% 회피` },
  { key: "def", name: "방어력", desc: (l) => `받는 피해 −${DEF_PER * l}` },
  { key: "hp", name: "체력", desc: (l) => `체력 +${HP_PER * l}` },
];

// 수치(웹 전용). 기본: 체력 60, 공격력 10
// 상성(사용자 지정, 2026-10-26): 방어력 > 공격력 > 방어관통 > 방어력, 공격력 > 체력 > 방어관통 (왼쪽이 이김)
//  - 공격력은 방어력보다 효율이 나쁘다: 같은 단계면 방어력이 깎는 피해(8) > 공격력이 올리는 피해(5)
//  - 방어력은 방어관통에 진다: 같은 단계면 관통(12)이 방어력(8)을 다 지우고도 남고, 관통 2단계(24)가 방어력 3단계(24)를 다 지운다
//    (2026-10-26 사용자 테스트: 관통 8일 땐 2단계가 방어력 3단계를 못 이겼다)
//  - 공격력은 방어관통보다 강하다: 관통은 상대 방어력이 있을 때만 쓸모, 공격력은 언제나 피해 +5
//  - 체력은 공격력에 약하다: 같은 단계면 공격력이 늘어난 체력보다 빨리 깎는다. 쓰러뜨리는 데 드는 타격 수(올림)가
//    기본 6번 → (60+15L)/(10+5L) = 5·5·5번. 체력 20이었을 땐 1단계끼리 6번 대 6번으로 비겨서 15로 낮췄다(2026-10-26)
//  - 체력은 방어관통에 강하다: 관통은 체력을 못 깎는다(방어력만 지운다)
//  - 명중률은 회피율보다 좋다: 같은 단계면 명중률(25%p)이 회피율(15%)을 다 지우고, 명중 2단계(50)가 회피 3단계(45)를 다 지운다.
//    대신 상대 회피율만 깎으므로 상대가 회피율이 없으면 아무 효과가 없다(사용자 지정)
// 피해 = max(1, 공격력 − max(0, 상대 방어력 − 내 방어관통)). 회피 확률 = max(0, 상대 회피율 − 내 명중률)
export const BASE_HP = 60, BASE_ATK = 10;
// 상성 효율을 키운 값(2026-10-26): 적 조합 전부에 대해 아군 최선 조합을 계산해 보니(공격 횟수 비교 모델)
// 1라운드 적 조합의 97%에 1.3배 이상 우세한 조합이 있고, 한 가지 조합으로 다 이기는 비율은 68%로 줄었다(상성을 봐야 이김).
// 강화를 고르게 나눈 적(예: 공격 2·관통 1·회피 1·체력 1)은 최선이어도 1.1배 안팎이라 빠듯하다
export const ATK_PER = 5, PEN_PER = 12, EVA_PER = 0.15, ACC_PER = 0.25, DEF_PER = 8, HP_PER = 15;
/** 정보창·방 소개에 쓰는 상성 한 줄 */
export const COUNTER_TEXT = ["방어력 ▶ 공격력 ▶ 방어관통 ▶ 방어력", "공격력 ▶ 체력 ▶ 방어관통", "명중률 ▶ 회피율"];
export const MAX_PER = 3;
/** 마지막 라운드(사용자 지정, 2026-10-26 — 5에서 3으로 줄임). 적 강화 5 · 6 · 7개 */
export const FINAL_ROUND = 3;
const enemyBudget = (round: number) => Math.min(4 + round, 7);
/**
 * 아군 강화 합계 한도 = 적 강화 수 − 1, 마지막 라운드는 − 2(사용자 지정, 2026-10-26).
 * 늘 적보다 적게 갖고 상성으로 이겨야 한다. 라운드별 적/아군: 5/4 · 6/5 · 7/5(마지막).
 * 처음부터 넉넉하게 시작(사용자 요청) — 적이 3개뿐이면 한 종류에 몰았을 때 상성으로 지워도 기본 능력치끼리 동점 싸움이 된다
 */
export const allyLimit = (round: number) => enemyBudget(round) - (round >= FINAL_ROUND ? 2 : 1);
export const UNITS_PER_SIDE = 10;

const ZERO: Levels = { atk: 0, pen: 0, acc: 0, eva: 0, def: 0, hp: 0 };
export const total = (l: Levels) => l.atk + l.pen + l.acc + l.eva + l.def + l.hp;

/** 라운드가 오를수록 적 강화 개수가 늘어난다(3개에서 시작, 최대 7개). 종류는 랜덤, 한 종류 최대 3 */
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
    const s = get(), name = UPGRADES.find((u) => u.key === k)!.name;
    const fail = s.phase === "cleared" ? "모든 라운드 클리어"
      : s.ally[k] >= MAX_PER ? `${name}은 최대 ${MAX_PER}번`
      : total(s.ally) >= allyLimit(s.round) ? `이번 라운드는 ${allyLimit(s.round)}번까지` : "";
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
