/** 맨 위 소개글. 자기소개 책상 팝업(CoverLetterPreview)에도 이 문단만 따로 쓴다 */
export function AboutIntro() {
  return (
    <p>다양한 게임 아이디어를 기획하고, 이를 유니티와 언리얼엔진으로 만들어냅니다. 또한 게임에 대한 분석, 공략, 역기획서 작성 등 다양한 문서 작업도 병행하여 남들에게 제 아이디어를 알리는 작업을 합니다.</p>
  );
}

export default function AboutContent() {
  return (
    <>
      <AboutIntro />
      <h3>주로 쓰는 것</h3>
      <ul>
        <li>Unity / C# — 게임플레이 로직, 툴 제작</li>
        <li>Unreal Engine / C++ — 로그라이크 개발</li>
      </ul>
    </>
  );
}
