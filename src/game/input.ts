// 키보드·터치 조이스틱·클릭이동이 같이 쓰는 입력 상태. 엔진이 매 프레임 읽는다.
export const keys: Record<string, boolean> = Object.create(null);
export const stick = { active: false, dx: 0, dy: 0 };
// 게임창 클릭/탭 위치(가상 해상도 좌표). 엔진이 매 프레임 비운다.
export const clicks: { x: number; y: number }[] = [];
// 터치 E 버튼 누름 횟수. 허브에선 상호작용, 체험판이 게임창을 넘겨받았을 땐 그 게임의 행동(예: 대시).
export const actions = { pending: 0 };

export function clearKeys() {
  for (const k in keys) keys[k] = false;
}

export function axis() {
  let dx = 0, dy = 0;
  if (keys.a || keys.arrowleft) dx -= 1;
  if (keys.d || keys.arrowright) dx += 1;
  if (keys.w || keys.arrowup) dy -= 1;
  if (keys.s || keys.arrowdown) dy += 1;
  if (stick.active) { dx += stick.dx; dy += stick.dy; }
  const m = Math.hypot(dx, dy);
  return m > 1 ? { x: dx / m, y: dy / m } : { x: dx, y: dy };
}
