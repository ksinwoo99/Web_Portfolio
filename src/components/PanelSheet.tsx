import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useArchiveStore } from "../content/archive/store";
import { OBJECTS_BY_ID } from "../game/rooms";
import { useGameStore } from "../store";
import Sheet from "./Sheet";

// 게임창이 이 폭 이상이면 전시물 팝업을 게임창 안에 띄운다(사용자 요청 2026-11-04, 시안 A "종이 카드").
// 더 좁으면(휴대폰 등) 게임창 안이 너무 작아 읽기 어려우므로 예전처럼 페이지 전체 모달.
const IN_GAME_MIN = 560;

/** 지금 팝업을 넣을 게임 화면(.screen). 게임창이 작으면 null */
function useGameScreen(open: boolean) {
  // 렌더 중에 바로 읽는다(effect로 정하면 첫 프레임이 페이지 모달로 깜빡인다). 창 크기가 바뀌면 다시 렌더
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const onResize = () => setTick((t) => t + 1);
    addEventListener("resize", onResize);
    return () => removeEventListener("resize", onResize);
  }, [open]);
  if (!open) return null;
  const screen = document.getElementById("game-screen");
  return screen && screen.clientWidth >= IN_GAME_MIN ? screen : null;
}

export default function PanelSheet() {
  const openId = useGameStore((s) => s.openObjectId);
  const closeSheets = useGameStore((s) => s.closeSheets);
  const content = openId ? OBJECTS_BY_ID[openId]?.content : undefined;

  // 책장 팝업에서 문서를 고르면 팝업을 닫는다 — 문서는 게임창 아래 자료실 페이지에서 넓게 열린다
  const docSeq = useArchiveStore((s) => s.seq);
  useEffect(() => {
    if (docSeq) closeSheets();
  }, [docSeq, closeSheets]);

  // 방이 바뀌면 그 방 전시물 팝업은 닫는다(안내 키오스크의 방 링크 등)
  const room = useGameStore((s) => s.room);
  const prevRoom = useRef(room);
  useEffect(() => {
    if (prevRoom.current === room) return;
    prevRoom.current = room;
    closeSheets();
  }, [room, closeSheets]);

  const screen = useGameScreen(!!content);
  const sheet = (
    <Sheet open={!!content} onClose={closeSheets} closeLabel="닫기" labelledBy="p-title" className={screen ? "in-game" : undefined}>
      {content && (
        <>
          <h2 id="p-title">{content.title}</h2>
          <div className="lede">{content.lede}</div>
          <div className="prose">
            <content.Body key={openId} />
          </div>
        </>
      )}
    </Sheet>
  );
  // 게임창 .game-window는 clip-path가 있어 fixed 모달을 안에 두면 잘린다 — 게임창 안일 때만 포털로 넣는다
  return screen ? createPortal(sheet, screen) : sheet;
}
