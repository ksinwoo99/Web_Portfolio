import type { MouseEvent } from "react";
import { ROOMS, type RoomId } from "../game/rooms";

/*
 * 자기소개서(사용자가 직접 쓴다). 여기 COVER_LETTER만 고치면 두 곳에 같이 나온다:
 *  - 자기소개 방 게임창 아래 페이지: 전문(CoverLetterFull)
 *  - 자기소개 방 책상(서류철) 팝업: 한 줄 소개 + 소제목 목록(CoverLetterPreview)
 *
 * "소제목형" 자기소개서(2026-11-09 사용자 요청 — 성장 과정/지원 동기 식 나눔이 별로라서):
 *  - headline : 나를 한 문장으로. 맨 위에 크게 나온다
 *  - label    : 이 단락이 답하는 질문(작은 주황 글씨). 그대로 둬도 되고 바꿔도 된다
 *  - title    : 소제목 = 이 단락의 "주장" 한 문장. 읽는 사람은 이것만 훑는다(팝업에도 이것만 나온다)
 *  - paragraphs: 근거. 문단 하나당 문자열 하나. 상황 → 내가 한 일 → 결과(숫자가 있으면 숫자) 순서로
 *  - proof    : 이 단락의 증거가 되는 체험실. 단락 밑에 "직접 해 보기" 링크가 붙는다
 *               (pyfactory / roguelike / evolution / archive 중에서, 없으면 [])
 * 비어 있는 글("")은 화면에 나오지 않는다. 소제목이 비어 있으면 label을 대신 보여 준다.
 * 글 안에 큰따옴표(")를 쓰려면 \" 로 쓰거나 「」를 쓸 것.
 */
export const COVER_LETTER: {
  headline: string;
  sections: { label: string; title: string; paragraphs: string[]; proof: RoomId[] }[];
} = {
  headline: "",
  sections: [
    {
      label: "왜 게임을 만드는가",
      title: "",
      paragraphs: [
        "",
      ],
      proof: [],
    },
    {
      label: "일하는 방식",
      title: "",
      paragraphs: [
        "",
      ],
      proof: ["evolution"],
    },
    {
      label: "가장 깊이 파고든 프로젝트",
      title: "",
      paragraphs: [
        "",
      ],
      proof: ["pyfactory"],
    },
    {
      label: "앞으로",
      title: "",
      paragraphs: [
        "",
      ],
      proof: [],
    },
  ],
};

// ─────────────── 아래는 화면 코드 — 글만 쓸 거라면 고치지 않아도 된다 ───────────────

const clean = () => ({
  headline: COVER_LETTER.headline.trim(),
  sections: COVER_LETTER.sections.map((s) => ({
    ...s,
    heading: s.title.trim() || s.label,
    hasTitle: !!s.title.trim(),
    paragraphs: s.paragraphs.map((p) => p.trim()).filter(Boolean),
  })),
});

// 체험실 링크: 방 해시로 이동하고 게임창이 보이게 올린다(게임 스토어 import는 rooms.ts와 순환 참조라 해시로)
const toGame = (_: MouseEvent) =>
  requestAnimationFrame(() => document.getElementById("game-title")?.scrollIntoView({ behavior: "smooth", block: "start" }));

/** 게임창 아래 자기소개 페이지에 펼치는 전문 */
export function CoverLetterFull() {
  const { headline, sections } = clean();
  return (
    <>
      {headline && <p className="cover-headline">{headline}</p>}
      {sections.map((s) => (
        <div key={s.label} className="cover-section">
          {s.hasTitle && <span className="cover-label">{s.label}</span>}
          <h4>{s.heading}</h4>
          {s.paragraphs.length ? s.paragraphs.map((p, i) => <p key={i}>{p}</p>) : <p className="note">작성 중입니다.</p>}
          {s.proof.length > 0 && (
            <div className="cover-proof">
              {s.proof.map((id) => (
                <a key={id} href={`#/room/${id}`} onClick={toGame}>▶ 직접 해 보기 · {ROOMS[id].name}</a>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

/**
 * 책상 팝업: 한 줄 소개 + 소제목 목록. 전문은 게임창 아래 페이지에서 읽게 한다(팝업은 긴 글에 좁다).
 * 팝업 닫기는 이벤트로 — 여기서 게임 스토어를 import하면 순환 참조가 생긴다(PanelSheet가 받는다).
 */
export function CoverLetterPreview() {
  const { headline, sections } = clean();
  const readAll = () => {
    dispatchEvent(new Event("portfolio:close-sheets"));
    requestAnimationFrame(() => document.getElementById("cover-letter")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  return (
    <>
      {headline && <p className="cover-headline">{headline}</p>}
      <ol className="cover-preview">
        {sections.map((s) => (
          <li key={s.label}>
            <span className="cover-label">{s.label}</span>
            <b>{s.hasTitle ? s.heading : "작성 중입니다."}</b>
          </li>
        ))}
      </ol>
      <button className="btn-primary cover-read" onClick={readAll}>아래에서 전문 읽기 ↓</button>
    </>
  );
}
