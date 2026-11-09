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
 *  - paragraphs: 근거. 상황 → 내가 한 일 → 결과(숫자가 있으면 숫자) 순서로.
 *               글은 백틱(` `) 안에 쓴다 — 안에서는 엔터로 줄을 바꿔도 화면에선 한 문단으로 이어진다.
 *               빈 줄(엔터 두 번)을 넣으면 거기서 문단이 나뉜다
 *  - proof    : 이 단락의 증거가 되는 체험실. 단락 밑에 "직접 해 보기" 링크가 붙는다
 *               (pyfactory / roguelike / evolution / archive 중에서, 없으면 [])
 * 비어 있는 글은 화면에 나오지 않는다. 소제목이 비어 있으면 label을 대신 보여 준다.
 * 백틱 안에선 큰따옴표(")·작은따옴표(')를 그냥 써도 된다. 백틱(`)과 ${ 만 쓰지 말 것.
 */
export const COVER_LETTER: {
  headline: string;
  sections: { label: string; title: string; paragraphs: string[]; proof: RoomId[] }[];
} = {
  headline: "",
  sections: [
    {
      label: "왜 게임을 만들고싶은가",
      title: "성취감에 대해서",
      paragraphs: [
        `저는 기존에 무엇을 하고싶은지 정하지 못하고 살아왔습니다.
        솔직히 컴퓨터공학과에 들어올때도 정확히 어떤 분야로 가겠다 생각하지 않고,
        그저 '이쪽이 돈을 많이 버니까' 라는 안일한 마음으로 다니고 있었습니다.
        그렇게 제대로 된 진로를 찾지 못하던 와중, 한 협동 레이드 게임에서 월드 기록을 세우는 일이 생겼습니다.
        그때 정말 큰 성취감을 느끼게 되었고, 그때 이후로 "남에게도 이런 성취감을 주고싶다" 라는 생각이 들었습니다.
        그러기 위해서 계속 게임을 만들고 있고, 최종적으로는 레이드가 메인인 RPG 게임을 만들고 싶습니다.`,
      ],
      proof: [],
    },
    {
      label: "일하는 방식",
      title: "주도적으로, 일정 관리는 철저히",
      paragraphs: [
        `부끄러운 이야기지만, 대학교 2학년 1학기가 끝난 후 미등록 제적을 당했던 일이 있습니다.
        위에서 말했듯 목표가 없으니 의지도 없어서 제대로 저와 관련된 일정을 찾아보지 않았었습니다.
        그렇다보니 휴학 신청기간이 정해져있는 줄도 모르고 "언제든 방학중에 신청하면 되겠지" 라고 생각했습니다.
        그런데 휴학 신청기간이 끝나버렸고, 결국 다른 해결법도 찾아보았지만 수강신청도 하지 않은 상태였어서 미등록 제적이 되었습니다.
        이때 생각보다 충격을 많이 먹었고, 이후로는 늘 저와 직접적으로 관련된 일정의 경우 늘 두번씩 체크하고, 캘린더 어플에 적어두게 되었습니다.
        물론 이 당시엔 안좋은 경험이었지만, 이런 일이 있던 덕분에 제 일정을 체계적으로 관리할 수 있게 되었습니다.`,
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
    // 빈 줄로 문단을 나누고, 문단 안의 줄바꿈은 띄어쓰기 하나로 잇는다(파일에서 엔터로 줄을 나눠 써도 되게)
    paragraphs: s.paragraphs
      .flatMap((p) => p.split(/\n\s*\n/))
      .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
      .filter(Boolean),
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
