import AboutContent from "../content/AboutContent";
import ContactContent from "../content/ContactContent";

// 전시실 밖의 일반 섹션. 게임을 하지 않고 스크롤만 해도 볼 수 있어야 하는 정보.
export default function PageSections() {
  return (
    <>
      <section id="about-section" className="page-section">
        <div className="sec-head">
          <span className="sec-num">02</span>
          <span className="sec-name">소개</span>
        </div>
        <div className="prose"><AboutContent /></div>
      </section>

      <section id="contact-section" className="page-section">
        <div className="sec-head">
          <span className="sec-num">03</span>
          <span className="sec-name">연락처</span>
        </div>
        <div className="prose"><ContactContent /></div>
      </section>
    </>
  );
}
