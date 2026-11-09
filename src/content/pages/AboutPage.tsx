import AboutContent from "../AboutContent";
import ContactContent from "../ContactContent";
import { CoverLetterFull } from "../CoverLetter";

// 자기소개 방 페이지: 소개 → 자기소개서 전문(CoverLetter.tsx) → 연락처.
// 액자 팝업(AboutPanel)은 소개 + 연락처, 자기소개서 전시물 팝업은 미리보기만 띄운다
export default function AboutPage() {
  return (
    <div className="prose">
      <AboutContent />
      <section id="cover-letter" className="cover-letter">
        <h3>자기소개서</h3>
        <CoverLetterFull />
      </section>
      <h3>연락처</h3>
      <ContactContent />
    </div>
  );
}
