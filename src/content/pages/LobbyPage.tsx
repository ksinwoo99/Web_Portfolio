import { ROOMS, exitDir, type RoomId } from "../../game/rooms";
import { useGameStore } from "../../store";

const EXHIBITS: RoomId[] = ["pyfactory", "roguelike", "evolution", "archive"];
const DOOR = { up: "↑ 위쪽 문", down: "↓ 아래쪽 문", left: "← 왼쪽 문", right: "→ 오른쪽 문" } as const;

export default function LobbyPage() {
  const enterRoom = useGameStore((s) => s.enterRoom);

  return (
    <>
      <div className="prose">
        <p>직접 만든 게임과 기획을 전시하는 공간입니다. 로비의 네 문이 각 전시실로 이어집니다.
        캐릭터로 걸어가도 되고, 아래 카드를 눌러 바로 이동해도 됩니다.</p>
      </div>
      {/* 본문 폭 제한(.prose) 밖에 둬야 카드 4장이 한 줄에 들어간다 */}
      <div className="room-cards">
        {EXHIBITS.map((id) => {
          const dir = exitDir("lobby", id);
          return (
            <button key={id} className="room-card" onClick={() => enterRoom(id)}>
              {dir && <span className="room-card-dir">{DOOR[dir]}</span>}
              <b>{ROOMS[id].name}</b>
              <span>{ROOMS[id].summary}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
