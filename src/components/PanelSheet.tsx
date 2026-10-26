import { useEffect } from "react";
import { useArchiveStore } from "../content/archive/store";
import { OBJECTS_BY_ID } from "../game/rooms";
import { useGameStore } from "../store";
import Sheet from "./Sheet";

export default function PanelSheet() {
  const openId = useGameStore((s) => s.openObjectId);
  const closeSheets = useGameStore((s) => s.closeSheets);
  const content = openId ? OBJECTS_BY_ID[openId]?.content : undefined;

  // 책장 팝업에서 문서를 고르면 팝업을 닫는다 — 문서는 게임창 아래 자료실 페이지에서 넓게 열린다
  const docSeq = useArchiveStore((s) => s.seq);
  useEffect(() => {
    if (docSeq) closeSheets();
  }, [docSeq, closeSheets]);

  return (
    <Sheet open={!!content} onClose={closeSheets} closeLabel="닫기" labelledBy="p-title">
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
}
