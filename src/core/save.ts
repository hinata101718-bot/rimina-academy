// セーブデータの変換（バージョン番号つき）。DOMに依存しない
import { SAVE_VERSION, DIFFICULTY } from '../data/balance';
import type { SkillId } from './types';
import type { GameState } from './state';
import { defaultSettings, mailImportant } from './game';
import { ARTS, ART_SLOTS } from '../data/arts';
import { migrateArtPlan } from './arts';
import { restartBattleAsCards } from './flow';
import { isCardMode } from './battle/auto';
import { WEAPONS } from '../data/weapons';
import { ensureSpellPlan, learnSpells } from './spells';
import { ensureTeacherSince, instructorCaps } from './instructor';
import { birthdayFor } from './student';
import { ensureRosters, nemesisToOfficer, linkOrg, markOrgSeen } from './officers';
import { START_STRATS } from './stratagems';
import { careerTitleOnly } from './discovery';
import { titleOf } from './alumni';
import { Rng } from './rng';
import { startSeed } from './ending';
import { round5 } from './growth';
import { startNewsDesk } from './newspaper';
import { STATS } from '../data/balance';
import { STOCK_IDS, stockUid } from './loot';
import { liftGrowth, talentToApt } from './aptitude';
import { learnArts, autoLoadout, isSpellId } from './arts';
import { ensureRegions, borderOf, setOwner } from './regions';
import { RANK_POINTS } from '../data/balance';
import { rebuildReviews } from './review';
import { seeWeapon, ensureLegends } from './rarity';

export interface SaveFile { app: 'rimina-academy'; version: number; savedAt: number; state: GameState }

export function serialize(s: GameState): string {
  const f: SaveFile = { app: 'rimina-academy', version: SAVE_VERSION, savedAt: Date.now(), state: s };
  return JSON.stringify(f);
}

/** 読み込み：古い形式は変換する。壊れていれば例外 */
export function deserialize(text: string): GameState {
  const f = JSON.parse(text) as Partial<SaveFile> & { state?: GameState };
  if (!f || f.app !== 'rimina-academy' || !f.state) throw new Error('このゲームのセーブデータではありません');
  return migrate(f.state, f.version ?? 0);
}

export function migrate(s: GameState, from: number): GameState {
  if (from > SAVE_VERSION) throw new Error('新しい版のセーブデータです。ページを再読み込みしてください');
  const oldSettings = s.settings ?? {};
  s.settings = { ...defaultSettings(), ...oldSettings };
  if (from < 2) migrateTo2(s, oldSettings as Partial<GameState['settings']>);
  if (from < 3) migrateTo3(s);
  if (from < 4) migrateTo4(s);
  if (from < 5) migrateTo5(s);
  if (from < 6) migrateTo6(s);
  if (from < 7) migrateTo7(s);
  if (from < 8) migrateTo8(s);
  if (from < 9) migrateTo9(s);
  if (from < 10) migrateTo10(s);
  ensure10(s);
  if (from < 11) migrateTo11(s);
  if (from < 12) migrateTo12(s);
  if (from < 13) migrateTo13(s);
  if (from < 14) migrateTo14(s);
  if (from < 15) migrateTo15(s);
  if (from < 16) migrateTo16(s);
  s.heirs ??= [];
  s.archive ??= {};
  s.notices ??= [];
  // 16夜目：古い形の戦い（マス目・場面の戦い）の途中なら、札の戦いとしてやり直す
  if (s.battle && !s.battle.auto?.cards && isCardMode()) restartBattleAsCards(s);
  s.version = SAVE_VERSION;
  return s;
}

/**
 * 1夜目の版（version 1）→ 2夜目の版（version 2）
 * - 魔法は技能ランクで覚える形に：武器庫の魔道書・杖は売ったことにしてお金に換える（購入価格の半額）
 * - 生徒全員に「覚える魔法の一覧」を作り、今の技能ランクまでの魔法を覚えさせる
 * - 演出の設定を足す（敵ターンは「ゆっくり」に）
 */
function migrateTo2(s: GameState, old: Partial<GameState['settings']>): void {
  if (old.animSpeed === undefined) s.settings.animSpeed = 2;
  if (old.flip === undefined) s.settings.flip = true;
  s.settings.enemySpeed = 1;
  // 武器庫の魔法を売る
  let total = 0;
  const sold: Record<string, number> = {};
  s.armory = (s.armory ?? []).filter((a) => {
    const w = WEAPONS[a.weaponId];
    if (!w) return false;
    if (!w.spell) return true;
    const v = Math.floor((w.value ?? w.price ?? 0) / 2);
    total += v;
    sold[w.name] = (sold[w.name] ?? 0) + 1;
    return false;
  });
  s.money = Math.round((s.money ?? 0) + total);
  // 生徒の魔法
  for (const st of Object.values(s.students ?? {})) {
    st.spells ??= [];
    ensureSpellPlan(st);
    learnSpells(null, st);
  }
  for (const st of s.applicants ?? []) { st.spells ??= []; ensureSpellPlan(st); learnSpells(null, st); }
  // 出撃中の戦闘：持っている魔道書・杖はそのまま使える（同じ名前の魔法として扱う）
  const soldText = Object.entries(sold).map(([n, c]) => `${n}×${c}`).join('・');
  s.pending ??= [];
  s.pending.push({
    type: 'event', title: '魔法の覚え方が変わりました',
    lines: [
      '魔法（魔道）と回復の杖（信仰）は、買うのではなく、生徒が技能ランクを上げたときに覚えるようになりました。',
      soldText ? `武器庫にあった ${soldText} は売り払い、${total}G になりました。` : '武器庫に魔道書・杖はありませんでした。',
      '生徒たちは、今の技能ランクまでの魔法をすでに覚えています。個人ページで「覚えた魔法」と「次に覚える魔法」を見られます。',
    ],
  });
}

/**
 * 2夜目の版（version 2）→ 3夜目の版（version 3）
 * - 教官：着任の年・技能の上限（教えるほど上がる）・歴代の教官・副教官を足す
 * - 講師：学校に来た年（副教官になれるか）を卒業の年から推定
 * - 生徒：誕生日を付ける（在校生・卒業生・志願者すべて）
 * - 兵種：条件より低いレベルですでに昇格している子は、そのまま（降格しない）
 */
function migrateTo3(s: GameState): void {
  s.instructor.since ??= 1;
  s.instructor.generation ??= 1;
  instructorCaps(s);
  s.pastInstructors ??= [];
  s.vice ??= [];
  s.declinedSuccessors ??= [];
  ensureTeacherSince(s);
  for (const st of [...Object.values(s.students ?? {}), ...(s.applicants ?? [])]) st.birthday ??= birthdayFor(st.id + st.given);
  s.settings.rosterView ??= 'card';
}

/**
 * 4夜目の版（version 3）→ 5夜目の版（version 4）
 * - 戦闘は自動で決着する形が基本に（設定「戦闘を自分で指揮する」は初期オフ）
 * - 因縁の敵将の記録・直近に使った場面の文の記録を足す
 * - 手動の戦闘の途中で保存されたセーブは、そのまま手動の戦闘の続きから遊べる
 */
function migrateTo4(s: GameState): void {
  s.settings.manualBattle ??= false;
  s.nemeses ??= [];
  s.autoMemory ??= { lines: [], events: [] };
  s.pending ??= [];
  s.pending.push({
    type: 'event', title: '戦闘が自動で決着するようになりました',
    lines: [
      '月末の戦闘は、出撃メンバー・作戦の方針・役割を決めると、自動で決着するようになりました。戦いの様子は場面ごとにタップで見られ、ここぞという時には先生が指示を選べます。',
      '育てた能力・兵種・技能・支援・やる気・疲れが、そのまま結果に表れます。',
      '今までどおり自分で指揮したいときは、「設定」の「戦闘を自分で指揮する」をオンにするか、出撃前に「この戦いは自分で指揮する」を選んでください。',
      ...(s.battle ? ['いま途中の戦闘は、これまでどおり自分で指揮して続けられます。'] : []),
    ],
  });
}

/**
 * 5夜目の版（version 4）→ 6夜目の版（version 5）
 * - 因縁の敵将（Nemesis）を、敵将の名簿（EnemyOfficer）に変換する。陣営に合う顔画像を割り当てる
 * - 三国の軍と盗賊団の名簿を作る（足りない分を新しく）
 * - 生徒と敵将の因縁（宿敵）の記録を足す
 * - 戦闘の途中のセーブ：自動の戦闘の敵将は、因縁の敵将なら名簿の敵将につなぐ
 */
function migrateTo5(s: GameState): void {
  const r = new Rng({ rng: (s.rng ^ 0x6e696768) | 0 });
  s.officers ??= [];
  s.rivalries ??= {};
  for (const n of s.nemeses ?? []) if (!s.officers.some((o) => o.id === n.id)) s.officers.push(nemesisToOfficer(s, n, r));
  delete s.nemeses;
  ensureRosters(s, r);
  // 卒業生の昇進の演出：今の肩書き・兵種を「見たもの」として記録する（読み込みのたびに全員分の演出が出ないように）
  for (const st of Object.values(s.students ?? {})) if (st.status === 'graduated' && st.career) { st.seenTitle ??= careerTitleOnly(titleOf(st)); st.seenClass ??= st.classId; }
  const L = s.battle?.auto?.leader;
  if (L && L.nemesisId && !L.officerId && s.officers.some((o) => o.id === L.nemesisId)) {
    const o = s.officers.find((x) => x.id === L.nemesisId)!;
    L.officerId = o.id; L.faceImage = o.faceImage; L.scars = o.scars;
  }
  if (s.officers.length) {
    s.pending ??= [];
    s.pending.push({
      type: 'event', title: '敵将の名簿ができました',
      lines: [
        '三国の軍と盗賊団には、それぞれ幹部の名簿ができました。「戦況」の「敵将の名簿」で見られます。会うほど、敵将のことが分かっていきます。',
        '敵将は、こちらとの出来事を覚えています。生徒を倒した敵将は昇進して二つ名がつき、逃げた敵将は傷を負って戻ってきます。',
        '何度も戦った生徒と敵将は「宿敵」になり、決着をつける場面が来ることがあります。',
        ...((s.officers.filter((o) => o.meets.length).length) ? ['これまでの「因縁の敵将」も、名簿に載っています。'] : []),
      ],
    });
  }
}

/**
 * 6夜目の版（version 5）→ 7夜目の版（version 6）
 * - 授業は「日ごとの授業カード」に：週の途中のセーブは、その週の月曜日から。個人指導・週末の予定はなくなる
 * - 重点科目と週末の予定は、最初の日のカードに出す（重点科目の授業・お茶会など）。目標技能はその月の目標に
 * - 鍛錬ゲージ・体調不良の日数を足す。設定の「細かな調整」に「技能の伸び方」を足す
 * - 兵種試験のレベル条件が上がる（Lv5/15/25/45）。条件より低いレベルで昇格している子は、そのまま（降格しない）
 * - 戦闘の途中のセーブ：手動の戦闘はそのまま。自動の戦闘は、戦いの記録のない場面は今までの文で見せる
 */
function migrateTo6(s: GameState): void {
  s.day = 1;
  s.today = null;
  const skills: SkillId[] = [];
  for (const g of [1, 2, 3]) for (const k of s.focus?.[g] ?? []) if (!skills.includes(k)) skills.push(k);
  const social: string[] = [];
  for (const w of s.plan?.weekend ?? []) { const k = w.kind === 'spar' ? 'spar' : w.kind === 'tea' ? 'tea' : w.kind === 'dinner' ? 'dinner' : ''; if (k && !social.includes(k)) social.push(k); }
  if ((s.plan?.tutoring ?? []).some((t) => t.kind !== 'skill') && !social.includes('interview')) social.push('interview');
  s.carry = { skills: skills.slice(0, 2), social };
  s.plan = { tutoring: [], weekend: [] };
  s.settings.mods = { ...DIFFICULTY[s.settings.difficulty ?? 'normal'], ...s.settings.mods };
  s.settings.mods.skill ??= DIFFICULTY[s.settings.difficulty ?? 'normal'].skill;
  for (const st of Object.values(s.students ?? {})) { st.train ??= {}; st.trainGain ??= {}; st.sickDays ??= 0; }
  for (const st of s.applicants ?? []) { st.train ??= {}; st.trainGain ??= {}; st.sickDays ??= 0; }
  // 平和な時代のセーブ：最後のエンディングから「次の戦争の火種」を置く（毎年2%の再発の代わり）
  s.endings = (s.endings ?? []).map((e) => ({ ...e, n: e.n ?? 1 }));
  if (s.world.era === 'peace' && !s.world.seed) { const last = s.endings[s.endings.length - 1]; if (last) startSeed(s, last.kind, last.country ?? null); }
  s.pending ??= [];
  s.pending.push({
    type: 'event', title: '授業が「日ごとの授業カード」になりました',
    lines: [
      '授業は、全学年いっしょに1日1回になりました。月〜金の毎日、5種類の授業と休講から1つを選びます。全員が伸び、カードに顔が出ている子は特に伸びます。',
      '個人指導と週末の交流はなくなり、お茶会・食事会・紅白戦・面談・進路指導も授業のカードとして出ます。体力が減ってきたら「休講」で休ませましょう。',
      '目標技能は月に一度決めます（今の目標技能が今月の目標です）。今月の重点科目と週末の予定は、最初の日のカードに出ています。',
      '兵種試験のレベル条件が上がりました（初級Lv5・中級Lv15・上級Lv25・最上級Lv45）。すでに昇格している子はそのままです。',
      ...(s.battle ? ['いま途中の戦闘は、そのまま続けられます。'] : []),
    ],
  });
}

/**
 * 7夜目の途中の版（version 6）→ version 7：体力は先生だけ（生徒の体力・疲労・体調不良をなくす）
 * - 生徒の疲労・体調不良（日・週）を消す。先生の体力を満タンで始める
 * - 6夜目版からの変換（migrateTo6 のあと）もここを通る
 */
function migrateTo7(s: GameState): void {
  for (const st of [...Object.values(s.students ?? {}), ...(s.applicants ?? [])]) { st.fatigue = 0; st.sickDays = 0; st.sickWeeks = 0; }
  s.instructor.stamina ??= 100;
  s.instructor.sickDays ??= 0;
  s.today = null;
  s.pending ??= [];
  s.pending.push({ type: 'event', title: '体力は先生だけになりました', lines: ['生徒の体力（疲労）と体調不良はなくなりました。', '授業は先生の体力を使います。武器の授業は多め、頭と心の授業は少なめ、交流は少し。休講で大きく回復します。', '先生の体力が低いと授業の効果が少し落ち、0になると数日寝込んで自動で休講になります。体力のゲージは授業カードの画面に出ています。'] });
}

/**
 * 7夜目の版（version 7）→ 8夜目の版（version 8）：見た目と先生
 * - 先生の経験ポイントと特殊能力：今の技能はそのまま、ポイントは0から、特殊能力はまだなし
 * - 生徒本人の成長率を5%きざみに（近い5の倍数へ四捨五入。5〜95%）
 * - 兵種図鑑：今いる生徒・卒業生の兵種を「なったことがある」に
 * - 新聞は半年に一回（9月の終わりの前期号・3月の後期号）。次の号に載せる出来事のメモを始める
 */
function migrateTo8(s: GameState): void {
  const ins = s.instructor;
  ins.xp ??= 0; ins.xpTotal ??= 0; ins.abilities ??= []; ins.inherited ??= [];
  for (const st of [...Object.values(s.students ?? {}), ...(s.applicants ?? [])]) {
    for (const k of STATS) st.growth[k] = Math.max(5, Math.min(95, round5(st.growth[k] ?? 0)));
    if (st.growthKnown) st.growthSeen = true;
  }
  s.classSeen = [...new Set(Object.values(s.students ?? {}).map((st) => st.classId))];
  if (!s.newsDesk) startNewsDesk(s);
  s.pending ??= [];
  s.pending.push({
    type: 'event', title: '8夜目の新しいこと',
    lines: [
      '画面が「教官の机」になりました。机の上の地図・手帳・書状・新聞・写真が、それぞれの画面の入口です。',
      '先生も授業で経験ポイントを得るようになりました。教官手帳の「教官」から、先生の技能と特殊能力（20種）を上げられます。今の技能はそのままで、ポイントは0からです。',
      '個人ページに成長率の内わけ（本人＋兵種＋才能・特徴＝合計）が出ます。生徒本人の成長率は5%きざみになりました（近い数に丸めています）。名簿の「図鑑」から兵種図鑑が見られます。',
      '新聞は半年に一回（9月の終わりの前期号・3月の後期号）になりました。大事件の月は号外が出ます。',
    ],
  });
}

/**
 * 8夜目の版（version 8）→ 9夜目の版（version 9）：戦い
 * - 策（作戦カード）：はじめの4種から。生徒の軍略は0から（戦術論・兵法の歴史の授業でたまる）
 * - 敵将の組織図：隊長→幹部→将軍の線をつなぐ。今の組織図を「前に見たとき」として覚える（変化の印は次から）
 * - 戦闘の演出は「派手」から（設定で変えられる）
 * - 途中の戦いは、そのまま最後まで遊べる（1部隊として終わる）
 */
function migrateTo9(s: GameState): void {
  s.strats ??= [...START_STRATS];
  s.sortie ??= null;
  s.settings.battleFx ??= 'big';
  linkOrg(s);
  markOrgSeen(s);
  s.pending ??= [];
  s.pending.push({
    type: 'event', title: '9夜目の新しいこと',
    lines: [
      '在籍が20人を超えると、月末に2部隊（30人で3部隊）を別々の依頼へ出せます。教官はすべての部隊に同行し、順番に1つずつ戦います。',
      '出撃前に「策（作戦カード）」を選べます。はじめは4種。戦術論・兵法の歴史の授業や、魅力の高い子・軍師の才のある子がいると、新しい策を覚えます。部隊長と、策を立てる子も選べます。',
      '戦いのあとの評価が、一人ずつの称号・名場面・ひとことになりました。',
      '戦況の「敵将の名簿」が、家系図のような組織図になりました。前に見たときからの変化に印がつきます。戦いで目立った敵の一般兵が、名前を得て「見込みのある兵」になることもあります。',
      '戦いの記録の演出が派手になりました（設定の「戦闘」で、派手／ふつう／控えめを選べます）。',
    ],
  });
}

/**
 * 9夜目の版（version 9）→ 10夜目の版（version 10）
 * - 月末の出撃の途中：9夜目は教官がすべての部隊に同行していたので、残りの部隊も「同行する」のまま
 */
function migrateTo10(s: GameState): void {
  if (s.sortie) for (const sq of s.sortie.squads) sq.away ??= false;
  // 武器は戦利品で：鉄の武器は学校の備え（数の制限なし）になったので、武器庫の鉄の武器（遺品でないもの）は備えに戻す
  const gone = new Map<string, string>();
  s.armory = (s.armory ?? []).filter((a) => { if (STOCK_IDS.has(a.weaponId) && !a.engraved && !a.named) { gone.set(a.uid, a.weaponId); return false; } return true; });
  const remap = (d: { armoryUid: string | null }) => { if (d.armoryUid && gone.has(d.armoryUid)) d.armoryUid = stockUid(gone.get(d.armoryUid)!); };
  for (const sq of s.sortie?.squads ?? []) sq.deploy.forEach(remap);
  s.pending ??= [];
  s.pending.push({
    type: 'event', title: '10夜目の新しいこと',
    lines: [
      '戦いの画面が、ターン制のRPGのような1枚の画面になりました。下の文の窓をタップすると、1文ずつ進みます。',
      '月末に2部隊・3部隊を出すとき、先生は第一部隊にだけ同行します。ほかの部隊は部隊長にまかせて、結果だけを見ます（部隊の札で「同行する」にもできます）。',
      '武器は買わずに、戦いで手に入れるようになりました。鉄の武器は学校にいつでもそろっています。敵将を討ち取ると、その敵将の名を冠した武器が手に入ります。',
      '生徒の成長率が上がり、レベルアップで3〜4つの能力が伸びるようになりました。今いる子の成長率も引き上げています。',
      '生徒ごとに「得意な技能」「苦手な技能」ができました。隠れた才能はなくなり、得意な技能に変わっています。苦手な技能に「眠った芽」を持つ子もいます。芽が見えたら目標技能にして育てると、花が開くかもしれません。',
      '「軍略」と「統率」が技能ランクになりました。新しい授業「指揮の演習」「行軍」で統率が伸びます。卒業後の道に「勇士」が加わりました。',
    ],
  });
}

/** 10夜目の形をそろえる（作業の途中で公開した版のセーブにも効くよう、何度呼んでも同じになる） */
function ensure10(s: GameState): void {
  const r = new Rng({ rng: (s.createdAt ?? 1) ^ 0x10a7 });
  // 軍略・統率を技能ランクに：9夜目の軍略の数値（0〜100）と魅力から、E〜D+くらいに
  const fill = (sk: Record<string, number> | undefined) => { if (!sk) return; sk.tactics ??= 0; sk.command ??= 0; };
  const all = [...Object.values(s.students ?? {}), ...(s.applicants ?? [])];
  for (const st of all) {
    if (st.skills && st.skills.tactics === undefined) {
      const cha = st.stats?.cha ?? 5;
      st.skills.tactics = Math.min(RANK_POINTS['D+'], Math.round((st.strat ?? 0) * 0.9));
      st.skills.command = Math.min(RANK_POINTS['D+'], Math.round(Math.max(0, cha - 4) * 3 + (st.strat ?? 0) * 0.3));
    }
    fill(st.skills);
    // 得意・苦手・眠った芽（隠れた才能→得意）と、成長率の引き上げ
    if (!st.apt) {
      liftGrowth(st);
      talentToApt(st, r, st.status === 'enrolled' || s.applicants?.includes(st));
    }
    if (!st.growthKnown) st.growthKnown = true;
    // 同じ会話を二度出さない：これまでの会話の記録から、見た面談の題を拾う
    if (!st.seenTalks) { const l = [...new Set((st.archive ?? []).map((id) => s.archive?.[id]).filter((t) => t && t.b === 'teacher').map((t) => t!.title))]; if (l.length) st.seenTalks = l; }
  }
  // 先生の技能の上限：軍略・統率がまだない古いセーブだけ、Bまで（読みこむたびに書きかえない）
  if (s.instructor?.caps && s.instructor.caps.tactics === undefined) { s.instructor.caps.tactics = RANK_POINTS.B; s.instructor.caps.command = RANK_POINTS.B; }
  fill(s.instructor?.skills); fill(s.instructor?.caps);
  // 敵将の型（勇士型・将型）：今いる敵将にも1つ（名前から決める）
  for (const o of s.officers ?? []) {
    if (o.kind === 'monster' || o.traits.includes('valor') || o.traits.includes('marshal')) continue;
    let h = 7; for (const c of o.id + o.given) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const st = h % 10 < (o.rank === 0 ? 4 : o.rank === 1 ? 5 : 6) ? 'valor' : 'marshal';
    o.traits.push(st); o.knownTraits.push(st);
  }
  if (s.instructor?.skills && !s.instructor.skills.tactics && !s.instructor.skills.command) { s.instructor.skills.tactics = RANK_POINTS.D; s.instructor.skills.command = RANK_POINTS.D; }
}

/**
 * 10夜目の版（version 10）→ 11夜目の版（version 11）
 * - 戦の描写の設定（はじめは「濃い」）。先輩と後輩・戦いのあとの場面・書き直した文は、そのまま使える
 */
function migrateTo11(s: GameState): void {
  s.settings.battleProse ??= 'dense';
  s.pending ??= [];
  s.pending.push({
    type: 'event', title: '11夜目の新しいこと',
    lines: [
      '画面の文と、生徒たちの台詞を読みやすく書き直しました。',
      '学年の違う二人が親しくなると「先輩と後輩」になることがあります。いっしょの授業では後輩がよく伸び、卒業する先輩は後輩に何かを託していきます。',
      '戦いの文が、武器や当たり方ごとに書き分けられるようになりました。設定の「戦の描写」で、ふつう・濃い・凄惨を選べます（はじめは濃い）。',
    ],
  });
}

/**
 * 11夜目の版（version 11）→ 12夜目の版（version 12）
 * - 戦技と心得：今いる生徒・卒業生は、今の技能ランクまでの技を覚えた状態にする（演出なし）。付けかえはおまかせ
 */
function migrateTo12(s: GameState): void {
  for (const st of [...Object.values(s.students ?? {}), ...(s.applicants ?? [])]) learnArts(null, st, false);
  s.pending ??= [];
  s.pending.push({
    type: 'event', title: '12夜目の新しいこと',
    lines: [
      '技能ランクが上がると「戦技」と「心得」を覚えるようになりました。戦技は戦いの中で自動で使う技、心得はいつも効く力です。',
      '今いる子は、今の技能ランクまでの技をもう覚えています。個人ページの「技能」タブで、覚えた技とまだの技を見られます。',
      '敵将も戦技を使います。出撃前の敵の情報や組織図に「〇〇の使い手」と出ます。',
    ],
  });
}

/**
 * 12夜目の版（version 12）→ 13夜目の版（version 13）
 * - 勢力図：地域の持ち主は、はじめの形から（国力が大きく偏っているときは、強い国が国境の地域を1つずつ持つ）
 */
function migrateTo13(s: GameState): void {
  ensureRegions(s);
  const pw = s.world.power;
  const cs = (['kingdom', 'empire', 'alliance'] as const).slice().sort((a, b) => pw[b] - pw[a]);
  if (pw[cs[0]] - pw[cs[2]] >= 20) { const bd = borderOf(s, cs[2], cs[0]).filter((id) => !id.startsWith('winter') && !id.startsWith('solaria') && !id.startsWith('fiore')); if (bd.length) setOwner(s, bd[0], cs[0], '（これまでの戦いで）'); }
  s.pending ??= [];
  s.pending.push({ type: 'event', title: '13夜目の新しいこと', lines: [
    '戦況の画面に「大陸の勢力図」ができました。地域ごとに、どの国が治めているかが色で分かります。地域をタップすると、そこにいる教え子と名産が見られます。',
    '戦争が続くと、国境の地域が奪われたり、取りもどされたりします。依頼の戦いの勝ち負けでも、地域の色が変わることがあります。',
    '組織図と勢力図の「この前から変わったこと」を、1つずつ場面で見られるようになりました。',
  ] });
}

/**
 * 13夜目の版（version 13）→ 14夜目の版（version 14）
 * - 最初の1時間の案内は、新しく始めたときだけ（今のセーブには出さない。設定の「案内を見なおす」で出せる）
 */
function migrateTo14(s: GameState): void {
  rebuildReviews(s);
  // 武器のレアリティ：今の武器はそのまま（鉄＝ノーマル、鋼・銀・名匠など＝レア、銘入り＝ユニーク）。図鑑に載せ、伝説の武器の行方を決める
  for (const a of s.armory ?? []) seeWeapon(s, a);
  ensureLegends(s);
  s.pending ??= [];
  s.pending.push({ type: 'event', title: '14夜目の新しいこと', lines: NIGHT14_LINES });
}
const NIGHT14_LINES = [
  'ホームの作戦地図をなくしました。勢力図や敵の組織が動いたときは、教官手帳に赤い字で出ます。個人ページの「戦技と心得」は、つけている技が効果のひとことつきで並ぶようになりました。',
  '先輩と後輩の会話が増え、卒業した先輩から手紙が届くようになりました。卒業生の講師は、自分の覚えた技を授業で手ほどきします。設定の「引き継ぎの文字」で、セーブを別の端末へ移せます。',
  '武器に4つのレアリティ（ノーマル・レア・ユニーク・レジェンド）がつきました。今ある武器もそのまま使えます（鉄の武器はノーマル、鋼・銀などはレア、銘入りはユニーク）。レアやユニークには「鋭い」「確かな」などの添え名がつくことがあります。',
  '大陸には12振りの伝説の武器があり、そのいくつかは敵の将軍が持っています。年鑑の「記録」の「伝説の武器の行方」で確かめられます。',
  '年度末（卒業式のあと）に「1年の振り返り」が出るようになりました。年鑑の「振り返り」で、これまでの年も読み返せます（前の年の分は、年表から作れるところまで作りました）。',
  'はじめて遊ぶ人のために、最初のひと月を管理人が案内するようになりました（新しく始めたときだけ）。設定の「案内を見なおす」で、はじめて出たものの説明をもう一度見られます。',
];

/**
 * 14夜目の版（version 14）→ 15夜目の版（version 15）：片づけ
 * - たまっていた書状の未読は、大事な知らせ（急報・敵将のうわさ・昇格など）を残して、読んだことにする
 * - 今月の主役にまだ声をかけていなければ、声をかけたことにする（「声をかける」はおまかせになった。読みこんだ月の分の伸びはなし）
 */
function migrateTo15(s: GameState): void {
  for (const m of s.mail ?? []) if (!m.read && !mailImportant(m)) m.read = true;
  for (const sp of s.spotlight ?? []) if (!sp.done) { sp.done = true; sp.res = '先生が声をかけた。'; }
  // 7夜目になくなった「体調不良」の残り
  for (const st of Object.values(s.students ?? {})) st.sickWeeks = 0;
  // 戦技と魔法は合わせて5つ：手で選んでいた子は、今の戦技に、よく使う魔法（おまかせで選ぶもの）を足して5つ。おまかせの子は選び直す
  for (const st of Object.values(s.students ?? {})) {
    const auto = autoLoadout(st);
    if (!st.artsManual) { st.artsOn = auto; continue; }
    const mine = (st.artsOn ?? []).filter((id) => ARTS[id]);
    const arts = mine.filter((id) => ARTS[id].kind === 'art').slice(0, ART_SLOTS.art);
    const spells = auto.filter((id) => isSpellId(id)).slice(0, Math.max(0, ART_SLOTS.art - arts.length));
    st.artsOn = [...spells, ...arts, ...mine.filter((id) => ARTS[id].kind === 'mind').slice(0, ART_SLOTS.mind)];
  }
  s.pending ??= [];
  s.pending.push({ type: 'event', title: '15夜目の片づけ', lines: NIGHT15_LINES });
}
const NIGHT15_LINES = [
  '書状の赤い数字は、急報や敵将のうわさ、卒業生の昇格など、大事な知らせだけになりました。たまっていた書状は読んだことにしました。誕生日の便りは「今月の誕生日 3人」のように1通にまとまります。郵便受けに「すべて読んだ」を足しました。',
  '教官手帳のやること一覧は、机の手帳と開いた頁で同じものになりました。今月の主役には、月のはじめに先生が自動で声をかけます。',
  '月末の出撃は、画面の上の「おすすめで出撃する」を押せば、そのまま出られます。部隊長・方針・策・陣形は、変えたいときだけ開きます。',
  '傷薬と特効薬は、毎月のはじめに自動で補充します（お金から少し引きます）。武器庫の「買う」はなくしました。武器庫の棚はたためるようになりました。',
  '図鑑（兵種・技・武器・敵将）は、年鑑の「図鑑」にまとめました。年鑑の「新聞」はなくしました（ホームの新聞から、これまでの号も読めます）。戦況の三国の図と国どうしの関係は、1つの欄になりました。',
  '兵種試験は、個人ページの「兵種試験を受ける」から兵種を選ぶだけで変わります。',
  '「戦技と心得」を分け直しました。戦いの中で使う「戦技と魔法」は、合わせて5つまでつけられます（おまかせのときは、回復の魔法を必ず入れます）。いつも効く力は「心得」から「スキル」という呼び名になり、兵種のスキルも同じ欄に並びます。',
  '戦いで倒れたときの文は、とどめを刺した武器や魔法の属性（炎・風・雷・氷・闇・光）に合うものになりました。',
];

/**
 * 15夜目の版（version 15）→ 16夜目の版（version 16）
 * - 生徒ごとの「覚える表」を、性格・夢・国・家柄から作る。もう覚えた技は（表と違っていても）そのまま残し、その節目の技として表に入れる
 */
function migrateTo16(s: GameState): void {
  for (const st of [...Object.values(s.students ?? {}), ...(s.applicants ?? [])]) migrateArtPlan(st);
  s.pending ??= [];
  s.pending.push({ type: 'event', title: '16夜目の新しいこと', lines: NIGHT16_LINES });
}
export const NIGHT16_LINES = [
  '生徒ごとに、覚える戦技・魔法・スキルが違うようになりました。同じ剣でも、ある子は「燕返し」、別の子は「居合い」を覚えます。性格・夢・生まれた国の流派・家柄で決まり、もう覚えた技はそのままです。',
  '「HPが半分以下のとき」「仲間が倒れたとき」など、条件で効くスキルが増えました。覚えた技は、技能のランクが上がると「燕返し＋」のように強くなります。',
  '戦いが「札の戦い」になりました。授業で覚えた戦技・魔法・スキルと先生の策が札になり、毎ターン手札から行動力の分だけ出します。敵の札の下に「次の行動」が出ているので、それを読んで、かばう・守る・先に倒すを選んでください。「おまかせで札を出す」もあります。',
  '戦いの途中で保存していた場合は、同じ依頼・同じ顔ぶれで、札の戦いとしてはじめからやり直します。手で動かすマス目の戦闘と、その設定はなくしました。小さな依頼と、教官が同行しない部隊は、結果だけ届きます。',
];
