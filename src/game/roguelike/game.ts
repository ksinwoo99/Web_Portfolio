import { VW, VH, TILE, DASH_SPEED, DASH_TRAIL_S } from "../constants";
import { drawHero as heroArt, floorTile, type Facing } from "../art";
import { readPalette } from "../palette";
import type { Light } from "../lighting";
import { axis } from "../input";
import type { DrawKit, RoomPlugin } from "../plugins";
import { isLocked, useGameStore } from "../../store";
import { ITEM_BY_ID, type Stat } from "./items";
import { useRlStore } from "./store";

/*
 * 로그라이크 웹 열화판. 원본: graduation_work/roguelike_Personal (PlayerCharacter·EnemyActor·Projectile).
 * GAME START를 누르면 이 플러그인이 게임창 전체를 넘겨받는다(takeover). 적은 1종(원본 기본 수치).
 */

// 원본 카메라(높이 8000, 수평 시야각 40°)가 보여주는 가로 폭을 게임창 가로 384px에 맞춘 비율.
// 속도·거리는 전부 이 비율로 원본 값을 옮긴다.
const U = VW / (2 * 8000 * Math.tan((20 * Math.PI) / 180)); // ≈ 0.066 px / 언리얼 유닛

// 웹 템포 조정(사용자 요청): 원본 비율 그대로면 답답해서 이동 관련 값만 같은 배율로 올린다.
// 플레이어·적·투사체·대시를 함께 올려야 서로의 관계(투사체가 적보다 빠름 등)가 유지된다.
const SPEED_SCALE = 3;
const PLAYER_SPEED = 600 * U * SPEED_SCALE; // CharacterMovement 기본 MaxWalkSpeed
const ENEMY_SPEED = 400 * U * SPEED_SCALE;
const PROJ_SPEED = 1000 * U * SPEED_SCALE;
const PROJ_LIFE = 5;
const TARGET_RANGE = 3000 * U;
const SPAWN_MIN = 2500 * U, SPAWN_MAX = 3000 * U;
// 대시: 원본은 순간이동이지만 웹판은 허브와 같은 "빠르게 미끄러지는" 대시(사용자 요청, 2026-10-08).
// 거리는 원본 그대로, 속도는 허브와 공용(DASH_SPEED). 대시 중엔 무적이고 적을 밀어내지 않고 뚫고 지나간다
const DASH_DIST = 500 * U * SPEED_SCALE, DASH_CD = 10, DASH_INVINCIBLE = 0.1;
const HIT_INVINCIBLE = 2;
// 원본의 두 번째 기본 공격(범위 공격·FireAoEAttack)은 웹판에서 뺐다(사용자 결정) — 빨라진 적에게 안 맞고,
// 플레이어가 쓰는지도 알기 어려워서. 대신 투사체 기본 공격 간격을 원본 2초 → 1초로 줄였다.
// 체력은 3칸, 한 번 맞으면 1칸(사용자 요청, 2026-10-23 — 원본은 체력 100·접촉 피해 10). 피격 후 2초 무적은 그대로
const MAX_HP = 3, BASE_DAMAGE = 60, BASE_ATTACK_INTERVAL = 1;
const VARIANCE = 0.2;
const SPREAD = (3 * Math.PI) / 180; // 적이 없어 허공에 쏠 때 투사체 사이 각도(원본 SpreadAngle 3°)
// 웹 전용: 같은 적을 노리는 투사체끼리 벌어지는 각도. 원본은 완전히 겹쳐서 적이 적은 초반엔
// 개수 증가가 눈에 안 보인다 — "눈에 띄는 강화"가 목적이라 부채꼴로 벌린다.
const FAN = (8 * Math.PI) / 180;
const ENEMY_HP = 100, ENEMY_DAMAGE = 1, ENEMY_EXP = 20;
// 원본 첫 레벨업은 100(5마리), 이후 ×1.2. 웹은 첫 레벨업을 1마리로 당기고, 이후는 ×1.5
// (레벨업 횟수를 줄이고 한 번에 크게 강해지게 — 사용자 요청, 2026-10-23. 1분 동안 대략 10번)
const FIRST_MAX_EXP = ENEMY_EXP, EXP_GROWTH = 1.5;
// 1분 생존 데모(사용자 결정, 2026-10-06): 시작부터 몰려오고, 60초 버티면 클리어.
// 스폰은 웹 전용 규칙(WaveData 미사용): 시작 즉시 START_WAVE마리, 이후 0.6초마다 2마리 + 20초마다 +1마리.
// 서툰 자동 플레이(적 반대로 도망 + 대시)로 재 보며 맞춘 값 — 처음 해보는 사람도 버틸 만하게.
const DEMO_TIME = 60;
const START_WAVE = 8, SPAWN_INTERVAL = 0.6, SPAWN_BASE = 2, SPAWN_RAMP = 20, MAX_ENEMIES = 120;
// 판정 반경(px). 원본 캡슐은 이 축척에서 2px 남짓이라 그림 크기에 맞췄다.
// 투사체는 크기 아이템 효과가 눈에 보이도록 기본을 조금 크게(지름 7px) 잡았다.
const PLAYER_R = 4, ENEMY_R = 4, PROJ_R = 3;

type V = { x: number; y: number };
type Enemy = V & { hp: number; flash: number };
type Proj = V & {
  vx: number; vy: number; life: number; dmg: number; r: number;
  pierce: number;      // 남은 관통 횟수(원본 RemainingPierceCount)
  hit: Set<Enemy>;     // 이미 맞힌 적 — 관통 중에 같은 적을 매 프레임 다시 때리지 않게
  dead?: boolean;
};
type Floater = V & { t: number; text: string; color: "ink" | "brass" | "jade" };

const store = useRlStore;

/* ---------- 스탯: 보유 아이템(레벨별 총량)에서 매번 새로 계산 — 원본의 "치환" 방식과 결과가 같다 ---------- */
function computeStats(owned: Record<string, number>) {
  const sum: Partial<Record<Stat, number>> = {};
  for (const [id, lv] of Object.entries(owned))
    for (const [k, v] of Object.entries(ITEM_BY_ID[id].levels[lv - 1])) sum[k as Stat] = (sum[k as Stat] ?? 0) + v;
  return {
    size: 1 + (sum.projectileSize ?? 0) / 100,   // 원본 SetScale(EffectAreaMultiplier)
    count: 1 + (sum.projectileCount ?? 0),       // 원본 1 + AdditionalProjectiles
    pierce: sum.pierce ?? 0,
    damage: BASE_DAMAGE + (sum.attackDamage ?? 0),
    // 원본 RecalculateAttackRate: 초당 공격 횟수에 (1 + 공속 보너스)를 곱한다. 기본 간격은 웹판 1초
    attackInterval: Math.max(0.1, BASE_ATTACK_INTERVAL / (1 + (sum.attackSpeed ?? 0) / 100)),
  };
}

function newWorld() {
  return {
    t: 0,
    started: false,
    player: { x: 0, y: 0, hp: MAX_HP, inv: 0, dashCd: 0, dashT: 0, dashDir: { x: 0, y: 1 }, face: { x: 0, y: 1 }, moving: false, walk: 0 },
    trail: [] as { x: number; y: number; t: number }[],
    enemies: [] as Enemy[],
    projs: [] as Proj[],
    floaters: [] as Floater[],
    exp: 0, maxExp: FIRST_MAX_EXP, level: 1, pendingLevels: [] as number[], score: 0,
    attackT: 0, spawnT: 0,
    owned: {} as Record<string, number>,
    stats: computeStats({}),
  };
}

let w = newWorld();
let runId = store.getState().runId;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** 원본 RollAttackDamage의 기본 편차(±20%). 치명타·추가 피해 등을 주는 아이템은 웹판에서 뺐다 */
const rollDamage = () => w.stats.damage * (1 + rand(-VARIANCE, VARIANCE));

/** 원본 FindTargets: 탐색 범위 안의 적을 가까운 순으로(적이 1종이라 등급 비교는 생략) */
function findTargets() {
  const p = w.player;
  return w.enemies
    .map((e) => ({ e, d: Math.hypot(e.x - p.x, e.y - p.y) }))
    .filter((t) => t.d < TARGET_RANGE)
    .sort((a, b) => a.d - b.d)
    .map((t) => t.e);
}

function float(x: number, y: number, text: string, color: Floater["color"]) {
  w.floaters.push({ x, y, t: 0, text, color });
}

function hitEnemy(e: Enemy, dmg: number) {
  if (e.hp <= 0) return;
  e.hp -= dmg;
  e.flash = 0.12;
  float(e.x, e.y - 6, String(Math.round(dmg)), "ink");
  if (e.hp <= 0) {
    w.exp += ENEMY_EXP;
    w.score += ENEMY_EXP;
    while (w.exp >= w.maxExp) {
      w.exp -= w.maxExp;
      w.maxExp *= EXP_GROWTH;
      w.level++;
      w.pendingLevels.push(w.level);
    }
  }
}

/**
 * 원본 AutoAttack(기본값인 분산 모드): 투사체 i번째는 가까운 순서 i번째 적을 노린다(적이 모자라면 처음부터 다시).
 * 적이 없으면 무작위 방향을 기준으로 3°씩 벌려 허공에 쏜다.
 */
function autoAttack() {
  const p = w.player;
  const { count, size, pierce } = w.stats;
  const targets = findTargets();
  const base = Math.random() * Math.PI * 2;
  const n = targets.length;
  for (let i = 0; i < count; i++) {
    let ang: number;
    if (n) {
      const j = i % n, t = targets[j];
      const group = Math.floor((count - 1 - j) / n) + 1; // 이 적을 노리는 투사체 수
      const k = Math.floor(i / n);                        // 그중 몇 번째인지
      ang = Math.atan2(t.y - p.y, t.x - p.x) + (k - (group - 1) / 2) * FAN;
    } else {
      ang = base + (i - (count - 1) / 2) * SPREAD;
    }
    w.projs.push({
      x: p.x, y: p.y - 4,
      vx: Math.cos(ang) * PROJ_SPEED, vy: Math.sin(ang) * PROJ_SPEED,
      life: PROJ_LIFE, dmg: rollDamage(), r: PROJ_R * size, pierce, hit: new Set(),
    });
  }
}

function dash() {
  const p = w.player;
  if (p.dashCd > 0 || p.dashT > 0) return;
  // 누르고 있는 방향이 있으면 그쪽, 없으면 바라보는 방향
  const a = axis(), m = Math.hypot(a.x, a.y);
  p.dashDir = m ? { x: a.x / m, y: a.y / m } : { ...p.face };
  p.dashT = DASH_DIST / DASH_SPEED;
  p.dashCd = DASH_CD;
}

function spawn(count = SPAWN_BASE + Math.floor(w.t / SPAWN_RAMP)) {
  const p = w.player;
  const n = Math.min(count, MAX_ENEMIES - w.enemies.length);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = rand(SPAWN_MIN, SPAWN_MAX);
    w.enemies.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, hp: ENEMY_HP, flash: 0 });
  }
}

function step(dt: number) {
  const p = w.player;
  w.t += dt;

  for (const g of w.trail) g.t += dt;
  while (w.trail.length && w.trail[0].t > DASH_TRAIL_S) w.trail.shift();

  const a = axis();
  p.moving = a.x !== 0 || a.y !== 0;
  if (p.dashT > 0) {
    p.x += p.dashDir.x * DASH_SPEED * dt;
    p.y += p.dashDir.y * DASH_SPEED * dt;
    p.face = { ...p.dashDir };
    p.moving = true;
    w.trail.push({ x: p.x, y: p.y, t: 0 });
    // 끝난 직후 아주 짧은 무적(원본 DashInvincibleTime) — 적 무리 한가운데서 멈춰도 바로 맞지 않게
    if ((p.dashT -= dt) <= 0) p.inv = Math.max(p.inv, DASH_INVINCIBLE);
  } else if (p.moving) {
    p.x += a.x * PLAYER_SPEED * dt;
    p.y += a.y * PLAYER_SPEED * dt;
    const m = Math.hypot(a.x, a.y);
    p.face = { x: a.x / m, y: a.y / m };
    p.walk += dt;
  }
  p.inv = Math.max(0, p.inv - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);

  if (!w.started) { w.started = true; spawn(START_WAVE); } // 시작하자마자 둘러싸이게
  if ((w.attackT += dt) >= w.stats.attackInterval) { w.attackT -= w.stats.attackInterval; autoAttack(); }
  if ((w.spawnT += dt) >= SPAWN_INTERVAL) { w.spawnT -= SPAWN_INTERVAL; spawn(); }

  // 적: 플레이어에게 직진, 서로 겹치면 밀어냄, 닿으면 피해(피격 후 2초 무적)
  const es = w.enemies;
  for (const e of es) {
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    e.x += (dx / d) * ENEMY_SPEED * dt;
    e.y += (dy / d) * ENEMY_SPEED * dt;
    e.flash = Math.max(0, e.flash - dt);
  }
  for (let i = 0; i < es.length; i++)
    for (let j = i + 1; j < es.length; j++) {
      const A = es[i], B = es[j], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
      if (d > 0 && d < ENEMY_R * 2) {
        const push = (ENEMY_R * 2 - d) / 2;
        A.x -= (dx / d) * push; A.y -= (dy / d) * push;
        B.x += (dx / d) * push; B.y += (dy / d) * push;
      }
    }
  for (const e of es) {
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
    const min = PLAYER_R + ENEMY_R;
    if (d < min && p.dashT <= 0) { // 대시 중엔 무적 — 밀어내지도 않고 그대로 뚫고 지나간다
      e.x = p.x + (dx / d) * min;
      e.y = p.y + (dy / d) * min;
      if (p.inv <= 0) {
        p.hp -= ENEMY_DAMAGE;
        p.inv = HIT_INVINCIBLE;
        float(p.x, p.y - 16, `-${ENEMY_DAMAGE}`, "brass");
      }
    }
  }

  for (const pr of w.projs) {
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    if ((pr.life -= dt) <= 0) { pr.dead = true; continue; }
    // 원본 Projectile: 적에게 닿으면 피해 → 관통 횟수가 남았으면 줄이고 계속, 없으면 소멸
    for (const e of es) {
      if (e.hp <= 0 || pr.hit.has(e) || Math.hypot(e.x - pr.x, e.y - pr.y) >= pr.r + ENEMY_R) continue;
      hitEnemy(e, pr.dmg);
      pr.hit.add(e);
      if (pr.pierce > 0) pr.pierce--;
      else { pr.dead = true; break; }
    }
  }
  w.projs = w.projs.filter((pr) => !pr.dead);
  w.enemies = es.filter((e) => e.hp > 0);

  for (const f of w.floaters) f.t += dt;
  w.floaters = w.floaters.filter((f) => f.t < 0.7);

  if (p.hp <= 0) {
    p.hp = 0;
    store.getState().gameOver({ score: w.score, time: w.t, level: w.level, cleared: false });
  } else if (w.t >= DEMO_TIME) {
    store.getState().gameOver({ score: w.score, time: DEMO_TIME, level: w.level, cleared: true });
  }
}

function update(dt: number) {
  const s = store.getState();
  if (s.runId !== runId) { runId = s.runId; w = newWorld(); }
  if (s.owned !== w.owned) {
    w.owned = s.owned;
    w.stats = computeStats(s.owned);
  }
  if (s.phase !== "playing" || isLocked(useGameStore.getState())) return;

  // 쌓인 레벨업을 하나씩 처리(원본 PendingLevelUpQueue). 선택지가 없으면 그냥 넘어간다.
  while (w.pendingLevels.length) {
    const lv = w.pendingLevels.shift()!;
    if (store.getState().offerLevelUp(lv)) return;
  }
  step(dt);
}

/* ---------- 그리기 ---------- */


function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, shadow: string, align: CanvasTextAlign = "left") {
  ctx.font = "10px Galmuri9, monospace";
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.fillStyle = shadow;
  ctx.fillText(s, Math.round(x) + 1, Math.round(y) + 1);
  ctx.fillStyle = color;
  ctx.fillText(s, Math.round(x), Math.round(y));
}

function render({ ctx, PAL, px, now }: DrawKit) {
  const p = w.player;
  const cx = Math.round(p.x - VW / 2), cy = Math.round(p.y - VH / 2);
  const sx = (x: number) => Math.round(x - cx), sy = (y: number) => Math.round(y - cy);

  // 끝없는 바닥 (원본 Map_1 대신 체크무늬)
  const tx0 = Math.floor(cx / TILE), ty0 = Math.floor(cy / TILE);
  for (let ty = ty0; ty <= ty0 + VH / TILE + 1; ty++)
    for (let tx = tx0; tx <= tx0 + VW / TILE + 1; tx++)
      floorTile(px, PAL, tx * TILE - cx, ty * TILE - cy, tx, ty);

  for (const e of w.enemies) {
    const x = sx(e.x), y = sy(e.y);
    const body = e.flash > 0 ? PAL.ink : PAL.brassDark;
    px(x - 4, y + 4, 10, 2, "rgba(0,0,0,.35)");
    px(x - 4, y - 6, 9, 1, PAL.outline);                 // 외곽선
    px(x - 5, y - 5, 11, 10, PAL.outline);
    px(x - 3, y - 5, 7, 1, body);
    px(x - 4, y - 4, 9, 8, body);
    px(x - 4, y - 4, 9, 1, e.flash > 0 ? PAL.ink : PAL.brass); // 윗면 하이라이트
    px(x - 4, y + 2, 9, 2, e.flash > 0 ? PAL.skinShade : PAL.carpetDark);
    px(x - 2, y - 2, 2, 2, PAL.void);
    px(x + 1, y - 2, 2, 2, PAL.void);
  }

  for (const pr of w.projs) {
    const R = Math.max(1, Math.round(pr.r));
    px(sx(pr.x) - R, sy(pr.y) - R, R * 2 + 1, R * 2 + 1, PAL.jade);
    px(sx(pr.x), sy(pr.y), 1, 1, PAL.ink);
  }

  // 플레이어 — 허브 캐릭터와 같은 그림. 대시 잔상을 먼저, 피격 무적 중엔 깜빡인다.
  for (const g of w.trail) {
    ctx.globalAlpha = 0.35 * (1 - g.t / DASH_TRAIL_S);
    drawHero(sx(g.x), sy(g.y), 0);
  }
  ctx.globalAlpha = 1;
  if (p.dashT > 0 || !(p.inv > 0 && Math.floor(now / 90) % 2))
    drawHero(sx(p.x), sy(p.y), p.moving && Math.floor(p.walk * 8) % 2 ? 1 : 0);

  function drawHero(hx: number, hy: number, bob: number) {
    const f = p.face;
    const facing: Facing = Math.abs(f.x) > Math.abs(f.y) ? (f.x > 0 ? "right" : "left") : f.y < 0 ? "up" : "down";
    heroArt(px, PAL, hx, hy - 2, facing, bob);
  }

}

// 7×6 도트 하트. full이면 주황, 잃은 칸은 어두운 회색
const HEART = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"];
function heart(px: DrawKit["px"], PAL: DrawKit["PAL"], x: number, y: number, full: boolean) {
  HEART.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) if (row[c] === "1") {
      px(x + c, y + r, 1, 1, full ? PAL.brass : PAL.wallSide);
    }
  });
  // 외곽 그림자와 하이라이트
  px(x, y + 6, 7, 1, PAL.void);
  if (full) px(x + 1, y + 1, 1, 1, PAL.hairHi);
}

/** 조명 위에 그리는 층: 떠오르는 숫자와 HUD — 어두워지면 안 되는 글자·게이지 */
function renderHud({ ctx, PAL, px, now }: DrawKit) {
  const p = w.player;
  const cx = Math.round(p.x - VW / 2), cy = Math.round(p.y - VH / 2);
  for (const f of w.floaters) {
    ctx.globalAlpha = Math.max(0, 1 - f.t / 0.7);
    text(ctx, f.text, Math.round(f.x - cx), Math.round(f.y - cy) - f.t * 12, PAL[f.color], PAL.void, "center");
  }
  ctx.globalAlpha = 1;

  // HUD: 경험치 줄 · 체력 · 레벨 · 남은 시간 · 점수 · 대시 쿨타임
  px(0, 0, VW, 3, PAL.void);
  px(0, 0, Math.round((VW * w.exp) / w.maxExp), 3, PAL.jade);
  for (let i = 0; i < MAX_HP; i++) heart(px, PAL, 6 + i * 12, 6, i < p.hp);
  text(ctx, `Lv ${w.level}`, 44, 5, PAL.ink, PAL.void);
  const left = Math.max(0, Math.ceil(DEMO_TIME - w.t));
  const hurry = left <= 10; // 마지막 10초는 주황으로 깜빡인다
  const timeColor = hurry && Math.floor(now / 250) % 2 ? PAL.brass : PAL.ink;
  text(ctx, `남은 시간 0:${String(left).padStart(2, "0")}`, VW / 2, 5, timeColor, PAL.void, "center");
  text(ctx, `점수 ${w.score}`, VW - 6, 5, PAL.ink, PAL.void, "right");
  const ready = p.dashCd <= 0;
  px(6, VH - 15, 44, 10, PAL.void);
  px(6, VH - 15, Math.round(44 * (1 - p.dashCd / DASH_CD)), 10, ready ? PAL.jade : PAL.wallSide);
  text(ctx, ready ? "대시 OK" : `대시 ${Math.ceil(p.dashCd)}`, 9, VH - 15, ready ? PAL.void : PAL.ink, ready ? PAL.jade : PAL.void);
}

/* ---------- 입력 ---------- */

function keydown(e: KeyboardEvent) {
  const s = store.getState();
  const k = e.key.toLowerCase();
  switch (s.phase) {
    case "playing":
      // 대시는 Shift(사용자 요청 — 원본은 Space). Space는 페이지 스크롤만 막고 아무 동작 안 함
      if (k === "shift") { if (!e.repeat) dash(); return true; }
      if (k === " ") return true;
      if (k === "escape") { s.togglePause(); return true; }
      return false;
    case "paused":
      if (k === "escape" || k === " ") { s.togglePause(); return true; }
      return false;
    case "levelup":
      // 이동하느라 누르고 있던 키의 자동 반복이 선택을 마구 넘기지 않게 한다
      if (e.repeat) return true;
      // 원본 기획 메모: "레벨업 선택지 뜨면, w/s 로 선택 가능하게". 카드가 가로로 놓여 a/d도 받는다.
      if (k === "w" || k === "a" || k === "arrowup" || k === "arrowleft") { s.move(-1); return true; }
      if (k === "s" || k === "d" || k === "arrowdown" || k === "arrowright") { s.move(1); return true; }
      // 확정은 Enter·Space 둘 다(사용자 요청 — 대시가 Shift로 옮겨가 Space 오입력 걱정이 없어짐).
      // Tab은 카드 사이 키보드 포커스 이동에 필요하니 막지 않는다.
      if (k === "enter" || k === " ") s.choose(s.selected);
      return k !== "tab";
    case "over":
      if (k === "enter" || k === " ") { s.start(); return true; }
      if (k === "escape") { s.quit(); return true; }
      return false;
    default:
      return false;
  }
}

// 조명 층(화면 좌표): 캐릭터 주변 빛 + 투사체 민트 번짐. 바탕을 밝게(lightBoost) 해 가장자리 적도 보이게
let PALc: ReturnType<typeof readPalette> | null = null;
function lights(): Light[] {
  const P = (PALc ??= readPalette()), p = w.player;
  const cx = p.x - VW / 2, cy = p.y - VH / 2;
  const out: Light[] = [{ x: VW / 2, y: VH / 2 - 6, r: 130, color: P.lightWarm, a: 0.5 }];
  for (const pr of w.projs.slice(0, 60)) out.push({ x: pr.x - cx, y: pr.y - cy, r: 14 + pr.r * 2, color: P.jade, a: 0.6, bloom: true });
  return out;
}

export const roguelikePlugin: RoomPlugin = {
  lights,
  lightBoost: 0.3,
  update,
  draw: () => {},
  takeover: () => store.getState().phase !== "idle",
  render,
  renderHud,
  keydown,
  action: () => { if (store.getState().phase === "playing") dash(); },
  click: () => store.getState().phase !== "idle",
};
