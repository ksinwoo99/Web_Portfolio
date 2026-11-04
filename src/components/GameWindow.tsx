import { useEffect, useRef } from "react";
import { VW, VH } from "../game/constants";
import { startEngine } from "../game/engine";
import { useGameStore } from "../store";
import TouchControls from "./TouchControls";
import CodingWindow from "./pyfactory/CodingWindow";
import RlOverlay from "./roguelike/RlOverlay";

const PAD = 10;    // .game-window 안쪽 여백(한쪽)
const MARGIN = 12; // 화면 높이에 맞출 때 위아래로 남기는 틈

export default function GameWindow() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const room = useGameStore((s) => s.room);

  useEffect(() => startEngine(canvasRef.current!), []);

  /*
   * 게임창은 브라우저 폭에 맞춰 연속으로 커진다(2026-11-04 사용자 요청 — "비율은 맞추되 페이지에 꽉 차게").
   * 본문 폭(--page)에 묶이지 않고 양옆 여백만 남긴 채 넓어지며, 높이는 고정 상단바 아래 한 화면에 다 들어오는 데까지.
   * 도트가 뭉개지지 않게 화면 캔버스의 실제 픽셀 크기는 384×240의 정수배(k)로 두고 엔진이 최근접 확대로 채운다.
   * 그걸 CSS 크기로 살짝 줄여 보여주므로(k는 필요한 배율의 올림) 픽셀 경계가 고르게 유지된다.
   */
  useEffect(() => {
    const wrap = wrapRef.current!, canvas = canvasRef.current!;
    const section = wrap.parentElement!;
    const resize = () => {
      const cs = getComputedStyle(section);
      const gutter = parseFloat(cs.paddingLeft); // 페이지 양옆 여백(넓은 화면 24px, 좁은 화면 16px)
      const inner = section.clientWidth - gutter - parseFloat(cs.paddingRight);
      const byWidth = document.documentElement.clientWidth - gutter * 2 - PAD * 2;
      const header = document.querySelector(".site-header")?.getBoundingClientRect().height ?? 0;
      const byHeight = ((innerHeight - header - PAD * 2 - MARGIN * 2) * VW) / VH;
      const w = Math.max(Math.min(byWidth, byHeight), Math.min(byWidth, VW)); // 너무 낮은 화면에서도 1배 밑으로는 안 줄임
      // 본문 폭보다 넓으면 양옆으로 똑같이 튀어나오게(가운데 정렬)
      const over = Math.floor(w) + PAD * 2 - inner;
      wrap.style.marginLeft = over > 0 ? -Math.ceil(over / 2) + "px" : "";
      canvas.style.width = Math.floor(w) + "px";
      canvas.style.height = Math.round((w * VH) / VW) + "px";
      const k = Math.max(1, Math.ceil((w * devicePixelRatio) / VW - 0.01));
      if (canvas.width !== VW * k) {
        canvas.width = VW * k;
        canvas.height = VH * k;
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(section);
    addEventListener("resize", resize); // 화면 높이·배율(확대/축소) 변화
    return () => {
      ro.disconnect();
      removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="game-window" ref={wrapRef}>
      <div className="stage">
        {/* 터치 조작층은 캔버스 영역만 덮는다 — 좁은 화면에서 아래로 내려가는 코딩창을 가리지 않게 */}
        <div className="screen" id="game-screen">
          <canvas id="game" ref={canvasRef} aria-label="포트폴리오 허브 맵" />
          <TouchControls />
          {room === "roguelike" && <RlOverlay />}
        </div>
        {room === "pyfactory" && <CodingWindow />}
      </div>
    </div>
  );
}
