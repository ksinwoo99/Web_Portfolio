import type { MouseEvent } from "react";
import { ROOMS, type RoomId } from "../game/rooms";
import { AboutIntro } from "./AboutContent";

/*
 * 자기소개서(사용자가 직접 쓴다). 여기 COVER_LETTER만 고치면 두 곳에 같이 나온다:
 *  - 자기소개 방 게임창 아래 페이지: 전문(CoverLetterFull) — 소개글(AboutContent.tsx) 바로 밑에 이어진다
 *  - 자기소개 방 책상(서류철) 팝업: 소개글 + 소제목 목록(CoverLetterPreview)
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
        이때 느낀것이, 사람은 이러한 성취감을 느끼기 위한 "목표"가 삶에 있어 정말 중요하다 생각하게 되었습니다.
        꿈이 없던 20살의 저보다 게임 기획자라는 꿈을 가진 27살의 제가 훨씬 삶에 긍정적이고 열심히 산다는것을 스스로 느끼고 있습니다.
        이러한 저의 목표를 이루기 위하여 계속 게임 기획과 제작에 대하여 공부하고 있고,
        최종적으로는 레이드가 메인인 RPG 게임을 만들고 싶습니다.`,
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
    {
      label: "작업하며 얻은 경험",
      title: "졸업작품과 프로그램 외주",
      paragraphs: [
        `졸업 작품으로 제작한 게임 py.Factory의 경우 전체 기획과 프론트개발을 맡았습니다.
        팀원들에게 파트를 분배하고, 일정표를 짜 관리하며 프로젝트를 이끌었습니다.
        해당 작업을 하면서, 기획자와 개발자 간의 소통이 중요하다는 것을 깨달았습니다.
        저의 경우는 생각해놓은 모습이 머릿속에 있기에 이것을 그대로 프론트엔드에 구현할 수 있었습니다.
        그러나 팀원들의 경우는 제가 설명해준 내용과 다른 경우로 작업하는 일이 있었는데요,
        사소한 부분에서의 생각 차이가 이런 경우를 만들어냈습니다.
        이후로 무언가 기획을 할 때 관련된 세세한 부분은 어떻게 되는지에 대한 문서도 작성하게 되었습니다.
        
        그 외에, 크롤링 프로그램 외주를 맡은 경험이 있습니다. 어떻게 보면 이번엔 제가 다른 사람의 기획에 대한 개발을 담당한 셈이었습니다.
        업체측에선 A를 원했으나 이를 구현하기가 매우 어려웠는데, 왜 A라는 요구사항이 필요한지 스스로 생각해보며 다른 방안을 찾아보았습니다.
        이후 직접 업체측에 "B라는 방법을 써도 같은 결과가 나오는데, 이쪽으로 진행해도 괜찮을까요?" 라는 질문을 하였고, 가능하다는 답변이 돌아왔습니다.
        이런 기획 및 설계에서 다시 한번 기획과 개발 간의 생각 차이를 좁히기 위한 소통이 중요하단것을 깨달았습니다. `,
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
 * 책상 팝업: 소개글(AboutContent의 첫 문단) + 소제목 목록. 전문은 게임창 아래 페이지에서 읽게 한다(팝업은 긴 글에 좁다).
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
      <AboutIntro />
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
