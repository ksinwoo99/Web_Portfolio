import { ITEM_BY_ID } from "../../game/roguelike/items";
import { useRlStore } from "../../game/roguelike/store";
import { useGameStore } from "../../store";

const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

// 판을 끝내고 로비로 — 문을 걸어 나갈 필요 없이 바로(방을 떠나면 GameSection이 판을 정리한다)
const toLobby = () => {
  useRlStore.getState().quit();
  useGameStore.getState().enterRoom("lobby");
};

// 로그라이크 진행 중 게임창 위에 뜨는 창: 일시정지 버튼 / 레벨업 선택지 / 일시정지 / 게임 오버
export default function RlOverlay() {
  const phase = useRlStore((s) => s.phase);
  const choices = useRlStore((s) => s.choices);
  const selected = useRlStore((s) => s.selected);
  const choiceLevel = useRlStore((s) => s.choiceLevel);
  const owned = useRlStore((s) => s.owned);
  const result = useRlStore((s) => s.result);
  const highScore = useRlStore((s) => s.highScore);
  const { choose, select, togglePause, start, quit } = useRlStore.getState();

  if (phase === "levelup") {
    return (
      <div className="rl-overlay" role="dialog" aria-label="레벨 업 선택지">
        <h3>레벨 업! Lv {choiceLevel}</h3>
        {/* 세로로 긴 카드를 가로로 나란히. 키보드는 고른 뒤 Enter로 확정, 마우스는 올리면 선택·클릭하면 바로 확정 */}
        <div className="rl-choices">
          {choices.map((c, i) => {
            const item = ITEM_BY_ID[c.itemId];
            return (
              <button
                key={c.itemId}
                className={i === selected ? "rl-choice on" : "rl-choice"}
                onMouseEnter={() => select(i)}
                onFocus={() => select(i)}
                onClick={() => choose(i)}
              >
                <span className="rl-choice-num">{i + 1}</span>
                <b>{item.name}</b>
                <span className="rl-choice-lv">{c.level === 1 ? "NEW" : `Lv ${c.level - 1} → ${c.level}`}</span>
                <span className="rl-choice-desc">{item.describe(c.level)}</span>
              </button>
            );
          })}
        </div>
        <p className="rl-hint">A/D 또는 W/S로 고르고 Enter · Space로 결정 · 마우스로 바로 클릭</p>
      </div>
    );
  }

  // 플레이 중: 오른쪽 위 일시정지 버튼(Esc를 모르거나 터치 화면이어도 나갈 수 있게)
  if (phase === "playing") {
    return <button className="rl-pause-btn" onClick={togglePause} aria-label="일시정지">Ⅱ 일시정지</button>;
  }

  if (phase === "paused") {
    return (
      <div className="rl-overlay" role="dialog" aria-label="일시정지">
        <h3>일시정지</h3>
        <div className="rl-actions">
          <button onClick={togglePause}>계속하기 (Esc)</button>
          <button onClick={start}>처음부터</button>
          <button onClick={quit}>그만하기</button>
          <button onClick={toLobby}>로비로 나가기</button>
        </div>
      </div>
    );
  }

  if (phase === "over" && result) {
    const items = Object.entries(owned);
    return (
      <div className="rl-overlay" role="dialog" aria-label={result.cleared ? "클리어" : "게임 오버"}>
        <h3 className={result.cleared ? "rl-clear" : undefined}>
          {result.cleared ? "클리어! 1분 생존 성공" : "게임 오버"}
        </h3>
        <p className="rl-score">
          점수 <b>{result.score}</b>{result.newRecord && <em> 최고 기록!</em>}
          <span>최고 점수 {highScore} · 생존 {fmtTime(result.time)} / 1:00 · Lv {result.level}</span>
        </p>
        {items.length > 0 && (
          <p className="rl-items">{items.map(([id, lv]) => `${ITEM_BY_ID[id].name} Lv${lv}`).join(" · ")}</p>
        )}
        <div className="rl-actions">
          <button onClick={start}>다시 하기 (Enter)</button>
          <button onClick={quit}>그만하기 (Esc)</button>
          <button onClick={toLobby}>로비로 나가기</button>
        </div>
      </div>
    );
  }

  return null;
}
