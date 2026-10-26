import { OBJECTS_BY_ID, ROOMS, type ControlBadge } from "../game/rooms";
import { useRlStore } from "../game/roguelike/store";
import { useGameStore } from "../store";

const BASE_CONTROLS: ControlBadge[] = [
  { key: "WASD / ↑↓←→", label: "이동" },
  { key: "클릭", label: "그 위치로 이동 · 전시물 바로 열기" },
  { key: "Shift", label: "대시" },
];

// 로그라이크 한 판 진행 중에는 그 게임의 조작으로 바꿔 보여준다(대시는 사용자 요청으로 원본 Space → Shift, Esc 일시정지).
const ROGUELIKE_CONTROLS: ControlBadge[] = [
  { key: "WASD / ↑↓←→", label: "이동" },
  { key: "Shift", label: "대시 (쿨타임 10초)" },
  { key: "ESC", label: "일시정지" },
  { key: "자동", label: "투사체 공격" },
];

// 조작 배지는 모바일에서도 숨기지 않는다 — 조작법을 못 찾아 이탈하는 게 더 큰 손해.
export default function ControlsPanel() {
  const room = useGameStore((s) => s.room);
  const nearId = useGameStore((s) => s.nearObjectId);
  const rlPlaying = useRlStore((s) => s.phase !== "idle");
  const near = nearId ? OBJECTS_BY_ID[nearId] : null;

  const badges: ControlBadge[] = room === "roguelike" && rlPlaying ? ROGUELIKE_CONTROLS : [
    ...BASE_CONTROLS,
    { key: "E", label: near ? near.action ?? `${near.label} 살펴보기` : "상호작용" },
    { key: "ESC", label: "닫기" },
    ...ROOMS[room].controlsExtra,
  ];

  return (
    <div id="controls-panel" className="controls-panel">
      {badges.map((b) => (
        <span className="key-badge" key={b.key}>
          <kbd>{b.key}</kbd>
          {b.label}
        </span>
      ))}
    </div>
  );
}
