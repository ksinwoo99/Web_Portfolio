import { useState } from "react";

/*
 * 게임 전시실 페이지 맨 위의 "게임 다운로드" 버튼(사용자 요청, 2026-10-26 — 실제 연동은 아직 하지 않음).
 * 나중에 빌드 파일이나 스토어 주소가 생기면 href만 넘기면 진짜 링크가 된다.
 */
export default function DownloadButton({ game, platform, href }: { game: string; platform: string; href?: string }) {
  const [note, setNote] = useState(false);
  return (
    <div className="dl">
      {href ? (
        <a className="btn-primary dl-btn" href={href} target="_blank" rel="noopener">↓ {game} 다운로드</a>
      ) : (
        <button className="btn-primary dl-btn" onClick={() => setNote(true)}>↓ {game} 다운로드</button>
      )}
      <span className="dl-meta">{platform}</span>
      {note && <span className="dl-note" role="status">다운로드 링크는 곧 연결됩니다.</span>}
    </div>
  );
}
