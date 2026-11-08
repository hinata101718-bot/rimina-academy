// バランス値。ゲームの数値はすべてここに集める（設計書の「ふつう」が初期値）。
import type { Rank, SkillId, StatId } from '../core/types';

export const SAVE_VERSION = 7;

export const RANKS: Rank[] = ['E', 'E+', 'D', 'D+', 'C', 'C+', 'B', 'B+', 'A', 'A+', 'S'];
export const RANK_POINTS: Record<Rank, number> = {
  E: 0, 'E+': 20, D: 50, 'D+': 90, C: 140, 'C+': 200, B: 270, 'B+': 350, A: 440, 'A+': 540, S: 650,
};
export const SKILL_MAX_POINTS = 700;

export const SKILLS: SkillId[] = ['sword', 'lance', 'axe', 'bow', 'magic', 'faith', 'riding', 'heavy', 'flying', 'gun'];
export const STATS: StatId[] = ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res', 'cha'];

export const B = {
  // ---- 生徒 ----
  student: {
    firstYearCount: [6, 8] as [number, number],
    startAge: [18, 20] as [number, number],
    olderChance: 0.06,          // 年上の新入生
    olderAge: [23, 26] as [number, number],
    hpStart: [18, 26] as [number, number],
    statStart: [2, 8] as [number, number],
    growthBase: [7, 30] as [number, number], // 7夜目：レベルの目標が上がった分、15〜60 → 7〜30
    hpGrowthBonus: 10,          // HPの成長率は少し高め
    statCapSchool: 30,
    hpCapSchool: 60,
    statCapGrad: 50,
    hpCapGrad: 80,
    expPerLevel: 100,
    maxLevel: 70,               // 7夜目：卒業後の上限 50→70
    traitCount: [1, 3] as [number, number],
    talentChance: 0.55,         // 何かしらの才能を持つ確率
    heroChance: 0.01,
    startSkillPoints: [0, 45] as [number, number], // 夢・出身に沿った技能の初期値
    capacityByRep: [ [0, 7], [20, 8], [40, 9], [60, 10] ] as [number, number][],
  },
  // ---- やる気・疲労 ----
  motivationMul: [0.8, 0.9, 1.0, 1.1, 1.2],
  motivationLabel: ['とても低い', '低い', '普通', '高い', 'とても高い'],
  fatigue: {
    lesson: 7, tutoring: 10, spar: 10, campMul: 1.5,
    naturalRecovery: 5, chapelRecovery: [0, 3, 6, 9],
    slowAt: 60, slowMul: 0.8, sickAt: 100, sickReset: 40, warnAt: 80,
    rest: 25, tea: 5, epidemicCap: 80,
  },
  // ---- 日ごとの授業カード（7夜目）。数字は長期シミュレーションで「育ち方の目標」に合わせた ----
  day: {
    cards: 5,                      // 毎日出る授業の数（＋休講）
    faces: [0.3, 0.45, 0.25],      // 1枚のカードに出る顔の数（1人・2人・3人の割合）
    skillPts: 0.62,                // 顔なし・↑↑・倍率1のときの、1日の技能ポイント
    faceMul: 2, targetMul: 1.3, target2Mul: 1.15, tagMul: 1.3,
    viceMul: 1.1,                  // 担任のいる学年は少しよく伸びる
    exp: 2.7,                      // ふつうの授業の経験値（顔なし）
    expDamp: { base: 1.25, perLevel: 0.028, min: 0.3, max: 1.2 }, // レベルが上がるほど授業の経験値は少なく
    reveal: 0.5,                   // 才能の判明度（顔なし）
    trainPts: 12,                  // 鍛錬ゲージ（↑↑・顔なし）。100で能力+1
    trainFull: 100,
    naturalRecovery: 3, chapelRecovery: [0, 1, 2, 3],
    lowStamina: 40,                // 体力がこれ未満で「疲」（＝疲労60以上）
    tea: { support: 6, motivation: 1, talkChance: 0.6 },
    dinner: { motivationChance: 0.5, support: 1 },
    spar: { skill: 1.0 },          // 全部の技能に（skillPts×これ）
    field: { skill: 0.9 },
    interview: { faceTrust: 1 },
    career: { trust: 3, faceTrust: 6 },
    eventChance: 0.55,             // 練習中の出来事が起きる確率
    teacherGrow: 0.35,             // 選んだ授業の技能が、教官・講師にも少し身につく
    festivalSocial: 2.5,           // 収穫祭の月は交流のカードが出やすい
    careerAutumn: 3,               // 秋（10月）以降は進路指導が出やすい
    consultInterview: true,
    sickDays: 5,                   // 体調を崩すと休む日数
    motivationDrop: 0.06,          // 疲れているとき、1日にやる気が下がる確率
  },
  // ---- 先生の体力（7夜目の途中で方針変更：体力は先生だけ。生徒の体力・疲労・体調不良はなくした） ----
  teacher: {
    max: 100, ageFrom: 45, agePerYear: 1, minMax: 70, epidemic: 15, // 年をとると最大体力が少し下がる（45歳から1年に1、最低70）。疫病の年は−15
    natural: 4,                 // 毎日の自然回復
    chapel: [0, 1, 2, 3],       // 礼拝堂の段階ごとの毎日の回復
    chapelRest: [0, 5, 10, 15], // 礼拝堂の段階ごとの休講の回復の上乗せ
    lowAt: 30, lowMul: 0.85,    // 体力がこれ未満だと授業の効果×0.85
    restAt: 45,                 // おまかせ：これ未満なら休講も考える
    sickDays: 3, sickRecover: 20, // 0になると3日寝込む（自動で休講）。寝込んでいる間は1日+20
  },
  // ---- 授業（6夜目まで。週末・個人指導の数字は古いセーブの変換と会話の条件に使う） ----
  lesson: {
    focusPoints: 6, targetPoints: 8, expPerWeek: 9, // 3夜目：兵種試験にレベル条件が入ったので、授業の経験値を5→9に
    teacherRankMul: { E: 0.6, D: 0.8, C: 1.0, B: 1.2, A: 1.4, S: 1.6 } as Record<string, number>,
    noTeacherMul: 0.5,
    campMul: 1.5,
    dreamMatchUpChance: 0.35,  // 月末：目標技能が夢に沿うとやる気が上がる確率
    dreamMismatchDownChance: 0.25,
  },
  tutoring: {
    baseSlots: 3, maxSlots: 6,
    skillPoints: 25, subSkillPoints: 15,
    reveal: 15, subReveal: 8,
    exp: 15, trust: 3,
    talkTrust: 10, talkReveal: 10,
    consultPerWeek: [0, 2] as [number, number],
    consultChance: 0.45,
    oldTiredChance: 0.2, oldTiredAge: 56,
  },
  weekend: {
    baseActions: 1, extraActionChance: 0.0, festivalExtra: 1,
    teaSupport: 8, sparSupport: 6, sparSkill: 10,
    dinnerMotivationChance: 0.7,
    teaTalkChance: 0.6,
  },
  // ---- 才能 ----
  talent: {
    weeklyReveal: 2, libraryReveal: [0, 1, 2, 3],
    battleReveal: 10, hint1: 30, hint2: 60, full: 100,
    expDiv: 20, // 教官の経験÷20 を毎週の判明度に加算（上限3）
    expBonusMax: 3,
  },
  // ---- 支援・信頼 ----
  support: {
    max: 150, C: 30, B: 70, A: 120,
    sameGradeMonthly: 1, adjacentBattle: 2, talkBonus: 3,
    battle: {
      C: { hit: 5, avo: 5, crit: 0, dmg: 0 },
      B: { hit: 10, avo: 10, crit: 3, dmg: 0 },
      A: { hit: 15, avo: 15, crit: 5, dmg: 1 },
    },
    range: 2, maxPartners: 2,
    loveChance: 0.35,
  },
  trust: { max: 100, letterAt: 50, consultBeforeDropAt: 60, specialAt: [40, 70, 90] },
  archive: { perStudent: 24, departedKeep: 8, departedYears: 3 },
  // ---- 退学 ----
  dropout: {
    lowMotivationWeeks: 6,   // 「とても低い」がこの週数続くと予兆
    familyChancePerMonth: 0.004,
    poachChancePerMonth: 0.006,
    homeWarChancePerMonth: 0.01,
    signWeeks: [4, 8] as [number, number],
    talksHighTrust: 1, talksLowTrust: 2, highTrust: 50,
  },
  // ---- 学校 ----
  school: {
    startMoney: 800, startReputation: 10,
    donationPerRep: 12,
    aidPerRankPoint: 8, aidPerFriendship: 5,
    // 友好度は年度末に「その国にいる卒業生の数」に見合う高さへ少しずつ戻る（4夜目）。目安＝20＋現役の卒業生1人につき3（上限100）
    friendshipDrift: { base: 20, perAlumni: 2.5, rate: 0.4 },
    aidRichFrom: 3000, aidRichSpan: 12000, aidRichMin: 0.15, // 所持金が多いほど三国からの援助金は減る
    reputationMax: 100,
    deadlineYear: 3, deadlineRep: 40, independenceRep: 70,
    vassalOtherFriendship: -20, independencePenalty: -30,
    vassalAidMul: { empire: 1.5, kingdom: 1.0, alliance: 1.2 } as Record<string, number>,
  },
  facilities: {
    training: { name: '訓練場', cost: [600, 1500, 3000], skillUp: [0, 0.1, 0.2, 0.3], skills: ['sword', 'lance', 'axe'] as SkillId[] },
    library: { name: '書庫', cost: [600, 1500, 3000], skillUp: [0, 0.1, 0.2, 0.3], skills: ['magic'] as SkillId[] },
    stable: { name: '厩舎', cost: [800, 1800, 3500], skillUp: [0, 0.1, 0.2, 0.3], skills: ['riding', 'flying'] as SkillId[] },
    chapel: { name: '礼拝堂', cost: [600, 1500, 3000], skillUp: [0, 0.1, 0.2, 0.3], skills: ['faith'] as SkillId[] },
    dining: { name: '食堂', cost: [500, 1200, 2500], skillUp: [0, 0, 0, 0], skills: [] as SkillId[] },
    range: { name: '射撃場', cost: [800, 1800, 3500], skillUp: [0, 0.1, 0.2, 0.3], skills: ['gun', 'bow'] as SkillId[] },
  },
  diningMotivationKeep: [0, 0.15, 0.3, 0.45], // 毎週のやる気低下を防ぐ確率
  diningEventUp: [0, 0.1, 0.2, 0.3],
  teachers: {
    candidates: [2, 3] as [number, number],
    salary: [150, 400] as [number, number],
    alumniSalaryMul: 0.5,
    yearlyRaise: 0.05, maxRaise: 1.6, // 毎年の昇給（雇ったときの給料の最大1.6倍まで）
    max: 6,                           // 雇える講師の上限
  },
  /** 施設の維持費（段階1つにつき毎月） */
  upkeepPerLevel: 30,
  reputation: {
    questWin: [1, 3] as [number, number], questWinByDanger: [0, 1.1, 1.5, 2.0], questLose: -2, deathInSchool: -3, dropout: -1,
    exhibition: [2, 4] as [number, number], promotionDiv: 4, promotionMax: 3,
    yearlyDecay: 0.08, decayFloor: 40, schoolDefenseWin: 3,
  },
  // ---- 試験 ----
  exam: { baseRate: 60, perPoints: 5, max: 100, levelReq: [0, 5, 15, 25, 45] as number[], heroLevel: 25 }, // 段階ごとの受験レベル（7夜目：初級5・中級15・上級25・最上級（卒業後）45、英雄25）
  // ---- 戦闘 ----
  battle: {
    width: 8, height: 12,
    deployBase: 6, deployAt12: 8, deployAt20: 10,
    triangleHit: 15, triangleMight: 1, effectiveMul: 3,
    doubleSpeed: 4, critMul: 3,
    fortHealPct: 0.2,
    rewinds: 3, rewindTurns: 5,
    exp: { hit: 10, kill: 30, heal: 12, survive: 5, levelDiffPer: 3, levelDiffMax: 20, minKill: 10 },
    drillExpMul: 0.7,
    skillPerUse: 1.5,   // 7夜目：戦闘で武器を1回使うごとの技能（4→1.5）
    expDamp: { base: 0.5, perLevel: 0.006, min: 0.3 }, // 7夜目：戦闘の経験値は控えめに（レベルの伸びの中心は授業）。レベルが高いほど少なく
    injuryBase: 50, injuryPerLck: 1, injurySupportB: 5, injurySupportA: 10, injuryMax: 90,
    injuryWeeks: [3, 5] as [number, number],
    commandBase: 80, commandPerTrust: 0.2,
    aimHit: 15,
    poisonPct: 0.1, poisonTurns: 3, weakenAmount: 3, weakenTurns: 2,
    rainMove: -1, fogRange: -1,
    vulnerary: 10,
    maxTurnsDefault: 25,
    focusAggro: 250, // 自動の戦闘「速攻で敵将を」：敵将を狙いやすく
    enemyPowerRange: [0.9, 1.1] as [number, number],
    enemyPowerBase: 0.5, enemyPowerPerDanger: 0.1, drillPowerMul: 0.85,
    gunDefPierce: 0.5,
    escortAggro: 25, npcHp: 30, npcDef: 6, escapeNeed: 3,
    npcHpPerLevel: 2, npcDefPerLevel: 0.4, defendSpawnDist: 5, // 7夜目：守る相手（村人・依頼人）は依頼のレベルに合わせて丈夫に
  },
  terrain: {
    plain: { name: '平地', avo: 0, def: 0, cost: { infantry: 1, cavalry: 1, armor: 1, flying: 1 } },
    forest: { name: '森', avo: 20, def: 0, cost: { infantry: 2, cavalry: 3, armor: 2, flying: 1 } },
    mountain: { name: '山', avo: 30, def: 0, cost: { infantry: 2, cavalry: 99, armor: 99, flying: 1 } },
    fort: { name: '砦', avo: 20, def: 2, cost: { infantry: 1, cavalry: 1, armor: 1, flying: 1 } },
    river: { name: '川', avo: 0, def: 0, cost: { infantry: 99, cavalry: 99, armor: 99, flying: 1 } },
    bridge: { name: '橋', avo: 0, def: 0, cost: { infantry: 1, cavalry: 1, armor: 1, flying: 1 } },
    village: { name: '村', avo: 10, def: 0, cost: { infantry: 1, cavalry: 1, armor: 1, flying: 1 } },
    wall: { name: '壁', avo: 0, def: 0, cost: { infantry: 99, cavalry: 99, armor: 99, flying: 99 } },
    road: { name: '道', avo: 0, def: 0, cost: { infantry: 1, cavalry: 1, armor: 1, flying: 1 } },
    door: { name: '扉', avo: 0, def: 0, cost: { infantry: 99, cavalry: 99, armor: 99, flying: 99 } }, // シーフ系が隣で開けると道になる
  },
  // ---- 敵の強さ（7夜目：生徒の成長率を下げた分、敵の1レベルあたりの伸びも下げた。6夜目は hp .75 str .42 …、武器は Lv7・15 で持ち替え） ----
  enemy: {
    growth: { hp: 0.5, str: 0.31, mag: 0.23, skl: 0.3, spd: 0.3, lck: 0.23, def: 0.25, res: 0.19, cha: 0.15 } as Record<string, number>,
    weaponLv: [12, 26] as [number, number],
  },
  // ---- 依頼 ----
  quests: {
    realCount: [2, 3] as [number, number],
    reward: [200, 1500] as [number, number],
    friendshipUp: 3, powerUp: 1, enemyFriendshipDown: 2,
    mercBonus: 0.2,
  },
  // ---- 進路 ----
  career: {
    acceptBase: 30, acceptPerTrust: 0.6,
    matchGrowth: 0.1, forcedGrowth: -0.1,
    friendshipPerGrad: 5,
    offerBase: 0.25, // 声かけの基本確率
  },
  // ---- 卒業生 ----
  alumni: {
    yearlyExp: { warrior: 140, strategist: 100, civil: 60, stay: 50, home: 25, merc: 120 } as Record<string, number>, // 7夜目：最上級（Lv45）・上限（Lv70）に合わせて少し上げた
    deathRate: { peace: 0.006, tension: 0.015, war: 0.028 },
    frontDeathMul: 1.25, rearDeathMul: 0.8, veteranLevel: 60, veteranMin: 0.45,
    empireFrontExtra: 0.012,
    injuryRate: 0.06,
    retireAge: [48, 55] as [number, number],
    marriageRate: 0.15,
    childRate: 0.3,
    childEnrollAge: 18,
    betrayRate: 0.01,
    transferRate: 0.03,
    letterRate: 0.6,
    rankPoints: {
      warrior: [1, 2, 4, 8, 15],
      strategist: [1, 3, 6, 12],
      civil: [1, 3, 6, 12],
    },
    promoteBase: 0.25,
    promoteLevel: 22, // 昇進のしやすさの基準のレベル（7夜目：卒業時のレベルが上がったので 15→22）
    tier4Level: 45,
  },
  // ---- 戦況 ----
  world: {
    startPower: { kingdom: 55, empire: 65, alliance: 50 },
    startRelations: { ke: -30, ea: -10, ak: 10 },
    startTension: 30,
    peaceBelow: 35, warAbove: 65,
    relWar: -50, relAllied: 50,
    warriorPowerMul: 0.3, strategistPowerMul: 0.25, civilRelMul: 0.4,
    empireAmbition: -0.22, allianceBridge: 0.15, warFatigueYears: 4, warFatiguePerYear: 1.2,
    yearRandom: 3, warDecay: -3,
    tensionPerWar: 8, tensionPerFriendly: -5, tensionPowerGapDiv: 10,
    tensionBase: 0, tensionWarPair: 38, tensionTensePair: 12, tensionTenseMul: 0.2, tensionAlliedPair: -6, tensionFriendlyPair: -2,
    monthlyDrift: 1.2,
    powerMeanRevert: 0.08, powerMeanRevertYear: 0.12,
    pairWarFatigue: 1.5, pairWarFatigueMax: 10, weakSidePower: 30, weakSidePeace: 6, civilRelMax: 8, warriorPowerMax: 4, monthlyWarDrift: -0.1,
    gunYears: [3, 6] as [number, number],
    events: {
      borderClashRel: -15, borderClashBelow: -35,
      invasionPower: -10, invasionEmpirePower: 70,
      kingDeathYear: 5,
      allianceStrifePower: 40, allianceStrifeHit: -8,
      famineWarYears: 2, famineAidMul: 0.7,
      epidemicRate: 0.02,
      heroPower: 15,
      schoolDefenseChance: 0.15,
      neutralDefenseChance: 0.12, // 中立宣言の条件が防衛戦以外そろっているとき、激戦期でなくても学校が狙われる（毎月）
      peaceRel: 0,
      peaceTension: 45,             // 関係がすべて0以上で、緊張度がこれ未満なら和平会議が開かれやすい
      peaceChance: 0.3,
      diplomatTalksTension: 62,     // 教え子の大使が二国以上にいれば、戦争中でなければ会議を呼びかけられる
      diplomatTalksChance: 0.02,
      peaceCooldown: 30,
      peaceBaseRel: 6, peacePerAmbassador: 3,
      roundTableRel: 25,            // 和平の円卓での関係の改善
      diplomatAmbitionDamp: 0.25,   // 帝国の大使の教え子1人ごとに、帝国の野心を弱める割合
    },
    alumniAppear: { peace: 0.08, tension: 0.18, war: 0.3 },
  },
  // ---- 教官 ----
  instructor: {
    retireMin: 50, retireMax: 65,
    // 教えるほど上がる技能（ポイント。D=50→B=270 は苦手科目を重点にし続けて約10年）
    growFocus: 0.42,         // その科目がどこかの学年の重点科目だった週
    growFocusExtraGrade: 0.05, // 2学年め・3学年めも重点にしていれば少し上乗せ
    growTutor: 0.15,         // 個人指導（技能指導）で教えた1回
    capGood: 'S' as Rank, capOther: 'B' as Rank, capWanderer: 'A' as Rank,
    teacherGrow: 0.2, teacherCap: 'A' as Rank, teacherDayMul: 0.6, // 講師：自分の科目の授業の日（7夜目）
    // 後継
    acceptBase: 20, acceptPerTrust: 0.7, acceptMax: 95,
    recallPower: 3, recallFriendship: -5, recallRank: 2, // 部隊長・参謀長・大使以上を呼び戻すと国力と友好度が下がる
    newFriendship: 10,       // 新しい教官の所属していた国との縁
    externalAge: [30, 38] as [number, number],
  },
  // ---- 開始の状態（「ふつう」「名門」はエンディングに一度届くと選べる） ----
  starts: {
    poor: { name: '廃校寸前', money: 800, rep: 10, facility: 0, cohort: [6, 8] as [number, number], quality: 0, deadline: true },
    normal: { name: 'ふつう', money: 3000, rep: 40, facility: 1, cohort: [8, 9] as [number, number], quality: 0.3, deadline: false },
    elite: { name: '名門', money: 6000, rep: 70, facility: 2, cohort: [9, 10] as [number, number], quality: 0.6, deadline: false },
  },
  // ---- エンディング（設計書 §15） ----
  ending: {
    unifyYears: 2,               // 一国の国力が他の二国の合計を上回る状態が2年続く
    ceasefireWarYears: 8,        // 戦いの疲れ（激戦期1年=1、緊張期1年=0.5、平和期は−1）が8年分
    ceasefirePower: 35,          // 三国すべての国力が35以下
    neutralRep: 90, neutralGrads: 100, neutralFriendship: 60, // 学校の中立宣言（4夜目にゆるめた）
    neutralBalance: 1.15, neutralAlumniMin: 10, // 三国にいる教え子の数が釣り合っている（多い国が少ない国の1.15倍まで・各国10人以上）
    neutralRevealRep: 70,        // 評判70になるまで、戦況タブの「中立宣言への道」は「？？？」
    // 戦いの疲れ：長く戦うほど、三国とも国力が削れていく（強い国ほど大きく）
    exhaustWar: 1, exhaustTension: 0.5, exhaustPeace: -1, exhaustDrainFrom: 3, exhaustDrainPer: 0.03,
    // エンディングのあと「この学校を続ける」と平和な時代。まれに再び戦争
    peaceEraRel: 30, relapseChance: 0.02, // relapseChance は6夜目まで（7夜目からは火種のくすぶりで次の戦争）
    // 火種（7夜目）：毎年のくすぶりの伸びは 100÷目安の年数 × 倍率（0.35〜2）。予兆は30・60・85
    seed: {
      jitter: 0.2, minMul: 0.6, maxMul: 2, omenAt: [30, 60, 85] as number[], // 遅らせても止めることはできない（最小0.6倍）
      peaceLostCivil: 0.35, peaceActiveCivil: 0.03,   // 円卓：去った大使以上の文官1人ごとに＋、現役の文官1人ごとに−
      unifyStudent: 0.02, unifyAlumni: 0.02,          // 統一：旧二国出身の在校生・その国で役職についた教え子1人ごとに−
      ceasePower: 0.012, ceaseHelp: 0.08,             // 停戦：三国の国力のいちばん高い国が50を超えた分ごとに＋、弱った国の依頼に勝つごとに−
      neutralRep: 0.01, neutralFriend: 0.012,         // 中立：評判70を超えた分ごとに＋、三国の友好度の低い国が50を超えた分ごとに−
      outbreakRel: -55, outbreakTension: 70,          // 次の戦争の始まり：関係を下げ、緊張度を上げる
    },
  },
  // ---- まるごと書いた会話（7夜目）：部品を組み合わせた会話より何倍出やすいか。面談でまるごと書いたものを選ぶ割合 ----
  talkWhole: { weight: 3, interviewChance: 0.7 },
  // ---- 面談：直近の面談と同じ話題は避ける（記録の新しいほうから何件） ----
  interview: { avoidRecent: 4 },
  // ---- 副教官（学年の担任） ----
  vice: { minYears: 1, max: 3, tutorMul: 0.7, tutorPerVice: 1 },
  // ---- 演出（ミリ秒）。設定の「演出の速さ」「敵ターンの速さ」で倍率がかかる ----
  anim: {
    speedMul: [1, 1.35, 1, 0.6],      // 演出の速さ：ゆっくり／ふつう／はやい
    enemySpeedMul: [1, 1, 0.65, 0.4],  // 敵ターンの速さ：ゆっくり／ふつう／はやい
    fastMul: 0.12,                     // タップで早送りしたときの倍率
    enemyFocus: 380,      // 動く敵に枠を合わせてから歩き出すまで
    enemyWalkStep: 130,   // 敵が1マス歩く時間
    playerWalkStep: 55,   // 味方が1マス歩く時間
    targetFlash: 330,     // 攻撃対象を光らせる時間
    enemyAfter: 260,      // 敵1体の行動のあとの間
    strikeLead: 220,      // 一撃ごとの溜め
    gauge: 500,           // HPゲージが減る時間
    strikeAfter: 260,     // 一撃のあとの間
    killPause: 420,
    panelAfter: 320,
    banner: 700,          // 「敵のターン」などの帯
    expGauge: 700,        // 経験値ゲージが伸びる時間
    skillGauge: 600,
    levelStat: 230,       // レベルアップで能力が1つ光る間隔
    learn: 900,
    flip: 650,            // 日めくり
  },
  // ---- 誕生日（誕生日の週：やる気+1、お茶会で支援が上がりやすい） ----
  birthday: { motivation: 1, teaMul: 1.5, trust: 2 },
  letters: { birthdayChance: 0.4, careChance: 0.08 }, // 誕生日の月の家族の便り・卒業生からの差し入れ
  // ---- その他 ----
  exportReminderDays: 14,
  itemPrice: { vulnerary: 100, elixir: 500 },
  familyLetterChance: 0.01,
  pressureAt: -20, vassalInviteGap: 50,
};

export type Difficulty = 'easy' | 'normal' | 'hard';
export interface DifficultyMods {
  enemy: number; exp: number; money: number; death: number; reveal: number; war: number;
  /** 技能の伸び方（7夜目） */
  skill: number;
}
export const DIFFICULTY: Record<Difficulty, DifficultyMods> = {
  easy: { enemy: 0.85, exp: 1.25, money: 1.25, death: 0.5, reveal: 1.3, war: 0.8, skill: 1.2 },
  normal: { enemy: 1, exp: 1, money: 1, death: 1, reveal: 1, war: 1, skill: 1 },
  hard: { enemy: 1.15, exp: 0.85, money: 0.85, death: 1.3, reveal: 0.8, war: 1.2, skill: 0.85 },
};
