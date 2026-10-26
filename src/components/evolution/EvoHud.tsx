import { COUNTER_TEXT, FINAL_ROUND, MAX_PER, UPGRADES, allyLimit, total, useEvoStore, type Levels } from "../../game/evolution/store";

// AI 진화 체험판 정보창(게임창 아래): 내 강화 현황과 상성. 이번 적의 강화는 게임창 안 화면 위쪽에 띄운다(사용자 요청)
export default function EvoHud() {
  const round = useEvoStore((s) => s.round);
  const attempts = useEvoStore((s) => s.attempts);
  const losses = useEvoStore((s) => s.losses);
  const ally = useEvoStore((s) => s.ally);
  const alive = useEvoStore((s) => s.alive);
  const result = useEvoStore((s) => s.result);
  const phase = useEvoStore((s) => s.phase);
  const { refund, start, stop, resetAll } = useEvoStore.getState();

  const limit = allyLimit(round);
  const status = phase === "cleared" ? `모든 라운드 클리어! (시도 ${attempts}번)`
    : result === "win" ? (round >= FINAL_ROUND ? "마지막 라운드 승리!" : "승리! 새로운 적으로 교체합니다")
    : result === "lose" ? "패배 — 같은 적과 다시 싸웁니다"
    : phase === "fight" ? `전투 중 · 아군 ${alive.ally} : 적 ${alive.enemy}`
    : "대기 중 — 강화를 고르고 전투 시작";

  return (
    <div className="evo-hud">
      <div className="evo-head">
        <b>ROUND {round}/{FINAL_ROUND}</b>
        <span>시도 {attempts} · 패배 {losses}</span>
        <span className={result ? `evo-status ${result}` : "evo-status"} aria-live="polite">{status}</span>
      </div>
      {/* 게임창 안 버튼과 같은 동작 — 걸어가기 번거로운 모바일·키보드 사용자용 */}
      <div className="evo-ctrl">
        <button onClick={start} disabled={phase !== "ready"}>▶ 전투 시작</button>
        <button onClick={stop} disabled={phase !== "fight"}>■ 정지</button>
        <button onClick={() => { if (confirm("라운드·시도·패배 기록과 강화를 모두 처음으로 되돌릴까요?")) resetAll(); }}>전체 초기화</button>
      </div>
      <div className="evo-cols">
        <section>
          <h4>
            <i className="evo-dot ally" aria-hidden="true" />아군 강화
            <small>남은 강화 {limit - total(ally)}/{limit}</small>
          </h4>
          <UpList levels={ally} />
          {total(ally) > 0 && <button className="evo-refund" onClick={refund}>강화 초기화</button>}
        </section>
        <section>
          <h4>상성</h4>
          {COUNTER_TEXT.map((t) => <p key={t} className="evo-counter">{t}</p>)}
          <p className="evo-counter-note">▶ 쪽을 이깁니다. 적의 강화는 게임창 왼쪽 화면 위쪽(빨간 점 줄)에 나옵니다. 회피율은 확률로 공격을 피하고(MISS), 명중률은 상대 회피율만 깎습니다.</p>
        </section>
      </div>
      <p className="evo-help">오른쪽 공간의 버튼을 클릭하거나 가까이 가서 E. 강화는 한 종류 최대 {MAX_PER}번, 합계는 늘 적 강화 수보다 1개 적게(마지막 {FINAL_ROUND}라운드는 2개 적게) — 고른 뒤 전투 시작. 이기면 강화를 돌려받고 새 적이 나옵니다.</p>
    </div>
  );
}

function UpList({ levels }: { levels: Levels }) {
  return (
    <ul className="evo-ups">
      {UPGRADES.map((u) => (
        <li key={u.key}>
          <span className="evo-name">{u.name}</span>
          <span className="evo-pips" aria-label={`${levels[u.key]}단계`}>
            {Array.from({ length: MAX_PER }, (_, i) => <i key={i} className={i < levels[u.key] ? "on" : ""} />)}
          </span>
          <span className="evo-desc">{levels[u.key] ? u.desc(levels[u.key]) : "—"}</span>
        </li>
      ))}
    </ul>
  );
}
