// 宿敵の仕組み（6夜目）：敵将の名簿と勢力図・敵将の記憶・生徒側の因縁・弱点・卒業生の宿敵。DOMに依存しない
import { OFFICER, ROSTER_FACTIONS, FACTION_NAMES, RANK_NAMES, ENEMY_FACES, ageBand, QUEST_RANK, OFFICER_CLASSES, OFFICER_TRAITS, TRAIT_IDS, EPITHET_VICTIM, EPITHET_WEAPON, EPITHET_PERSONALITY, EPITHET_MANY, HEAD_EFFECT, RIVAL_STAGE_NAMES, ALUMNI_PERSONALITY, SCOUT_CLASSES, type FactionId, type AgeBand } from '../data/officers';
import { MEMORY_TEXT, OFFICER_NEWS, LETTER_TEXT, TRAIT_REVEAL, EXPLOIT_TEXT } from '../data/officers_text';
import { LEADER_NAMES, BANDIT_EPITHETS, type LeaderPersonality } from '../data/autobattle';
import { NAMES } from '../data/names';
import { COUNTRY_SHORT, RANK_TITLES } from '../data/people';
import { CLASSES } from '../data/classes';
import { WEAPONS } from '../data/weapons';
import { B } from '../data/balance';
import type { GameState, EnemyOfficer, Rivalry, Nemesis, Quest, Student, BattleFinding, OfficerMeet, OrgMark } from './state';
import type { CountryId, Gender } from './types';
import { Rng } from './rng';
import { generateFace } from './student';
import { chronicle, mail } from './game';
import { supportValue, getSupport } from './support';
import { MONTH_NAMES } from './util';

// ---------- 小さな道具 ----------
function hash(s: string): number { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
function fill(t: string, v: Record<string, string>): string { return t.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m); }

export function officers(s: GameState): EnemyOfficer[] { return (s.officers ??= []); }
export function officerById(s: GameState, id: string | undefined | null): EnemyOfficer | null { return id ? officers(s).find((o) => o.id === id) ?? null : null; }
export function activeOf(s: GameState, f: FactionId): EnemyOfficer[] { return officers(s).filter((o) => o.faction === f && o.status === 'active' && !o.prospect); }
/** 見込みのある兵（9夜目）：戦いで目立った一般兵。隊長の席が空くと抜擢される */
export function prospectsOf(s: GameState, f: FactionId): EnemyOfficer[] { return officers(s).filter((o) => o.faction === f && o.status === 'active' && o.prospect); }

/** 表示する名前（二つ名つき）。軍は「ヴォルグ・ハイン」→二つ名がつくと「ハンナ殺しのヴォルグ」 */
export function officerName(o: Pick<EnemyOfficer, 'given' | 'family' | 'epithet' | 'kind' | 'title'>): string {
  if (o.title) return o.title;
  if (o.epithet) return `${o.epithet}${o.given}`;
  return o.kind === 'army' && o.family ? `${o.given}・${o.family}` : o.given;
}
export function fullName(o: EnemyOfficer): string { return o.kind === 'army' && o.family ? `${o.given}・${o.family}` : o.given; }
export function rankName(o: Pick<EnemyOfficer, 'kind' | 'rank' | 'title'>): string {
  if (o.kind === 'monster') return '魔物の主';
  if (o.rank >= 3) return '見込みのある兵';
  return RANK_NAMES[o.kind === 'army' ? 'army' : 'bandit'][Math.max(0, Math.min(2, o.rank))];
}
export function factionName(f: FactionId): string { return FACTION_NAMES[f]; }

/** 女性の敵将・年配の敵将の一人称（口上の言い回しを合わせる） */
export function voice(text: string, o: Pick<EnemyOfficer, 'gender' | 'age' | 'personality'> | null | undefined): string {
  if (!o) return text;
  if (o.gender === 'f') return text.replace(/俺/g, o.personality === 'young' || o.personality === 'cunning' ? 'あたし' : '私');
  if (ageBand(o.age) === 'old') return text.replace(/俺/g, 'わし');
  return text;
}

// ---------- 顔 ----------
/** 顔画像を選ぶ：陣営・性別・年代が合うもの。今いる敵将どうしで同じ顔にならないように */
export function pickFace(s: GameState, faction: FactionId, gender: Gender, band: AgeBand, r: Rng, salt = ''): string | null {
  if (faction === 'monster') return null;
  const used = new Set(officers(s).filter((o) => o.status === 'active' && o.faceImage).map((o) => o.faceImage!));
  const mine = ENEMY_FACES.filter((f) => f.startsWith(`${faction}_`));
  const tiers = [
    mine.filter((f) => f.startsWith(`${faction}_${gender}_${band}_`) && !used.has(f)),
    mine.filter((f) => f.startsWith(`${faction}_${gender}_`) && !used.has(f)),
    mine.filter((f) => !used.has(f)),
    mine.filter((f) => f.startsWith(`${faction}_${gender}_`)),
  ];
  const list = tiers.find((t) => t.length) ?? [];
  if (!list.length) return null;
  return list[(hash(salt) + r.int(0, list.length - 1)) % list.length];
}
/** 顔画像のファイル名から性別・年代を読む */
export function parseEnemyFace(f: string): { gender: Gender; band: AgeBand } | null {
  const m = f.match(/^[a-z]+_([mf])_(young|middle|old)_/);
  return m ? { gender: m[1] as Gender, band: m[2] as AgeBand } : null;
}

// ---------- 敵将を作る ----------
const ARMY_PERS: LeaderPersonality[] = ['arrogant', 'veteran', 'cunning', 'proud', 'young', 'cold'];
const BANDIT_PERS: LeaderPersonality[] = ['arrogant', 'cunning', 'young', 'veteran', 'cold'];
function persForAge(r: Rng, kind: 'army' | 'bandit', band: AgeBand): LeaderPersonality {
  const list = (kind === 'army' ? ARMY_PERS : BANDIT_PERS).filter((p) => !(p === 'young' && band === 'old') && !(p === 'veteran' && band === 'young'));
  return r.pick(list);
}

/** 使われている名前（生徒・卒業生・志願者・敵将。10夜目：一般兵の名前もこれと重ならないように） */
/** 23夜目：同じ時期に使われている下の名前（在籍中・希望者・先生と講師・生きている敵将と宿敵・便りのある卒業生） */
export function takenNames(s: GameState): Set<string> {
  const t = new Set<string>();
  for (const x of Object.values(s.students ?? {})) {
    if (x.status === 'enrolled') t.add(x.given);
    else if (x.status === 'graduated' && x.career && x.career.alive !== false && !x.career.retired) t.add(x.given);
  }
  for (const st of s.applicants ?? []) t.add(st.given);
  for (const o of officers(s)) if (o.status === 'active') t.add(o.given);
  if (s.instructor?.name) t.add(s.instructor.name.split('・')[0]);
  for (const te of s.teachers ?? []) t.add(te.name.split('・')[0]);
  return t;
}

/** 23夜目：かぶらない下の名前を選ぶ。その出身の表で尽きたら、ほかの国の表からも */
export function pickGiven(s: GameState, r: Rng, origin: keyof typeof NAMES, gender: Gender, avoid?: Set<string>): string {
  const taken = takenNames(s);
  if (avoid) for (const n of avoid) taken.add(n);
  const key = gender === 'f' ? 'female' : 'male';
  const order: (keyof typeof NAMES)[] = [origin, ...(Object.keys(NAMES) as (keyof typeof NAMES)[]).filter((o) => o !== origin)];
  for (const o of order) {
    const free = NAMES[o][key].filter((n) => !taken.has(n));
    if (free.length) { const g = r.pick(free); avoid?.add(g); return g; }
  }
  // どの表も尽きたとき（ふつうは起きない）：数字を添える
  const base = r.pick(NAMES[origin][key]);
  let k = 2; while (taken.has(`${base}${k}`)) k++;
  return `${base}${k}`;
}

export function newOfficer(s: GameState, r: Rng, faction: FactionId, rank: number): EnemyOfficer {
  const kind: 'army' | 'bandit' = faction === 'bandit' ? 'bandit' : 'army';
  const band: AgeBand = rank === 0 ? r.pick(['middle', 'old', 'old'] as const) : rank === 1 ? r.pick(['young', 'middle', 'middle', 'old'] as const) : r.pick(['young', 'young', 'middle'] as const);
  let gender: Gender = r.chance(0.3) ? 'f' : 'm';
  const id = `of${s.nextId++}`;
  const faceImage = pickFace(s, faction, gender, band, r, id);
  const pf = faceImage ? parseEnemyFace(faceImage) : null;
  if (pf) gender = pf.gender;
  const realBand = pf?.band ?? band;
  const age = r.int(...OFFICER.ageRange[realBand]);
  const origin = faction === 'bandit' ? 'frontier' : faction;
  const nl = NAMES[origin as keyof typeof NAMES];
  const given = pickGiven(s, r, origin as keyof typeof NAMES, gender);
  const pers = persForAge(r, kind, realBand);
  // 盗賊の二つ名は、今いる盗賊どうしで重ならないように
  const usedEp = new Set(activeOf(s, 'bandit').map((o) => o.epithet));
  let ep = kind === 'bandit' ? r.pick(BANDIT_EPITHETS) : undefined;
  for (let k = 0; k < 12 && ep && usedEp.has(ep); k++) ep = r.pick(BANDIT_EPITHETS);
  const traits = r.shuffle([...TRAIT_IDS]).slice(0, OFFICER.traitCount);
  // 10夜目：敵将の型（勇士型・将型）。はじめから知られている
  const style = r.chance(rank === 0 ? 0.35 : rank === 1 ? 0.5 : 0.6) ? 'valor' : 'marshal';
  traits.push(style);
  return {
    id, given, family: kind === 'army' ? r.pick(nl.family) : '', epithet: ep,
    faction, kind, country: kind === 'army' ? faction as CountryId : null, rank, gender, age, personality: pers,
    face: generateFace(r, origin as 'frontier', gender), faceImage, classId: r.pick(OFFICER_CLASSES[kind]),
    level: Math.max(1, Math.round(3 + s.year * 0.6 + (2 - rank) * 2)), scars: 0, traits, knownTraits: [style], meets: [], status: 'active', grudge: null, victims: [], joined: s.year,
  };
}

/** 名簿を満たす（ゲーム開始・読み込み・月の初め・年度末）。上が空いていれば下から昇格させる */
export function ensureRosters(s: GameState, r: Rng, report?: string[]): void {
  for (const f of ROSTER_FACTIONS) fillFaction(s, f, r, report);
  linkOrg(s);
}

// ---------- 組織図（9夜目） ----------
/** 組織図の線をつなぐ：幹部→将軍、隊長→幹部（子の少ない幹部へ） */
export function linkOrg(s: GameState): void {
  for (const f of ROSTER_FACTIONS) {
    const list = activeOf(s, f);
    const head = list.find((o) => o.rank === 0);
    const mids = list.filter((o) => o.rank === 1);
    for (const o of list) {
      if (o.rank === 0) { o.parent = undefined; continue; }
      if (o.rank === 1) { o.parent = head?.id; continue; }
      if (o.parent && mids.some((m) => m.id === o.parent)) continue;
      const kids = (m: EnemyOfficer) => list.filter((x) => x.rank === 2 && x.parent === m.id).length;
      o.parent = [...mids].sort((a, c) => kids(a) - kids(c))[0]?.id;
    }
  }
}
/** 組織図を見たときのようすを覚える（次に見たとき、変化に印をつける） */
export function markOrgSeen(s: GameState, only?: FactionId): void {
  const seen = (s.orgSeen ??= {});
  for (const f of only ? [only] : ROSTER_FACTIONS) {
    const o: Record<string, OrgMark> = {};
    for (const x of officers(s)) if (x.faction === f && (x.status === 'active' || seen[f]?.o[x.id]?.status === 'active')) o[x.id] = { rank: x.rank, status: x.status, ep: x.epithet, parent: x.parent, prospect: x.prospect || undefined };
    seen[f] = { at: s.absWeek, o };
  }
}
export type OrgChangeKind = 'new' | 'promote' | 'fell' | 'gone' | 'contest' | 'epithet' | 'raised' | 'prospect';
export interface OrgChange { kind: OrgChangeKind; id: string; text: string; from?: number; to?: number }
/** 前に見たときからの変化 */
export function orgChanges(s: GameState, f: FactionId): OrgChange[] {
  const was = s.orgSeen?.[f]?.o;
  if (!was) return [];
  const out: OrgChange[] = [];
  const rn = (o: EnemyOfficer, rank = o.rank) => (rank >= 3 ? '一兵卒' : rankName({ ...o, rank }));
  for (const o of officers(s).filter((x) => x.faction === f)) {
    const w = was[o.id];
    const nm = officerName(o);
    if (!w) {
      if (o.status !== 'active') continue;
      if (o.prospect) out.push({ kind: 'prospect', id: o.id, text: `${nm}が見込みのある兵に（${o.deed ?? '戦場で目立った'}）` });
      else if (o.raisedYear) out.push({ kind: 'raised', id: o.id, text: `${nm}が一兵卒から${rn(o)}に抜擢された` });
      else out.push({ kind: 'new', id: o.id, text: `${nm}が新しく${rn(o)}に` });
      continue;
    }
    if (w.status === 'active' && o.status !== 'active') {
      const m = o.meets[o.meets.length - 1];
      const by = m?.foes?.map((id) => s.students[id]?.given).filter(Boolean)[0];
      if (o.status === 'dead') out.push({ kind: 'fell', id: o.id, text: `${nm}が討ち取られた${by ? `（${by}）` : ''}` });
      else out.push({ kind: 'gone', id: o.id, text: `${nm}が去った（${o.endNote ?? '戦場を去った'}）` });
      continue;
    }
    if (o.status !== 'active') continue;
    if (w.prospect && !o.prospect) out.push({ kind: 'raised', id: o.id, text: `${nm}が一兵卒から${rn(o)}に抜擢された`, from: 3, to: o.rank });
    else if (o.rank < w.rank) {
      const gone = Object.entries(was).map(([id, x]) => ({ x, o: officerById(s, id) })).find((v) => v.x.rank === o.rank && v.x.status === 'active' && v.o && v.o.status !== 'active');
      const why = gone?.o ? `（${officerName(gone.o)}が抜けた空きを埋めた）` : '';
      out.push({ kind: 'promote', id: o.id, text: `${nm}が${rn(o, w.rank)}→${rn(o)}に昇進${why}`, from: w.rank, to: o.rank });
    }
    if (o.epithet && o.epithet !== w.ep && o.kind === 'army') out.push({ kind: 'epithet', id: o.id, text: `${o.given}が「${nm}」と呼ばれるようになった` });
    if (o.contest) out.push({ kind: 'contest', id: o.id, text: `${nm}が${RANK_NAMES[o.kind === 'army' ? 'army' : 'bandit'][0]}の座をねらっている` });
  }
  const order: OrgChangeKind[] = ['fell', 'promote', 'raised', 'contest', 'new', 'epithet', 'gone', 'prospect'];
  return out.sort((a, c) => order.indexOf(a.kind) - order.indexOf(c.kind));
}

// ---------- 見込みのある兵（9夜目） ----------
const RAISE_VERB: Record<string, string> = { bow: '射ちの', magic: '焼きの', holy: '焼きの', lance: '突きの', axe: '割りの', sword: '斬りの', gun: '撃ちの' };
/** 戦いで目立った一般兵を、見込みのある兵として名簿に入れる */
export function addProspect(s: GameState, f: FactionId, g: { given: string; family: string; gender: Gender; face: EnemyOfficer['face']; faceImage: string | null; classId: string; level: number; deed: string; victim?: string; dead?: boolean; weapon?: string | null }, title: string): EnemyOfficer {
  const kind: 'army' | 'bandit' = f === 'bandit' ? 'bandit' : 'army';
  const o: EnemyOfficer = {
    id: `of${s.nextId++}`, given: g.given, family: kind === 'army' ? g.family : '', faction: f, kind, country: kind === 'army' ? f as CountryId : null,
    rank: 3, gender: g.gender, age: 20 + (hash(g.given) % 9), personality: (['young', 'arrogant', 'cold', 'cunning'] as const)[hash(g.given + title) % 4], face: g.face, faceImage: g.faceImage,
    classId: g.classId, level: g.level, scars: 0, traits: [...new Rng({ rng: hash(g.given + f) }).shuffle([...TRAIT_IDS]).slice(0, OFFICER.traitCount), 'valor'], knownTraits: ['valor'], meets: [{ year: s.year, month: s.month, title, result: 'win', foes: g.victim ? [g.victim] : [] }],
    status: 'active', grudge: null, victims: g.victim && s.students[g.victim] ? [{ id: g.victim, name: s.students[g.victim].given, year: s.year, dead: !!g.dead }] : [], joined: s.year,
    prospect: true, deed: g.deed,
  };
  if (g.weapon) o.raiseWeapon = g.weapon;
  officers(s).push(o);
  // 多すぎるときは古い順に去る
  const list = prospectsOf(s, f);
  if (list.length > OFFICER.prospectMax) for (const x of list.slice(0, list.length - OFFICER.prospectMax)) { x.status = 'retired'; x.endYear = s.year; x.endNote = '名を上げる前に戦場を去った'; }
  // 生徒の側も覚えている：重傷にされた子は因縁、倒された子の仲間は仇討ちの誓い
  if (g.victim && s.students[g.victim]) {
    if (!g.dead && s.students[g.victim].status === 'enrolled') { const rv = ensureRivalry(s, g.victim, o.id); rv.battles += 1; rv.stage = Math.max(1, rv.stage); rv.log.push({ year: s.year, month: s.month, text: `${title}で重傷を負わされた` }); }
    if (g.dead) {
      const fr = Object.values(s.students).filter((y) => y.status === 'enrolled' && y.id !== g.victim && (getSupport(s, y.id, g.victim!).kind === 'love' || supportValue(s, y.id, g.victim!) >= B.support.B)).sort((a, c) => supportValue(s, c.id, g.victim!) - supportValue(s, a.id, g.victim!))[0];
      if (fr) { const rv = ensureRivalry(s, fr.id, o.id); rv.vow = g.victim; rv.stage = Math.max(1, rv.stage); rv.log.push({ year: s.year, month: s.month, text: `${s.students[g.victim].given}の仇` }); }
    }
  }
  return o;
}
/** 隊長の席が空いたとき、見込みのある兵を抜擢する（生徒を倒した兵は二つ名つき） */
function raiseProspect(s: GameState, f: FactionId, r: Rng, report?: string[]): boolean {
  const list = prospectsOf(s, f);
  if (!list.length || !r.chance(OFFICER.raiseChance)) return false;
  const p = r.weighted(list, (o) => 1 + o.victims.length * 2 + o.level / 10);
  p.prospect = false; p.rank = 2; p.raisedYear = s.year; p.level += 1;
  const v = p.victims[p.victims.length - 1];
  if (v && !p.epithet) p.epithet = `${v.name}${RAISE_VERB[p.raiseWeapon ?? ''] ?? '討ちの'}`;
  const t = fill(OFFICER_NEWS.raised, { faction: FACTION_NAMES[f], name: officerName(p), rank: rankName(p) });
  chronicle(s, t, 'world'); report?.push(t);
  return true;
}
function rankScore(o: EnemyOfficer): number { return o.level + o.victims.length * 3 + o.meets.length; }
function fillFaction(s: GameState, f: FactionId, r: Rng, report?: string[]): void {
  const kind = f === 'bandit' ? 'bandit' : 'army';
  for (let rank = 0; rank <= 1; rank++) {
    let guard = 0;
    while (activeOf(s, f).filter((o) => o.rank === rank).length < OFFICER.roster[rank] && guard++ < 4) {
      const cands = activeOf(s, f).filter((o) => o.rank === rank + 1);
      if (!cands.length) break;
      const win = r.weighted(cands, (o) => 1 + rankScore(o));
      win.rank = rank;
      const rn = RANK_NAMES[kind][rank];
      if (rank === 0 && cands.length >= 2 && r.chance(0.5)) {
        // 権力争い：負けた者は去る
        const loser = r.pick(cands.filter((o) => o !== win));
        if (r.chance(0.4)) { loser.status = 'retired'; loser.endYear = s.year; loser.endNote = '権力争いに敗れて去った'; }
        const t = fill(OFFICER_NEWS.struggle, { faction: FACTION_NAMES[f], name: officerName(win), rank: rn, loser: officerName(loser) });
        chronicle(s, t, 'world'); report?.push(t);
      } else {
        const t = fill(rank === 0 ? OFFICER_NEWS.head : OFFICER_NEWS.promote, { faction: FACTION_NAMES[f], name: officerName(win), rank: rn, pers: LEADER_NAMES[win.personality as LeaderPersonality] ?? '' });
        if (s.year > 1 || s.month > 0) { chronicle(s, t, 'world'); report?.push(t); }
      }
    }
  }
  for (let rank = 0; rank <= 2; rank++) {
    while (activeOf(s, f).filter((o) => o.rank === rank).length < OFFICER.roster[rank] && activeOf(s, f).length < OFFICER.rosterMax) {
      if (rank === 2 && raiseProspect(s, f, r, report)) continue;
      officers(s).push(newOfficer(s, r, f, rank));
    }
  }
}

/** 5夜目の因縁の敵将を、名簿の敵将に変換する（陣営に合う顔を割り当てる） */
export function nemesisToOfficer(s: GameState, n: Nemesis, r: Rng): EnemyOfficer {
  const faction: FactionId = n.kind === 'monster' ? 'monster' : n.kind === 'bandit' ? 'bandit' : (n.country ?? 'kingdom');
  let given = n.name, family = '', epithet: string | undefined;
  if (n.kind === 'army' && n.name.includes('・')) [given, family] = n.name.split('・');
  if (n.kind === 'bandit') { const ep = BANDIT_EPITHETS.find((e) => n.name.startsWith(e)); if (ep) { epithet = ep; given = n.name.slice(ep.length); } }
  const origin = faction === 'bandit' || faction === 'monster' ? 'frontier' : faction;
  const nl = NAMES[origin as keyof typeof NAMES];
  const gender: Gender = nl.female.includes(given) ? 'f' : 'm';
  const band: AgeBand = n.personality === 'veteran' ? 'old' : n.personality === 'young' ? 'young' : 'middle';
  const faceImage = n.kind === 'monster' ? null : pickFace(s, faction, gender, band, r, n.id);
  const pf = faceImage ? parseEnemyFace(faceImage) : null;
  const fled = n.meets.filter((m) => m.result === 'fled').length;
  return {
    id: n.id, given, family, epithet, faction, kind: n.kind, country: n.country, rank: n.level >= 15 ? 1 : 2,
    gender: pf?.gender ?? gender, age: r.int(...OFFICER.ageRange[pf?.band ?? band]), personality: n.personality, face: n.face, faceImage,
    classId: n.classId, level: n.level, scars: Math.min(3, fled), traits: [...r.shuffle([...TRAIT_IDS]).slice(0, OFFICER.traitCount), n.level % 2 ? 'valor' : 'marshal'], knownTraits: [n.level % 2 ? 'valor' : 'marshal'],
    meets: n.meets.map((m) => ({ ...m })), status: n.status === 'active' ? 'active' : 'defeated', grudge: null, victims: [], joined: n.meets[0]?.year ?? s.year,
    title: n.kind === 'monster' ? n.name : undefined,
  };
}

// ---------- 依頼と敵将 ----------
export function factionOfQuest(q: Quest): FactionId | null {
  if (q.kind === 'drill' || q.kind === 'exhibition') return null;
  if (q.kind === 'monster') return 'monster';
  return q.enemyCountry ?? 'bandit';
}
export function headOf(s: GameState, f: FactionId): EnemyOfficer | null { return activeOf(s, f).find((o) => o.rank === 0) ?? null; }
export function headEffect(s: GameState, f: FactionId | null) {
  const h = f ? headOf(s, f) : null;
  return HEAD_EFFECT[(h?.personality as LeaderPersonality) ?? 'beast'] ?? HEAD_EFFECT.beast;
}

/** 依頼の敵将を名簿から選ぶ（状態は変えない）。依頼の大きさで階級が変わる */
export function pickOfficerForQuest(s: GameState, q: Quest, r: Rng, deployIds: string[]): EnemyOfficer | null {
  const f = factionOfQuest(q);
  if (!f || f === 'monster') return null;
  const pool = activeOf(s, f).filter((o) => !o.alumniId || alumniUsable(s, o));
  if (!pool.length) return null;
  const want = QUEST_RANK[q.kind] ?? { rank: 2, up: 0.2 };
  let rank = want.rank;
  if (q.danger >= 3 && r.chance(want.up)) rank = Math.max(0, rank - 1);
  let cands = pool.filter((o) => o.rank === rank);
  for (let d = 1; !cands.length && d <= 2; d++) cands = pool.filter((o) => Math.abs(o.rank - rank) === d);
  if (!cands.length) cands = pool;
  const rv = s.rivalries ?? {};
  return r.weighted(cands, (o) => (o.meets.length ? OFFICER.metWeight : 1)
    * (o.grudge && deployIds.includes(o.grudge) ? OFFICER.grudgeWeight : 1)
    * (deployIds.some((id) => (rv[rivalKey(id, o.id)]?.stage ?? 0) >= 1 && !rv[rivalKey(id, o.id)]?.settled) ? OFFICER.rivalWeight : 1));
}
function alumniUsable(s: GameState, o: EnemyOfficer): boolean {
  const st = s.students[o.alumniId!];
  return !!st && st.status === 'graduated' && !!st.career?.alive && !st.career.retired && st.career.kind === 'army';
}

/** 戦場での敵将のレベル（依頼の敵より少し強く、生徒を倒したり傷を負うほど強くなる） */
export function officerLevel(o: EnemyOfficer, base: number): number {
  const grow = Math.min(OFFICER.growthCap, o.victims.length * OFFICER.victimLevel + o.scars * OFFICER.scarLevel);
  return Math.max(1, Math.round(base + OFFICER.rankLevel[Math.max(0, Math.min(2, o.rank))] - 1 + grow));
}

export function isScout(classId: string): boolean { return SCOUT_CLASSES.includes(classId); }

// ---------- 宿敵（生徒側の因縁） ----------
export function rivalKey(sid: string, oid: string): string { return `${sid}|${oid}`; }
export function rivalryOf(s: GameState, sid: string, oid: string): Rivalry | null { return s.rivalries?.[rivalKey(sid, oid)] ?? null; }
export function ensureRivalry(s: GameState, sid: string, oid: string): Rivalry {
  const k = rivalKey(sid, oid);
  return ((s.rivalries ??= {})[k] ??= { sid, oid, battles: 0, stage: 0, vow: null, log: [], settled: null });
}
export function rivalriesOf(s: GameState, sid: string): Rivalry[] {
  return Object.values(s.rivalries ?? {}).filter((r) => r.sid === sid && (r.stage >= 1 || r.vow || r.settled)).sort((a, c) => c.stage - a.stage || c.battles - a.battles);
}
export function stageName(n: number): string { return RIVAL_STAGE_NAMES[Math.max(0, Math.min(3, n))]; }
export function stageFor(rv: Rivalry): number {
  let st = 0;
  OFFICER.stageAt.forEach((n, i) => { if (rv.battles >= n) st = i + 1; });
  if (rv.vow) st = Math.max(st, 1);
  return st;
}

// ---------- 口上（記憶） ----------
export function whenText(s: GameState, year: number, month: number): string {
  const d = s.year - year;
  return d <= 0 ? `今年の${MONTH_NAMES[month]}` : d === 1 ? `去年の${MONTH_NAMES[month]}` : `${d}年前の${MONTH_NAMES[month]}`;
}
/** 過去の出来事に触れる口上。出撃している生徒（ids）を見て選ぶ */
export function memoryLine(s: GameState, o: EnemyOfficer, ids: string[], r: Rng): { text: string; target?: string } | null {
  const last = o.meets[o.meets.length - 1];
  if (!last) return null;
  const nm = (id?: string | null) => (id && s.students[id] ? s.students[id].given : '');
  if (o.grudge && ids.includes(o.grudge)) return { text: voice(fill(r.pick(MEMORY_TEXT.grudge), { a: nm(o.grudge) }), o), target: o.grudge };
  const when = whenText(s, last.year, last.month);
  const v = o.victims[o.victims.length - 1];
  if (v && r.chance(0.55)) return { text: voice(fill(r.pick(MEMORY_TEXT.victim), { v: v.name, when: whenText(s, v.year, 0).replace(/の.*$/, '') }), o) };
  if (last.result === 'fled' || o.scars) {
    const foe = (last.foes ?? []).find((id) => ids.includes(id)) ?? (last.foes ?? [])[0];
    if (foe && nm(foe)) return { text: voice(fill(r.pick(MEMORY_TEXT.scar), { a: nm(foe), when, title: last.title }), o), target: foe };
    return { text: voice(fill(r.pick(MEMORY_TEXT.scarAny), { when, title: last.title }), o) };
  }
  if (last.result === 'lose') return { text: voice(fill(r.pick(MEMORY_TEXT.won), { when, title: last.title }), o) };
  return { text: voice(fill(r.pick(MEMORY_TEXT.lost), { when, title: last.title }), o) };
}

// ---------- 特徴が分かる（偵察・手紙） ----------
export function revealOne(o: EnemyOfficer, r: Rng): string | null {
  const unknown = o.traits.filter((t) => !o.knownTraits.includes(t) && !!OFFICER_TRAITS[t]);
  if (!unknown.length) return null;
  const id = r.pick(unknown);
  o.knownTraits.push(id);
  return id;
}

// ---------- 年度末 ----------
const OFFICER_MARK = /と呼ばれるようになった|昇進した|宿敵|仇|因縁に決着|討ち取った|権力争い|に就いた/;
/** 年度末：敵将が年をとる・引退・権力争い・卒業生が敵将になる・卒業生からの手紙。新聞に載せる文を返す */
export function yearlyOfficers(s: GameState, r: Rng): string[] {
  const report: string[] = [];
  for (const o of officers(s)) {
    if (o.status !== 'active' || o.kind === 'monster') continue;
    if (o.alumniId) {
      const st = s.students[o.alumniId];
      if (!alumniUsable(s, o)) { o.status = st?.career?.alive === false ? 'dead' : 'retired'; o.endYear = s.year; o.endNote = st?.career?.alive === false ? '戦場で倒れた' : '軍を離れた'; continue; }
      o.level = st.level; o.classId = st.classId; o.age = st.age;
      continue;
    }
    o.age += 1;
    o.level += o.rank === 2 ? 1 : r.chance(0.6) ? 1 : 0;
    if (o.age >= OFFICER.retireAge && r.chance(OFFICER.retireChance)) {
      o.status = 'retired'; o.endYear = s.year; o.endNote = '年をとって引退した';
      const t = fill(OFFICER_NEWS.retire, { faction: FACTION_NAMES[o.faction], name: officerName(o) });
      chronicle(s, t, 'world'); report.push(t);
    }
  }
  // 卒業生が敵将になる
  for (const st of Object.values(s.students)) {
    const c = st.career;
    if (st.status !== 'graduated' || !c?.alive || c.retired || c.kind !== 'army' || !c.country || c.path === 'civil' || c.rank < OFFICER.alumniRank) continue;
    if (officers(s).some((o) => o.alumniId === st.id)) continue;
    if (activeOf(s, c.country).filter((o) => o.alumniId).length >= OFFICER.alumniMax || activeOf(s, c.country).length >= OFFICER.rosterMax || !r.chance(OFFICER.alumniChance)) continue;
    // 10夜目：統率の高い教え子ほど上の段（幹部）に。軍略の高い子は策を使ってくる敵将に
    const o = alumniOfficer(s, st, c.country, c.rank >= 3 || (st.skills.command ?? 0) >= 270 ? 1 : 2);
    officers(s).push(o);
    const t = fill(OFFICER_NEWS.alumni, { a: `${st.given}（${st.cohort}期生）`, faction: FACTION_NAMES[c.country], rank: rankName(o) });
    chronicle(s, t, 'student'); report.push(t);
    st.history.push({ year: s.year, text: `${FACTION_NAMES[c.country]}の${rankName(o)}になった（敵将の名簿に載る）` });
  }
  contests(s, r, report);
  ensureRosters(s, r, report);
  // 三国の軍の頭の性格で、戦況の動きが少し変わる（好戦的な頭は緊張を高める）
  let dt = 0;
  for (const f of ['kingdom', 'empire', 'alliance'] as const) dt += headEffect(s, f).tension * 0.5;
  s.world.tension = Math.max(0, Math.min(100, s.world.tension + dt));
  // 卒業生からの手紙（敵将の特徴）
  let sent = 0;
  const writers = r.shuffle(Object.values(s.students).filter((st) => st.status === 'graduated' && st.career?.alive && !st.career.retired && st.career.kind === 'army' && st.trust >= 20));
  for (const w of writers) {
    if (sent >= OFFICER.letterMax) break;
    if (!r.chance(OFFICER.letterChance)) continue;
    const met = officers(s).filter((o) => o.status === 'active' && o.meets.length && o.traits.some((t) => !o.knownTraits.includes(t)) && o.alumniId !== w.id);
    if (!met.length) continue;
    const o = r.weighted(met, (x) => (x.faction === w.career!.country ? 3 : 1) + x.meets.length);
    const id = revealOne(o, r)!;
    const T = OFFICER_TRAITS[id];
    if (!T) continue;
    mail(s, `${w.given}（${w.cohort}期生）`, LETTER_TEXT.title, fill(r.pick(LETTER_TEXT.body), { place: w.career!.country ? `${COUNTRY_SHORT[w.career!.country]}の陣中` : '戦場', leader: officerName(o), faction: FACTION_NAMES[o.faction], desc: T.desc, trait: T.name, a: w.given }), w.id);
    sent++;
  }
  // 宿敵にならなかった記録を整理する
  for (const [k, rv] of Object.entries(s.rivalries ?? {})) {
    const o = officerById(s, rv.oid);
    const st = s.students[rv.sid];
    // 19夜目：宿敵が覚えている子（負けた・傷つけられた・倒した相手）の因縁は、卒業しても残す
    const remembered = !!o && (o.memory?.beatenBy.includes(rv.sid) || o.memory?.woundedBy.some((w) => w.id === rv.sid) || o.victims.some((v) => v.id === rv.sid));
    const alive = !!st && (st.status === 'enrolled' || (st.status === 'graduated' && !!st.career?.alive));
    if (rv.stage === 0 && !rv.vow && (rv.settled || !o || (o.status !== 'active' && !o.presumed) || !alive || (!remembered && st.status !== 'enrolled'))) delete s.rivalries![k];
  }
  // 新聞：この1年の敵将の動き（昇進・二つ名・因縁の決着など）
  for (const c of s.chronicle) if (c.year === s.year && OFFICER_MARK.test(c.text) && !report.includes(c.text)) report.push(c.text);
  // 名簿の古い記録を整理（去った敵将は新しい40人まで）
  const gone = officers(s).filter((o) => o.status !== 'active');
  if (gone.length > 40) { const keep = new Set(gone.slice(-40)); s.officers = officers(s).filter((o) => o.status === 'active' || keep.has(o)); }
  return report;
}

/** 権力争い（9夜目）：野心のある幹部が頭の座をねらい、翌年に決着する */
function contests(s: GameState, r: Rng, report: string[]): void {
  for (const f of ROSTER_FACTIONS) {
    const list = activeOf(s, f);
    const head = list.find((o) => o.rank === 0);
    const c = list.find((o) => o.contest);
    const rn = RANK_NAMES[f === 'bandit' ? 'bandit' : 'army'][0];
    if (c) {
      if (c.contest! >= s.year) continue;
      c.contest = undefined;
      if (head && r.chance(OFFICER.contestWin)) {
        head.status = 'retired'; head.endYear = s.year; head.endNote = '権力争いに敗れて去った';
        c.rank = 0;
        const t = fill(OFFICER_NEWS.struggle, { faction: FACTION_NAMES[f], name: officerName(c), rank: rn, loser: officerName(head) });
        chronicle(s, t, 'world'); report.push(t);
      } else {
        const t = fill(OFFICER_NEWS.contestLost, { faction: FACTION_NAMES[f], name: officerName(c), rank: rn });
        chronicle(s, t, 'world'); report.push(t);
        if (r.chance(0.5)) { c.status = 'retired'; c.endYear = s.year; c.endNote = '権力争いに敗れて去った'; }
      }
      continue;
    }
    if (!head || !r.chance(OFFICER.contestChance)) continue;
    const amb = list.filter((o) => o.rank === 1 && !o.alumniId && ['arrogant', 'young', 'cunning'].includes(o.personality));
    if (!amb.length) continue;
    const x = r.weighted(amb, (o) => 1 + rankScore(o));
    x.contest = s.year;
    const t = fill(OFFICER_NEWS.contest, { faction: FACTION_NAMES[f], name: officerName(x), rank: rn });
    chronicle(s, t, 'world'); report.push(t);
  }
}

export function alumniOfficer(s: GameState, st: Student, country: CountryId, rank: number): EnemyOfficer {
  return {
    id: `of${s.nextId++}`, given: st.given, family: st.family, faction: country, kind: 'army', country, rank, gender: st.gender, age: st.age,
    personality: ALUMNI_PERSONALITY[st.personality] ?? 'proud', face: st.face, faceImage: null, classId: st.classId, level: st.level, scars: 0,
    traits: [...new Rng({ rng: hash(st.id) }).shuffle([...TRAIT_IDS]).slice(0, OFFICER.traitCount), st.career?.path === 'champion' ? 'valor' : 'marshal'], knownTraits: [st.career?.path === 'champion' ? 'valor' : 'marshal'], meets: [], status: 'active', grudge: null, victims: [], alumniId: st.id, joined: s.year,
  };
}

/** 卒業生の敵将の肩書き（国の役職） */
export function alumniRankTitle(st: Student): string {
  const c = st.career;
  if (!c || c.kind !== 'army') return '';
  const t = RANK_TITLES[c.path];
  return t[Math.min(c.rank, t.length - 1)];
}

/** 倒れた敵将が深手を負いながら逃げのびるか（名簿の敵将だけ。決着の指示「討ち取る」のときは逃げられない） */
export function survives(o: EnemyOfficer, objective: string, r: Rng): boolean {
  if (o.kind === 'monster') return false;
  let p = OFFICER.survive[Math.max(0, Math.min(2, o.rank))];
  if (objective === 'boss' || objective === 'seize') p *= OFFICER.surviveBossMul;
  return r.chance(p);
}

/** 名簿の見え方：0=会ったことがない 1=一度会った 2=何度も会った */
export function knowledge(o: EnemyOfficer): number { return o.meets.length === 0 ? 0 : o.meets.length === 1 ? 1 : 2; }

void ageBand;
