import RoomCards from "./RoomCards";

export default function LobbyPage() {
  return (
    <>
      <div className="prose">
        <p>직접 만든 게임과 기획을 전시하는 공간입니다. 로비의 세 문이 게임 및 프로그램 제작 · 기획 및 분석 · 자기소개로 이어집니다.
        바닥의 화살표를 따라 걸어가도 되고, 아래 카드를 눌러 바로 이동해도 됩니다.</p>
      </div>
      <RoomCards from="lobby" rooms={["works", "archive", "about"]} />
    </>
  );
}
