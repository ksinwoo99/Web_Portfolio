// 자기소개 방 모니터 → 영상 자기소개서(사용자 제작). 유튜브에 올린 영상을 띄운다(2026-11-04 사용자 제공 링크).
// 원본 mp4(96MB)는 git에 올리지 않는다(사용자 요청 — .gitignore의 *.mp4).
// youtube-nocookie: 재생 전까지 방문자 쿠키를 남기지 않는 유튜브 임베드 주소
const VIDEO_ID = "AAB4pwS-Zx8";

export default function VideoPanel() {
  return (
    <div className="video-resume">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0`}
        title="김신우 영상 자기소개서"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      />
    </div>
  );
}
