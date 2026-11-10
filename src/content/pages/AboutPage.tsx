import AboutContent from "../AboutContent";
import ContactContent from "../ContactContent";
import { CoverLetterFull } from "../CoverLetter";

// 자기소개 방 페이지: 소개글 · 주로 쓰는 것 → 자기소개서 단락들(CoverLetter.tsx) → 연락처.
// "자기소개"와 "자기소개서"를 한 편의 글로 합쳤다(2026-11-10 사용자 요청) — 따로 "자기소개서" 제목을 두지 않는다.
// 책상 팝업(CoverLetterPreview)의 "전문 읽기"가 이 자리(#cover-letter)로 내려온다
export default function AboutPage() {
  return (
    <div id="cover-letter" className="prose cover-letter">
      <AboutContent />
      <CoverLetterFull />
      <h3>연락처</h3>
      <ContactContent />
    </div>
  );
}
