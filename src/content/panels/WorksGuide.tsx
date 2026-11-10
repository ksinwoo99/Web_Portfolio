import { ROOMS, type RoomId } from "../../game/rooms";

// "게임 및 프로그램 제작" 방 한가운데 안내 키오스크. 링크는 방 해시(#/room/…)로 이동한다 —
// 여기서 게임 스토어를 import하면 rooms.ts와 순환 참조가 생기므로(앱이 안 뜬다) useHashSync에 맡긴다.
// 방이 바뀌면 PanelSheet가 이 팝업을 닫는다.
const GUIDE: { id: RoomId; door: string; play: string }[] = [
  { id: "pyfactory", door: "↑ 위쪽 문", play: "파이썬 코드로 채굴기·가공기를 돌려 보는 코딩 자동화 게임" },
  { id: "evolution", door: "← 왼쪽 문", play: "아군 유닛을 강화하고, 상성을 읽어 적과 자동 전투를 벌이는 게임" },
  { id: "roguelike", door: "→ 오른쪽 문", play: "몰려오는 적을 60초 동안 버티는 탑다운 로그라이크 게임" },
];

export default function WorksGuide() {
  return (
    <>
      <p>이 방의 세 문이 각 게임 체험실로 이어집니다. 바닥의 화살표를 따라 걸어가도 되고, 아래에서 바로 이동해도 됩니다.</p>
      <div className="guide-links">
        {GUIDE.map((g) => (
          <a key={g.id} className="room-link" href={`#/room/${g.id}`}>
            <b>{g.door} · {ROOMS[g.id].name}</b>
            <span>{g.play}</span>
          </a>
        ))}
      </div>
    </>
  );
}
