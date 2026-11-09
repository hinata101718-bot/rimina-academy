// バランス値。ゲームの数値はすべてここに集める（設計書の「ふつう」が初期値）。
import type { Rank, SkillId, StatId } from '../core/types';

export const SAVE_VERSION = 19;

export const RANKS: Rank[] = ['E', 'E+', 'D', 'D+', 'C', 'C+', 'B', 'B+', 'A', 'A+', 'S'];
export const RANK_POINTS: Record<Rank, number> = {
  E: 0, 'E+': 20, D: 50, 'D+': 90, C: 140, 'C+': 200, B: 270, 'B+': 350, A: 440, 'A+': 540, S: 650,
};
export const SKILL_MAX_POINTS = 700;

export const SKILLS: SkillId[] = ['sword', 'lance', 'axe', 'bow', 'magic', 'faith', 'riding', 'heavy', 'flying', 'gun', 'tactics', 'command'];
/** 武器と体の技能（10夜目：軍略・統率を除いたもの。兵種・武器・育ち方の目安に使う） */
export const ARM_SKILLS: SkillId[] = ['sword', 'lance', 'axe', 'bow', 'magic', 'faith', 'riding', 'heavy', 'flying', 'gun'];
/** 采配の技能（10夜目） */
export const LEAD_SKILLS: SkillId[] = ['tactics', 'command'];
export const STATS: StatId[] = ['hp', 'str', 'mag', 'skl', 'spd', 'def'];

export const B = {
  // ---- 最初の1時間の案内（14夜目） ----
  tutorial: {
    /** 1日目の授業の札の数（休講なし） */
    firstCards: 3,
    /** 最初の戦い（盗賊の見張り）の敵の強さ（ふつうの依頼を1として） */
    enemyPower: 0.5,
    /** 最初の戦いの報酬と、いちばん活躍した子がもらえる経験値の下限（レベルアップを一度見せるため） */
    reward: 200, mvpExp: 100,
  },
  // ---- 得意・苦手・才能開花（10夜目） ----
  apt: {
    goodMul: 1.5, badMul: 0.5,
    /** 芽が見えた苦手の伸び（育てればふつうに伸びる） */
    budMul: 1.0,
    /** 得意は2〜3個（3個になる確率）、苦手は1〜2個（2個になる確率） */
    good3: 0.45, bad2: 0.45,
    /** 眠った芽を持つ子の割合、金の芽（英雄への道）の割合 */
    budChance: 0.3, goldChance: 0.012,
    /** 芽の判明度：ヒント・芽の印が見える */
    hint: 30, known: 60,
    /** 目標技能にしてこのランクまで上げると開花 */
    bloomRank: 'D+' as const,
    /** 金の芽：判明したうえで、このレベル・得意の技能がこのランク */
    goldLevel: 20, goldRank: 'C+' as const,
  },
  // ---- 勢力図（13夜目） ----
  regions: {
    /** 戦争中、強い国が年度末に国境の地域を奪う見込み：もと＋国力の差1あたり（上限） */
    captureBase: 0.15, capturePerPower: 0.012, captureMax: 0.6,
    /** 平和なとき、奪われた地域がもとの国に戻る見込み（1年に） */
    returnInPeace: 0.25,
    /** 依頼の勝ち負けで地域の色が変わる見込み（守る・奪う戦い） */
    questTake: 0.18, questLose: 0.12,
    /** 地域の多さの倍率（援助金・入学者の出身）の下限と上限 */
    mulMin: 0.6, mulMax: 1.4,
    /** 14夜目：争いの地（戦いの最中・取られた地域）の依頼は危険度が1つ上がる（3のときはレベルが上がる）。報酬も上がる。
     *  平和な時代も、無主地（荒野）の依頼はときどき手ごわい */
    hotLevel: 2, hotReward: 1.3, wildHot: 0.35,
    /** 14夜目（2回目の調整）：戦争が終わったあとの平和な時代は、食いつめた兵くずれの盗賊団が手ごわい（実戦の依頼がこの見込みで争いの地に） */
    peaceHot: 0.4,
  },
  // ---- 戦利品（10夜目：武器は買わずに戦いで手に入れる） ----
  loot: {
    /** 倒した雑兵が武器を落とす確率と、1つの戦いで落ちる数の上限 */
    dropChance: 0.03, maxDrops: 1,
    /** 落とし物が銀になる敵のレベル、名匠になる敵のレベルと確率 */
    silverLv: 18, silverChance: 0.35, masterLv: 30, masterChance: 0.08,
    /** 敵将の銘入りの武器：敵将のレベルで鋼→銀→名匠。銘入りは少し強い */
    namedSteelLv: 18, namedSilverLv: 32,
    named: { might: 1, hit: 5, crit: 0 },
    /** 12夜目：ふつうの隊長を討ったとき、銘入りの武器が手に入る見込み（宿敵・因縁・幹部以上・将軍は必ず） */
    namedChance: 0.12, // 14夜目：0.3→0.12（ユニークが1年に2〜3本になるように）
    /** 依頼の報酬に武器がつく確率（実戦・危険度2以上） */
    questChance: 0.18,
    /** 評判の段階が上がったとき、国から届く武器 */
    giftOnRank: true,
    /** 14夜目：レアに添え名がつく確率、落とし物が「変わった武器」（キルソード・手槍など）になる確率 */
    rareAffixChance: 0.5, specialChance: 0.15,
    /** 14夜目：伝説の武器。はじめに敵の将軍が持っている数、年に一度の「古戦場で見つかる」見込み、
     *  生涯の宿敵との決着のあとに見つかる見込み、戦争を終わらせたときに三国から贈られるか */
    legendHeld: 4, legendFind: 0.015, legendRival: 0.35, legendEnding: true,
  },
  // ---- 生徒 ----
  student: {
    firstYearCount: [6, 8] as [number, number],
    /** 19夜目：始めたときの上級生（2〜3人） */
    seniors: [2, 3] as [number, number],
    startAge: [18, 20] as [number, number],
    olderChance: 0.06,          // 年上の新入生
    olderAge: [23, 26] as [number, number],
    hpStart: [18, 26] as [number, number],
    statStart: [2, 8] as [number, number],
    growthBase: [7, 30] as [number, number], // 9夜目まで（古いセーブの変換の目安）
    /** 10夜目：本人の成長率（風花雪月くらいの基準）。得意な能力50〜65・ふつう30〜45・苦手20〜30、HP40〜65。全能力の合計330〜420 */
    growthHigh: [50, 65] as [number, number], growthMid: [30, 40] as [number, number], growthLow: [20, 30] as [number, number], growthHp: [40, 65] as [number, number],
    growthTotal: [330, 420] as [number, number],
    hpGrowthBonus: 10,
    growthQuality: 4,           // 評判が高いほど成長率の高い子が来る（7夜目：8→4）          // HPの成長率は少し高め
    // 10夜目：成長率を上げたので、上限も上げる（30のままだと3年生の4分の3が頭打ちになった）
    statCapSchool: 40,
    hpCapSchool: 70,
    statCapGrad: 60,
    hpCapGrad: 90,
    expPerLevel: 100,
    levelUpMin: 2,              // 8夜目「2ピン保証」：レベルアップで最低2つの能力が上がる
    maxLevel: 70,               // 7夜目：卒業後の上限 50→70
    traitCount: [1, 3] as [number, number],
    talentChance: 0.55,         // 何かしらの才能を持つ確率
    heroChance: 0.01,
    startSkillPoints: [0, 45] as [number, number], // 夢・出身に沿った技能の初期値
    capacityByRep: [ [0, 6], [30, 7], [60, 8] ] as [number, number][], // 19夜目：1学年6〜8人（全体20人前後）
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
    highDiv: 800, highMin: 0.3,   // ランクが高いほど伸びにくい（技能ポイント÷900だけ減る、最低0.3倍）
    skillPts: 0.66,                // 顔なし・↑↑・倍率1のときの、1日の技能ポイント
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
    spar: { skill: 1.0, support: 4 },          // 全部の技能に（skillPts×これ）
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
  /** 19夜目：1週の過ごし方（授業の札1枚と交流の札1枚）。授業は1週ぶん（前の5日ぶんに近い伸び）。交流の札の数 */
  week: { lessonCards: 4, socialCards: 3, lessonMul: 3.6, nemStudyPts: 30, mindCalm: 8, mindGrudge: -12, restrainGrudge: -18, restrainCalm: 8 },
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
    teacherRankMul: { E: 0.75, D: 0.9, C: 1.0, B: 1.1, A: 1.2, S: 1.3 } as Record<string, number>, // 7夜目：0.6〜1.6 → 0.75〜1.3（学校が育った後半に伸びすぎないように）
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
    /** 11夜目：学年の違う二人が支援Cになったとき、先輩と後輩になる見込み。先輩後輩のタッグは後輩だけ伸び（×tagMul）、先輩は魅力の鍛錬が少したまる */
    senpaiChance: 0.6, senpaiChaTrain: 6,
    /** 11夜目：同じ授業のカードに顔が並んだ、学年の違う子どうしの支援 */
    crossFace: 3,
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
    training: { name: '訓練場', cost: [600, 1500, 3000], skillUp: [0, 0.05, 0.1, 0.15], skills: ['sword', 'lance', 'axe'] as SkillId[] },
    library: { name: '書庫', cost: [600, 1500, 3000], skillUp: [0, 0.05, 0.1, 0.15], skills: ['magic'] as SkillId[] },
    stable: { name: '厩舎', cost: [800, 1800, 3500], skillUp: [0, 0.05, 0.1, 0.15], skills: ['riding', 'flying'] as SkillId[] },
    chapel: { name: '礼拝堂', cost: [600, 1500, 3000], skillUp: [0, 0.05, 0.1, 0.15], skills: ['faith'] as SkillId[] },
    dining: { name: '食堂', cost: [500, 1200, 2500], skillUp: [0, 0, 0, 0], skills: [] as SkillId[] },
    range: { name: '射撃場', cost: [800, 1800, 3500], skillUp: [0, 0.05, 0.1, 0.15], skills: ['gun', 'bow'] as SkillId[] },
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
  exam: { baseRate: 60, perPoints: 5, max: 100, levelReq: [0, 0, 6, 14, 30] as number[], heroLevel: 25, /** 19夜目：中級は2年生（1年目の終わり）から、上級は3年生から。出撃の回数（宿敵戦は2回に数える） */ tier2Grade: 2, tier3Grade: 3, sorties: [0, 0, 3, 8, 15] as number[] }, // 段階ごとの受験レベル（7夜目：初級5・中級15・上級25・最上級（卒業後）45、英雄25）
  // ---- 戦闘 ----
  /** 19夜目：入学の希望者（10人ほど＋評判25ごとに1人）・仇討ちの子が来る見込み */
  admission: { base: 10, perRep: 25, avenger: 0.3 },
  /** 19夜目：全盛期と衰え（年齢）：伸び盛り〜27歳、28〜34歳は伸びが0.6倍、35〜44歳は0.3倍、45歳から伸びなくなり、毎年少しずつ衰える */
  prime: { peakEnd: 27, slowEnd: 34, slowMul: 0.6, stopAt: 44, lateMul: 0.3, declineAt: 45, declineChance: 0.15, declinePerYear: 0.02 },
  /** 19夜目：月末の出撃（教え子の人数）・出撃しない子の罠の傷 */
  sortie: { members: 4, trapDmg: 6, /** ふつうの戦いで討った名前のある将が、深手を負って逃げのびる見込み */ officerEscape: 0.65 },
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
    injuryBase: 68, injuryPerLck: 1, injurySupportB: 5, injurySupportA: 10, injuryMax: 94,
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
  // ---- 札の戦い（16夜目） ----
  /** 18夜目：技の進化。熟練が need[段] に満ちると進化を選べる。1枚出すと perUse、倒すと perKill、覚えてから技能の節目を1つ越えるごとに perRank。1戦でたまるのは perBattleMax まで */
  evo: { need: [8, 22] as number[], perUse: 1, perKill: 1, perRank: 3, perBattleMax: 4 },
  cards: {
    /** 手札の数・行動力（出撃した人数で少し増える：4人まで3、そこから3人ごとに+1、5まで） */
    hand: 5, ap: 3, apPerMembers: 3, apMax: 5,
    /** 18夜目：スキルで増える行動力（1ターン目・仲間が倒れたとき）と、多く引く札の上限（部隊みんなの合計） */
    perkApMax: 1, perkDrawMax: 2,
    /** 18夜目：反撃（間合い取り）・追い打ち（連ね太刀）の威力の倍率 */
    counterMul: 0.6,
    /** 決着までのターン（勝利条件ごと） */
    turns: { rout: 6, boss: 6, defend: 4, escort: 5, seize: 6, rescue: 6, escape: 4 } as Record<string, number>,
    /** 敵の前に出る数（出撃した人数で増える） */
    front: [3, 4, 5] as [number, number, number],
    /** 1人の札の数（いちばん少なくても・多くても） */
    perMin: 3, perMax: 5,
    /** 威力の倍率：味方の札・敵の行動 */
    dmgMul: 1.15, foeMul: 1.0,
    /** 命中のもと（札は当たりやすい：命中の式に足す） */
    hitPlus: 25, foeHitPlus: 10,
    /** 必殺（大当たり）の倍率 */
    critMul: 2.0,
    /** 敵将の体力の倍率（一撃で終わらないように） */
    leaderHp: 1.25,
    /** かばう：受けるダメージの倍率 */
    coverMul: 0.5,
    /** 信頼が低い子は、ときどき自分の判断で動く：信頼がこれより下で、差1あたりの% */
    obeyAt: 55, disobeyPer: 0.45, disobeyMax: 25,
    /** 敵将の大振り（威力の倍率）・怒りの構え（次の攻撃+）・戦技を使う割合 */
    bigMul: 1.5, rage: 4, leaderArt: 0.35, leaderBig: 0.3, leaderRage: 0.15,
    /** 時間切れのとき：残った敵のHPがこの割合以下なら、敵が退いて勝ち */
    timeoutWin: 0.5,
    /** 策の札が手札に来やすい：策を立てる子の軍略で（もとの見込み＋軍略/この数） */
    stratTop: 0.3, stratPerStrat: 200,
    /** 札を出したときの技能の伸び（1枚＝武器を使った回数） */
    usePerCard: 1,
    /** 経験値：札1枚あたり（攻撃が当たった・守った・癒やした）、生き残った子へ */
    expCard: 10, expSurvive: 5,
    /** 生徒が倒れたとき、戦死になりやすさの倍率（札の戦いは見えている分、少し軽く） */
    deathMul: 0.2,
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
    // 8夜目「2ピン保証」：生徒のレベルアップは最低2つの能力が上がるので、敵の1レベルあたりの伸びも数値で同じだけ上げる
    pinMul: 1.22,
    // 9夜目：策・陣形・部隊長で味方が少し強くなった分（在学中の戦死を8夜目に近づける）
    stratMul: 1.06,
    // 10夜目：生徒の成長率を風花雪月くらいに上げた分、敵の1レベルあたりの伸びも上げる（つり合いは敵の側でとる）
    growth10: 1.6, growth10Hp: 1.45, // 12夜目：戦技・心得で味方が強くなった分、1.5→1.6（HPは1.4→1.45）
    // 12夜目：敵の兵の戦技（このレベルから、見込みが少しずつ上がる）
    artLv: 10, artBase: 0.35, artPerLv: 0.02, artMax: 0.8,
  },
  // ---- 依頼 ----
  quests: {
    realCount: [2, 3] as [number, number],
    /** 9夜目：2つ目・3つ目の部隊向けの小さな依頼の報酬の倍率 */
    smallRewardMul: 0.15,
    /** 小さな依頼に名簿の敵将が出てくる割合（ほかは名もない敵将） */
    smallOfficer: 0.4,
    reward: [200, 1500] as [number, number],
    friendshipUp: 3, powerUp: 1, enemyFriendshipDown: 2,
    mercBonus: 0.2,
  },
  // ---- 進路 ----
  career: {
    /** 11夜目：先輩から託されたノートで伸びる技能ポイント */
    senpaiNote: 25,
    acceptBase: 30, acceptPerTrust: 0.6,
    matchGrowth: 0.1, forcedGrowth: -0.1,
    friendshipPerGrad: 5,
    offerBase: 0.25, // 声かけの基本確率
  },
  // ---- 卒業生 ----
  alumni: {
    yearlyExp: { warrior: 140, champion: 150, strategist: 100, civil: 60, stay: 50, home: 25, merc: 120 } as Record<string, number>, // 7夜目：最上級（Lv45）・上限（Lv70）に合わせて少し上げた
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
      champion: [1, 2, 4, 7],
    },
    // 10夜目：出世に効く技能（将＝統率、参謀＝軍略。技能ポイント1あたり）、勇士の位の上がりにくさ、毎年伸びる道の技能
    rankSkill: 0.0012, rankSkillBase: 140, championRankMul: 0.5, pathSkillYear: 14,
    // 統率の低い将の失敗（年に1回の見込み）、勇士の武勲（二つ名・新聞）
    lowCommandAt: 50, lowCommandFail: 0.12, championDeed: 0.18,
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
  // ---- 先生の経験ポイントと特殊能力（8夜目）。7夜目の「教えるほど自動で上がる」を置き換えた（雇った講師・卒業生講師は自動のまま） ----
  mentor: {
    // 1回の授業でもらえる経験ポイント：基本＋顔の子1人ごと＋友情タッグ1組ごと＋ランクアップ・レベルアップした子1人ごと（上限つき）
    xpBase: 4, xpSocial: 3, xpRest: 0, xpFace: 1, xpTag: 2, xpGrow: 2, xpGrowMax: 8,
    // 特殊能力の値段（小・中・大）。覚えるたびに次が少しずつ高くなる（1つごとに+50%）
    // 8夜目の長期シミュレーションで調整：1年目2〜3個、10年で約9個、20年で約13個（引退までに半分〜3分の2）
    cost: { S: 600, M: 1000, L: 1600 } as Record<string, number>, costGrowth: 0.5,
    // 技能：次のランクまでの技能ポイント1につき、経験ポイント3
    skillCostPerPt: 3,
    // 後継の教官が受け継ぐ特殊能力の数（教え子が継ぐと2つ、外から来た教官は1つ）
    inheritAlumni: 2, inheritExternal: 1,
  },
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
  /** 15夜目：道具は毎月のはじめに自動で補充（この数まで。所持金がこれより少ないときは補充しない） */
  restock: { vulnerary: 3, elixir: 1, keep: 1500 },
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
