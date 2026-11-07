// 依頼の種類
import type { Quest } from '../core/state';

export interface QuestKindDef {
  kind: string; title: string; stages: ('peace' | 'tension' | 'war')[];
  objectives: Quest['objective'][]; templates: string[]; clients: string[];
  country: boolean; enemyCountry: boolean; danger: [number, number]; reward: number; weight: number;
  enemyPool: string[]; // 敵の兵種
}

const BANDITS = ['fighter', 'fighter', 'swordsman', 'archer', 'thief', 'warrior'];
const SOLDIERS = ['lancer', 'swordsman', 'archer', 'fighter', 'mage', 'armor_knight', 'cavalier', 'monk'];
const MONSTERS = ['fighter', 'warrior', 'pegasus_rider', 'hexer', 'berserker'];

export const QUEST_KINDS: QuestKindDef[] = [
  { kind: 'bandit', title: '盗賊退治', stages: ['peace', 'tension'], objectives: ['rout', 'boss'], templates: ['forest_road', 'border_village', 'mountain_fort', 'hill_camp', 'ruins', 'old_keep', 'prison'], clients: ['街道の村', '宿場の組合', '山あいの村'], country: true, enemyCountry: false, danger: [1, 2], reward: 250, weight: 10, enemyPool: BANDITS },
  { kind: 'monster', title: '魔物の討伐', stages: ['peace'], objectives: ['rout'], templates: ['forest_road', 'river_bridge', 'ruins', 'old_keep'], clients: ['森の猟師たち', '川辺の集落'], country: false, enemyCountry: false, danger: [1, 3], reward: 300, weight: 6, enemyPool: MONSTERS },
  { kind: 'escort', title: '商人の護衛', stages: ['peace', 'tension'], objectives: ['escort'], templates: ['forest_road', 'river_bridge'], clients: ['交易商の一行', '旅の商隊'], country: true, enemyCountry: false, danger: [1, 2], reward: 300, weight: 7, enemyPool: BANDITS },
  { kind: 'border', title: '{enemy}との国境の小競り合い', stages: ['tension', 'war'], objectives: ['rout', 'boss'], templates: ['border_village', 'mountain_fort', 'river_bridge', 'hill_camp', 'ruins'], clients: ['国境守備隊', '辺境伯'], country: true, enemyCountry: true, danger: [2, 3], reward: 450, weight: 8, enemyPool: SOLDIERS },
  { kind: 'defend', title: '国境の村の防衛', stages: ['tension', 'war'], objectives: ['defend'], templates: ['border_village'], clients: ['国境の村長', '村の自警団'], country: true, enemyCountry: true, danger: [2, 3], reward: 400, weight: 7, enemyPool: SOLDIERS },
  { kind: 'refugee', title: '避難民の護衛', stages: ['war'], objectives: ['escort'], templates: ['forest_road', 'river_bridge'], clients: ['避難民の代表', '教会'], country: true, enemyCountry: true, danger: [2, 3], reward: 350, weight: 6, enemyPool: SOLDIERS },
  { kind: 'rescue', title: '捕らわれた{client}の兵の救出', stages: ['tension', 'war'], objectives: ['rescue'], templates: ['mountain_fort', 'border_village', 'hill_camp', 'ruins', 'prison'], clients: ['前線の司令部', '捕虜の家族'], country: true, enemyCountry: true, danger: [2, 3], reward: 500, weight: 5, enemyPool: SOLDIERS },
  { kind: 'breakout', title: '包囲された部隊の突破', stages: ['war'], objectives: ['escape'], templates: ['forest_road', 'river_bridge', 'ruins', 'hill_camp'], clients: ['包囲された部隊', '前線の司令部'], country: true, enemyCountry: true, danger: [2, 3], reward: 450, weight: 5, enemyPool: SOLDIERS },
  { kind: 'fort', title: '砦の攻略', stages: ['tension', 'war'], objectives: ['seize', 'boss'], templates: ['mountain_fort', 'old_keep'], clients: ['前線の司令部', '騎士団'], country: true, enemyCountry: true, danger: [3, 3], reward: 600, weight: 5, enemyPool: SOLDIERS },
];
