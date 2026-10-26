import { useEffect } from "react";
import { ROOMS } from "../game/rooms";
import { usePyfStore } from "../game/pyfactory/store";
import { useRlStore } from "../game/roguelike/store";
import { useArchiveStore } from "../content/archive/store";
import { useGameStore } from "../store";
import ControlsPanel from "./ControlsPanel";
import GameWindow from "./GameWindow";
import RoomStage from "./RoomStage";
import PyfHud from "./pyfactory/PyfHud";
import EvoHud from "./evolution/EvoHud";

export default function GameSection() {
  const room = useGameStore((s) => s.room);
  const openList = useGameStore((s) => s.openList);
  const r = ROOMS[room];

  const rlPlaying = useRlStore((s) => s.phase !== "idle");

  // 방을 떠나면(목록 뷰·URL 등) 그 방 체험판의 떠 있는 창을 닫고, 진행 중인 판은 끝내고, 열린 문서는 목록으로 되돌린다.
  useEffect(() => {
    if (room !== "pyfactory") usePyfStore.getState().closeCoding();
    if (room !== "roguelike") useRlStore.getState().quit();
    if (room !== "archive") useArchiveStore.getState().close();
  }, [room]);

  return (
    <section id="game-section" className="game-section">
      <div className="sec-head">
        <span className="sec-num">01</span>
        <span className="sec-name">전시관</span>
        <button id="to-list" onClick={openList}>목록으로 보기</button>
      </div>
      <h2 id="game-title">
        <span className="game-title-pre">게임 포트폴리오 전시</span>
        {r.name}
      </h2>

      <ControlsPanel />
      <GameWindow />

      <p id="room-tag">
        {room === "roguelike" && rlPlaying
          ? "1분만 버티면 클리어! 공격은 자동입니다. 몰려오는 적을 피하며 레벨업마다 아이템을 고르세요."
          : r.tag}
      </p>
      {room === "pyfactory" && <PyfHud />}
      {room === "evolution" && <EvoHud />}
      <RoomStage />
    </section>
  );
}
