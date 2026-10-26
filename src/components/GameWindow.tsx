import { useEffect, useRef } from "react";
import { VW, VH } from "../game/constants";
import { startEngine } from "../game/engine";
import { useGameStore } from "../store";
import TouchControls from "./TouchControls";
import CodingWindow from "./pyfactory/CodingWindow";
import RlOverlay from "./roguelike/RlOverlay";

const PAD = 10;          // .game-window 안쪽 여백(한쪽)
const TOP_RESERVE = 110; // 게임창 위쪽(고정 상단바 등)에 남겨둘 높이 — 게임창 전체가 한 화면에 들어오게

export default function GameWindow() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const room = useGameStore((s) => s.room);

  useEffect(() => startEngine(canvasRef.current!), []);

  /*
   * 게임창은 페이지 폭(그리고 화면 높이)에 맞춰 연속으로 커진다.
   * 도트가 뭉개지지 않게 화면 캔버스의 실제 픽셀 크기는 384×240의 정수배(k)로 두고 엔진이 최근접 확대로 채운다.
   * 그걸 CSS 크기로 살짝 줄여 보여주므로(k는 필요한 배율의 올림) 픽셀 경계가 고르게 유지된다.
   */
  useEffect(() => {
    const wrap = wrapRef.current!, canvas = canvasRef.current!;
    const section = wrap.parentElement!;
    const resize = () => {
      const cs = getComputedStyle(section);
      const byWidth = section.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - PAD * 2;
      const byHeight = ((innerHeight - TOP_RESERVE) * VW) / VH;
      const w = Math.max(Math.min(byWidth, byHeight), Math.min(byWidth, VW)); // 너무 낮은 화면에서도 1배 밑으로는 안 줄임
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
        <div className="screen">
          <canvas id="game" ref={canvasRef} aria-label="포트폴리오 허브 맵" />
          <TouchControls />
          {room === "roguelike" && <RlOverlay />}
        </div>
        {room === "pyfactory" && <CodingWindow />}
      </div>
    </div>
  );
}
