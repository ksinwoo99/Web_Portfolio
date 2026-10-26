import { AnimatePresence, motion, type Variants } from "motion/react";
import { ROOM_PAGES } from "../content/pages";
import type { Dir } from "../game/rooms";
import { useGameStore } from "../store";

/*
 * 게임창 아래 방 소개 페이지. 이웃한 방으로 옮기면 게임창의 카메라 패닝과 같은 방향·같은 길이로
 * 페이지가 밀려나고 새 방 페이지가 들어온다 — 웹페이지 자체가 그 방향으로 이동하는 연출.
 */

const DURATION = 0.45; // engine.ts의 PAN_MS와 맞출 것
const EASE = [0.65, 0, 0.35, 1] as const; // easeInOutCubic, 캔버스 패닝과 같은 곡선

// 들어오는 페이지의 시작 위치. 나가는 페이지는 그 반대편으로 빠진다.
function offset(dir: Dir | null, sign: 1 | -1) {
  switch (dir) {
    case "right": return { x: `${100 * sign}%`, opacity: 1 };
    case "left": return { x: `${-100 * sign}%`, opacity: 1 };
    case "down": return { y: 60 * sign, opacity: 0 };
    case "up": return { y: -60 * sign, opacity: 0 };
    default: return { opacity: 0 };
  }
}

const variants: Variants = {
  enter: (dir: Dir | null) => offset(dir, 1),
  center: { x: 0, y: 0, opacity: 1 },
  exit: (dir: Dir | null) => offset(dir, -1),
};

export default function RoomStage() {
  const room = useGameStore((s) => s.room);
  const dir = useGameStore((s) => s.moveDir);
  const Page = ROOM_PAGES[room];

  return (
    <div className="room-stage">
      <AnimatePresence initial={false} custom={dir}>
        <motion.div
          key={room}
          className="room-page"
          custom={dir}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: DURATION, ease: EASE }}
        >
          <Page />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
