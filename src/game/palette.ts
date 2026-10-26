export type Palette = {
  void: string; void2: string;
  floorA: string; floorB: string; floorHi: string; floorLo: string;
  wallTop: string; wallSide: string; wallHi: string; wallFace: string; outline: string;
  metal: string; metalHi: string;
  carpet: string; carpetDark: string; carpetHi: string;
  leaf: string; leafDark: string;
  hairHi: string; skinShade: string; blush: string;
  lightAmbient: string; lightWarm: string;
  unitAlly: string; unitEnemy: string;
  ink: string; inkDim: string;
  brass: string; brassDark: string; jade: string;
};

// 색은 CSS 변수가 원본이다. 캔버스는 여기서 한 번 읽어 쓴다.
export function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const c = (k: string) => css.getPropertyValue(k).trim();
  return {
    void: c("--void"), void2: c("--void-2"),
    floorA: c("--floor-a"), floorB: c("--floor-b"), floorHi: c("--floor-hi"), floorLo: c("--floor-lo"),
    wallTop: c("--wall-top"), wallSide: c("--wall-side"), wallHi: c("--wall-hi"), wallFace: c("--wall-face"), outline: c("--outline"),
    metal: c("--metal"), metalHi: c("--metal-hi"),
    carpet: c("--carpet"), carpetDark: c("--carpet-dark"), carpetHi: c("--carpet-hi"),
    leaf: c("--leaf"), leafDark: c("--leaf-dark"),
    hairHi: c("--hair-hi"), skinShade: c("--skin-shade"), blush: c("--blush"),
    lightAmbient: c("--light-ambient"), lightWarm: c("--light-warm"),
    unitAlly: c("--unit-ally"), unitEnemy: c("--unit-enemy"),
    ink: c("--ink"), inkDim: c("--ink-dim"),
    brass: c("--brass"), brassDark: c("--brass-dark"), jade: c("--jade"),
  };
}
