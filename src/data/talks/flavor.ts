// 会話に差し込む、出身・家柄・季節ごとの言葉。
// {myHome} {myFood} {mySight} {myFest} … のように差し込む（{your…} は聞き手のもの）。
import type { Origin, House } from '../../core/types';

export interface OriginFlavor { home: string; food: string; sight: string; fest: string; cold: string }
export const ORIGIN_FLAVOR: Record<Origin, OriginFlavor[]> = {
  kingdom: [
    { home: '北の雪深い町', food: '羊肉のシチュー', sight: '凍った湖', fest: '冬至の灯籠祭り', cold: '冬は息まで凍る' },
    { home: '城下の石畳の町', food: '黒パンと蜂蜜', sight: '王城の尖塔', fest: '騎士の馬上試合', cold: '朝は霧が深い' },
    { home: '山あいの牧場の村', food: '焼いたチーズ', sight: '雪をかぶった峰', fest: '羊追いの祭り', cold: '夏でも夜は寒い' },
  ],
  empire: [
    { home: '帝都の下町', food: '辛い串焼き', sight: '大運河の灯り', fest: '凱旋の大行進', cold: '夏は石畳が焼ける' },
    { home: '南の港町', food: '揚げた小魚', sight: '赤い屋根の並ぶ坂', fest: '船出の祭り', cold: '雨季は毎日雨' },
    { home: '鉱山の町', food: '豆の煮込み', sight: '夜通し燃える炉', fest: '鍛冶の神の祭り', cold: '冬は煤まじりの雪' },
  ],
  alliance: [
    { home: '運河の多い商業都市', food: '魚の香草焼き', sight: '水面に映る市場', fest: '仮面の謝肉祭', cold: '春先は霧雨が続く' },
    { home: '丘の上の葡萄畑の村', food: '葡萄のパイ', sight: '一面の葡萄畑', fest: '収穫の踊り', cold: '秋の夕暮れが早い' },
    { home: '湖のほとりの学問の町', food: '川魚のスープ', sight: '大図書館の丸屋根', fest: '書物を祝う夜', cold: '冬は湖から風が吹く' },
  ],
  frontier: [
    { home: '国境近くの小さな村', food: '木の実のパン', sight: 'どこまでも続く草原', fest: '村の焚き火祭り', cold: '冬は村ごと雪に埋もれる' },
    { home: '森の中の集落', food: 'きのこの包み焼き', sight: '大樹の森', fest: '森の精を送る夜', cold: '森の冬は静かで長い' },
  ],
};

export const HOUSE_FLAVOR: Record<House, { home: string; duty: string }> = {
  noble: { home: '屋敷', duty: '家の名を背負うこと' },
  commoner: { home: '家', duty: '家族の暮らしを支えること' },
  orphan: { home: '孤児院', duty: '院の子どもたちの手本になること' },
};

/** 月（0=4月）→季節の言葉 */
export const SEASON_WORDS = ['春', '春', '初夏', '夏', '夏', '秋', '秋', '秋', '冬', '冬', '冬', '春先'];
export const SEASON_SCENE = [
  '桜の花びらが舞う中庭', '若葉の揺れる中庭', '雨上がりの回廊', '日差しの強い訓練場', '蝉の鳴く木陰',
  '涼しい風の吹く中庭', '落ち葉の積もる中庭', '夕焼けの見える回廊', '雪のちらつく中庭', '暖炉の前', '霜の降りた訓練場', '梅のつぼみがふくらむ中庭',
];
