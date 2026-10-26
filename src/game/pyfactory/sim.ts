import { TILE } from "../constants";
import { OBJECTS_BY_ID } from "../rooms";
import type { DrawKit, Pt, RoomPlugin } from "../plugins";
import type { Light } from "../lighting";
import { readPalette, type Palette } from "../palette";
import {
  MINING_TIME, PROCESS_TIME, PRODUCT_COST, PRODUCT_PRICE, RES_PER_DROP,
  usePyfStore, type MachineId,
} from "./store";

/*
 * py.Factory 체험판의 매 프레임 부분: 기계 타이머, 떨어진 자원·상품, 떠오르는 글자.
 * 화면 문구에 드러나는 값(자원·골드·기계 상태)은 store.ts에 두고 이벤트 때만 바꾼다.
 */

const MACHINE_OBJECT: Record<MachineId, string> = { miner: "pyfactory-miner", productor: "pyfactory-productor" };
const POP_TIME = 0.45;
const PICK_RADIUS = 10;

type Drop = { kind: "res" | "product"; x: number; y: number; fromY: number; t: number };
type Floater = { text: string; x: number; y: number; t: number; color: "jade" | "brass" | "inkDim" };
type Timer = { phase: "mine" | "wait" | "process"; t: number };

const store = usePyfStore;
let drops: Drop[] = [];
let floaters: Floater[] = [];
let timers: Partial<Record<MachineId, Timer>> = {};
let epoch = store.getState().epoch;

function machineBox(id: MachineId) {
  const o = OBJECTS_BY_ID[MACHINE_OBJECT[id]];
  return { x: o.col * TILE, y: o.row * TILE, cx: o.col * TILE + TILE / 2 };
}

function floatText(text: string, x: number, y: number, color: Floater["color"]) {
  floaters.push({ text, x, y, t: 0, color });
}

function spawnDrop(id: MachineId, kind: Drop["kind"]) {
  const b = machineBox(id);
  // 기계 아래 한 칸에 떨어진다. 여러 개가 겹치지 않게 조금씩 흩뿌린다.
  const n = drops.filter((d) => d.kind === kind).length;
  const x = b.cx + ((n % 3) - 1) * 9 + (Math.random() * 4 - 2);
  drops.push({ kind, x, y: b.y + TILE + 10 + Math.floor(n / 3) * 8, fromY: b.y + 6, t: 0 });
  store.getState().dropSpawned(kind);
}

function dropAt(p: Pt) {
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    if (d.t >= POP_TIME && Math.hypot(p.x - d.x, p.y - d.y) < PICK_RADIUS) return i;
  }
  return -1;
}

function update(dt: number) {
  const s = store.getState();
  if (s.epoch !== epoch) {
    epoch = s.epoch;
    drops = [];
    floaters = [];
    timers = {};
  }

  for (const id of ["miner", "productor"] as MachineId[]) {
    const status = store.getState().machines[id].status;
    if (status === "idle") { delete timers[id]; continue; }
    const tm = (timers[id] ??= { phase: id === "miner" ? "mine" : "wait", t: 0 });
    tm.t += dt;

    if (tm.phase === "mine" && tm.t >= MINING_TIME) {
      spawnDrop("miner", "res");
      store.getState().setStatus("miner", "idle"); // 반복문이 없으니 1회 작동 후 정지
    } else if (tm.phase === "wait") {
      // 원본 가공기처럼 자원이 모일 때까지 1초 간격으로 다시 확인
      if (tm.t >= (status === "waiting" ? 1 : 0)) {
        tm.t = 0;
        if (store.getState().consumeRes(PRODUCT_COST)) {
          const b = machineBox("productor");
          floatText(`-${PRODUCT_COST}`, b.cx, b.y - 14, "inkDim");
          tm.phase = "process";
          store.getState().setStatus("productor", "working");
        } else if (status !== "waiting") {
          store.getState().setStatus("productor", "waiting");
        }
      }
    } else if (tm.phase === "process" && tm.t >= PROCESS_TIME) {
      spawnDrop("productor", "product");
      store.getState().setStatus("productor", "idle");
    }
  }

  for (const d of drops) d.t += dt;
  for (const f of floaters) f.t += dt;
  floaters = floaters.filter((f) => f.t < 1.1);
}

function click(p: Pt) {
  const i = dropAt(p);
  if (i < 0) return false;
  const d = drops[i];
  drops.splice(i, 1);
  store.getState().dropCollected(d.kind);
  if (d.kind === "res") floatText(`+${RES_PER_DROP} 자원`, d.x, d.y - 8, "jade");
  else floatText(`+${PRODUCT_PRICE} G`, d.x, d.y - 8, "brass");
  return true;
}

function secondary(objectId: string | null) {
  const id = (Object.keys(MACHINE_OBJECT) as MachineId[]).find((k) => MACHINE_OBJECT[k] === objectId);
  if (!id) return;
  const b = machineBox(id);
  const m = store.getState().machines[id];
  if (!store.getState().restart(id)) floatText("명령어가 없습니다.", b.cx, b.y - 16, "inkDim");
  else floatText(m.status === "idle" ? "재가동" : "작동 중", b.cx, b.y - 16, "jade");
}

function draw({ px, PAL, ctx, now }: DrawKit) {
  const s = store.getState();

  for (const id of ["miner", "productor"] as MachineId[]) {
    const b = machineBox(id);
    const m = s.machines[id];
    // 상태등: 작동 중 옥색 깜빡임 / 자원 대기 황동 / 정지 흐림 (원본의 Running·Stopping·Stopped 아이콘 대신)
    const lamp = m.status === "working" ? (Math.floor(now / 250) % 2 ? PAL.jade : PAL.ink)
      : m.status === "waiting" ? PAL.brass : PAL.wallTop;
    px(b.x + TILE - 6, b.y - 10, 4, 4, PAL.void);
    px(b.x + TILE - 5, b.y - 9, 2, 2, lamp);

    const tm = timers[id];
    if (tm && tm.phase !== "wait") {
      const total = tm.phase === "mine" ? MINING_TIME : PROCESS_TIME;
      px(b.x + 2, b.y + TILE + 1, TILE - 4, 3, PAL.void);
      px(b.x + 2, b.y + TILE + 1, (TILE - 4) * Math.min(1, tm.t / total), 3, PAL.jade);
    }

    if (m.name) {
      ctx.font = "10px Galmuri9, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = PAL.void;
      ctx.fillText(m.name, b.cx + 1, b.y - 13);
      ctx.fillStyle = PAL.ink;
      ctx.fillText(m.name, b.cx, b.y - 14);
    }
  }

  for (const d of drops) {
    const k = Math.min(1, d.t / POP_TIME);
    const y = d.fromY + (d.y - d.fromY) * k - Math.sin(k * Math.PI) * 10; // 튀어나오는 포물선
    const bob = k >= 1 ? Math.round(Math.sin(now / 300 + d.x) * 1) : 0;
    px(d.x - 4, d.y + 3, 8, 2, "rgba(0,0,0,.3)");
    if (d.kind === "res") {
      px(d.x - 3, y - 3 + bob, 7, 6, PAL.inkDim);
      px(d.x - 2, y - 2 + bob, 3, 2, PAL.ink);
    } else {
      px(d.x - 3, y - 4 + bob, 7, 7, PAL.brass);
      px(d.x - 3, y - 1 + bob, 7, 2, PAL.jade);
    }
  }
}

function drawTop({ ctx, PAL }: DrawKit) {
  ctx.font = "10px Galmuri9, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  for (const f of floaters) {
    ctx.globalAlpha = Math.max(0, 1 - f.t / 1.1);
    const y = Math.round(f.y - f.t * 14);
    ctx.fillStyle = PAL.void;
    ctx.fillText(f.text, Math.round(f.x) + 1, y + 1);
    ctx.fillStyle = PAL[f.color];
    ctx.fillText(f.text, Math.round(f.x), y);
  }
  ctx.globalAlpha = 1;
}

// 조명 층 광원: 작동 중 기계는 민트, 자원 대기는 주황 상태등이 번진다. 떨어진 상품은 은은하게
let PALc: Palette | null = null;
function lights(): Light[] {
  const s = store.getState(), P = (PALc ??= readPalette()), out: Light[] = [];
  for (const id of ["miner", "productor"] as MachineId[]) {
    const b = machineBox(id), st = s.machines[id].status;
    if (st === "working") out.push({ x: b.x + TILE - 4, y: b.y - 8, r: 40, color: P.jade, a: 0.7, bloom: true });
    else if (st === "waiting") out.push({ x: b.x + TILE - 4, y: b.y - 8, r: 30, color: P.brass, a: 0.5, bloom: true });
  }
  for (const d of drops) if (d.kind !== "res") out.push({ x: d.x, y: d.y - 2, r: 16, color: P.brass, a: 0.45 });
  return out;
}

export const pyfactoryPlugin: RoomPlugin = {
  lights,
  update,
  draw,
  drawTop,
  click,
  secondary,
  hot: (p) => dropAt(p) >= 0,
};
