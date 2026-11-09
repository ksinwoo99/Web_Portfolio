/*
 * 자기소개서(사용자가 직접 쓴다). 여기 COVER_LETTER만 고치면 두 곳에 같이 나온다:
 *  - 자기소개 방 게임창 아래 페이지: 전문(CoverLetterFull)
 *  - 자기소개 방 게임창 안 전시물 팝업: 항목 제목 + 첫 문장 미리보기(CoverLetterPreview)
 *
 * 쓰는 법: 항목 하나 = { title, paragraphs }. paragraphs는 문단 하나당 문자열 하나.
 * 항목을 늘리거나 줄여도 된다. 비어 있는 문단("")은 화면에 나오지 않는다.
 */
export const COVER_LETTER: { title: string; paragraphs: string[] }[] = [
  {
    title: "성장 과정",
    paragraphs: [
      "",
    ],
  },
  {
    title: "지원 동기",
    paragraphs: [
      "",
    ],
  },
  {
    title: "나의 강점",
    paragraphs: [
      "",
    ],
  },
  {
    title: "입사 후 포부",
    paragraphs: [
      "",
    ],
  },
];

// ─────────────── 아래는 화면 코드 — 글만 쓸 거라면 고치지 않아도 된다 ───────────────

const sections = () =>
  COVER_LETTER.map((s) => ({ ...s, paragraphs: s.paragraphs.map((p) => p.trim()).filter(Boolean) }));

/** 게임창 아래 자기소개 페이지에 펼치는 전문 */
export function CoverLetterFull() {
  return (
    <>
      {sections().map((s) => (
        <div key={s.title} className="cover-section">
          <h4>{s.title}</h4>
          {s.paragraphs.length ? s.paragraphs.map((p, i) => <p key={i}>{p}</p>) : <p className="note">작성 중입니다.</p>}
        </div>
      ))}
    </>
  );
}

/** 문단의 첫 문장(미리보기용) */
const firstSentence = (p: string) => {
  const m = p.match(/^.+?[.!?。](?=\s|$)/);
  return m ? m[0] : p;
};

/**
 * 게임창 안 팝업: 항목 제목 + 첫 문장. 전문은 게임창 아래 페이지에서 읽게 한다(팝업은 긴 글에 좁다).
 * 팝업을 닫는 건 이벤트로 — 여기서 게임 스토어를 import하면 rooms.ts와 순환 참조가 생긴다(PanelSheet가 받는다).
 */
export function CoverLetterPreview() {
  const readAll = () => {
    dispatchEvent(new Event("portfolio:close-sheets"));
    requestAnimationFrame(() => document.getElementById("cover-letter")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  return (
    <>
      <ul className="cover-preview">
        {sections().map((s) => (
          <li key={s.title}>
            <b>{s.title}</b>
            <span>{s.paragraphs[0] ? firstSentence(s.paragraphs[0]) : "작성 중입니다."}</span>
          </li>
        ))}
      </ul>
      <button className="btn-primary" onClick={readAll}>아래에서 전문 읽기 ↓</button>
    </>
  );
}
