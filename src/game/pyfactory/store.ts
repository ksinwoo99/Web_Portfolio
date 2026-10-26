import { create } from "zustand";
import { validateCode } from "./validate";

/*
 * py.Factory 간소화 체험판의 화면 상태(자원·골드·기계 코드·코딩창).
 * 원본: graduation_work/.../Ingame_UI_Tutorial.cs 의 채굴기·가공기 구간(0~40단계)을
 * 조건문·반복문·설치 모드 없이 줄였다. 매 프레임 타이머·떨어진 아이템은 sim.ts에 있다.
 */

export type MachineId = "miner" | "productor";
export type MachineStatus = "idle" | "working" | "waiting";

// 원본 프리팹 값: 채굴 덩어리 20, A상품 소모 100·판매 100. 시간은 웹 체험용으로 5초 → 3초로 줄임.
export const RES_PER_DROP = 20;
export const PRODUCT_COST = 100;
export const PRODUCT_PRICE = 100;
export const START_RES = 60; // 채굴을 두 번 하면 가공 가능 — "1회 실행 후 정지 → 재가동"을 한 번 겪게 하려는 값
export const MINING_TIME = 3;
export const PROCESS_TIME = 3;

export const MACHINE_INFO: Record<MachineId, { title: string; syntax: string; desc: string; preset: string }> = {
  miner: {
    title: "채굴기",
    syntax: "mining(Common)",
    desc: "일반 자원을 채굴합니다. 반복문이 없으면 1회 작동 후 멈춥니다.",
    preset: 'name = "기본 채굴기"\nmining(Common)',
  },
  productor: {
    title: "가공기",
    syntax: "producting(Common, 'A')",
    desc: `일반 자원 ${PRODUCT_COST}개로 A상품을 만듭니다. 자원이 모자라면 모일 때까지 기다립니다.`,
    preset: "name = \"기본 가공기\"\nproducting(Common, 'A')",
  },
};

type Machine = { code: string; name: string | null; valid: boolean; status: MachineStatus };

type PyfState = {
  machines: Record<MachineId, Machine>;
  res: number;
  gold: number;
  collected: number;
  sold: number;
  resDrops: number;
  productDrops: number;
  codingOpen: MachineId | null;
  result: { ok: boolean; text: string } | null;
  epoch: number; // 처음부터 다시 할 때 증가 — sim.ts가 보고 떨어진 아이템·타이머를 비운다

  openCoding: (id: MachineId) => void;
  closeCoding: () => void;
  setCode: (id: MachineId, code: string) => void;
  run: (id: MachineId) => void;
  restart: (id: MachineId) => boolean;
  setStatus: (id: MachineId, status: MachineStatus) => void;
  consumeRes: (n: number) => boolean;
  dropSpawned: (kind: "res" | "product") => void;
  dropCollected: (kind: "res" | "product") => void;
  reset: () => void;
};

const initial = () => ({
  machines: {
    miner: { code: "", name: null, valid: false, status: "idle" as MachineStatus },
    productor: { code: "", name: null, valid: false, status: "idle" as MachineStatus },
  },
  res: START_RES,
  gold: 0,
  collected: 0,
  sold: 0,
  resDrops: 0,
  productDrops: 0,
  codingOpen: null,
  result: null,
});

export const usePyfStore = create<PyfState>()((set, get) => {
  const patchMachine = (id: MachineId, patch: Partial<Machine>) =>
    set((s) => ({ machines: { ...s.machines, [id]: { ...s.machines[id], ...patch } } }));

  return {
    ...initial(),
    epoch: 0,

    openCoding: (id) => set({ codingOpen: id, result: null }),
    closeCoding: () => set({ codingOpen: null, result: null }),
    setCode: (id, code) => patchMachine(id, { code }),

    // 원본의 "저장 및 디버깅(F5)": 검사 통과하면 이름을 반영하고 1회 작동시킨다.
    run: (id) => {
      const m = get().machines[id];
      const r = validateCode(id, m.code);
      if (!r.ok) {
        patchMachine(id, { valid: false });
        set({ result: { ok: false, text: r.message } });
        return;
      }
      const busy = m.status !== "idle";
      patchMachine(id, { valid: true, name: r.name ?? m.name, status: busy ? m.status : "working" });
      set({
        result: {
          ok: true,
          text: busy ? "저장 완료! 지금 작동이 끝나면 새 코드로 다시 실행하세요." : `저장 및 디버깅 완료! ${MACHINE_INFO[id].title}가 작동합니다.`,
        },
      });
    },

    // 원본의 "설치물 우클릭 → 재가동". 검사를 통과한 코드가 없으면 false.
    restart: (id) => {
      const m = get().machines[id];
      if (!m.valid) return false;
      if (m.status === "idle") patchMachine(id, { status: "working" });
      return true;
    },

    setStatus: (id, status) => patchMachine(id, { status }),
    consumeRes: (n) => {
      if (get().res < n) return false;
      set((s) => ({ res: s.res - n }));
      return true;
    },
    dropSpawned: (kind) => set((s) => (kind === "res" ? { resDrops: s.resDrops + 1 } : { productDrops: s.productDrops + 1 })),
    dropCollected: (kind) =>
      set((s) =>
        kind === "res"
          ? { resDrops: s.resDrops - 1, res: s.res + RES_PER_DROP, collected: s.collected + 1 }
          : { productDrops: s.productDrops - 1, gold: s.gold + PRODUCT_PRICE, sold: s.sold + 1 },
      ),
    reset: () => set((s) => ({ ...initial(), epoch: s.epoch + 1 })),
  };
});

/** 어시스턴트 말풍선. 진행 단계를 따로 저장하지 않고 현재 상태에서 바로 정한다. */
export function assistantLine(s: PyfState): string {
  const { miner, productor } = s.machines;
  if (s.sold > 0)
    return "첫 수익이에요, 축하합니다! 실제 게임에서는 조건문·반복문·수송 벨트로 이 과정을 전부 자동화해 나갑니다.";
  if (s.productDrops > 0) return "상품이 나왔어요! 마우스로 직접 클릭해서 판매해 보세요.";
  if (productor.status === "waiting") return `자원이 모자라요. 가공기는 일반 자원 ${PRODUCT_COST}개가 모일 때까지 기다립니다. 채굴기를 다시 돌려 주세요.`;
  if (productor.status === "working") return `가공기가 자원 ${PRODUCT_COST}개를 가져가서 상품을 만드는 중이에요.`;
  if (s.resDrops > 0) return "채굴기가 자원을 캐냈어요! 떨어진 자원을 마우스로 직접 클릭해서 획득하세요.";
  if (miner.status === "working") return "채굴기가 코드대로 작동 중이에요. 잠시 기다려 볼까요?";
  if (s.res >= PRODUCT_COST || productor.valid)
    return "자원이 충분해요! 이번엔 가공기를 열어 producting(Common, 'A')를 적고 실행(F5)해 보세요.";
  if (s.collected > 0)
    return "그런데 채굴기가 멈췄죠? 반복문이 없는 '단순 코드형'이라 1회 채굴 후 정지했어요. 채굴기를 우클릭하거나 코딩창에서 다시 실행(F5)해 보세요.";
  if (s.codingOpen === "miner")
    return '코딩창에 mining(Common)을 적고 실행(F5)하세요. name = "이름"으로 채굴기 이름도 지을 수 있어요.';
  return "안녕하세요, py.Factory 어시스트입니다! 목표는 '설치물의 코딩과 공장의 자동화'예요. 먼저 채굴기를 클릭하거나, 가까이 가서 E를 눌러 보세요.";
}
