import AboutContent from "../AboutContent";
import ContactContent from "../ContactContent";

// 자기소개 방 액자를 열었을 때. 본문은 아래 02 소개 · 03 연락처와 같은 컴포넌트(텍스트뿐인 콘텐츠는 한 컴포넌트를 두 곳에서)
export default function AboutPanel() {
  return (
    <>
      <AboutContent />
      <h3>연락처</h3>
      <ContactContent />
    </>
  );
}
