import DownloadButton from "./DownloadButton";
import GameDesign, { type GameDesignData } from "./GameDesign";

// 원본(graduation_work: Unity 클라이언트 + FastAPI 서버)에서 확인한 내용만 적는다.
const DESIGN: GameDesignData = {
  pitch: "설치물에 파이썬 코드를 짜 넣어 공장을 자동화하며, 코딩 기초를 게임 진행으로 익히는 코딩 교육형 시뮬레이션.",
  specs: [
    ["장르", "코딩 퍼즐 · 공장 자동화"],
    ["엔진", "Unity 2022.3 (C#)"],
    ["서버", "FastAPI · MySQL · 힌트 추천 ML"],
    ["형태", "졸업 작품 · PC(Windows)"],
  ],
  loop: ["설치물에 코드 작성", "실행(F5)", "자원 채굴", "가공 · 판매로 골드", "퀘스트로 새 문법 · 설치물 해금"],
  points: [
    {
      title: "문법을 진행도로 배치",
      body: "튜토리얼 78단계가 변수 · 함수 호출 → 조건문(if/elif) → 반복문(for · while) → 수송 벨트 → 공장 확장 순서로 이어집니다. 새 문법과 설치물은 퀘스트를 깨야 열립니다.",
    },
    {
      title: "필요를 먼저 겪게 하는 흐름",
      body: "반복문이 아직 없을 때 채굴기는 한 번 일하고 멈춥니다. 다시 실행해야 하는 불편을 먼저 겪은 뒤 반복문을 배우는 구조라, 이 체험판도 그 구간을 그대로 옮겼습니다.",
    },
    {
      title: "실제 실행 + 게임 규칙 검사",
      body: "실행하면 서버가 코드를 실제 파이썬으로 돌려 문법과 출력을 확인하고, 게임은 그 코드가 설치물에 맞는지(자원 등급, 잠긴 문법 등)를 다시 검사해 바로 안내합니다.",
    },
    {
      title: "실력에 맞춘 AI 힌트",
      body: "제출한 코드는 기본 점수 · 개인 평균 대비 변화 · 힌트 반영 정도 · 나쁜 패턴 7종으로 채점됩니다. 군집 분석으로 수준을 나누고, 사용자 맥락을 보는 밴딧 모델이 그 사람에게 맞는 힌트를 고릅니다.",
    },
    {
      title: "다른 공장 방문 · 추천",
      body: "다른 플레이어의 아이디로 그 사람의 공장을 방문하고 추천할 수 있습니다. 추천 수와 랭킹이 남아 혼자 하는 학습에 비교하고 자랑할 거리를 더합니다.",
    },
  ],
};

export default function PyFactoryPage() {
  return (
    <>
      <DownloadButton game="py.Factory" platform="Windows · Unity 빌드" />
      <div className="prose">
        <p>py.Factory는 설치물에 파이썬 코드를 짜 넣어 공장을 자동화하는 게임입니다.
        게임창에서 실제 튜토리얼의 첫 구간(채굴기 → 가공기)을 줄인 체험판을 플레이할 수 있습니다.</p>
        <h3>체험 방법</h3>
        <ul>
          <li>채굴기를 클릭하거나 가까이 가서 E → 코딩창에 <code>mining(Common)</code> 입력 → 실행(F5)</li>
          <li>떨어진 자원을 클릭하거나 가까이 가서 E로 수집. 반복문이 없어서 1회 후 멈추면 우클릭이나 F5로 재가동</li>
          <li>자원 100개가 모이면 가공기에 <code>producting(Common, 'A')</code> → 상품을 클릭하거나 E로 판매</li>
        </ul>
        <p className="note">실제 게임과 연동하지 않고 웹으로 다시 구현한 간소화판입니다.
        조건문·반복문·수송 벨트·창고 등은 실제 게임에서 이어집니다.</p>
      </div>
      <GameDesign data={DESIGN} />
    </>
  );
}
