import { PANEL_RECTS, panelScreen } from "../maps";
import { OBJECTS_BY_ID } from "../rooms";
import { TILE } from "../constants";
import type { DrawKit, RoomPlugin } from "../plugins";
import type { Light } from "../lighting";
import { readPalette, type Palette } from "../palette";
import {
  ACC_PER, ATK_PER, BASE_ATK, BASE_HP, DEF_PER, EVA_PER, HP_PER, MAX_PER, PEN_PER, UNITS_PER_SIDE, UPGRADES,
  FINAL_ROUND, useEvoStore, type Levels, type PadKey, type UpKey,
} from "./store";

/*
 * AI 진화 체험판의 매 프레임 부분: 왼쪽 화면 패널 안의 자동 전투 + 오른쪽 강화 버튼 그림.
 * 점 하나가 유닛 하나. 가장 가까운 적에게 다가가 사거리 안이면 공격한다.
 * 피해 = max(1, 공격력 − max(0, 상대 방어력 − 내 방어관통)), 맞기 전에 회피 확률을 굴린다.
 */

const store = useEvoStore;
const SCREEN = panelScreen(PANEL_RECTS.evolution!);
const TOP = 48;            // 화면 위쪽 머리글 높이(라운드·남은 수 + 적 강화 표 3줄)
const RANGE = 7, SPEED = 24, SEP = 5;
const ATTACK_CD = 0.9;
const RESULT_S = 2.2;      // 승패 표시 후 다음 판까지

// 오른쪽 공간 버튼 ↔ 동작(강화 6종 · 강화 초기화 · 전투 시작 · 정지 · 전체 초기화)
export const PAD_KEY: Record<string, PadKey> = {
  "evo-atk": "atk", "evo-pen": "pen", "evo-acc": "acc", "evo-eva": "eva", "evo-def": "def", "evo-hp": "hp", "evo-reset": "reset",
  "evo-start": "start", "evo-stop": "stop", "evo-resetall": "resetAll",
};
const isUpgrade = (k: PadKey): k is UpKey => k in { atk: 1, pen: 1, acc: 1, eva: 1, def: 1, hp: 1 };

type Unit = {
  x: number; y: number; hp: number; maxHp: number; team: 0 | 1;   // 0 아군(초록) / 1 적(빨강)
  cd: number; flash: number;
  shot: { x: number; y: number; t: number } | null;
};
type Spark = { x: number; y: number; vx: number; vy: number; t: number; team: 0 | 1 };
type Floater = { x: number; y: number; t: number; text: string; ok: boolean };
type Miss = { x: number; y: number; t: number; team: 0 | 1 };

let units: Unit[] = [];
let sparks: Spark[] = [];
let floaters: Floater[] = [];
let misses: Miss[] = [];
let allyHpLv = store.getState().ally.hp; // 체력 강화가 바뀌면 살아 있는 아군에 바로 반영
let resultT = 0;
let pressSeq = store.getState().press.seq;
let formation = store.getState().formation;

function spawn() {
  units = [];
  sparks = [];
  misses = [];
  const s = store.getState();
  allyHpLv = s.ally.hp;
  const cols = 5, gap = SCREEN.w / (cols + 1);
  for (let team = 0 as 0 | 1; team <= 1; team++)
    for (let i = 0; i < UNITS_PER_SIDE; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      const y = team === 0 ? SCREEN.y + SCREEN.h - 10 - r * 9 : SCREEN.y + TOP + 8 + r * 9;
      // 줄 맞춰 세우되 조금씩 흩뜨린다 — 똑같이 서면 1대1 결투 다섯 줄로만 보인다
      const jx = (Math.random() - 0.5) * gap * 0.8, jy = (Math.random() - 0.5) * 8;
      const maxHp = BASE_HP + HP_PER * (team === 0 ? s.ally.hp : s.enemy.hp);
      units.push({ x: SCREEN.x + gap * (c + 1) + (r % 2 ? gap / 2 : 0) + jx, y: y + jy, hp: maxHp, maxHp, team, cd: Math.random() * ATTACK_CD, flash: 0, shot: null });
    }
  store.getState().setAlive(UNITS_PER_SIDE, UNITS_PER_SIDE);
}
spawn();

function stats(l: Levels) {
  return { atk: BASE_ATK + ATK_PER * l.atk, pen: PEN_PER * l.pen, acc: ACC_PER * l.acc, eva: EVA_PER * l.eva, def: DEF_PER * l.def };
}

function padCenter(id: string) {
  const o = OBJECTS_BY_ID[id];
  return { x: (o.col + (o.w ?? 1) / 2) * TILE, y: o.row * TILE };
}

function update(dt: number) {
  const s = store.getState();

  // 강화 버튼을 눌렀으면 그 버튼 위에 결과 글자
  if (s.press.seq !== pressSeq) {
    pressSeq = s.press.seq;
    const id = Object.keys(PAD_KEY).find((k) => PAD_KEY[k] === s.press.key)!;
    const c = padCenter(id);
    floaters.push({ x: c.x, y: c.y - 14, t: 0, text: s.press.msg, ok: s.press.ok });
  }
  for (const f of floaters) f.t += dt;
  floaters = floaters.filter((f) => f.t < 1.2);
  for (const p of sparks) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  sparks = sparks.filter((p) => p.t < 0.4);
  for (const m of misses) m.t += dt;
  misses = misses.filter((m) => m.t < 0.7);

  // 체력 강화(또는 되돌리기)는 싸우는 중인 아군에 바로: 최대 체력과 현재 체력을 같은 만큼 올리고 내린다
  if (s.ally.hp !== allyHpLv) {
    const d = (s.ally.hp - allyHpLv) * HP_PER;
    allyHpLv = s.ally.hp;
    for (const u of units) if (u.team === 0 && u.hp > 0) { u.maxHp += d; u.hp = Math.max(1, u.hp + d); }
  }

  // 정지·결과 후·초기화 → 처음 배치로
  if (s.formation !== formation) { formation = s.formation; spawn(); return; }
  if (s.phase === "result") {
    if ((resultT -= dt) <= 0) s.nextBattle();
    return;
  }
  if (s.phase !== "fight") return; // 대기: 배치만 해 두고 싸우지 않는다

  const st = [stats(s.ally), stats(s.enemy)];
  for (const u of units) {
    u.flash = Math.max(0, u.flash - dt);
    if (u.shot && (u.shot.t -= dt) <= 0) u.shot = null;
    if (u.hp <= 0) continue;

    let tgt: Unit | null = null, best = Infinity;
    for (const o of units) {
      if (o.team === u.team || o.hp <= 0) continue;
      const d = Math.hypot(o.x - u.x, o.y - u.y);
      if (d < best) { best = d; tgt = o; }
    }
    if (!tgt) continue;

    if (best > RANGE) {
      u.x += ((tgt.x - u.x) / best) * SPEED * dt;
      u.y += ((tgt.y - u.y) / best) * SPEED * dt;
    } else if ((u.cd -= dt) <= 0) {
      u.cd = ATTACK_CD + Math.random() * 0.3;
      u.shot = { x: tgt.x, y: tgt.y, t: 0.09 };
      const me = st[u.team], them = st[tgt.team];
      if (Math.random() < Math.max(0, them.eva - me.acc)) { // 명중률은 상대 회피율만 깎는다
        misses.push({ x: tgt.x, y: tgt.y - 4, t: 0, team: tgt.team });
      } else {
        tgt.hp -= Math.max(1, me.atk - Math.max(0, them.def - me.pen));
        tgt.flash = 0.12;
        if (tgt.hp <= 0) {
          for (let i = 0; i < 6; i++) {
            const a = Math.random() * Math.PI * 2, v = 10 + Math.random() * 20;
            sparks.push({ x: tgt.x, y: tgt.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, team: tgt.team });
          }
        }
      }
    }
    // 같은 편끼리 겹치지 않게 살짝 밀어내고, 화면 밖으로 못 나가게
    for (const o of units) {
      if (o === u || o.team !== u.team || o.hp <= 0) continue;
      const dx = u.x - o.x, dy = u.y - o.y, d = Math.hypot(dx, dy);
      if (d > 0 && d < SEP) { u.x += (dx / d) * (SEP - d) * 0.5; u.y += (dy / d) * (SEP - d) * 0.5; }
    }
    u.x = Math.min(SCREEN.x + SCREEN.w - 3, Math.max(SCREEN.x + 3, u.x));
    u.y = Math.min(SCREEN.y + SCREEN.h - 3, Math.max(SCREEN.y + TOP + 3, u.y));
  }

  const ally = units.filter((u) => u.team === 0 && u.hp > 0).length;
  const enemy = units.filter((u) => u.team === 1 && u.hp > 0).length;
  s.setAlive(ally, enemy);
  if (!ally || !enemy) {
    s.endBattle(enemy === 0);
    resultT = RESULT_S;
  }
}

/* ---------- 그리기 ---------- */

// 강화 버튼 화면에 띄우는 5×5 아이콘
const ICONS: Record<PadKey, string[]> = {
  atk: ["....#", "...#.", "#.#..", ".#...", "#.#.."],   // 칼
  pen: ["..#..", "...#.", "#####", "...#.", "..#.."],   // 화살표
  eva: ["###..", ".....", ".####", ".....", "###.."],   // 바람
  def: ["#####", "#...#", "#...#", ".#.#.", "..#.."],   // 방패
  hp: [".#.#.", "#####", "#####", ".###.", "..#.."],    // 하트
  acc: ["..#..", "..#..", "##.##", "..#..", "..#.."],   // 조준
  reset: [".###.", "#...#", "#.#..", "#..#.", ".##.."], // 되돌리기
  start: ["#....", "###..", "#####", "###..", "#...."], // 재생
  stop: ["#####", "#####", "#####", "#####", "#####"],  // 정지
  resetAll: ["#...#", ".#.#.", "..#..", ".#.#.", "#...#"], // 초기화
};

function draw({ px, PAL }: DrawKit) {
  const s = store.getState();
  const team = (t: 0 | 1) => (t === 0 ? PAL.unitAlly : PAL.unitEnemy);

  // 화면 안: 유닛 · 사격선 · 파편
  for (const u of units) {
    if (!u.shot || u.hp <= 0) continue;
    const n = Math.ceil(Math.hypot(u.shot.x - u.x, u.shot.y - u.y));
    for (let i = 1; i < n; i += 2) px(u.x + ((u.shot.x - u.x) * i) / n, u.y + ((u.shot.y - u.y) * i) / n, 1, 1, team(u.team));
  }
  for (const u of units) {
    if (u.hp <= 0) continue;
    const x = Math.round(u.x), y = Math.round(u.y);
    px(x - 2, y - 2, 5, 5, PAL.outline);
    px(x - 1, y - 1, 3, 3, u.flash > 0 ? PAL.ink : team(u.team));
    px(x - 1, y - 1, 1, 1, PAL.ink);
    if (u.hp < u.maxHp) px(x - 2, y - 4, Math.max(1, Math.round((5 * u.hp) / u.maxHp)), 1, team(u.team));
  }
  for (const p of sparks) px(p.x, p.y, 1, 1, team(p.team));

  // 오른쪽 공간: 강화 버튼 화면의 아이콘
  for (const [id, key] of Object.entries(PAD_KEY)) {
    const o = OBJECTS_BY_ID[id], x = o.col * TILE, y = o.row * TILE;
    const color = !isUpgrade(key) ? PAL.inkDim : s.ally[key] >= MAX_PER ? PAL.jade : PAL.ink;
    // 전투 버튼은 누르는 버튼 색으로 구분: 시작 초록(전투 중이면 어둡게) · 정지 주황 · 초기화 회색
    if (key === "start") px(x + 7, y + 13, 10, 4, s.phase === "ready" ? PAL.unitAlly : PAL.wallSide);
    if (key === "stop") px(x + 7, y + 13, 10, 4, s.phase === "fight" ? PAL.brass : PAL.wallSide);
    if (key === "resetAll") px(x + 7, y + 13, 10, 4, PAL.inkDim);
    ICONS[key].forEach((row, r) => [...row].forEach((ch, c) => { if (ch === "#") px(x + 10 + c, y + 4 + r, 1, 1, color); }));
  }
}

// 3×5 도트 글자(MISS 표시용)
const GLYPHS: Record<string, string[]> = {
  M: ["#.#", "###", "###", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  S: ["###", "#..", "###", "..#", "###"],
};
function pixelText(px: DrawKit["px"], t: string, x: number, y: number, color: string) {
  [...t].forEach((ch, i) => GLYPHS[ch]?.forEach((row, r) => [...row].forEach((b, c) => {
    if (b === "#") px(x + i * 4 + c, y + r, 1, 1, color);
  })));
}

/** 조명 위 층: 화면 머리글 · 승패 · 강화 버튼 이름과 단계 · 떠오르는 글자 */
function drawTop({ ctx, px, PAL, label }: DrawKit) {
  const s = store.getState();
  // 이 방의 글자는 작게(벽까지 튀어나가지 않게), 하지만 도트 버퍼가 아니라 화면 해상도로 선명하게(label) — 사용자 피드백 2026-10-26
  const text = (t: string, x: number, y: number, color: string, align: CanvasTextAlign = "left", size = 7.5, alpha = 1) =>
    label(t, x, y, { color, align, size, alpha });

  text(`ROUND ${s.round}/${FINAL_ROUND}`, SCREEN.x + 3, SCREEN.y + 2, PAL.jade);
  text(`${s.alive.ally} : ${s.alive.enemy}`, SCREEN.x + SCREEN.w - 3, SCREEN.y + 2, PAL.ink, "right");

  // 적 강화 표(게임창 안 정보창): 기존 아이콘 + 단계 칸 그림에 작은 한글 이름(Galmuri7). 3열 × 2줄 — 위·아래가 상성 짝
  const by = SCREEN.y + 13, colW = (SCREEN.w - 6) / 3;
  px(SCREEN.x + 1, by - 1, SCREEN.w - 2, 32, "rgba(0,0,0,.5)");
  px(SCREEN.x + 1, by - 1, 2, 32, PAL.unitEnemy);              // 왼쪽 빨간 띠 = 적
  const order: UpKey[] = ["atk", "pen", "acc", "def", "hp", "eva"];
  order.forEach((k, i) => {
    const x = SCREEN.x + 6 + (i % 3) * colW, y = by + 1 + Math.floor(i / 3) * 15, lv = s.enemy[k];
    ICONS[k].forEach((row, r) => [...row].forEach((ch, c) => { if (ch === "#") px(x + c, y + r, 1, 1, lv ? PAL.ink : PAL.wallSide); }));
    for (let j = 0; j < MAX_PER; j++) px(x + 8 + j * 4, y + 1, 3, 3, j < lv ? PAL.unitEnemy : PAL.wallSide);
    text(UPGRADES.find((u) => u.key === k)!.name, x, y + 6, lv ? PAL.ink : PAL.inkDim, "left", 7);
  });
  if (s.phase === "cleared") {
    px(SCREEN.x, SCREEN.y + SCREEN.h / 2 - 14, SCREEN.w, 26, "rgba(0,0,0,.6)");
    text("모든 라운드 클리어!", SCREEN.x + SCREEN.w / 2, SCREEN.y + SCREEN.h / 2 - 11, PAL.unitAlly, "center", 9);
    text("전체 초기화로 다시 도전", SCREEN.x + SCREEN.w / 2, SCREEN.y + SCREEN.h / 2 + 1, PAL.inkDim, "center", 8);
  }
  if (s.phase === "ready") {
    px(SCREEN.x, SCREEN.y + SCREEN.h / 2 - 14, SCREEN.w, 26, "rgba(0,0,0,.55)");
    text("전투 대기", SCREEN.x + SCREEN.w / 2, SCREEN.y + SCREEN.h / 2 - 11, PAL.ink, "center", 9);
    text("▶ 전투 시작을 누르세요", SCREEN.x + SCREEN.w / 2, SCREEN.y + SCREEN.h / 2 + 1, PAL.unitAlly, "center", 8);
  }
  if (s.result) {
    px(SCREEN.x, SCREEN.y + SCREEN.h / 2 - 12, SCREEN.w, 22, "rgba(0,0,0,.6)");
    text(s.result === "win" ? (s.round >= FINAL_ROUND ? "마지막 라운드 승리!" : "승리! 새로운 적") : "패배 — 강화를 바꿔 보세요", SCREEN.x + SCREEN.w / 2, SCREEN.y + SCREEN.h / 2 - 7,
      s.result === "win" ? PAL.jade : PAL.brass, "center", 9);
  }

  for (const [id, key] of Object.entries(PAD_KEY)) {
    const o = OBJECTS_BY_ID[id], cx = (o.col + 0.5) * TILE, y = o.row * TILE;
    text(o.label, cx, y + TILE + 1, PAL.ink, "center");
    if (!isUpgrade(key)) continue;
    for (let i = 0; i < MAX_PER; i++) px(cx - 7 + i * 5, y - 7, 4, 3, i < s.ally[key] ? PAL.jade : PAL.wallSide);
  }

  // 회피: 피한 쪽 색으로 작은 MISS(아군 초록 · 적 빨강). 3×5 도트 글자라 화면 안 점들과 크기가 맞는다
  for (const m of misses) {
    ctx.globalAlpha = Math.max(0, 1 - m.t / 0.7);
    pixelText(px, "MISS", Math.round(m.x - 7), Math.round(m.y - 6 - m.t * 10), m.team === 0 ? PAL.unitAlly : PAL.unitEnemy);
  }
  ctx.globalAlpha = 1;

  for (const f of floaters)
    text(f.text, f.x, f.y - f.t * 12, f.ok ? PAL.jade : PAL.brass, "center", 7.5, Math.max(0, 1 - f.t / 1.2));
}

// 조명: 살아 있는 유닛마다 제 색으로 은은하게
let PALc: Palette | null = null;
function lights(): Light[] {
  const P = (PALc ??= readPalette());
  return units.filter((u) => u.hp > 0).map((u) => ({ x: u.x, y: u.y, r: 9, color: u.team === 0 ? P.unitAlly : P.unitEnemy, a: 0.55 }));
}

export const evolutionPlugin: RoomPlugin = { update, draw, drawTop, lights };
