import type { ComponentType } from "react";

/*
 * 기획 자료실 문서 목록. 문서를 추가할 때는 여기에 한 줄씩 넣으면 된다.
 * 본문 형식은 셋 중 하나:
 *   - embed: 공개된 웹 문서(노션 게시 페이지, 구글 시트 등)를 열람 화면 안에 바로 띄운다.
 *            href에는 원본 링크를 적는다("새 탭에서 열기"). 비공개 문서는 방문자에게 로그인 화면이 뜨므로
 *            반드시 웹에 공개(노션: 공유 → 게시 / 구글: 링크가 있는 모든 사용자 보기)한 뒤 넣을 것
 *   - pdf: public/docs/ 에 PDF를 두고 경로를 적는다 (예: "/docs/pyfactory-gdd.pdf")
 *   - Body: 웹 글로 올릴 때 본문 컴포넌트 (예: SampleBody.tsx처럼)
 * 아무것도 없으면 열람 화면에 "본문 준비 중"이 뜬다.
 */

export const DOC_KINDS = ["기획서", "분석글"] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export type ArchiveDoc = {
  id: string;
  kind: DocKind;
  title: string;
  date?: string;     // "2026-10" 형식
  summary: string;   // 목록 카드에 보이는 한두 줄 소개
  tags: string[];
  via?: string;      // 어디에 쓴 문서인지(노션, 구글 시트) — 카드와 열람 화면에 표시
  href?: string;     // 원본 링크
  embed?: string;    // 열람 화면 안에 띄울 주소(공개된 문서만)
  pdf?: string;
  Body?: ComponentType;
};

const KEFKA_SHEET = "https://docs.google.com/spreadsheets/d/1IOuecCvMqqGUk5boBHMoFSsSyVdCbTH8mfbGLUaDP7M";

// 노션 문서: app.notion.com 주소와 notion.site 게시 주소(/페이지)는 노션이 다른 사이트 안에 띄우는 걸 막는다
// (frame-ancestors). 게시된 페이지의 임베드 전용 주소 notion.site/ebd/<페이지 id>만 iframe으로 열린다.
// app.notion.com 링크는 초대받은 사람만 볼 수 있으니 href도 게시 주소를 쓸 것
const NOTION_SITE = "https://dorian-screw-6d9.notion.site";
const notion = (slug: string, id: string) => ({
  via: "노션",
  href: `${NOTION_SITE}/${slug}-${id}`,
  embed: `${NOTION_SITE}/ebd/${id}`,
});

// 종류·태그는 문서 내용을 보고 붙인 것 — 사용자 확인 전
export const DOCS: ArchiveDoc[] = [
  {
    id: "lostark-epic-raid",
    kind: "기획서",
    title: "로스트아크 — 16인 에픽 레이드 베히모스",
    summary: "엔드 콘텐츠 라인업의 신규 16인 레이드 기획서. 기획 의도, 관문 구성, 부위 파괴·약점 노출 등 시스템, 보상과 성장 요소까지.",
    tags: ["레이드", "콘텐츠 기획"],
    ...notion("_v-01", "234fb316c9608031ba41ea7540a29ec7"),
  },
  {
    id: "mabinogi-rune",
    kind: "분석글",
    title: "마비노기 모바일 — 룬 시스템 분석",
    date: "2025-07",
    summary: "전투 성장의 중심인 룬 시스템의 등급·획득·성장 방식을 정리하고 기획 의도를 추측한 뒤 개선 방향을 제안.",
    tags: ["성장 시스템", "역기획"],
    ...notion("_v-03", "234fb316c960800e9de5ce938f16de53"),
  },
  {
    id: "kefka-sheet",
    kind: "분석글",
    title: "절 케프카",
    summary: "생존기 배치와 1~5페이즈별 진행을 정리한 시트.",
    tags: ["레이드"],
    via: "구글 시트",
    href: `${KEFKA_SHEET}/edit?gid=362395380`,
    embed: `${KEFKA_SHEET}/htmlview`, // gid를 붙이면 시트 탭 목록이 사라진다. 첫 탭이 생존기
  },
];
