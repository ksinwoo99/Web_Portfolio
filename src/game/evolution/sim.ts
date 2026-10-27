import { PANEL_RECTS, panelScreen } from "../maps";
import { OBJECTS_BY_ID } from "../rooms";
import { TILE } from "../constants";
import type { DrawKit, RoomPlugin } from "../plugins";
import type { Light } from "../lighting";
import { readPalette, type Palette } from "../palette";
import {
  ACC_PER, ATK_PER, BASE_ATK, BASE_HP, DEF_PER, EVA_PER, GROUPS, HP_PER, MAX_PER, NAME, PEN_PER, SPL_EVA_MULT, SPL_PER,
  UNITS_PER_SIDE, FINAL_ROUND, effLevels, useEvoStore, type Levels, type PadKey, type UpKey,
} from "./store";

/*
 * AI 진화 체험판의 매 프레임 부분: 왼쪽 화면 패널 안의 자동 전투 + 오른쪽 강화 버튼 그림.
 * 점 하나가 유닛 하나. 가장 가까운 적에게 다가가 사거리 안이면 공격한다.
 * 양쪽 강화는 먼저 상성으로 깎고(store `effLevels` — 이기는 강화 1단계가 지는 강화 1.5단계를 지운다), 남은 단계로:
 * 피해 = (기본 공격력 + 공격력 + 관통 피해) × (1 − 상대 방어력), 명중률만큼 약점 명중(2배), 상대 회피율만큼 빗나감(MISS),
 * 맞히면 그 적에게서 가장 가까운 다른 적 1명에게 스플래시(상대 회피율의 2배 확률로 빗나감).
 */

const store = useEvoStore;
const SCREEN = panelScreen(PANEL_RECTS.evolution!);
const TOP = 63;            // 화면 위쪽 머리글 높이(라운드·남은 수 + 적 강화 표 3줄)
const RANGE = 7, SPEED = 24, SEP = 5;
const ATTACK_CD = 0.9;
const RESULT_S = 2.2;      // 승패 표시 후 다음 판까지

// 오른쪽 공간 버튼 ↔ 동작(강화 7종 · 강화 초기화 · 전투 시작 · 정지 · 전체 초기화)
export const PAD_KEY: Record<string, PadKey> = {
  "evo-atk": "atk", "evo-pen": "pen", "evo-def": "def", "evo-hp": "hp", "evo-eva": "eva", "evo-spl": "spl", "evo-acc": "acc",
  "evo-reset": "reset", "evo-start": "start", "evo-stop": "stop", "evo-resetall": "resetAll",
};
const isUpgrade = (k: PadKey): k is UpKey => k in NAME;

type Unit = {
  x: number; y: number; hp: number; maxHp: number; team: 0 | 1;   // 0 아군(초록) / 1 적(빨강)
  cd: number; flash: number;
  shot: { x: number; y: number; t: number } | null;
};
type Spark = { x: number; y: number; vx: number; vy: number; t: number; team: 0 | 1 };
type Floater = { x: number; y: number; t: number; text: string; ok: boolean };
type Miss = { x: number; y: number; t: number; team: 0 | 1 };
type Blast = { x: number; y: number; x2: number; y2: number; t: number; team: 0 | 1 }; // 스플래시 이어지는 선(때린 쪽 색)

let units: Unit[] = [];
let sparks: Spark[] = [];
let floaters: Floater[] = [];
let misses: Miss[] = [];
let blasts: Blast[] = [];
// 팀별 최대 체력. 체력 강화(와 그걸 지우는 상대 공격력)가 바뀌면 살아 있는 유닛에 바로 반영
let maxHpNow: [number, number] = [BASE_HP, BASE_HP];
let resultT = 0;
let pressSeq = store.getState().press.seq;
let formation = store.getState().formation;

function spawn() {
  units = [];
  sparks = [];
  misses = [];
  blasts = [];
  const s = store.getState();
  maxHpNow = teamMaxHp(s.ally, s.enemy);
  const cols = 5, gap = SCREEN.w / (cols + 1);
  for (let team = 0 as 0 | 1; team <= 1; team++)
    for (let i = 0; i < UNITS_PER_SIDE; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      const y = team === 0 ? SCREEN.y + SCREEN.h - 10 - r * 9 : SCREEN.y + TOP + 8 + r * 9;
      // 줄 맞춰 세우되 조금씩 흩뜨린다 — 똑같이 서면 1대1 결투 다섯 줄로만 보인다
      const jx = (Math.random() - 0.5) * gap * 0.8, jy = (Math.random() - 0.5) * 8;
      const maxHp = maxHpNow[team];
      units.push({ x: SCREEN.x + gap * (c + 1) + (r % 2 ? gap / 2 : 0) + jx, y: y + jy, hp: maxHp, maxHp, team, cd: Math.random() * ATTACK_CD, flash: 0, shot: null });
    }
  store.getState().setAlive(UNITS_PER_SIDE, UNITS_PER_SIDE);
}
spawn();

/** 상성 적용 후 단계(e)로 계산한 전투 수치 */
function stats(e: Levels) {
  return {
    dmg: BASE_ATK + ATK_PER * e.atk + PEN_PER * e.pen,
    taken: Math.max(0.25, 1 - DEF_PER * e.def),     // 받는 피해 배율
    eva: Math.min(0.9, EVA_PER * e.eva),
    splEva: Math.min(0.95, SPL_EVA_MULT * EVA_PER * e.eva),
    crit: ACC_PER * e.acc,
    spl: SPL_PER * e.spl,
  };
}
function effBoth(ally: Levels, enemy: Levels) {
  return [effLevels(ally, enemy), effLevels(enemy, ally)] as const;
}
function teamMaxHp(ally: Levels, enemy: Levels): [number, number] {
  const [a, e] = effBoth(ally, enemy);
  return [BASE_HP + HP_PER * a.hp, BASE_HP + HP_PER * e.hp];
}

function damage(tgt: Unit, d: number) {
  tgt.hp -= d;
  tgt.flash = 0.12;
  if (tgt.hp > 0) return;
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2, v = 10 + Math.random() * 20;
    sparks.push({ x: tgt.x, y: tgt.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, team: tgt.team });
  }
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
  for (const b of blasts) b.t += dt;
  blasts = blasts.filter((b) => b.t < 0.25);

  // 체력이 바뀌면(내 체력 강화, 또는 그걸 지우는 상대 공격력 강화) 싸우는 중인 유닛에 바로: 최대·현재 체력을 같은 만큼
  const hpNow = teamMaxHp(s.ally, s.enemy);
  for (const t of [0, 1] as const) {
    const d = hpNow[t] - maxHpNow[t];
    if (!d) continue;
    for (const u of units) if (u.team === t && u.hp > 0) { u.maxHp += d; u.hp = Math.max(1, u.hp + d); }
  }
  maxHpNow = hpNow;

  // 정지·결과 후·초기화 → 처음 배치로
  if (s.formation !== formation) { formation = s.formation; spawn(); return; }
  if (s.phase === "result") {
    if ((resultT -= dt) <= 0) s.nextBattle();
    return;
  }
  if (s.phase !== "fight") return; // 대기: 배치만 해 두고 싸우지 않는다

  const st = effBoth(s.ally, s.enemy).map(stats);
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
      if (Math.random() < them.eva) {
        misses.push({ x: tgt.x, y: tgt.y - 4, t: 0, team: tgt.team });
      } else {
        const d = me.dmg * them.taken * (Math.random() < me.crit ? 2 : 1); // 명중률: 약점 명중이면 2배
        damage(tgt, d);
        // 스플래시: 맞힌 적에게서 가장 가까운 다른 적 1명에게 피해 일부. 상대 회피율의 2배 확률로 빗나간다
        if (me.spl > 0) {
          let next: Unit | null = null, nd = Infinity;
          for (const o of units) {
            if (o === tgt || o.team !== tgt.team || o.hp <= 0) continue;
            const dd = Math.hypot(o.x - tgt.x, o.y - tgt.y);
            if (dd < nd) { nd = dd; next = o; }
          }
          if (next) {
            blasts.push({ x: tgt.x, y: tgt.y, x2: next.x, y2: next.y, t: 0, team: u.team });
            if (Math.random() < them.splEva) misses.push({ x: next.x, y: next.y - 4, t: 0, team: next.team });
            else damage(next, d * me.spl);
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
  spl: ["#.#.#", ".###.", "##.##", ".###.", "#.#.#"],   // 폭발
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
  // 스플래시: 맞힌 적 → 다음 적으로 튀는 점선
  for (const b of blasts) {
    const n = Math.ceil(Math.hypot(b.x2 - b.x, b.y2 - b.y));
    for (let i = 1; i < n; i += 2) px(b.x + ((b.x2 - b.x) * i) / n, b.y + ((b.y2 - b.y) * i) / n, 1, 1, team(b.team));
  }

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

  // 적 강화 표(게임창 안 정보창): 아이콘 + 단계 칸 + 작은 한글 이름. 한 줄이 한 묶음(공격 / 방어 / 명중 — 버튼 배치와 같다)
  const by = SCREEN.y + 13, colW = (SCREEN.w - 6) / 3, rowH = 15, h = rowH * GROUPS.length + 2;
  px(SCREEN.x + 1, by - 1, SCREEN.w - 2, h, "rgba(0,0,0,.5)");
  px(SCREEN.x + 1, by - 1, 2, h, PAL.unitEnemy);               // 왼쪽 빨간 띠 = 적
  GROUPS.forEach((g, gi) => g.keys.forEach((k: UpKey, i) => {
    const x = SCREEN.x + 6 + i * colW, y = by + 1 + gi * rowH, lv = s.enemy[k];
    ICONS[k].forEach((row, r) => [...row].forEach((ch, c) => { if (ch === "#") px(x + c, y + r, 1, 1, lv ? PAL.ink : PAL.wallSide); }));
    for (let j = 0; j < MAX_PER; j++) px(x + 8 + j * 4, y + 1, 3, 3, j < lv ? PAL.unitEnemy : PAL.wallSide);
    text(NAME[k], x, y + 6, lv ? PAL.ink : PAL.inkDim, "left", 7);
  }));
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
