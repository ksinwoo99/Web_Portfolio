import ArchiveShelf from "../panels/ArchiveShelf";

// 게임창의 책장 팝업에서 문서를 고르면 여기서 열린다(열린 문서는 useArchiveStore로 공유).
// 목록·열람 화면은 본문 폭 제한(.prose) 밖에 둔다 — 시트처럼 넓은 문서를 게임창과 같은 폭으로 띄우려고.
export default function ArchivePage() {
  return (
    <>
      <div className="prose">
        <p>직접 쓴 기획서와 분석글을 모아둔 곳입니다. 문서를 누르면 이 자리에서 바로 열립니다.</p>
      </div>
      <ArchiveShelf />
    </>
  );
}
