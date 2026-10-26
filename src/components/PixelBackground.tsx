import { useEffect, useRef } from "react";
import { DIR_VEC } from "../game/rooms";
import { useGameStore } from "../store";

/*
 * 페이지 전체 뒤에 깔리는 도트 파티클 배경.
 * 저해상도 캔버스를 정수배(PIXEL)로 늘려 게임창과 같은 도트 느낌을 낸다.
 * 텍스트를 읽는 페이지라 대비는 낮게, 움직임은 느리게 유지할 것.
 */

const PIXEL = 3;                 // 배경 1도트 = 3 CSS px
const DENSITY = 1 / 600;         // 논리 픽셀당 파티클 수
const MAX_PARTICLES = 480;
const REPEL_RADIUS = 40;         // 커서가 파티클을 밀어내는 반경(논리 px)
const SPARK_STEP = 5;            // 커서가 이만큼(논리 px) 움직일 때마다 불씨 하나
const SPARK_LIFE = 0.9;          // 초
const MAX_SPARKS = 60;
const REPEL_FORCE = 140;
const RETURN_RATE = 1.8;         // 밀려난 파티클이 원래 흐름으로 돌아오는 속도
const MOUSE_PARALLAX = [3, 7, 13];      // 층별 마우스 시차 최대 이동량(논리 px)
const SCROLL_PARALLAX = [0.04, 0.09, 0.16];
const ROOM_SHIFT = 70;                   // 방 이동 때 배경이 카메라 반대쪽으로 흐르는 양(논리 px)
const ROOM_LAYER = [0.35, 0.65, 1];

type Layer = 0 | 1 | 2;
type Particle = {
  x: number; y: number;
  vx: number; vy: number;
  baseVx: number; baseVy: number;
  layer: Layer;
  size: number;
  color: string;
  alpha: number;
  twinkle: number; // 0이면 반짝이지 않음
  phase: number;
};

type Spark = { x: number; y: number; vx: number; vy: number; age: number; color: string };

const wrap = (v: number, max: number) => ((v % max) + max) % max;

export default function PixelBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    // 배경은 게임창 바깥(사이트) 색을 쓴다 — 밝은 종이 바탕 위의 먹색 먼지 + 주황 포인트.
    const css = getComputedStyle(document.documentElement);
    const site = (k: string) => css.getPropertyValue(k).trim();
    const PAL = { muted: site("--text-3"), text: site("--text"), accent: site("--accent") };
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const colors = [
      { c: PAL.muted, w: 0.6 },
      { c: PAL.text, w: 0.28 },
      { c: PAL.accent, w: 0.12 },
    ];
    const pickColor = () => {
      let r = Math.random();
      for (const { c, w } of colors) if ((r -= w) <= 0) return c;
      return colors[0].c;
    };

    let W = 0, H = 0;
    const particles: Particle[] = [];

    function spawn(): Particle {
      const layer = (Math.random() < 0.5 ? 0 : Math.random() < 0.65 ? 1 : 2) as Layer;
      const speed = [1.2, 2.2, 3.6][layer];
      const baseVx = (Math.random() * 0.6 + 0.2) * speed;  // 오른쪽 위로 느리게 흐른다
      const baseVy = -(Math.random() * 0.8 + 0.4) * speed;
      const color = pickColor();
      const accent = color === PAL.accent;
      return {
        x: Math.random() * W, y: Math.random() * H,
        vx: baseVx, vy: baseVy, baseVx, baseVy,
        layer,
        size: layer === 2 && Math.random() < 0.5 ? 2 : 1,
        color,
        alpha: [0.14, 0.22, 0.32][layer] + (accent ? 0.12 : 0),
        twinkle: accent || Math.random() < 0.15 ? Math.random() * 2 + 1 : 0,
        phase: Math.random() * Math.PI * 2,
      };
    }

    function resize() {
      W = Math.ceil(innerWidth / PIXEL);
      H = Math.ceil(innerHeight / PIXEL);
      canvas.width = W;
      canvas.height = H;
      canvas.style.width = W * PIXEL + "px";
      canvas.style.height = H * PIXEL + "px";
      // 모바일 주소창이 접힐 때마다 resize가 오므로 다시 뿌리지 않고 개수만 맞춘다.
      const target = Math.min(MAX_PARTICLES, Math.round(W * H * DENSITY));
      while (particles.length < target) particles.push(spawn());
      particles.length = target;
      for (const p of particles) { p.x = wrap(p.x, W); p.y = wrap(p.y, H); }
    }

    const mouse = { x: 0, y: 0, active: false, trail: 0 };
    const offset = [0, 1, 2].map(() => ({ x: 0, y: 0 }));
    // 이웃한 방으로 옮기면 게임창 카메라가 그 방향으로 움직이므로, 배경은 반대쪽으로 흘려 보낸다.
    const cam = { x: 0, y: 0, tx: 0, ty: 0 };
    const shiftX = (l: Layer) => offset[l].x + cam.x * ROOM_LAYER[l];
    const shiftY = (l: Layer) => offset[l].y + cam.y * ROOM_LAYER[l];
    const unsubscribe = useGameStore.subscribe((s, prev) => {
      if (s.room === prev.room || !s.moveDir) return;
      const v = DIR_VEC[s.moveDir];
      cam.tx -= v.x * ROOM_SHIFT;
      cam.ty -= v.y * ROOM_SHIFT;
    });
    const sparks: Spark[] = [];

    function addSpark(x: number, y: number) {
      if (sparks.length >= MAX_SPARKS) sparks.shift();
      sparks.push({
        x, y,
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 10 - 4, // 불씨처럼 위로 떠오른다
        age: 0,
        color: Math.random() < 0.7 ? PAL.accent : PAL.text,
      });
    }

    function draw(t: number) {
      ctx.clearRect(0, 0, W, H);
      const scroll = scrollY / PIXEL;
      for (const p of particles) {
        const dx = wrap(p.x + shiftX(p.layer), W);
        const dy = wrap(p.y + shiftY(p.layer) - scroll * SCROLL_PARALLAX[p.layer], H);

        let a = p.alpha;
        if (p.twinkle) a *= 0.55 + 0.45 * Math.sin(t * 0.001 * p.twinkle + p.phase);
        if (mouse.active) {
          const d = Math.hypot(dx - mouse.x, dy - mouse.y);
          const glow = 1 - d / (REPEL_RADIUS * 1.8);
          if (glow > 0) a = Math.min(1, a + glow * 0.7);
        }
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(dx | 0, dy | 0, p.size, p.size);
      }
      for (const s of sparks) {
        ctx.globalAlpha = 0.85 * (1 - s.age / SPARK_LIFE);
        ctx.fillStyle = s.color;
        ctx.fillRect(s.x | 0, s.y | 0, 1, 1);
      }
      ctx.globalAlpha = 1;
    }

    function update(dt: number) {
      const scroll = scrollY / PIXEL;
      const nx = mouse.active ? (mouse.x - W / 2) / (W / 2) : 0;
      const ny = mouse.active ? (mouse.y - H / 2) / (H / 2) : 0;
      const ease = Math.min(1, dt * 3);
      offset.forEach((o, i) => {
        // 커서 반대쪽으로 살짝 밀려 깊이감이 생긴다. 가까운 층일수록 많이 움직인다.
        o.x += (-nx * MOUSE_PARALLAX[i] - o.x) * ease;
        o.y += (-ny * MOUSE_PARALLAX[i] - o.y) * ease;
      });
      const camEase = Math.min(1, dt * 7);
      cam.x += (cam.tx - cam.x) * camEase;
      cam.y += (cam.ty - cam.y) * camEase;

      const back = Math.min(1, RETURN_RATE * dt);
      for (const p of particles) {
        if (mouse.active) {
          const dx = wrap(p.x + shiftX(p.layer), W) - mouse.x;
          const dy = wrap(p.y + shiftY(p.layer) - scroll * SCROLL_PARALLAX[p.layer], H) - mouse.y;
          const d = Math.hypot(dx, dy);
          if (d > 0.01 && d < REPEL_RADIUS) {
            const f = (1 - d / REPEL_RADIUS) * REPEL_FORCE * (0.6 + p.layer * 0.3);
            p.vx += (dx / d) * f * dt;
            p.vy += (dy / d) * f * dt;
          }
        }
        p.vx += (p.baseVx - p.vx) * back;
        p.vy += (p.baseVy - p.vy) * back;
        p.x = wrap(p.x + p.vx * dt, W);
        p.y = wrap(p.y + p.vy * dt, H);
      }

      for (const s of sparks) {
        s.age += dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 1 - Math.min(1, dt * 2);
      }
      while (sparks.length && sparks[0].age >= SPARK_LIFE) sparks.shift();
    }

    resize();

    if (reduceMotion) {
      draw(0);
      const onResize = () => { resize(); draw(0); };
      addEventListener("resize", onResize);
      return () => { unsubscribe(); removeEventListener("resize", onResize); };
    }

    const onPointerMove = (e: PointerEvent) => {
      const x = e.clientX / PIXEL, y = e.clientY / PIXEL;
      if (mouse.active) {
        // 빠르게 휘두르면 이벤트 간격이 벌어지므로, 불씨를 도착점이 아니라 이동 경로를 따라 뿌린다.
        const len = Math.hypot(x - mouse.x, y - mouse.y);
        let dist = SPARK_STEP - mouse.trail;
        while (dist <= len) {
          const k = dist / len;
          addSpark(mouse.x + (x - mouse.x) * k, mouse.y + (y - mouse.y) * k);
          dist += SPARK_STEP;
        }
        mouse.trail = len - (dist - SPARK_STEP);
      }
      mouse.x = x;
      mouse.y = y;
      mouse.active = true;
    };
    const onPointerEnd = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") mouse.active = false;
    };
    const onLeave = () => { mouse.active = false; };
    addEventListener("pointermove", onPointerMove, { passive: true });
    addEventListener("pointerup", onPointerEnd);
    addEventListener("pointercancel", onPointerEnd);
    document.documentElement.addEventListener("mouseleave", onLeave);
    addEventListener("blur", onLeave);
    addEventListener("resize", resize);

    let last = performance.now();
    let raf = requestAnimationFrame(function loop(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      update(dt);
      draw(now);
      raf = requestAnimationFrame(loop);
    });

    return () => {
      cancelAnimationFrame(raf);
      unsubscribe();
      removeEventListener("pointermove", onPointerMove);
      removeEventListener("pointerup", onPointerEnd);
      removeEventListener("pointercancel", onPointerEnd);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      removeEventListener("blur", onLeave);
      removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="pixel-bg" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
