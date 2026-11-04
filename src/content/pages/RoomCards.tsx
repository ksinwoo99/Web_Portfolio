import { ROOMS, exitDir, type RoomId } from "../../game/rooms";
import { useGameStore } from "../../store";

const DOOR = { up: "↑ 위쪽 문", down: "↓ 아래쪽 문", left: "← 왼쪽 문", right: "→ 오른쪽 문" } as const;

// 걸어가지 않고 바로 이동하는 카드(로비 · 제작 목록). 본문 폭 제한(.prose) 밖에 둬야 카드가 한 줄에 들어간다
export default function RoomCards({ from, rooms }: { from: RoomId; rooms: RoomId[] }) {
  const enterRoom = useGameStore((s) => s.enterRoom);
  return (
    <div className="room-cards">
      {rooms.map((id) => {
        const dir = exitDir(from, id);
        return (
          <button key={id} className="room-card" onClick={() => enterRoom(id)}>
            {dir && <span className="room-card-dir">{DOOR[dir]}</span>}
            <b>{ROOMS[id].name}</b>
            <span>{ROOMS[id].summary}</span>
          </button>
        );
      })}
    </div>
  );
}
