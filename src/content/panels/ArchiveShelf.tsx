import { useEffect, useRef, useState } from "react";
import { DOCS, DOC_KINDS, type ArchiveDoc, type DocKind } from "../archive/docs";
import { useArchiveStore } from "../archive/store";

type Filter = "전체" | DocKind;
const FILTERS: Filter[] = ["전체", ...DOC_KINDS];

// 책장 팝업용: 목록만 보여주고, 고르면 게임창 아래 자료실 페이지에서 연다(팝업은 PanelSheet가 닫는다).
// 여기서 게임 스토어를 import하면 rooms.ts와 순환 참조가 생긴다.
export function ArchivePicker() {
  return <ArchiveShelf picker />;
}

// 자료실 페이지(게임창 아래)의 문서 목록 + 열람. 노션·시트 문서는 페이지 폭으로 넓게 열어야 읽기 편하다.
export default function ArchiveShelf({ picker = false }: { picker?: boolean }) {
  const [filter, setFilter] = useState<Filter>("전체");
  const openId = useArchiveStore((s) => s.openId);
  const seq = useArchiveStore((s) => s.seq);
  const { open, close } = useArchiveStore.getState();
  const doc = picker ? undefined : DOCS.find((d) => d.id === openId);
  const readerRef = useRef<HTMLElement>(null);

  // 문서를 열면 열람 화면 맨 위로 — 문서 창이 화면을 꽉 채우게
  useEffect(() => {
    if (!picker && openId) readerRef.current?.scrollIntoView({ block: "start" });
  }, [picker, openId, seq]);

  if (doc) {
    const Body = doc.Body;
    return (
      <article className="doc-reader" ref={readerRef}>
        <button className="doc-back" onClick={close}>← 목록으로</button>
        <p className="doc-meta">{docMeta(doc)}</p>
        <h3 className="doc-title">{doc.title}</h3>
        <p className="doc-summary">{doc.summary}</p>
        <DocTags tags={doc.tags} />
        {doc.embed ? (
          // 공개된 웹 문서는 페이지 안에서 바로 연다. 새 탭은 보조 수단
          <div className="doc-embed">
            <div className="doc-embed-bar">
              <span>{doc.via ?? "웹 문서"}</span>
              {doc.href && <a href={doc.href} target="_blank" rel="noopener">새 탭에서 열기 ↗</a>}
            </div>
            <div className="doc-embed-frame">
              <iframe src={doc.embed} title={doc.title} loading="lazy" allowFullScreen />
            </div>
          </div>
        ) : Body ? (
          <div className="doc-body"><Body /></div>
        ) : doc.pdf ? (
          <a className="doc-pdf" href={doc.pdf} target="_blank" rel="noopener">PDF로 보기 ↗</a>
        ) : doc.href ? (
          <a className="doc-pdf" href={doc.href} target="_blank" rel="noopener">{doc.via ?? "원문"}에서 보기 ↗</a>
        ) : (
          <p className="note">본문 준비 중입니다.</p>
        )}
      </article>
    );
  }

  const shown = filter === "전체" ? DOCS : DOCS.filter((d) => d.kind === filter);

  return (
    <div className="doc-shelf">
      <div className="doc-filters" role="group" aria-label="문서 종류">
        {FILTERS.map((f) => (
          <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f} <span>{f === "전체" ? DOCS.length : DOCS.filter((d) => d.kind === f).length}</span>
          </button>
        ))}
      </div>
      <div className="doc-list">
        {shown.map((d) => (
          <button key={d.id} className="doc-card" onClick={() => open(d.id)}>
            <span className="doc-meta">{docMeta(d)}</span>
            <b>{d.title}</b>
            <span className="doc-summary">{d.summary}</span>
            <DocTags tags={d.tags} />
          </button>
        ))}
      </div>
    </div>
  );
}

// "분석글 · 구글 시트 · 2026-10"처럼 있는 것만 잇는다
function docMeta(d: ArchiveDoc) {
  return [d.kind, d.via, d.date].filter(Boolean).join(" · ");
}

function DocTags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <span className="doc-tags">
      {tags.map((t) => <span key={t}>#{t}</span>)}
    </span>
  );
}
