import { useEffect, useRef, useState, type PointerEvent } from "react";
import { VW, VH } from "../game/constants";
import { actions, clicks, stick } from "../game/input";

const STICK_R = 52; // 조이스틱 반지름(px)
const MAX_PULL = 44;
// 짧게 톡 친 터치는 조이스틱이 아니라 "그 위치로 이동/상호작용"으로 처리한다.
const TAP_MS = 250;
const TAP_SLOP = 10;

type Knob = { left: number; top: number; kx: number; ky: number };

export default function TouchControls() {
  const [isTouch] = useState(() => matchMedia("(pointer: coarse)").matches);
  const [knob, setKnob] = useState<Knob | null>(null);
  const pointerId = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0, t: 0 });

  useEffect(() => () => {
    stick.active = false;
    stick.dx = stick.dy = 0;
  }, []);

  if (!isTouch) return null;

  function onDown(e: PointerEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return; // E 버튼은 제외
    const rect = e.currentTarget.getBoundingClientRect();
    pointerId.current = e.pointerId;
    origin.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    stick.active = true;
    setKnob({ left: e.clientX - rect.left - STICK_R, top: e.clientY - rect.top - STICK_R, kx: 0, ky: 0 });
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerId !== pointerId.current) return;
    const dx = e.clientX - origin.current.x, dy = e.clientY - origin.current.y;
    const m = Math.hypot(dx, dy);
    const k = m > MAX_PULL ? MAX_PULL / m : 1;
    stick.dx = (dx * k) / MAX_PULL;
    stick.dy = (dy * k) / MAX_PULL;
    setKnob((prev) => prev && { ...prev, kx: dx * k, ky: dy * k });
  }

  function onEnd(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerId !== pointerId.current) return;
    pointerId.current = null;
    stick.active = false;
    stick.dx = stick.dy = 0;
    setKnob(null);

    const o = origin.current;
    const isTap = e.type === "pointerup" && performance.now() - o.t < TAP_MS
      && Math.hypot(e.clientX - o.x, e.clientY - o.y) < TAP_SLOP;
    if (isTap) {
      const r = e.currentTarget.getBoundingClientRect();
      clicks.push({ x: ((e.clientX - r.left) * VW) / r.width, y: ((e.clientY - r.top) * VH) / r.height });
    }
  }

  return (
    <div id="touch" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onEnd} onPointerCancel={onEnd}>
      {knob && (
        <div id="stick" style={{ left: knob.left, top: knob.top }}>
          <i style={{ transform: `translate(${knob.kx}px, ${knob.ky}px)` }} />
        </div>
      )}
      {/* 엔진이 다음 프레임에 처리: 허브에선 상호작용, 로그라이크 중엔 대시 */}
      <button id="btn-e" aria-label="상호작용" onClick={() => { actions.pending++; }}>E</button>
    </div>
  );
}
