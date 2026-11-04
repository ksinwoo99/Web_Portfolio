import RoomCards from "./RoomCards";

export default function WorksPage() {
  return (
    <>
      <div className="prose">
        <p>직접 만든 게임들의 체험실로 이어지는 방입니다. 각 방에서 웹으로 옮긴 체험판을 바로 해볼 수 있습니다.</p>
      </div>
      <RoomCards from="works" rooms={["pyfactory", "roguelike", "evolution"]} />
    </>
  );
}
