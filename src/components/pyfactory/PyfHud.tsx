import { assistantLine, usePyfStore } from "../../game/pyfactory/store";

// 원본의 자원 패널 + 튜토리얼 어시스턴트 말풍선. 게임창이 작은 모바일에서도 가리지 않게 게임창 아래에 둔다.
export default function PyfHud() {
  const line = usePyfStore(assistantLine);
  const res = usePyfStore((s) => s.res);
  const gold = usePyfStore((s) => s.gold);
  const done = usePyfStore((s) => s.sold > 0);
  const reset = usePyfStore((s) => s.reset);

  return (
    <div className="pyf-hud">
      <div className="pyf-assist">
        <span className="pyf-face" aria-hidden="true"><i /><i /></span>
        <p aria-live="polite">{line}</p>
      </div>
      <div className="pyf-stats">
        <span>일반 자원 <b>{res}</b></span>
        <span>골드 <b>{gold}</b></span>
        {done && <button onClick={reset}>처음부터 다시</button>}
      </div>
    </div>
  );
}
