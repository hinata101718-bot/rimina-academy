// 勢力図（13夜目）：大陸の15の地域。地形の絵は public/art/worldmap.webp、地域の区分けは public/art/worldmap-regions.png（1つの点が地域の番号。255は海）
// 作り方：docs/mockups/worldmap-gen.py をもとに scripts/worldmap-make.py で作った
export type RegionHome = 'kingdom' | 'empire' | 'alliance' | 'school' | 'wild';
export interface RegionDef { idx: number; id: string; name: string; home: RegionHome; kind: 'capital' | 'land' | 'port' | 'school'; product: string; x: number; y: number }
export const MAP_SIZE = { w: 740, h: 940 };
export const REGIONS: RegionDef[] = [
  { idx: 0, id: 'limina', name: 'リミナ分校', home: 'school', kind: 'school', product: '学校の畑の麦', x: 439, y: 429 },
  { idx: 1, id: 'fiore', name: '商都フィオレ', home: 'alliance', kind: 'capital', product: '絹と香料', x: 570, y: 678 },
  { idx: 2, id: 'marina', name: 'マリーナ港', home: 'alliance', kind: 'port', product: '海の塩と魚', x: 380, y: 759 },
  { idx: 3, id: 'caelum', name: 'カエルム領', home: 'empire', kind: 'land', product: '高原の馬', x: 255, y: 535 },
  { idx: 4, id: 'grauen', name: 'グラウエン領', home: 'kingdom', kind: 'land', product: '灰色の羊毛', x: 309, y: 383 },
  { idx: 5, id: 'ignis', name: 'イグニス領', home: 'empire', kind: 'land', product: '火山の硫黄', x: 179, y: 378 },
  { idx: 6, id: 'aurelia', name: 'アウレリア領', home: 'empire', kind: 'land', product: '金の麦', x: 217, y: 701 },
  { idx: 7, id: 'heidel', name: 'ハイデル領', home: 'kingdom', kind: 'land', product: '北の毛織物', x: 325, y: 113 },
  { idx: 8, id: 'winter', name: '王都ヴィンターホルム', home: 'kingdom', kind: 'capital', product: '王家の鍛冶', x: 419, y: 267 },
  { idx: 9, id: 'volken', name: 'ヴォルケン領', home: 'kingdom', kind: 'land', product: '雪解けの銀', x: 452, y: 124 },
  { idx: 10, id: 'rossa', name: 'ロッサ領', home: 'alliance', kind: 'land', product: '薬草', x: 411, y: 594 },
  { idx: 11, id: 'bella', name: 'ベッラ領', home: 'alliance', kind: 'land', product: '葡萄酒', x: 578, y: 452 },
  { idx: 12, id: 'eisen', name: 'アイゼンタール領', home: 'kingdom', kind: 'land', product: '鉄と炭', x: 244, y: 237 },
  { idx: 13, id: 'solaria', name: '帝都ソラリア', home: 'empire', kind: 'capital', product: '帝国の大砲', x: 99, y: 554 },
  { idx: 14, id: 'septem', name: 'セプテム荒野', home: 'wild', kind: 'land', product: '盗賊の隠れ里', x: 74, y: 700 },
];
/** となりあう地域（番号の組） */
export const REGION_ADJ: [number, number][] = [[0, 3], [0, 4], [0, 8], [0, 10], [0, 11], [1, 2], [1, 10], [1, 11], [2, 6], [2, 10], [3, 4], [3, 5], [3, 6], [3, 10], [3, 13], [4, 5], [4, 8], [4, 12], [5, 12], [5, 13], [6, 10], [6, 13], [6, 14], [7, 8], [7, 9], [7, 12], [8, 9], [8, 11], [8, 12], [9, 11], [10, 11], [13, 14]];
export const REGION_BY_ID: Record<string, RegionDef> = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
export const REGION_BY_IDX: Record<number, RegionDef> = Object.fromEntries(REGIONS.map((r) => [r.idx, r]));
