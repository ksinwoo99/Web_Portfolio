import type { RoomId } from "./rooms";
import type { Palette } from "./palette";
import type { Light } from "./lighting";
import { pyfactoryPlugin } from "./pyfactory/sim";
import { roguelikePlugin } from "./roguelike/game";
import { evolutionPlugin } from "./evolution/sim";

/*
 * 방마다 붙는 체험판 로직. 엔진은 허브(이동·충돌·문·오브젝트)만 알고,
 * 전시실 고유의 게임(py.Factory 기계 작동, 로그라이크 한 판 등)은 여기 등록된 플러그인이 맡는다.
 */

export type Pt = { x: number; y: number };

export type DrawKit = {
  ctx: CanvasRenderingContext2D;
  PAL: Palette;
  px: (x: number, y: number, w: number, h: number, color: string) => void;
  now: number;
};

export type RoomPlugin = {
  /** 그 방에 있을 때만, 방 이동 패닝 중이 아닐 때 매 프레임 호출 */
  update(dt: number): void;
  /** 방 타일·오브젝트 위, 캐릭터 아래. 패닝 중에도 그 방 좌표계로 그려진다 */
  draw(k: DrawKit): void;
  /** 캐릭터 위(떠오르는 글자 등). 조명 층 위에 그려져 어두워지지 않는다 */
  drawTop?(k: DrawKit): void;
  /** 좌클릭/탭. true를 돌려주면 엔진은 이동·오브젝트 처리를 하지 않는다 */
  click?(p: Pt): boolean;
  /** 우클릭. 오브젝트 위면 그 id */
  secondary?(objectId: string | null, p: Pt): void;
  /** 마우스 커서를 손가락 모양으로 바꿀 곳인지 */
  hot?(p: Pt): boolean;
  /** 이 방의 추가 광원(방 좌표). 넘겨받은 동안엔 화면 좌표 */
  lights?(): Light[];
  /** 넘겨받은 동안 조명 바탕 밝기(0~1) — 전투 화면은 가장자리 적도 보여야 한다 */
  lightBoost?: number;

  /**
   * true인 동안 체험판이 게임창 전체를 넘겨받는다(로그라이크 한 판 진행 중 등).
   * 엔진은 허브 이동·그리기를 멈추고 update/render만 부른다. WASD는 input.axis()로 그대로 읽으면 된다.
   */
  takeover?(): boolean;
  render?(k: DrawKit): void;
  /** 넘겨받은 동안, 조명 층 위에 그리는 HUD(글자·게이지가 어두워지지 않게) */
  renderHud?(k: DrawKit): void;
  /** 넘겨받은 동안의 키 입력. true면 엔진의 기본 처리(상호작용 등)를 건너뛴다 */
  keydown?(e: KeyboardEvent): boolean;
  /** 넘겨받은 동안 터치 E 버튼 */
  action?(): void;
};

export const ROOM_PLUGINS: Partial<Record<RoomId, RoomPlugin>> = {
  pyfactory: pyfactoryPlugin,
  roguelike: roguelikePlugin,
  evolution: evolutionPlugin,
};
