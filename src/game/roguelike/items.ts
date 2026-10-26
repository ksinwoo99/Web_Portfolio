/*
 * 레벨업 선택지 아이템. 원본: 바탕화면 RewardData.csv (언리얼 데이터테이블 내보내기).
 * 웹 데모 결정(사용자, 2026-10-06): 템포를 위해 "눈에 바로 보이는" 투사체 강화 3종 + 공격속도·공격력 2종만 남긴다.
 *  - 불안정 물질: CSV 설명은 "광역 범위"지만 원본 코드(SetScale)에서 실제로 키우는 건 투사체 크기 → 설명을 사실대로 고쳤다
 *  - 주문 분산기·꿰뚫기: 원본은 Tier 3(11레벨부터)이지만 처음부터 나오게 했다
 * 값은 누적이 아니라 "그 레벨의 총량". 업그레이드하면 이전 레벨 효과를 빼고 새 값으로 바꾼다(원본과 동일).
 * 레벨업 횟수를 줄이고 한 번 고를 때 확 세지게(사용자 요청, 2026-10-23): 5레벨 아이템을 3레벨로 줄이고 레벨당 증가폭을 키웠다.
 *  크기 15%→25%/레벨(최대 75%), 공격속도 12%→20%/레벨(60%), 공격력 10→20/레벨(60 — 기본 60의 두 배). 주문 분산기·꿰뚫기는 원래 2레벨
 */

export type Stat = "projectileSize" | "projectileCount" | "pierce" | "attackDamage" | "attackSpeed";

export type Item = {
  id: string;
  name: string;
  /** 레벨별 효과. 크기는 %, 개수·관통은 개수(원본 CSV 단위) */
  levels: Partial<Record<Stat, number>>[];
  describe: (lv: number) => string;
};

export const ITEMS: Item[] = [
  {
    id: "Unstable_matter", name: "불안정 물질",
    levels: [1, 2, 3].map((l) => ({ projectileSize: 25 * l })),
    describe: (l) => `투사체 크기가 ${25 * l}% 커집니다.`,
  },
  {
    id: "Duplicator", name: "주문 분산기",
    levels: [1, 2].map((l) => ({ projectileCount: l })),
    describe: (l) => `투사체가 ${l}개 추가됩니다.`,
  },
  {
    id: "Pierce", name: "꿰뚫기",
    levels: [1, 2].map((l) => ({ pierce: l })),
    describe: (l) => `투사체가 적을 ${l}회 관통합니다.`,
  },
  {
    id: "Light_holster", name: "경량 단검집",
    levels: [1, 2, 3].map((l) => ({ attackSpeed: 20 * l })),
    describe: (l) => `공격속도가 ${20 * l}% 증가합니다.`,
  },
  {
    id: "Crimson_jewel", name: "붉은 보석",
    levels: [1, 2, 3].map((l) => ({ attackDamage: 20 * l })),
    describe: (l) => `공격력이 ${20 * l} 증가합니다.`,
  },
];

export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i])) as Record<string, Item>;

const NUM_CHOICES = 4; // 원본 기본값. 남은 아이템이 그보다 적으면 있는 만큼만 보여준다
const BASE_WEIGHT = 10; // CSV DropWeight — 전부 10

export type Choice = { itemId: string; level: number };

/** 원본 RollLevelUpChoices: 보유 아이템은 다음 레벨만, 이미 가진 건 가중치 2배, 중복 없이 최대 4개. */
export function rollChoices(owned: Record<string, number>): Choice[] {
  const pool = ITEMS
    .filter((it) => (owned[it.id] ?? 0) < it.levels.length)
    .map((it) => ({ itemId: it.id, level: (owned[it.id] ?? 0) + 1, w: owned[it.id] ? BASE_WEIGHT * 2 : BASE_WEIGHT }));
  const picked: Choice[] = [];
  while (picked.length < NUM_CHOICES && pool.length) {
    let r = Math.random() * pool.reduce((s, c) => s + c.w, 0);
    const i = pool.findIndex((c) => (r -= c.w) <= 0);
    const [c] = pool.splice(i < 0 ? pool.length - 1 : i, 1);
    picked.push({ itemId: c.itemId, level: c.level });
  }
  return picked;
}
