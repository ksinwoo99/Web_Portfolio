import { TILE, COLS, ROWS, VW, VH, DASH_SPEED, DASH_TRAIL_S } from "./constants";
import { MAPS, PANEL_RECTS, panelScreen } from "./maps";
import { ROOMS, OPPOSITE, DIR_VEC, type Dir, type RoomId, type RoomObject } from "./rooms";
import { actions, axis, clearKeys, clicks, keys } from "./input";
import { readPalette } from "./palette";
import { crate, drawHero, floorTile, plant, rug, wallLamp, wallShadows, wallTile, type Facing } from "./art";
import { DECOR } from "./decor";
import { createLighting, type Light } from "./lighting";
import { ROOM_PLUGINS, type DrawKit, type LabelOpts } from "./plugins";
import { isLocked, useGameStore } from "../store";

const PLAYER_W = 12, PLAYER_H = 12; // 충돌 박스 (그림보다 작게)
const SPEED = 240;   // px/sec — 키보드·조이스틱·클릭 이동이 모두 이 값을 쓴다
const PAN_MS = 450;  // 방 이동 카메라 패닝. RoomStage의 페이지 슬라이드와 길이를 맞출 것
const FLASH_MS = 220;
const MARKER_S = 0.6;
// 허브 대시(Shift, 사용자 요청 — 로그라이크처럼 기본 이동에서도). 벽은 뚫지 않고 DASH_SPEED로 미끄러진다
const DASH_DIST = TILE * 2.5;
const DASH_CD = 0.5;
const DOOR_NEAR = TILE * 2.2; // 플레이어가 이만큼 가까우면 문이 열린다
const DOOR_OPEN_S = 0.18;     // 열리고 닫히는 데 걸리는 시간

type DoorRect = { side: Dir; x: number; y: number; w: number; h: number };
// 방마다 문 영역(벽 쪽 한 줄). 2칸짜리 문 하나를 한 덩어리로 그리기 위해 미리 묶어 둔다.
const DOORS = Object.fromEntries(
  (Object.keys(MAPS) as RoomId[]).map((id) => {
    const m = MAPS[id], list: DoorRect[] = [];
    const run = (side: Dir, cells: number[]) => {
      if (!cells.length) return;
      const a = Math.min(...cells), b = Math.max(...cells) + 1;
      if (side === "up" || side === "down")
        list.push({ side, x: a * TILE, y: side === "up" ? 0 : (ROWS - 1) * TILE, w: (b - a) * TILE, h: TILE });
      else
        list.push({ side, x: side === "left" ? 0 : (COLS - 1) * TILE, y: a * TILE, w: TILE, h: (b - a) * TILE });
    };
    const cols = (row: number) => [...Array(COLS).keys()].filter((c) => m[row][c] === "D");
    const rows = (col: number) => [...Array(ROWS).keys()].filter((r) => m[r][col] === "D");
    run("up", cols(0));
    run("down", cols(ROWS - 1));
    run("left", rows(0));
    run("right", rows(COLS - 1));
    return [id, list];
  }),
) as Record<RoomId, DoorRect[]>;


type Pt = { x: number; y: number };

const store = useGameStore;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ---------- 오브젝트 기하 ---------- */
const objW = (o: RoomObject) => o.w ?? 1;
const objCenter = (o: RoomObject): Pt => ({ x: (o.col + objW(o) / 2) * TILE, y: o.row * TILE + TILE / 2 });
const OBJ_TOP: Record<RoomObject["kind"], number> = { miner: -12, productor: -14, "start-button": 0, incubator: -14, bookshelf: -16, pad: -2 };

// 코딩창 등에 글을 쓰는 중이면 이동·상호작용 키로 받지 않는다.
const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
};

// 길찾기에서 오브젝트가 차지하는 타일
const OBJ_TILES = Object.fromEntries(
  (Object.keys(ROOMS) as RoomId[]).map((id) => {
    const set = new Set<number>();
    for (const o of ROOMS[id].objects)
      for (let r = Math.floor(o.row); r < Math.ceil(o.row + 1); r++)
        for (let c = Math.floor(o.col); c < Math.ceil(o.col + objW(o)); c++) set.add(r * COLS + c);
    return [id, set];
  }),
) as Record<RoomId, Set<number>>;

// 화분·상자처럼 한 칸을 막는 장식(충돌·길찾기에 들어간다)
const DECOR_SOLID = Object.fromEntries(
  (Object.keys(DECOR) as RoomId[]).map((id) => [
    id, new Set(DECOR[id].filter((d) => d.kind === "plant" || d.kind === "crate").map((d) => d.row * COLS + d.col)),
  ]),
) as Record<RoomId, Set<number>>;

/** 캔버스에 게임 루프를 붙이고, 정리 함수를 돌려준다. */
export function startEngine(canvas: HTMLCanvasElement): () => void {
  // 게임은 384×240 버퍼에 그리고, 매 프레임 화면 캔버스(GameWindow가 정수배 크기로 맞춤)로 최근접 확대해 옮긴 뒤
  // 그 위에 조명·후처리 층(lighting.ts)을 화면 해상도로 칠한다.
  const buf = document.createElement("canvas");
  buf.width = VW;
  buf.height = VH;
  const ctx = buf.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const view = canvas.getContext("2d")!;
  // 조명을 받지 않는 글자·HUD 층(투명 바탕, 같은 384×240)
  const hudBuf = document.createElement("canvas");
  hudBuf.width = VW;
  hudBuf.height = VH;
  const hud = hudBuf.getContext("2d")!;
  hud.imageSmoothingEnabled = false;
  const PAL = readPalette();
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lighting = createLighting(PAL, reduceMotion);
  let frameLights: Light[] = [];
  // 화면 해상도로 그리는 선명한 글자(DrawKit.label). 매 프레임 render가 채우고 present가 맨 위에 그린다
  let labels: (Required<LabelOpts> & { t: string; x: number; y: number })[] = [];
  let frameBoost = 0;
  function present(now: number) {
    view.imageSmoothingEnabled = false; // 캔버스 크기를 바꾸면 초기화되므로 매번
    view.drawImage(buf, 0, 0, canvas.width, canvas.height);
    lighting(view, canvas.width, canvas.height, frameLights, now, frameBoost);
    view.imageSmoothingEnabled = false;
    view.drawImage(hudBuf, 0, 0, canvas.width, canvas.height);
    drawLabels();
  }
  function drawLabels() {
    if (!labels.length) return;
    const s = canvas.width / VW, sh = Math.max(1, Math.round(s * 0.6));
    view.save();
    view.textBaseline = "top";
    for (const L of labels) {
      view.globalAlpha = L.alpha;
      view.textAlign = L.align;
      view.font = `${Math.round(L.size * s)}px Galmuri11, "Pretendard Variable", sans-serif`;
      const x = Math.round(L.x * s), y = Math.round(L.y * s);
      view.fillStyle = PAL.void;
      view.fillText(L.t, x + sh, y + sh); // 그림자
      view.fillStyle = L.color;
      view.fillText(L.t, x, y);
    }
    view.restore();
  }

  let room: RoomId = store.getState().room;
  const player = { x: VW / 2, y: VH / 2, facing: "down" as Dir, walkTime: 0, moving: false };
  let activeObject: RoomObject | null = null;
  let path: Pt[] = [];
  let stuck = 0;
  let marker: (Pt & { t: number }) | null = null;
  let pan: { from: RoomId; dir: Dir; t: number; start: Pt } | null = null;
  let flash = 0;
  let dash: { t: number; dir: Pt } | null = null;
  let dashCd = 0;
  const trail: (Pt & { t: number })[] = [];
  // 문 열림 정도(0 닫힘 ~ 1 열림). "방:방향" 키. 플레이어가 가까이 오면 열린다
  const doorOpen = new Map<string, number>();

  // 방이 바뀌는 길은 모두 스토어를 거친다(문 통과·목록 뷰·로비 카드·URL 해시).
  // 이웃한 방이면 그 방향으로 카메라를 패닝하고, 아니면 방 중앙에 나타난다.
  const unsubscribe = store.subscribe((s) => {
    if (s.room === room) return;
    const from = room;
    const start = { x: player.x, y: player.y };
    room = s.room;
    dash = null;
    trail.length = 0;
    path = [];
    marker = null;
    activeObject = null;
    const dir = s.moveDir;
    const spawn = dir ? spawnAt(room, OPPOSITE[dir]) : null;
    // 새 방의 문은 기본 닫힘. 막 지나온 문만 열린 채로 시작한다(지난번에 열어 둔 값이 남아 있으면 들어오자마자 닫히는 게 보인다)
    for (const d of DOORS[room]) doorOpen.set(`${room}:${d.side}`, 0);
    if (dir) doorOpen.set(`${room}:${OPPOSITE[dir]}`, 1);
    if (dir && spawn) {
      player.x = spawn.x;
      player.y = spawn.y;
      player.facing = dir;
      if (!reduceMotion) pan = { from, dir, t: 0, start };
    } else {
      placeAtEntry();
      pan = null;
      if (!reduceMotion) flash = 1;
    }
  });

  /* ---------- 입력 ---------- */
  const takeoverPlugin = () => {
    const p = ROOM_PLUGINS[room];
    return !pan && p?.takeover?.() ? p : null;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (isTyping(e)) return;
    const k = e.key.toLowerCase();
    const tp = isLocked(store.getState()) ? null : takeoverPlugin();
    if (tp) {
      keys[k] = true;
      if (tp.keydown?.(e) || k === " " || k.startsWith("arrow")) e.preventDefault();
      return;
    }
    if (k === "shift") { if (!e.repeat) startDash(); return; }
    if (k === "escape") { store.getState().closeSheets(); return; }
    // E로 연 창(py.Factory 코딩창)이 같은 키 입력 중에 입력칸에 포커스를 가져가면 "e"가 그대로 써진다 — 기본 동작을 막는다
    if (k === "e") { interact(); e.preventDefault(); }
    if (k === "q") store.getState().interactAlt();
    if (k === " " && !isLocked(store.getState())) { interact(); e.preventDefault(); }
    keys[k] = true;
    if (k.startsWith("arrow")) e.preventDefault();
  };
  // E·Space·터치 E: 방 플러그인이 먼저(py.Factory 떨어진 자원 줍기 등), 아니면 가까운 오브젝트
  function interact() {
    if (pan || isLocked(store.getState())) return;
    if (ROOM_PLUGINS[room]?.interact?.({ x: player.x, y: player.y })) return;
    store.getState().interact();
  }
  const onKeyUp = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
  addEventListener("keydown", onKeyDown);
  addEventListener("keyup", onKeyUp);
  addEventListener("blur", clearKeys);

  const toLogical = (e: PointerEvent): Pt => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * VW) / r.width, y: ((e.clientY - r.top) * VH) / r.height };
  };
  // 터치는 TouchControls가 탭을 판별해서 clicks에 넣는다.
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    if (e.button === 0) clicks.push(toLogical(e));
    else if (e.button === 2 && !pan && !isLocked(store.getState())) {
      const p = toLogical(e);
      ROOM_PLUGINS[room]?.secondary?.(objectAt(p)?.id ?? null, p);
    }
  };
  const onContextMenu = (e: Event) => e.preventDefault();
  const onHover = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    const p = toLogical(e);
    const hot = !takeoverPlugin() && (
      !!objectAt(p) || tileAt(Math.floor(p.x / TILE), Math.floor(p.y / TILE)) === "D" || !!ROOM_PLUGINS[room]?.hot?.(p)
    );
    const cursor = hot ? "pointer" : "default";
    if (canvas.style.cursor !== cursor) canvas.style.cursor = cursor;
  };
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onHover);
  canvas.addEventListener("contextmenu", onContextMenu);

  /* ---------- 맵 · 충돌 ---------- */
  function tileAt(col: number, row: number, r: RoomId = room) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return "#";
    return MAPS[r][row][col];
  }
  function solidAt(x: number, y: number) {
    const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
    const t = tileAt(c, r);
    return t === "#" || t === "P" || DECOR_SOLID[room].has(r * COLS + c);
  }
  function boxBlocked(cx: number, cy: number) {
    const hw = PLAYER_W / 2, hh = PLAYER_H / 2;
    return solidAt(cx - hw, cy - hh) || solidAt(cx + hw, cy - hh)
      || solidAt(cx - hw, cy + hh) || solidAt(cx + hw, cy + hh);
  }
  function objectBlocked(cx: number, cy: number) {
    for (const o of ROOMS[room].objects) {
      const c = objCenter(o);
      if (Math.abs(cx - c.x) < (objW(o) * TILE) / 2 + PLAYER_W / 2 && Math.abs(cy - c.y) < TILE * 0.6) return true;
    }
    return false;
  }
  const blocked = (x: number, y: number) => boxBlocked(x, y) || objectBlocked(x, y);

  function objectAt(p: Pt): RoomObject | null {
    for (const o of ROOMS[room].objects) {
      const x0 = o.col * TILE - 3, x1 = (o.col + objW(o)) * TILE + 3;
      const y0 = o.row * TILE + OBJ_TOP[o.kind] - 2, y1 = o.row * TILE + TILE;
      if (p.x >= x0 && p.x < x1 && p.y >= y0 && p.y < y1) return o;
    }
    return null;
  }

  /* ---------- 클릭 이동 (타일 격자 최단 경로) ---------- */
  const passable = (c: number, r: number) =>
    tileAt(c, r) !== "#" && tileAt(c, r) !== "P" && !OBJ_TILES[room].has(r * COLS + c) && !DECOR_SOLID[room].has(r * COLS + c);
  const tileCenter = (i: number): Pt => ({ x: (i % COLS) * TILE + TILE / 2, y: Math.floor(i / COLS) * TILE + TILE / 2 });

  function findPath(from: Pt, goal: Pt): Pt[] | null {
    const N = COLS * ROWS;
    const start = Math.floor(from.y / TILE) * COLS + Math.floor(from.x / TILE);
    const end = Math.floor(goal.y / TILE) * COLS + Math.floor(goal.x / TILE);
    const dist = new Float64Array(N).fill(Infinity);
    const prev = new Int16Array(N).fill(-1);
    const done = new Uint8Array(N);
    dist[start] = 0;
    for (;;) {
      let u = -1;
      for (let i = 0; i < N; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0) return null;
      if (u === end) break;
      done[u] = 1;
      const uc = u % COLS, ur = Math.floor(u / COLS);
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dc && !dr) continue;
          const c = uc + dc, r = ur + dr;
          if (!passable(c, r)) continue;
          // 대각선은 양옆이 모두 뚫려 있을 때만 — 벽 모서리를 깎고 지나가지 않게
          if (dc && dr && (!passable(uc + dc, ur) || !passable(uc, ur + dr))) continue;
          const v = r * COLS + c;
          const nd = dist[u] + (dc && dr ? Math.SQRT2 : 1);
          if (nd < dist[v]) { dist[v] = nd; prev[v] = u; }
        }
    }
    const tiles: number[] = [];
    for (let i = end; i !== start; i = prev[i]) tiles.push(i);
    tiles.reverse();
    const pts = tiles.map(tileCenter);
    if (pts.length) pts[pts.length - 1] = goal;
    else pts.push(goal);
    return pts;
  }

  function lineClear(a: Pt, b: Pt) {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3);
    for (let i = 1; i <= n; i++) if (blocked(lerp(a.x, b.x, i / n), lerp(a.y, b.y, i / n))) return false;
    return true;
  }

  function handleClick(p: Pt) {
    if (pan || isLocked(store.getState())) return;
    if (ROOM_PLUGINS[room]?.click?.(p)) { path = []; return; }
    const o = objectAt(p);
    if (o) {
      // 오브젝트를 직접 클릭하면 걸어갈 필요 없이 바로 상호작용
      path = [];
      store.getState().openObject(o.id);
      return;
    }
    const col = Math.floor(p.x / TILE), row = Math.floor(p.y / TILE);
    const t = tileAt(col, row);
    if (t === "#" || t === "P") return;
    const c = tileCenter(row * COLS + col);
    const slack = TILE / 2 - PLAYER_W / 2 - 1;
    const goal = t === "D" ? c : {
      x: Math.min(c.x + slack, Math.max(c.x - slack, p.x)),
      y: Math.min(c.y + slack, Math.max(c.y - slack, p.y)),
    };
    if (objectBlocked(goal.x, goal.y)) return;
    const found = findPath(player, goal);
    if (!found) return;
    path = found;
    stuck = 0;
    marker = { ...goal, t: 0 };
  }

  /** 경로를 따라갈 이동 벡터. 길이는 최대 1 — 목표를 지나치지 않도록 마지막 걸음은 줄인다. */
  function followPath(dt: number): Pt {
    while (path.length >= 2 && lineClear(player, path[1])) path.shift();
    while (path.length && Math.hypot(path[0].x - player.x, path[0].y - player.y) < 0.5) path.shift();
    if (!path.length) return { x: 0, y: 0 };
    const t = path[0];
    const d = Math.hypot(t.x - player.x, t.y - player.y);
    const k = Math.min(1, d / (SPEED * dt)) / d;
    return { x: (t.x - player.x) * k, y: (t.y - player.y) * k };
  }

  function startDash() {
    if (dash || dashCd > 0 || pan || takeoverPlugin() || isLocked(store.getState())) return;
    let d: Pt = axis();
    if (!d.x && !d.y && path.length) d = { x: path[0].x - player.x, y: path[0].y - player.y };
    if (!d.x && !d.y) d = DIR_VEC[player.facing];
    const len = Math.hypot(d.x, d.y) || 1;
    dash = { t: DASH_DIST / DASH_SPEED, dir: { x: d.x / len, y: d.y / len } };
    dashCd = DASH_CD;
    path = [];
    marker = null;
  }

  /* ---------- 업데이트 ---------- */
  function update(dt: number) {
    dashCd = Math.max(0, dashCd - dt);
    for (const p of trail) p.t += dt;
    while (trail.length && trail[0].t > DASH_TRAIL_S) trail.shift();
    while (clicks.length) handleClick(clicks.shift()!);
    if (marker && (marker.t += dt) > MARKER_S) marker = null;
    if (flash > 0) flash = Math.max(0, flash - (dt * 1000) / FLASH_MS);

    for (const d of DOORS[room]) {
      const near = Math.hypot(
        player.x - Math.max(d.x, Math.min(d.x + d.w, player.x)),
        player.y - Math.max(d.y, Math.min(d.y + d.h, player.y)),
      ) < DOOR_NEAR;
      const key = `${room}:${d.side}`, cur = doorOpen.get(key) ?? 0;
      const want = near; // 방 이동 중에도 같은 규칙 — 입구 앞에 선 캐릭터 쪽 문만 열려 있다
      const next = want ? Math.min(1, cur + dt / DOOR_OPEN_S) : Math.max(0, cur - dt / DOOR_OPEN_S);
      doorOpen.set(key, reduceMotion ? (want ? 1 : 0) : next);
    }

    if (pan) {
      pan.t += dt * 1000;
      player.moving = true;
      player.walkTime += dt;
      if (pan.t >= PAN_MS) pan = null;
      return;
    }
    ROOM_PLUGINS[room]?.update(dt);

    const tp = takeoverPlugin();
    for (; actions.pending > 0; actions.pending--) {
      if (tp) tp.action?.();
      else interact();
    }
    if (tp) { player.moving = false; path = []; marker = null; return; }
    if (isLocked(store.getState())) { player.moving = false; path = []; return; }

    if (dash) {
      // 축 분리로 미끄러진다 — 벽에 닿으면 그 축만 멈춘다
      const step = DASH_SPEED * dt;
      const nx = player.x + dash.dir.x * step;
      if (!blocked(nx, player.y)) player.x = nx;
      const ny = player.y + dash.dir.y * step;
      if (!blocked(player.x, ny)) player.y = ny;
      if (!reduceMotion) trail.push({ x: player.x, y: player.y, t: 0 });
      player.moving = true;
      player.walkTime += dt;
      if ((dash.t -= dt) <= 0) dash = null;
      checkDoor();
      if (!pan) checkNear();
      return;
    }

    let a = axis();
    if (a.x || a.y) path = []; // 키보드·조이스틱이 클릭 이동보다 우선
    else if (path.length) a = followPath(dt);

    player.moving = a.x !== 0 || a.y !== 0;
    if (player.moving) {
      if (Math.abs(a.x) > Math.abs(a.y)) player.facing = a.x > 0 ? "right" : "left";
      else player.facing = a.y > 0 ? "down" : "up";
      player.walkTime += dt;
    } else {
      player.walkTime = 0;
    }

    // 축 분리 이동 — 합쳐서 처리하면 벽에 비스듬히 부딪힐 때 완전히 멈춰 문 통과가 답답해진다.
    const ox = player.x, oy = player.y;
    const nx = player.x + a.x * SPEED * dt;
    if (!blocked(nx, player.y)) player.x = nx;
    const ny = player.y + a.y * SPEED * dt;
    if (!blocked(player.x, ny)) player.y = ny;

    if (path.length && player.x === ox && player.y === oy) {
      if ((stuck += dt) > 0.25) path = [];
    } else stuck = 0;

    checkDoor();
    if (!pan) checkNear();
  }

  function checkDoor() {
    const col = Math.floor(player.x / TILE), row = Math.floor(player.y / TILE);
    if (tileAt(col, row) !== "D") return;
    let dir: Dir | null = null;
    if (row === 0) dir = "up";
    else if (row === ROWS - 1) dir = "down";
    else if (col === 0) dir = "left";
    else if (col === COLS - 1) dir = "right";
    const dest = dir && ROOMS[room].exits[dir];
    if (dest) store.getState().enterRoom(dest); // 나머지는 스토어 구독 콜백이 처리
  }

  function checkNear() {
    let found: RoomObject | null = null, best = Infinity;
    for (const o of ROOMS[room].objects) {
      const c = objCenter(o);
      const reach = (objW(o) * TILE) / 2 + TILE * 1.1;
      const d = Math.hypot(player.x - c.x, player.y - c.y);
      if (d < reach && d < best) { found = o; best = d; }
    }
    activeObject = found;
    store.getState().setNearObject(found ? found.id : null);
    store.getState().setNearHint(ROOM_PLUGINS[room]?.hint?.({ x: player.x, y: player.y }) ?? null);
  }

  /** 문을 거치지 않고 나타날 때(새로고침·목록 뷰). 방 중앙이 전시물에 막혀 있으면 첫 문 앞에 선다. */
  function placeAtEntry() {
    player.x = VW / 2;
    player.y = VH / 2;
    if (!blocked(player.x, player.y)) return;
    const side = (["down", "left", "right", "up"] as Dir[]).map((d) => spawnAt(room, d)).find(Boolean);
    if (side) { player.x = side.x; player.y = side.y; }
  }

  /** side 쪽 문으로 들어왔을 때 서는 자리(문 안쪽 한 칸, 2칸짜리 문의 가운데). */
  function spawnAt(r: RoomId, side: Dir): Pt | null {
    const d = DOORS[r].find((d) => d.side === side);
    if (!d) return null;
    const v = DIR_VEC[side];
    return { x: d.x + d.w / 2 - v.x * TILE, y: d.y + d.h / 2 - v.y * TILE };
  }

  /* ---------- 렌더링 ---------- */
  function px(x: number, y: number, w: number, h: number, color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
  }

  function drawRoom(r: RoomId) {
    const map = MAPS[r];
    for (let row = 0; row < ROWS; row++) {
      for (let c = 0; c < COLS; c++) {
        const t = map[row][c], x = c * TILE, y = row * TILE;
        if (t === "#") {
          const side = row === 0 ? "top" : row === ROWS - 1 ? "bottom" : c === 0 ? "left" : "right";
          wallTile(px, PAL, x, y, side, c);
        } else if (t !== "D") { // 문 칸은 drawDoors가 한 덩어리로 그린다
          floorTile(px, PAL, x, y, c, row);
        }
      }
    }
    wallShadows(px, COLS, ROWS);
    const pn = PANEL_RECTS[r];
    if (pn) drawPanel(pn);
  }

  /**
   * 벽 크기의 화면 패널(AI 진화 방 왼쪽). 베젤(외곽선·금속 테두리) → 화면(어두운 바탕·격자·주사선).
   * 화면 안 내용(자동 전투)은 체험판 플러그인(evolution/sim.ts)이 panelScreen 영역에 그린다.
   */
  function drawPanel(pn: { x: number; y: number; w: number; h: number }) {
    const x = pn.x + 4, y = pn.y + 2, w = pn.w - 10, h = pn.h - 8;
    px(x + 3, y + h, w, 5, "rgba(0,0,0,.3)");                // 바닥 그림자
    px(x - 1, y - 1, w + 2, h + 2, PAL.outline);
    px(x, y, w, h, PAL.metal);                                // 베젤
    px(x, y, w, 2, PAL.metalHi);
    px(x + w - 3, y, 3, h, PAL.wallFace);
    const sc = panelScreen(pn);
    px(sc.x - 1, sc.y - 1, sc.w + 2, sc.h + 2, PAL.outline);
    px(sc.x, sc.y, sc.w, sc.h, PAL.void2);                    // 화면
    for (let gy = y + 6; gy < y + h - 10; gy += 12) px(x + 6, gy, w - 12, 1, PAL.floorB);   // 격자
    for (let gx = x + 6; gx < x + w - 6; gx += 12) px(gx, y + 6, 1, h - 16, PAL.floorB);
    for (let sy = y + 7; sy < y + h - 10; sy += 3) px(x + 6, sy, w - 12, 1, "rgba(255,255,255,.025)"); // 주사선
    px(x + w / 2 - 12, y + h - 7, 24, 3, PAL.wallFace);       // 아래 베젤 장식
    px(x + w - 12, y + h - 7, 3, 3, PAL.jade);                 // 전원 등
  }

  /** 장식: 러그는 바닥 위, 벽등은 벽 위, 화분·상자는 전시물과 같은 층 */
  function drawDecor(r: RoomId, layer: "floor" | "props") {
    for (const d of DECOR[r]) {
      const x = d.col * TILE, y = d.row * TILE;
      if (layer === "floor") {
        if (d.kind === "rug") rug(px, PAL, x, y, d.w * TILE, d.h * TILE);
      } else if (d.kind === "lamp") wallLamp(px, PAL, x, y);
      else if (d.kind === "plant") plant(px, PAL, x, y);
      else if (d.kind === "crate") crate(px, PAL, x, y);
    }
  }

  function drawDoors(r: RoomId) {
    for (const d of DOORS[r]) drawDoor(d, doorOpen.get(`${r}:${d.side}`) ?? 0);
  }

  /**
   * 자동문(2026-10-08, 시안 3종 — 자동문/여닫이 양문/열린 통로 — 중 사용자 선택).
   * 금속 문짝 두 장이 가운데에서 갈라져 미끄러지고, 문 너머는 이어지는 바닥이라 구멍처럼 보이지 않는다.
   * horiz = 위·아래 벽의 문(가로로 넓음), 아니면 좌우 벽의 문(세로로 김). open 0~1
   */
  function drawDoor(d: DoorRect, open: number) {
    const { x, y, w, h } = d, horiz = w > h;
    px(x, y, w, h, PAL.wallSide);
    // 문 너머 바닥(줄무늬)
    px(x + 3, y + 3, w - 6, h - 6, PAL.floorB);
    for (let i = 0; i < (horiz ? w : h) - 6; i += 6) {
      if (horiz) px(x + 3 + i, y + 3, 3, h - 6, PAL.floorA);
      else px(x + 3, y + 3 + i, w - 6, 3, PAL.floorA);
    }
    const half = ((horiz ? w : h) - 6) / 2, slide = Math.round(half * 0.92 * open);
    const leaf = (a: number, l: number) => {
      if (l <= 0) return;
      if (horiz) {
        px(x + 3 + a, y + 3, l, h - 6, PAL.metal);
        px(x + 3 + a, y + 3, l, 2, PAL.metalHi);      // 윗면 하이라이트
        px(x + 3 + a, y + h - 6, l, 3, PAL.wallFace); // 아래 그림자
      } else {
        px(x + 3, y + 3 + a, w - 6, l, PAL.metal);
        px(x + 3, y + 3 + a, 2, l, PAL.metalHi);
        px(x + w - 6, y + 3 + a, 3, l, PAL.wallFace);
      }
    };
    leaf(0, half - slide);
    leaf(half + slide, half - slide);
    if (open < 0.05) { // 닫혔을 때 가운데 이음매
      if (horiz) px(x + 3 + half - 1, y + 3, 2, h - 6, PAL.void);
      else px(x + 3, y + 3 + half - 1, w - 6, 2, PAL.void);
    }
    // 문틀과 센서 등: 닫히면 주황, 열리면 민트
    const lamp = open > 0.5 ? PAL.jade : PAL.brass;
    if (horiz) { px(x, y, w, 3, PAL.brassDark); px(x + w / 2 - 3, y, 6, 2, lamp); }
    else { px(x, y, 3, h, PAL.brassDark); px(x, y + h / 2 - 3, 2, 6, lamp); }
  }

  function drawObject(o: RoomObject, isNear: boolean, now: number) {
    const x = o.col * TILE, y = o.row * TILE, W = objW(o) * TILE;
    px(x - 2, y + TILE - 6, W + 4, 5, "rgba(0,0,0,.28)"); // 그림자

    // 외곽선을 두른 사각형 — 그래픽 개선 B안의 기본 단위
    const ob = (bx: number, by: number, bw: number, bh: number, c: string) => {
      px(bx - 1, by - 1, bw + 2, bh + 2, PAL.outline);
      px(bx, by, bw, bh, c);
    };
    if (o.kind === "miner") {
      ob(x + 2, y - 12, W - 4, 3, PAL.wallTop);           // 채굴탑 윗보
      px(x + 2, y - 12, W - 4, 1, PAL.wallHi);
      ob(x + 10, y - 9, 4, 17, PAL.wallSide);             // 탑
      px(x + 10, y - 9, 1, 17, PAL.wallHi);
      ob(x + 3, y + 6, W - 6, 12, PAL.brassDark);         // 받침
      px(x + 3, y + 6, W - 6, 2, PAL.brass);
      px(x + 3, y + 16, W - 6, 2, PAL.carpetDark);
      px(x + 5, y + 10, 1, 1, PAL.metalHi);               // 리벳
      px(x + W - 6, y + 10, 1, 1, PAL.metalHi);
      px(x + 9, y + 18, 6, 3, PAL.void);                  // 구멍
    } else if (o.kind === "productor") {
      ob(x + 15, y - 14, 4, 8, PAL.wallSide);             // 굴뚝
      px(x + 15, y - 14, 4, 1, PAL.wallHi);
      ob(x + 2, y - 6, W - 4, 22, PAL.wallSide);          // 본체
      px(x + 2, y - 6, W - 4, 2, PAL.wallHi);
      px(x + W - 5, y - 4, 3, 20, PAL.wallFace);
      px(x + 5, y - 2, 8, 6, PAL.void);                   // 창
      px(x + 6, y - 1, 3, 1, PAL.metalHi);
      ob(x + 5, y + 10, W - 10, 4, PAL.brassDark);        // 배출구
      px(x + 5, y + 10, W - 10, 1, PAL.brass);
    } else if (o.kind === "start-button") {
      ob(x, y + 4, W, 16, PAL.brassDark);                 // 받침
      ob(x + 2, y, W - 4, 16, isNear ? PAL.ink : PAL.brass);
      px(x + 2, y, W - 4, 2, isNear ? PAL.metalHi : PAL.hairHi);
      px(x + 2, y + 14, W - 4, 2, isNear ? PAL.skinShade : PAL.brassDark);
      ctx.fillStyle = PAL.void;
      ctx.font = "10px Galmuri9, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(o.label, Math.round(x + W / 2), Math.round(y + 8));
    } else if (o.kind === "incubator") {
      ob(x + 2, y - 14, W - 4, 4, PAL.wallTop);           // 뚜껑
      px(x + 2, y - 14, W - 4, 1, PAL.wallHi);
      ob(x + 3, y - 10, W - 6, TILE + 2, PAL.wallSide);   // 유리 테두리
      px(x + 5, y - 8, W - 10, TILE - 2, PAL.void2);
      px(x + 5, y - 1, W - 10, TILE - 9, PAL.jade);       // 배양액
      px(x + 5, y - 1, W - 10, 1, PAL.metalHi);
      px(x + 9, y + 1, 6, 5, PAL.leafDark);               // 안의 무언가
      px(x + 6, y - 7, 1, TILE - 6, PAL.metalHi);         // 유리 반사
      const b = Math.floor(now / 250) % 9;
      px(x + 7, y + 12 - b, 2, 2, PAL.ink);               // 기포
      ob(x + 1, y + 16, W - 2, 5, PAL.brassDark);         // 받침
      px(x + 1, y + 16, W - 2, 1, PAL.brass);
    } else if (o.kind === "pad") {
      // 강화 버튼(바닥에 선 콘솔). 아이콘·단계 표시는 체험판 플러그인이 그린다
      ob(x + 4, y + 2, W - 8, 18, PAL.metal);
      px(x + 4, y + 2, W - 8, 2, PAL.metalHi);
      px(x + W - 7, y + 4, 3, 16, PAL.wallFace);
      ob(x + 8, y + 3, 9, 7, isNear ? PAL.carpetDark : PAL.void2); // 화면
      ob(x + 7, y + 13, 10, 4, isNear ? PAL.hairHi : PAL.brass);    // 누르는 버튼
    } else if (o.kind === "bookshelf") {
      ob(x, y - 16, W, TILE + 14, PAL.brassDark);         // 틀
      px(x, y - 16, W, 2, PAL.brass);
      px(x + 2, y - 14, W - 4, TILE + 10, PAL.void2);
      const books = [PAL.jade, PAL.brass, PAL.inkDim, PAL.metal];
      [y - 13, y - 2, y + 9].forEach((top, shelf) => {
        for (let i = 0, bx = x + 3; bx < x + W - 6; i++) {
          const bw = 3 + ((i + shelf) % 3 === 0 ? 1 : 0);
          const dip = (i + shelf * 2) % 4 === 0 ? 2 : 0;
          px(bx, top + dip, bw, 9 - dip, books[(i + shelf) % 4]);
          px(bx, top + dip, 1, 9 - dip, PAL.outline);     // 책 사이 그림자
          bx += bw + 1;
        }
        px(x + 2, top + 9, W - 4, 2, PAL.brassDark);    // 선반
      });
    }

    if (isNear) {
      const cx = x + W / 2 - 4, top = y + OBJ_TOP[o.kind] - 14;
      const bob = Math.sin(now / 220) * 2;
      px(cx, top + bob, 8, 10, PAL.jade);
      px(cx + 2, top + 2 + bob, 4, 2, PAL.void);
      px(cx + 2, top + 5 + bob, 3, 2, PAL.void);
      px(cx + 2, top + 8 + bob, 4, 2, PAL.void);
    }
  }

  function drawScene(r: RoomId, ox: number, oy: number, now: number, withNear: boolean) {
    ctx.save();
    ctx.translate(Math.round(ox), Math.round(oy));
    drawRoom(r);
    drawDecor(r, "floor");
    drawDoors(r);
    drawDecor(r, "props");
    for (const o of ROOMS[r].objects) drawObject(o, withNear && o === activeObject, now);
    ROOM_PLUGINS[r]?.draw(kit(now));
    ctx.restore();
  }

  const label: DrawKit["label"] = (t, x, y, o = {}) =>
    labels.push({ t, x, y, color: o.color ?? PAL.ink, align: o.align ?? "left", size: o.size ?? 8, alpha: o.alpha ?? 1 });
  const kit = (now: number): DrawKit => ({ ctx, PAL, px, now, label });
  const hpx = (x: number, y: number, w: number, h: number, color: string) => {
    hud.fillStyle = color;
    hud.fillRect(x | 0, y | 0, w | 0, h | 0);
  };
  const hudKit = (now: number): DrawKit => ({ ctx: hud, PAL, px: hpx, now, label });

  function drawMarker() {
    if (!marker) return;
    const k = marker.t / MARKER_S;
    const r = 3 + k * 5;
    ctx.globalAlpha = 1 - k;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) px(marker.x + sx * r - 1, marker.y + sy * r - 1, 2, 2, PAL.jade);
    ctx.globalAlpha = 1;
  }

  function drawPlayer(cx: number, cy: number) {
    const bob = player.moving && Math.floor(player.walkTime * 11) % 2 ? 1 : 0;
    drawHero(px, PAL, cx, cy, player.facing as Facing, bob);
  }

  /** 방 하나의 광원(방 좌표 + 패닝 오프셋). 천장 중앙등 · 벽등 · 문 센서등 · 빛나는 전시물 · 체험판 광원 */
  function roomLights(r: RoomId, ox: number, oy: number, out: Light[]) {
    out.push({ x: VW / 2 + ox, y: VH / 2 + oy, r: 210, color: PAL.lightWarm, a: 0.32 });
    for (const d of DECOR[r])
      if (d.kind === "lamp") out.push({ x: d.col * TILE + 12 + ox, y: d.row * TILE + 18 + oy, r: 100, color: PAL.lightWarm, a: 0.55, bloom: true });
    for (const d of DOORS[r]) {
      const open = doorOpen.get(`${r}:${d.side}`) ?? 0, horiz = d.w > d.h;
      const sx = horiz ? d.x + d.w / 2 : d.x + (d.side === "left" ? 1 : d.w - 1);
      const sy = horiz ? d.y + (d.side === "up" ? 1 : 2) : d.y + d.h / 2;
      out.push({ x: sx + ox, y: sy + oy, r: 26, color: open > 0.5 ? PAL.jade : PAL.brass, a: 0.45, bloom: true });
      if (open > 0) out.push({ x: d.x + d.w / 2 + ox, y: d.y + d.h / 2 + oy, r: 56, color: PAL.lightWarm, a: 0.3 * open });
    }
    const pn = PANEL_RECTS[r];
    if (pn) out.push({ x: pn.x + pn.w / 2 + ox, y: pn.y + pn.h / 2 + oy, r: 150, color: PAL.jade, a: 0.3, bloom: false });
    for (const o of ROOMS[r].objects) {
      const c = objCenter(o);
      if (o.kind === "incubator") out.push({ x: c.x + ox, y: c.y - 4 + oy, r: 70, color: PAL.jade, a: 0.55, bloom: true });
      if (o.kind === "start-button") out.push({ x: c.x + ox, y: c.y + oy, r: 80, color: PAL.brass, a: 0.4, bloom: true });
    }
    if (r === room) for (const L of ROOM_PLUGINS[r]?.lights?.() ?? []) out.push({ ...L, x: L.x + ox, y: L.y + oy });
  }

  function render(now: number) {
    hud.clearRect(0, 0, VW, VH);
    labels = [];
    const tp = takeoverPlugin();
    if (tp?.render) {
      tp.render(kit(now));
      tp.renderHud?.(hudKit(now));
      frameLights = tp.lights?.() ?? [];
      frameBoost = tp.lightBoost ?? 0;
      return;
    }
    const lights: Light[] = [];
    frameLights = lights;
    frameBoost = 0;
    px(0, 0, VW, VH, PAL.void);
    if (pan) {
      // 새 방이 문 방향에서 밀려 들어오고, 캐릭터는 옛 방의 문에서 새 방의 입구까지 함께 이동한다.
      const p = easeInOut(Math.min(1, pan.t / PAN_MS));
      const v = DIR_VEC[pan.dir];
      const nx = v.x * VW * (1 - p), ny = v.y * VH * (1 - p);
      drawScene(pan.from, nx - v.x * VW, ny - v.y * VH, now, false);
      drawScene(room, nx, ny, now, false);
      roomLights(pan.from, nx - v.x * VW, ny - v.y * VH, lights);
      roomLights(room, nx, ny, lights);
      const ppx = lerp(pan.start.x, player.x, p), ppy = lerp(pan.start.y, player.y, p);
      drawPlayer(ppx, ppy);
      lights.push({ x: ppx, y: ppy - 6, r: 70, color: PAL.lightWarm, a: 0.28 });
    } else {
      drawScene(room, 0, 0, now, true);
      drawMarker();
      for (const p of trail) {
        ctx.globalAlpha = 0.35 * (1 - p.t / DASH_TRAIL_S);
        drawPlayer(p.x, p.y);
      }
      ctx.globalAlpha = 1;
      drawPlayer(player.x, player.y);
      ROOM_PLUGINS[room]?.drawTop?.(hudKit(now));
      roomLights(room, 0, 0, lights);
      lights.push({ x: player.x, y: player.y - 6, r: 70, color: PAL.lightWarm, a: 0.28 });
    }
    if (flash > 0) {
      ctx.globalAlpha = flash;
      px(0, 0, VW, VH, PAL.void);
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- 루프 ---------- */
  placeAtEntry();
  let last = performance.now();
  let raf = requestAnimationFrame(function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    render(now);
    present(now);
    raf = requestAnimationFrame(loop);
  });

  return () => {
    cancelAnimationFrame(raf);
    unsubscribe();
    removeEventListener("keydown", onKeyDown);
    removeEventListener("keyup", onKeyUp);
    removeEventListener("blur", clearKeys);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onHover);
    canvas.removeEventListener("contextmenu", onContextMenu);
    clearKeys();
    clicks.length = 0;
  };
}
