// セーブデータの変換（バージョン番号つき）。DOMに依存しない
import { SAVE_VERSION, DIFFICULTY } from '../data/balance';
import type { SkillId } from './types';
import type { GameState } from './state';
import { defaultSettings } from './game';
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
  s.heirs ??= [];
  s.archive ??= {};
  s.notices ??= [];
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
}

/** 10夜目の形をそろえる（作業の途中で公開した版のセーブにも効くよう、何度呼んでも同じになる） */
function ensure10(s: GameState): void {
  void s;
}
