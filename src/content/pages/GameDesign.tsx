import type { CSSProperties } from "react";

/*
 * 게임 전시실 페이지의 "게임 기획" 블록. 체험판(게임창)만 있으면 밋밋하다는 사용자 피드백(2026-10-08)으로 추가.
 * 내용은 각 방 페이지에서 데이터로 넘긴다 — 원본 소스(코드·기획 메모)에서 확인한 사실만 적을 것.
 */

export type GameDesignData = {
  pitch: string;                       // 한 줄 소개
  specs: [label: string, value: string][];
  loop: string[];                      // 핵심 루프(마지막 단계 다음엔 처음으로 돌아간다)
  points: { title: string; body: string }[];
  plans?: { title: string; items: string[] };
};

export default function GameDesign({ data }: { data: GameDesignData }) {
  return (
    <section className="design" aria-label="게임 기획">
      <h3 className="design-title"><span aria-hidden="true">▶</span> 게임 기획</h3>
      <p className="design-pitch">{data.pitch}</p>

      <dl className="design-spec">
        {data.specs.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <h4 className="design-sub">핵심 루프</h4>
      <ol className="design-loop">
        {data.loop.map((step, i) => (
          <li key={step}>
            <span className="design-loop-step"><span className="design-loop-num">{i + 1}</span>{step}</span>
            <span className="design-loop-arrow" aria-hidden="true">▶</span>
          </li>
        ))}
        <li><span className="design-loop-back">↻ 처음으로</span></li>
      </ol>

      <h4 className="design-sub">설계 포인트</h4>
      {/* 카드가 한 장만 다음 줄로 남지 않게: 4장이면 4열, 그 외엔 3열 */}
      <div className="design-points" style={{ "--cols": data.points.length === 4 ? 4 : 3 } as CSSProperties}>
        {data.points.map((p, i) => (
          <article key={p.title} className="design-point">
            <span className="design-point-num">{String(i + 1).padStart(2, "0")}</span>
            <b>{p.title}</b>
            <p>{p.body}</p>
          </article>
        ))}
      </div>

      {data.plans && (
        <>
          <h4 className="design-sub">{data.plans.title}</h4>
          <ul className="design-plans">
            {data.plans.items.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </>
      )}
    </section>
  );
}
