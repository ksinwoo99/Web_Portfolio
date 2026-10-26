import { MotionConfig } from "motion/react";
import GameSection from "./components/GameSection";
import PageSections from "./components/PageSections";
import PanelSheet from "./components/PanelSheet";
import ListSheet from "./components/ListSheet";
import PixelBackground from "./components/PixelBackground";
import { useHashSync } from "./hooks/useHashSync";

export default function App() {
  useHashSync();

  return (
    // reducedMotion="user": 움직임 줄이기를 켠 방문자에게는 슬라이드 없이 바로 바뀐다.
    <MotionConfig reducedMotion="user">
      <PixelBackground />

      <header className="site-header">
        <div className="site-header-inner">
          <a className="brand" href="#top">
            <span className="brand-mark" aria-hidden="true">▶</span> GAME DEVELOPER · 김신우<span className="caret" aria-hidden="true">_</span>
          </a>
          <nav className="site-nav" aria-label="섹션">
            <a href="#game-section">전시관</a>
            <a href="#about-section">소개</a>
            <a href="#contact-section">연락처</a>
          </nav>
        </div>
      </header>

      <section className="hero" id="top">
        {/* "게임"만 도트 글꼴 + 주황, 나머지는 Pretendard */}
        <h1>제가 하고 싶은 <em>게임</em>을<br />만들어냅니다.</h1>
        <p className="pitch">
          아래 게임창 속 전시관을 걸어 다니며 작품을 관람하고, 해당 게임들의 데모 버전을 체험해보세요.
        </p>
        <a className="hero-cta" href="#game-section"><span aria-hidden="true">▶</span> 전시관 들어가기</a>
      </section>

      <GameSection />
      <PageSections />

      <footer className="site-footer">
        <span>© 김신우</span>
        <span>게임 개발 포트폴리오</span>
      </footer>

      <PanelSheet />
      <ListSheet />
    </MotionConfig>
  );
}
