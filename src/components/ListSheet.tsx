import { DESTINATIONS } from "../game/rooms";
import { useGameStore } from "../store";
import Sheet from "./Sheet";

// 탐험을 건너뛰고 모든 전시실에 바로 가는 경로. 모바일로 3분 안에 훑는 채용 담당자를 위해 필수.
export default function ListSheet() {
  const open = useGameStore((s) => s.listOpen);
  const { closeSheets, enterRoom } = useGameStore.getState();

  return (
    <Sheet open={open} onClose={closeSheets} closeLabel="맵으로 돌아가기" labelledBy="list-title" className="list">
      <h2 id="list-title">전체 목록</h2>
      <div className="lede">탐험 없이 바로 이동합니다.</div>
      <div>
        {DESTINATIONS.map((d) => (
          <button key={d.room} className="room-link" onClick={() => { closeSheets(); enterRoom(d.room); }}>
            <b>{d.label}</b>
            <span>{d.lede}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
