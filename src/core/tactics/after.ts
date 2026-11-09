// 19夜目：新しい戦いの結果を学校に反映する。DOMに依存しない
import { B } from '../../data/balance';
import { TB } from '../../data/tactics';
import { CLASSES } from '../../data/classes';
import { WEAPONS } from '../../data/weapons';
import { BACKGROUNDS, COUNTRIES, COUNTRY_SHORT } from '../../data/people';
import type { GameState, Student, GrowthEntry, BattleReport, StudentEval, BattleFinding } from '../state';
import type { SkillId, CountryId } from '../types';
import type { TBattle, TUnit } from './types';
import { Rng } from '../rng';
import { addMoney, addRep, chronicle } from '../game';
import { addSkill, changeMotivation, revealTalent } from '../week';
import { gainExp, startGrowthLog, stopGrowthLog, snapGrowth, diffGrowth } from '../growth';
import { learnTechs } from '../techs';
import { addSupport, addRecent } from '../support';
import { rollLoot, takeLoot } from '../loot';
import { questRegionResult } from '../regions';
import { questWorldEffect } from '../world';
import { seedHelp } from '../ending';
import { afterTactics, moveMind } from '../nemesis';
import { checkBloom } from '../aptitude';
import { teacherWonNemesis } from '../instructor';

const WT_SKILL: Record<string, SkillId> = { sword: 'sword', lance: 'lance', axe: 'axe', bow: 'bow', magic: 'magic', holy: 'faith', staff: 'faith', gun: 'gun' };
function gradeFor(score: number): string { return score >= 9 ? 'S' : score >= 5 ? 'A' : score >= 2 ? 'B' : 'C'; }

export interface TacticsOutcome { report: BattleReport; dead: { st: Student; u: TUnit }[]; injured: { st: Student; u: TUnit }[] }

/** 20夜目：最上級の条件になる出来事を、生徒の記録（deeds）に足す */
export function addBattleDeeds(b: TBattle, u: TUnit, st: Student, win: boolean, bossU?: TUnit): void {
  const add = (k: string, n = 1) => { if (n > 0) (st.deeds ??= {})[k] = (st.deeds?.[k] ?? 0) + n; };
  for (const [k, n] of Object.entries(u.deeds ?? {})) if (k !== 'surroundedTurn') add(k, n);
  if (u.deeds?.surroundedTurn && u.alive) add('surrounded');
  const hitBoss = !!bossU && (bossU.hitBy?.[st.id] ?? 0) > 0;
  const kids = b.units.filter((x) => x.side === 'me' && x.studentId && !x.teacher && !x.raised);
  if (!win) { if (b.nemesisId && u.alive && b.objective === 'escape') add('outwit'); return; }
  if (b.real && u.alive && u.taken === 0) add('unhurt');
  if (b.nemesisId && bossU && bossU.resist.length > 0 && hitBoss) add('overcome');
  if (b.objective === 'defend' && hitBoss) add('holdGeneral');
  if (b.field === 'fort' && u.usedFire) add('burnFort');
  if (b.nemesisId && (u.traits?.includes('spot') || u.traits?.includes('trap')) && kids.every((x) => x.alive)) add('seeTrap');
  if (b.objective === 'escape' && u.alive) { add('rearguard'); if (b.nemesisId) add('outwit'); }
  if (kids.length >= 3 && kids.filter((x) => !x.alive).length * 2 >= kids.length && u.alive) add('turnTide');
}

/** 戦いの結果を学校に反映し、結果の報告を返す（戦死・重傷の後始末は呼ぶ側で） */
export function applyTactics(s: GameState, b: TBattle, r: Rng): TacticsOutcome {
  const q = s.quests.find((x) => x.id === b.questId);
  const win = b.result === 'win';
  const lines: string[] = [win ? `勝利！「${b.title}」` : `敗北……「${b.title}」`];
  if (win) s.stats.battlesWon++; else s.stats.battlesLost++;
  const growth: GrowthEntry[] = [];
  const grades: BattleReport['grades'] = [];
  const evals: StudentEval[] = [];
  const dead: TacticsOutcome['dead'] = [];
  const injured: TacticsOutcome['injured'] = [];
  const expMul = (b.real ? 1 : B.battle.drillExpMul) * (q?.tutorial ? 1.6 : 1);
  // ふつうの戦いで討ち取った名前のある将は、深手を負いながら逃げのびることがある（宿敵戦では討てば討てる）
  {
    const bu = b.units.find((u) => u.boss && u.officerId);
    if (bu && !bu.alive && bu.down === 'dead' && b.nemesisId !== bu.officerId && (q?.opening || r.chance(B.sortie.officerEscape))) { bu.down = 'fled'; bu.hp = 1; bu.escapedWounded = true; lines.push(`${bu.name}は深手を負ったが、兵に担がれて逃げのびた`); }
  }
  startGrowthLog();
  const bossU = b.units.find((u) => u.boss);
  for (const u of b.units) {
    if (u.side !== 'me' || !u.studentId || u.teacher) continue;
    const st = s.students[u.studentId];
    if (!st || st.status !== 'enrolled') continue;
    const snap = snapGrowth(st);
    st.battles += 1;
    if (b.nemesisId) st.nemBattles = (st.nemBattles ?? 0) + 1;
    if (u.guarded) st.guards = (st.guards ?? 0) + u.guarded;
    st.kills += u.kills;
    const X = TB.exp;
    const exp = X.join + u.kills * X.kill + u.weakHits * X.weak + u.breaks * X.brk + (win ? X.win : 0) + (bossU && !bossU.alive && bossU.lastHitBy === u.uid ? X.boss : 0);
    const damp = Math.max(B.battle.expDamp.min, Math.min(1, B.battle.expDamp.base * 2 - st.level * B.battle.expDamp.perLevel));
    gainExp(s, r, st, exp * expMul * damp);
    // 武器の技能：戦った分だけ
    const c = CLASSES[st.classId] ?? CLASSES.novice;
    const k = WT_SKILL[c.weapons[0]] ?? 'sword';
    const uses = Math.max(1, Math.round(u.dealt / 8));
    addSkill(st, k, uses * B.battle.skillPerUse * B.motivationMul[st.motivation] * (s.settings.mods.skill ?? 1));
    revealTalent(s, st, B.talent.battleReveal / 4);
    // 盗賊のかすめ取り
    if (win && u.traits?.includes('steal')) addMoney(s, 60 + u.kills * 20);
    addBattleDeeds(b, u, st, win, bossU);
    if (u.armoryUid) { const a = s.armory.find((x) => x.uid === u.armoryUid); if (a) (a.uses ??= {})[st.id] = (a.uses[st.id] ?? 0) + 1; }
    const learned = learnTechs(s, st);
    growth.push(diffGrowth(st, snap, learned));
    const score = u.kills * 3 + u.breaks * 2 + u.weakHits + u.dealt / 12 - (u.alive ? 0 : 3);
    const g = gradeFor(score);
    st.bestGrade = !st.bestGrade || 'SABC'.indexOf(g) < 'SABC'.indexOf(st.bestGrade) ? g : st.bestGrade;
    const note = u.down === 'dead' ? '帰らぬ人となった' : u.down === 'injured' ? '深手を負ったが、命はとりとめた' : u.breaks ? '守りを崩す見事な働きだった' : u.kills >= 2 ? '見事な戦いぶりだった' : u.dealt ? '堅実に役目を果たした' : '次はもっと活躍できるはず';
    grades.push({ id: st.id, grade: g, note });
    if (g === 'S' || g === 'A') changeMotivation(st, 1);
    if (q?.kind === 'exhibition') st.exhibitionScore += score;
    const badges: string[] = [];
    if (u.breaks) badges.push('breaker');
    if (u.kills >= 2) badges.push('slayer');
    evals.push({ id: st.id, grade: g, badges, scene: b.scenes.find((x) => x.text.includes(st.given))?.text ?? null, say: '', rec: { kills: u.kills, dealt: u.dealt, taken: u.taken, healed: 0, hits: u.weakHits, swings: 0 }, growth: [], rivals: [], outcome: u.down === 'dead' ? 'dead' : u.down === 'injured' ? 'injured' : undefined });
    if (u.down === 'dead') dead.push({ st, u });
    else if (u.down === 'injured') injured.push({ st, u });
    checkBloom(s, st);
  }
  stopGrowthLog();
  // 先生の兵種：宿敵戦に勝つと上がることがある
  if (win && b.nemesisId && b.real) { const t = teacherWonNemesis(s); if (t) lines.push(t); }
  // 禁呪の番人のいた戦で討った宿敵は、二度と蘇らない
  if (b.forbidden && b.nemesisId) { const o = (s.officers ?? []).find((x) => x.id === b.nemesisId); if (o) o.noRevive = true; }
  // 支援：最後にとなりにいた組
  const alive = b.units.filter((u) => u.side === 'me' && u.studentId && !u.teacher);
  for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
    const a = alive[i], c = alive[j];
    if (Math.abs(a.x - c.x) + Math.abs(a.y - c.y) > 2) continue;
    if (s.students[a.studentId!]?.status !== 'enrolled' || s.students[c.studentId!]?.status !== 'enrolled') continue;
    const t = addSupport(s, r, a.studentId!, c.studentId!, B.support.adjacentBattle);
    if (t) s.pending.push({ type: 'talk', talk: t });
    if (!a.alive || !c.alive) { addRecent(s, s.students[a.studentId!], 'ev_cover', c.name, c.studentId); }
  }
  // 戦利品
  const loot = takeLoot(s, rollLoot(s, b, q));
  for (const x of loot) lines.push(`戦利品：${x.named?.name ?? WEAPONS[x.weaponId]?.name}（${x.from}）`);
  // 報酬・評判・戦況
  if (q) {
    if (q.kind === 'exhibition') {
      addRep(s, win ? r.int(...B.reputation.exhibition) : 1);
      for (const gr of [...grades].sort((a, c) => 'SABC'.indexOf(a.grade) - 'SABC'.indexOf(c.grade)).slice(0, 3)) {
        const st = s.students[gr.id];
        const cc: CountryId = r.weighted(COUNTRIES, (x) => 10 + Math.max(0, s.world.friendship[x]) + (s.world.vassal === x ? 30 : 0));
        if (!st.offers.includes(cc)) st.offers.push(cc);
        lines.push(`観覧席の${COUNTRY_SHORT[cc]}の関係者が、${st.given}に声をかけた`);
      }
    } else if (q.kind === 'schoolDefense') {
      s.world.schoolDefensePending = false;
      if (win) { addRep(s, B.reputation.schoolDefenseWin); s.world.defenseWonYear = s.year; chronicle(s, '学校防衛戦に勝利', 'school'); lines.push(`学校を守り抜いた！ 評判+${B.reputation.schoolDefenseWin}`); }
      else {
        // 19夜目⑨：学校が焼かれても、バッドエンドにはしない。残った教え子と立て直す
        addRep(s, -8); s.money = Math.round(s.money * 0.6);
        chronicle(s, '学校防衛戦に敗れ、校舎が焼かれた', 'school');
        lines.push('校舎が焼かれた……（お金−40%、評判−8）');
        s.pending.push({ type: 'scene', title: '焼け跡から', lines: [
          { by: 'narr', text: '夜が明けると、校舎の半分は黒い柱だけになっていた。' },
          { by: 'narr', text: '教え子たちは、だれに言われるでもなく、焼け残った机を運び出しはじめた。' },
          { by: 'narr', text: `「先生、授業は外でもできますよ」——${Object.values(s.students).find((x) => x.status === 'enrolled')?.given ?? '教え子'}が笑った。学校は、まだ終わらない。` },
        ] });
      }
    } else if (q.real) {
      if (win) {
        const bg = BACKGROUNDS.find((x) => x.id === s.instructor.background);
        const reward = Math.round(q.reward * (bg?.realRewardMul ?? 1));
        const before = s.money; addMoney(s, reward);
        const rep = q.small ? 1 : B.reputation.questWinByDanger[q.danger] ?? 1;
        addRep(s, rep);
        lines.push(`報酬 ${s.money - before}G、評判+${rep}`);
        if (!q.small) { seedHelp(s, q.clientCountry); lines.push(...questWorldEffect(s, q.clientCountry, q.enemyCountry, true)); }
        const rg = questRegionResult(s, q, true, r); if (rg) lines.push(rg);
      } else { const lose = B.reputation.questLose; addRep(s, lose); lines.push(`依頼は失敗。評判${lose}`); const rg = questRegionResult(s, q, false, r); if (rg) lines.push(rg); }
    }
  }
  // 先生が倒れた：負け（宿敵戦では、さらわれる危険も＝⑧）
  const t = b.units.find((u) => u.teacher);
  if (t && !t.alive) lines.push(`${s.instructor.name}先生が倒れ、教え子たちに担がれて退いた`);
  // 宿敵の記憶・教え子の因縁・教訓・心
  const findings: BattleFinding[] = afterTactics(s, b, r, lines);
  for (const g of growth) {
    const st = s.students[g.id];
    if (st && g.lv1 > g.lv0) findings.push({ id: st.id, icon: 'star', text: `${st.given}　Lv${g.lv0} → Lv${g.lv1}` });
  }
  // 出撃しなかった子も、勝った知らせで少し心が動く
  for (const st of Object.values(s.students)) if (st.status === 'enrolled' && !b.units.some((u) => u.studentId === st.id)) moveMind(st, 'fight', win ? 1 : 0);
  const mvp = [...evals].sort((a, c) => 'SABC'.indexOf(a.grade) - 'SABC'.indexOf(c.grade) || c.rec.dealt - a.rec.dealt)[0]?.id;
  const report: BattleReport = {
    lines, grades, win, growth, mvp, title: b.title, findings, officerId: b.units.find((u) => u.boss)?.officerId,
    loot: loot.length ? loot : undefined, evals, scenes: b.scenes.slice(-8), nemesisId: b.nemesisId, auto: b.auto,
    fallen: [...dead.map((x) => ({ id: x.st.id, outcome: 'dead' as const })), ...injured.map((x) => ({ id: x.st.id, outcome: 'injured' as const }))],
  };
  return { report, dead, injured };
}
