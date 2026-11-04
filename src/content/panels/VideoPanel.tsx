import { useState } from "react";

// 자기소개 방 모니터 → 영상 자기소개서(사용자 제작).
// 파일은 public/video/video-resume.mp4 (96MB). 너무 커서 아직 git에 올리지 않았다(.gitignore) —
// 유튜브 등 배포용 주소가 생기면 SRC만 바꾸거나, 유튜브면 iframe으로 바꾼다.
const SRC = "/video/video-resume.mp4";

export default function VideoPanel() {
  const [failed, setFailed] = useState(false);
  if (failed) return <p>영상을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>;
  return (
    // 모니터를 누른 클릭·E가 사용자 조작이라 소리 있는 자동 재생이 허용된다(막히면 재생 버튼을 누르면 된다)
    <video className="video-resume" src={SRC} controls autoPlay playsInline preload="metadata" onError={() => setFailed(true)} />
  );
}
