// 自動の戦闘（5夜目）：出撃前の画面と、場面をタップで送る画面
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { act, useStore } from './store';
import { Sheet, HelpTip } from './common';
import { Portrait, OfficerFace } from './Portrait';
import { Icon } from './icons';
import { sfx } from './sound';
import { countryColor, Chip, Num, LvBadge, NameLine, ClassName, classIcon, OBJECTIVE_ICON, WEATHER_ICON, Stars } from './cards';
import type { GameState, Quest, Student, SquadPlan } from '../core/state';
import { STRATS, MAP_TAGS, TAG_NAMES, ROW_NAMES, type StratId } from '../data/stratagems';
import { knownStrats, stratSlots, stratOdds, oddsLabel, captainScore, plannerScore, stratOf, defaultCaptain, defaultPlanner, defaultRow } from '../core/stratagems';
import { effectiveStats } from '../core/game';
import type { Deploy } from '../core/battle/setup';
import { enrolled, available } from '../core/game';
import { deployFor, canEquip } from '../core/autoplay';
import { battleCtx, finishBattle, moreEscorted, squadAway } from '../core/flow';
import { previewBattle, enemyIntel, estimateWin, recommendDeploy, defaultRole, roleFit, tacticFits, chooseAuto, skipAuto, scoutQuest, defaultPlan, recommendStrats, type AutoPlan, type LeaderInfo } from '../core/battle/auto';
import { battleItems, hpAt, isGrunt, type BItem, type AtkLog } from '../core/battle/blog';
import { FX, MAGIC_COLOR, CRIT_SAY, LEADER_CRIT_SAY, FALL_TEXT, WEAPON_SFX, type FxLevel } from '../data/battlefx';
import type { BLog, BattleState } from '../core/battle/types';
import { STRIKE_VERB, ATTACK_SHOUT } from '../data/autobattle_text';
import { COUNTRY_SHORT } from '../data/people';
import { officerById, rivalryOf, stageName, isScout, factionName, rankName, officerName } from '../core/officers';
import { OFFICER_TRAITS, FACTION_COLOR } from '../data/officers';
import { SCAR_TEXT, SCOUT_TEXT } from '../data/officers_text';
import { MONTH_NAMES } from '../core/util';
import { TACTICS, TACTIC_OPTIONS, ROLES, ROLE_IDS, LEADER_NAMES, AUTO, type TacticId, type RoleId } from '../data/autobattle';
import { OBJECTIVE_NAMES, WEATHER_NAMES } from '../core/quests';
import { MAPS } from '../data/maps';
import { WEAPONS } from '../data/weapons';
import { CLASSES } from '../data/classes';
import { B, RANK_POINTS } from '../data/balance';
import { rankOf } from '../core/util';
import { usableSpells } from '../core/spells';
import { armoryItem, armoryName, isStock, stockList } from '../core/loot';

const FIT_MARK = ['△', '○', '◎'];
const SQUAD_LABEL = ['第一部隊', '第二部隊', '第三部隊'];

// ================= 出撃前（9夜目：部隊ごとの編成。策・部隊長・陣形） =================
/** 部隊の下書き（出撃前の画面で決めるもの） */
export interface SquadDraft {
  questId: string;
  deploy: Deploy[];
  tactic: TacticId;
  roleOver: Record<string, RoleId>;
  rows: Record<string, 'front' | 'back'>;
  strats: StratId[];
  captain?: string; planner?: string;
  manual: boolean;
  /** 教官が同行しない（10夜目。undefined＝2つ目からは同行しない） */
  away?: boolean;
}
export function draftFromSquad(s: GameState, sq: SquadPlan): SquadDraft {
  return { questId: sq.questId, deploy: sq.deploy, tactic: sq.plan.tactic, roleOver: {}, rows: { ...(sq.plan.rows ?? {}) }, strats: [...(sq.plan.strats ?? [])], captain: sq.plan.captain, planner: sq.plan.planner, manual: !!sq.manual, away: sq.away };
}
export function newDraft(s: GameState, q: Quest, limit: number, exclude?: Set<string>, usedArms?: Set<string>): SquadDraft {
  const deploy = recommendDeploy(s, q, limit, (ids) => deployFor(s, ids, usedArms ? new Set(usedArms) : undefined), exclude);
  return draftFromSquad(s, { questId: q.id, deploy, plan: defaultPlan(s, q, deploy), manual: s.settings.manualBattle });
}
/** 下書き→計画（役割・前列後列・部隊長・策を立てる子が空いていれば自動で） */
export function planOf(s: GameState, d: SquadDraft): AutoPlan {
  const ids = d.deploy.map((x) => x.studentId);
  const roles: Record<string, RoleId> = {};
  const rows: Record<string, 'front' | 'back'> = {};
  for (const id of ids) { roles[id] = d.roleOver[id] ?? defaultRole(s.students[id].classId, s.students[id]); rows[id] = d.rows[id] ?? defaultRow(roles[id]); }
  const captain = d.captain && ids.includes(d.captain) ? d.captain : defaultCaptain(s, ids);
  const planner = d.planner && ids.includes(d.planner) ? d.planner : defaultPlanner(s, ids);
  return { tactic: d.tactic, roles, rows, captain, planner, strats: d.strats.slice(0, stratSlots(s)) };
}
export function squadOf(s: GameState, d: SquadDraft): SquadPlan { return { questId: d.questId, deploy: d.deploy, plan: planOf(s, d), manual: d.manual || undefined, away: d.away }; }

export function SquadEditor({ s, draft, setDraft, limit, exclude, usedArms, quests, onBack, onGo, goLabel, squadNo }: {
  s: GameState; draft: SquadDraft; setDraft: (d: SquadDraft) => void; limit: number;
  /** ほかの部隊に入っている子・武器 */
  exclude: Set<string>; usedArms: Set<string>;
  /** 選べる依頼（ほかの部隊が選んでいないもの） */
  quests: Quest[];
  onBack?: () => void; onGo: () => void; goLabel: string; squadNo?: number;
}) {
  const q = s.quests.find((x) => x.id === draft.questId)!;
  const lim = limit - (q.scouted && !q.scoutFree ? 1 : 0);
  const deploy = draft.deploy;
  const setDeploy = (d: Deploy[]) => setDraft({ ...draft, deploy: d.slice(0, Math.max(1, lim)) });
  const [scoutMsg, setScoutMsg] = useState<string | null>(null);
  const [est, setEst] = useState<{ key: string; label: string } | null>(null);
  const [gearOpen, setGearOpen] = useState<string | null>(null);
  const ids = deploy.map((d) => d.studentId);
  const plan = planOf(s, draft);
  const roles = plan.roles;
  const key = `${q.id}|${ids.join(',')}|${deploy.map((d) => d.armoryUid).join(',')}|${plan.tactic}|${ids.map((i) => roles[i] + plan.rows![i]).join(',')}|${q.scouted ? 1 : 0}|${(plan.strats ?? []).join(',')}|${plan.captain}|${plan.planner}`;
  const preview = useMemo(() => previewBattle(s, q, deploy.length ? deploy : deployFor(s, enrolled(s).filter(available).filter((x) => !exclude.has(x.id)).slice(0, 1).map((x) => x.id)), plan), [key]);
  const intel = enemyIntel(s, preview);
  // 勝ち目：少し待ってから裏で試しに戦わせる
  useEffect(() => {
    if (!deploy.length) { setEst({ key, label: '—' }); return; }
    const tm = setTimeout(() => setEst({ key, label: estimateWin(s, q, deploy, plan, battleCtx(s)).label }), 350);
    return () => clearTimeout(tm);
  }, [key]);
  const avail = enrolled(s).filter(available).filter((x) => !exclude.has(x.id)).sort((x, y) => Number(ids.includes(y.id)) - Number(ids.includes(x.id)) || y.level - x.level);
  const toggle = (st: Student) => {
    sfx('move');
    if (ids.includes(st.id)) setDeploy(deploy.filter((d) => d.studentId !== st.id));
    else if (deploy.length < lim) setDeploy(deployFor(s, [...ids, st.id], new Set(usedArms)).map((d) => deploy.find((x) => x.studentId === d.studentId) ?? d));
  };
  const usedHere = new Set([...usedArms, ...deploy.flatMap((x) => [x.armoryUid, x.staffUid]).filter(Boolean) as string[]]);
  const L = intel.leader;
  const mapName = MAPS[q.template]?.name ?? '';
  const o = officerById(s, preview.auto?.leader?.officerId);
  const members = ids.map((id) => s.students[id]);
  const slots = stratSlots(s);
  const known = knownStrats(s);
  const odds = (id: StratId) => stratOdds(id, { q, planner: plan.planner ? s.students[plan.planner] : null, captain: plan.captain ? s.students[plan.captain] : null, members, traits: o?.knownTraits ?? [], known: o?.knownTraits ?? [] });
  const toggleStrat = (id: StratId) => {
    sfx('move');
    const on = draft.strats.includes(id);
    if (on) setDraft({ ...draft, strats: draft.strats.filter((x) => x !== id) });
    else setDraft({ ...draft, strats: [...draft.strats, id].slice(-slots) });
  };
  return (
    <Sheet title={squadNo !== undefined ? `第${squadNo + 1}部隊：${q.title}` : `出撃前：${q.title}`} onClose={onBack}>
      {quests.length > 1 && (
        <div class="sq-quests">
          {quests.map((x) => <button class={`sq-q${x.id === q.id ? ' on' : ''}`} onClick={() => { if (x.id === q.id) return; sfx('move'); setDraft({ ...draft, questId: x.id, strats: recommendStrats(s, x, ids, plan.planner, plan.captain) }); }}><b>{x.title}</b><small>{x.real ? `実戦・危険度${'★'.repeat(x.danger)}` : x.kind === 'exhibition' ? '演武会' : '演習'}</small></button>)}
        </div>
      )}
      <div class="pcard" style={{ ['--band' as string]: q.clientCountry ? countryColor(q.clientCountry) : 'var(--main)' }}>
        <div class="infogrid">
          <div><Icon name={OBJECTIVE_ICON[q.objective]} size={17} />{OBJECTIVE_NAMES[q.objective]}</div>
          <div><Icon name={WEATHER_ICON[q.weather]} size={17} />{WEATHER_NAMES[q.weather]}・{mapName}</div>
          <div>危険度 <Stars n={q.danger} /></div>
          <div class={q.real ? '' : 'muted'}>{q.real ? <><Icon name="skull" size={17} />戦死あり</> : '誰も死なない'}</div>
        </div>
        <div class="small muted">地形：{(MAP_TAGS[q.template] ?? []).map((x) => TAG_NAMES[x]).join('・')}{q.weather === 'rain' ? '　雨：移動しにくく、銃は使えない。火計は不発' : q.weather === 'fog' ? '　霧：弓・魔法・銃が届きにくい。夜襲が効く' : ''}</div>
      </div>

      <h3>敵の情報</h3>
      <div class="pcard ab-intel" style={{ ['--band' as string]: q.enemyCountry ? countryColor(q.enemyCountry) : '#7a6a55' }}>
        {L ? <LeaderIntel s={s} q={q} leader={preview.auto?.leader ?? null} intel={L} ids={ids} onScout={(free) => {
          sfx('ok');
          let got: string | null = null;
          act((g) => { got = scoutQuest(g, q.id, free); });
          const ln = preview.auto?.leader?.name ?? '';
          setScoutMsg(got ? fill(SCOUT_TEXT.done, { leader: ln, trait: OFFICER_TRAITS[got].name, tip: OFFICER_TRAITS[got].tip }) : fill(SCOUT_TEXT.none, { leader: ln }));
          if (!free && deploy.length >= lim) setDraft({ ...draft, deploy: deploy.slice(0, Math.max(1, lim - 1)) });
        }} scoutMsg={scoutMsg} /> : <div class="row nowrap gap6"><Icon name={classIcon(preview.units.find((u) => u.side === 'enemy')?.classId ?? 'fighter')} size={28} /><span class="muted">{q.real ? '敵将の名は分からない' : '演習の相手'}</span></div>}
        <div class="row gap4" style={{ marginTop: 6 }}>
          <span class="small">敵 <Num v={intel.count} unit="人" /></span>
          {intel.types.map((x) => <Chip>{x.name}×{x.n}</Chip>)}
        </div>
        <div class={`small ab-match ${intel.matchup >= 0.8 ? 'good' : intel.matchup <= -0.8 ? 'bad' : ''}`}>{intel.matchText}</div>
        {intel.alumni && s.students[intel.alumni] && <div class="small" style={{ color: 'var(--accent)' }}>敵の中に、教え子の{s.students[intel.alumni].given}の姿があるらしい</div>}
      </div>

      <div class="row between nowrap" style={{ marginTop: 10 }}>
        <h3 style={{ margin: 0 }}>出撃メンバー <span class="muted small">{deploy.length}／{lim}人</span></h3>
        <button class="btn small" onClick={() => { sfx('ok'); const d = recommendDeploy(s, q, lim, (x) => deployFor(s, x, new Set(usedArms)), exclude); setDraft({ ...draft, deploy: d, roleOver: {}, rows: {}, captain: undefined, planner: undefined }); }}>おすすめの編成</button>
      </div>
      {exclude.size > 0 && <div class="small muted">ほかの部隊に入っている子は出ていません</div>}
      <div class="ab-members">
        {avail.map((st) => {
          const on = ids.includes(st.id);
          return (
            <button class={`ab-mem${on ? ' on' : ''}`} onClick={() => toggle(st)}>
              <Portrait st={st} size={52} frame={countryColor(st.origin)} />
              <span class="ab-lv"><LvBadge lv={st.level} /></span>
              <span class="ab-name">{st.given}</span>
              <span class="ab-cls">{CLASSES[st.classId]?.name}</span>
              {on && <span class="ab-check">✓</span>}
              {on && plan.captain === st.id && <span class="ab-capt">長</span>}
            </button>
          );
        })}
      </div>

      {deploy.length > 0 && (
        <div class="sq-leads">
          <label class="sq-lead"><span><Icon name="flag" size={15} /> 部隊長 <HelpTip text="部隊長の統率が高いと、部隊の命中と回避が少し上がります。先生が同行しない部隊では、ここぞの判断も部隊長がします（統率と軍略が高いほど、よい判断になりやすい）。統率は「指揮の演習」「行軍」の授業や、部隊長を務めた戦いで伸びます。" /></span>
            <select value={plan.captain ?? ''} onChange={(e) => setDraft({ ...draft, captain: (e.target as HTMLSelectElement).value || undefined })}>
              {[...members].sort((a, c) => captainScore(c) - captainScore(a)).map((st, i) => <option value={st.id}>{st.given}　統率{rankOf(st.skills.command ?? 0)}{i === 0 ? '（おすすめ）' : ''}</option>)}
            </select>
          </label>
          {plan.captain && s.students[plan.captain] && <div class="small sq-leadnote">{s.students[plan.captain].given}　統率{rankOf(s.students[plan.captain].skills.command ?? 0)}　{captainNote(s.students[plan.captain])}</div>}
          <label class="sq-lead"><span><Icon name="scroll" size={15} /> 策を立てる子 <HelpTip text="策を立てる子の軍略が高いと、策が決まりやすくなります。新しい策を思いつくこともあります。軍略は「戦術論」「兵法の歴史」の授業や、策を立てた戦いで伸びます。" /></span>
            <select value={plan.planner ?? ''} onChange={(e) => setDraft({ ...draft, planner: (e.target as HTMLSelectElement).value || undefined })}>
              {[...members].sort((a, c) => plannerScore(c) - plannerScore(a)).map((st, i) => <option value={st.id}>{st.given}　軍略{rankOf(st.skills.tactics ?? 0)}{i === 0 ? '（おすすめ）' : ''}</option>)}
            </select>
          </label>
          {plan.planner && s.students[plan.planner] && <div class="small sq-leadnote">{s.students[plan.planner].given}　軍略{rankOf(s.students[plan.planner].skills.tactics ?? 0)}　{plannerNote(s.students[plan.planner])}</div>}
        </div>
      )}

      <h3>作戦の方針</h3>
      <div class="ab-tactics">
        {TACTIC_OPTIONS[q.objective].map((id) => {
          const tc = TACTICS[id];
          return (
            <button class={`ab-tac${draft.tactic === id ? ' on' : ''}`} onClick={() => { sfx('move'); setDraft({ ...draft, tactic: id }); }}>
              <b>{tc.name}</b>{tacticFits(id, q) && <span class="ab-fit">この依頼に合う</span>}
              <span class="small">{tc.desc}</span>
            </button>
          );
        })}
      </div>

      <h3>策 <span class="muted small">{draft.strats.length}／{slots}枚まで選べます（知っている策 {known.length}種）</span></h3>
      <div class="st-cards">
        {known.map((id) => {
          const d = STRATS[id];
          const od = odds(id);
          const on = draft.strats.includes(id);
          const hot = od.weak || (!od.dud && od.bad.length === 0 && od.good.length >= 1 && od.rate >= 60);
          return (
            <button class={`st-card${on ? ' on' : ''}${od.dud ? ' dud' : ''}${hot ? ' hot' : ''}`} onClick={() => toggleStrat(id)}>
              <span class="st-mark">{d.mark}</span>
              <span class="st-body">
                <b>{d.name}</b><small class="st-when">{d.when === 'open' ? '開戦で' : 'ぶつかり合いのあと'}</small>
                <span class="st-odds">見込み <b>{od.dud ? '不発' : `${oddsLabel(od.rate)}`}</b>{!od.dud && <small>（{od.rate}%）</small>}</span>
                {od.good.length > 0 && <span class="st-good">○ {od.good.join('・')}</span>}
                {od.bad.length > 0 && <span class="st-bad">× {od.bad.join('・')}</span>}
                {hot && <span class="st-hint">✦ この策が効きそう</span>}
              </span>
              {on && <span class="st-check">✓</span>}
            </button>
          );
        })}
      </div>
      {draft.strats.length > 0 && <div class="small muted">{draft.strats.map((id) => `${STRATS[id].name}：${STRATS[id].desc}`).join('　／　')}</div>}

      <h3>役割と陣形 <span class="muted small">役割は兵種から自動（◎向いている ○ふつう △向かない）。前列は狙われやすく、後列は守られる</span></h3>
      {deploy.map((d) => {
        const st = s.students[d.studentId];
        const role = roles[st.id];
        const row = plan.rows![st.id];
        const arms = [...s.armory, ...stockList(s)].filter((a) => canEquip(st, a.weaponId) && WEAPONS[a.weaponId].type !== 'staff' && (isStock(a.uid) || !usedHere.has(a.uid) || d.armoryUid === a.uid));
        const spells = usableSpells(st).map((id) => WEAPONS[id]?.name).filter(Boolean);
        return (
          <div class="ab-role">
            <div class="row nowrap gap6">
              <Portrait st={st} size={36} />
              <div class="grow" style={{ minWidth: 0 }}>
                <NameLine st={st} size={15} family={false} />
                <div class="small row nowrap gap4"><ClassName classId={st.classId} size={12} /><span class={`ab-weapon ${!d.armoryUid && !spells.length ? 'none' : 'muted'}`} onClick={() => setGearOpen(gearOpen === st.id ? null : st.id)}>{d.armoryUid ? armoryName(armoryItem(s, d.armoryUid)) : spells[0] ?? '武器なし'} ▾</span></div>
              </div>
              <button class={`sq-row ${row}`} onClick={() => { sfx('move'); setDraft({ ...draft, rows: { ...draft.rows, [st.id]: row === 'front' ? 'back' : 'front' } }); }}>{ROW_NAMES[row]}</button>
            </div>
            <div class="seg ab-roleseg">
              {ROLE_IDS.map((r) => <button class={role === r ? 'on' : ''} onClick={() => { sfx('move'); const nr = { ...draft.rows }; delete nr[st.id]; setDraft({ ...draft, roleOver: { ...draft.roleOver, [st.id]: r }, rows: nr }); }}>{ROLES[r].name}<small>{FIT_MARK[roleFit(st.classId, r)]}</small></button>)}
            </div>
            {gearOpen === st.id && (
              <div class="row ruled">
                <select value={d.armoryUid ?? ''} onChange={(e) => setDeploy(deploy.map((x) => x.studentId === st.id ? { ...x, armoryUid: (e.target as HTMLSelectElement).value || null } : x))}>
                  <option value="">武器なし</option>
                  {arms.map((a) => <option value={a.uid}>{armoryName(a)}{isStock(a.uid) ? '（学校の備え）' : a.engraved ? `（${a.engraved}の遺品）` : a.named ? '（銘入り）' : ''}</option>)}
                </select>
                <select value={d.item ?? ''} onChange={(e) => setDeploy(deploy.map((x) => x.studentId === st.id ? { ...x, item: ((e.target as HTMLSelectElement).value || null) as Deploy['item'] } : x))}>
                  <option value="">道具なし</option>
                  <option value="vulnerary" disabled={s.items.vulnerary <= deploy.filter((x) => x.studentId !== st.id && x.item === 'vulnerary').length}>傷薬（残{s.items.vulnerary}）</option>
                  <option value="elixir" disabled={s.items.elixir <= deploy.filter((x) => x.studentId !== st.id && x.item === 'elixir').length}>特効薬（残{s.items.elixir}）</option>
                </select>
                {spells.length > 0 && <div class="small muted" style={{ width: '100%' }}><Icon name="tome" size={14} /> 使える魔法：{spells.join('・')}</div>}
              </div>
            )}
          </div>
        );
      })}

      <div class="ab-odds">
        <span>勝ち目の目安</span>
        <b class={`ab-oddsv ${est?.key === key ? ({ 優勢: 'good', 五分: 'even', 苦しい: 'bad' } as Record<string, string>)[est.label] ?? '' : ''}`}>{est?.key === key ? est.label : '…'}</b>
      </div>
      <label class="row nowrap gap6 ab-manual"><input type="checkbox" checked={draft.manual} onChange={(e) => setDraft({ ...draft, manual: (e.target as HTMLInputElement).checked })} />この戦いは自分で指揮する（マスを動かす戦闘。策・陣形は使えません）</label>
      <button class="btn accent block" disabled={!deploy.length} onClick={() => { sfx('ok'); onGo(); }}>{goLabel}</button>
    </Sheet>
  );
}

function fill(t: string, v: Record<string, string>): string { return t.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m); }
/** 部隊長・策を立てる子のひとこと（10夜目：技能ランクで） */
function captainNote(st: Student): string { const p = st.skills.command ?? 0; return p >= RANK_POINTS.B ? '部隊の命中・回避がよく上がる' : p >= RANK_POINTS.D ? '部隊の命中・回避が少し上がる' : 'まだ部隊をまとめるのは不慣れ'; }
function plannerNote(st: Student): string { const p = st.skills.tactics ?? 0; return p >= RANK_POINTS.B ? '策がとても決まりやすい' : p >= RANK_POINTS.D ? '策が決まりやすい' : 'まだ策を立てるのは不慣れ'; }
function leaderFace(L: LeaderInfo | null) { return L ? { faceImage: L.faceImage, face: L.face, scars: L.scars, alumniId: L.alumniId } : null; }

/** 出撃前：敵将の情報（名簿の敵将なら、分かっている特徴・因縁・偵察） */
function LeaderIntel({ s, q, leader, intel, ids, onScout, scoutMsg }: { s: GameState; q: Quest; leader: LeaderInfo | null; intel: NonNullable<ReturnType<typeof enemyIntel>['leader']>; ids: string[]; onScout: (free: boolean) => void; scoutMsg: string | null }) {
  const o = officerById(s, leader?.officerId);
  const color = o ? FACTION_COLOR[o.faction] : 'var(--accent)';
  const last = o?.meets[o.meets.length - 1];
  const scouts = ids.map((id) => s.students[id]).filter((st) => st && isScout(st.classId));
  const rivals = o ? Object.values(s.students).filter((st) => st.status === 'enrolled').map((st) => ({ st, rv: rivalryOf(s, st.id, o.id) })).filter((x) => x.rv && !x.rv.settled && (x.rv.stage >= 1 || x.rv.vow)) : [];
  const grudge = o?.grudge && s.students[o.grudge]?.status === 'enrolled' ? s.students[o.grudge] : null;
  return (
    <div>
      <div class="row nowrap gap8">
        <OfficerFace o={leader ? { ...leaderFace(leader)!, scars: o?.scars ?? leader.scars } : null} size={64} frame={color} s={s} />
        <div class="grow" style={{ minWidth: 0 }}>
          <div class="row nowrap gap6"><b class="serif ofc-name">{intel.name}</b>{intel.again && <Chip tone="red">因縁</Chip>}{o?.alumniId && <Chip tone="gold">教え子</Chip>}</div>
          {o && o.kind !== 'monster' && <div class="small">{factionName(o.faction)}・{rankName(o)}</div>}
          <div class="small">兵種：{intel.className}・<LvBadge lv={intel.level} />　性格：{LEADER_NAMES[intel.personality]}</div>
          {o && o.scars > 0 && <div class="small muted">{SCAR_TEXT[Math.min(4, o.scars)]}</div>}
        </div>
      </div>
      {o && o.kind !== 'monster' && (
        <div class="ofc-traits">
          <span class="small muted">特徴</span>
          {o.traits.map((t) => o.knownTraits.includes(t) ? <span class={`ofc-trait ${OFFICER_TRAITS[t].weak ? 'weak' : 'strong'}`}>{OFFICER_TRAITS[t].weak ? '弱点' : '強み'}：{OFFICER_TRAITS[t].name}</span> : <span class="ofc-trait unknown">？</span>)}
        </div>
      )}
      {o && o.knownTraits.map((t) => <div class={`small ofc-tip${OFFICER_TRAITS[t].weak ? '' : ' strong'}`}>・{OFFICER_TRAITS[t].name}：{OFFICER_TRAITS[t].tip}</div>)}
      {last && <div class="small muted">前に会ったのは {last.year}年目 {MONTH_NAMES[last.month]}「{last.title}」（{MEET_SHORT[last.result] ?? ''}）。会うのは{o!.meets.length + 1}回目</div>}
      {grudge && <div class="small ofc-warn"><Icon name="target" size={14} /> {intel.name}は{grudge.given}をつけ狙っている</div>}
      {rivals.length > 0 && <div class="row gap4" style={{ marginTop: 4 }}>{rivals.map(({ st, rv }) => <span class="ofc-rival"><Portrait st={st} size={22} />{st.given}：{rv!.vow ? '仇討ちの誓い' : stageName(rv!.stage)}</span>)}</div>}
      {o && o.kind !== 'monster' && o.traits.some((t) => !o.knownTraits.includes(t)) && !q.scouted && (
        <div class="ofc-scout">
          {scouts.length
            ? <button class="btn small" onClick={() => onScout(true)}><Icon name="scout" size={16} /> {SCOUT_TEXT.button}<span class="small muted">　{fill(SCOUT_TEXT.scoutNote, { a: scouts[0].given })}</span></button>
            : <button class="btn small" onClick={() => onScout(false)}><Icon name="scout" size={16} /> {SCOUT_TEXT.button}<span class="small muted">　{SCOUT_TEXT.note}</span></button>}
        </div>
      )}
      {scoutMsg && <div class="small ofc-report"><Icon name="scout" size={14} /> {scoutMsg}</div>}
      {q.scouted && !scoutMsg && <div class="small muted">偵察済み{q.scoutFree ? '' : '（出撃は1人少なくなります）'}</div>}
    </div>
  );
}
const MEET_SHORT: Record<string, string> = { win: '取り逃がした', lose: '敗れた', fled: '取り逃がした', fell: '討ち取った', spared: '見逃した', persuaded: '説き伏せた', yielded: '一騎打ちで破った' };

// ================= 場面 =================
function Gauge2({ m }: { m: number }) {
  const p = Math.round(m * 100);
  return (
    <div class="ab-mom">
      <span class="ab-momlabel">味方</span>
      <div class="ab-mombar"><span class="ally" style={{ width: `${p}%` }} /><span class="enemy" style={{ width: `${100 - p}%` }} /></div>
      <span class="ab-momlabel">敵</span>
    </div>
  );
}

// ================= 戦いの記録（7夜目） =================
const GRUNT_MARK: Record<string, string> = { sword: '剣', lance: '槍', axe: '斧', bow: '弓', magic: '魔', holy: '聖', staff: '杖', gun: '銃' };
type Speed = 'tap' | 'normal' | 'fast';

/** 戦いの画面（10夜目）：ターン制のRPGのような1枚の画面。上に敵、まんなかに今戦っている2人、下に文の窓、いちばん下に味方。ここぞの判断は途中で止まる */
export function AutoBattleView() {
  const { s } = useStore();
  const b = s?.battle;
  const a = b?.auto;
  const items = useMemo(() => (b ? battleItems(b) : []), [a?.scenes.length, b?.units.length]);
  // 再開したときは、見終わった場面のあとから
  const startPos = useMemo(() => { if (!a) return 0; const i = items.findIndex((x) => (x.k === 'band' || x.k === 'title' || x.k === 'sync') && x.scene >= (a.shown ?? 0)); return a.shown ? (i < 0 ? items.length : i) : 0; }, []);
  const [pos, setPos] = useState(startPos);
  const [speed, setSpeed0] = useState<Speed>(s?.settings.battleLog ?? 'tap');
  const setSpeed = (v: Speed) => { setSpeed0(v); act((g) => { g.settings.battleLog = v; }); };
  const [logOpen, setLogOpen] = useState(false);
  const fxLevel: FxLevel = s?.settings.battleFx ?? 'big';
  // 大きな演出（必殺・撃破・倒れた子・宿命の対決・策の発動）。出ている間は止め、タップで早送り
  const [fxq, setFxq] = useState<FxShow[]>([]);
  const fxNow = fxq[0] ?? null;
  const dismissFx = () => setFxq((q) => q.slice(1));
  const duelShown = useRef<string>('');
  const total = items.length;
  const atLogEnd = pos >= total;
  const atChoice = !!a?.choice && atLogEnd;
  const atEnd = !!a && a.seg >= 3 && atLogEnd && !a.choice;
  const fit = useMemo(() => { const sec = items.reduce((t, x) => t + (x.k === 'band' ? AUTO.log.band : x.k === 'turn' || x.k === 'title' ? AUTO.log.turn : x.k === 'sync' ? 0 : AUTO.log.card), 0) / 1000; return sec > AUTO.log.maxSec ? AUTO.log.maxSec / sec : 1; }, [total]);
  const effect = (it: (typeof items)[number]) => {
    if (it.k === 'sync') act((g) => { if (g.battle?.auto) g.battle.auto.shown = Math.max(g.battle.auto.shown, it.scene + 1); });
    if (it.k === 'atk') {
      if (!it.e.hit) sfx('miss');
      else if (fxLevel === 'low') sfx(it.e.crit ? 'crit' : 'hit');
      else sfx(WEAPON_SFX[(it.e.w && WEAPONS[it.e.w]?.type) || ''] ?? 'hit');
      const add = s && b ? fxFor(s, b, it.e, fxLevel) : [];
      if (add.length) setFxq((q) => [...q, ...add]);
    }
    if (it.k === 'band' && (it.line.by === 'strat' || it.line.by === 'stratng') && fxLevel !== 'low' && it.line.by === 'strat') setFxq((q) => [...q, { k: 'strat', text: it.line.text }]);
    if (it.k === 'heal' && fxLevel !== 'low') sfx('heal');
  };
  /** タップで1文ずつ。区切り（ターン・場面の見出し）は次の文といっしょに出す */
  const tapNext = () => {
    if (fxNow) { dismissFx(); return; }
    if (atLogEnd) return;
    let p = pos;
    while (p < total) {
      const it = items[p];
      effect(it);
      p += 1;
      if (it.k !== 'sync' && it.k !== 'turn' && it.k !== 'title') break;
    }
    setPos(p);
  };
  useEffect(() => {
    if (!fxNow) return;
    const base = fxNow.k === 'strat' ? FX.strat : FX[fxNow.k === 'crit' ? 'cutin' : fxNow.k === 'kill' ? 'kill' : fxNow.k === 'fall' ? 'fall' : 'duel'];
    const ms = base * (fxLevel === 'normal' ? FX.normalMul : 1) * (speed === 'fast' ? FX.fastMul : 1) * (speed === 'tap' && fxNow.k === 'duel' ? 3 : 1);
    if (fxNow.k === 'crit') sfx('cutin'); else if (fxNow.k === 'kill') sfx('stamp'); else if (fxNow.k === 'fall') sfx('fall'); else if (fxNow.k === 'strat') sfx('ok'); else sfx('vs');
    const tm = setTimeout(dismissFx, ms);
    return () => clearTimeout(tm);
  }, [fxNow]);
  useEffect(() => {
    const c = a?.choice;
    if (!c || !atChoice || fxLevel === 'low' || !s || !b) return;
    const key = `${a!.scenes.length}|${c.prompt}`;
    if ((c.duo || c.kind === 'duel') && duelShown.current !== key) {
      duelShown.current = key;
      const L = a!.leader;
      const actor = c.actor ?? c.options.find((o) => o.actor)?.actor;
      if (L && actor) setFxq((q) => [...q, { k: 'duel', a: actor, title: c.duo ? '宿命の対決' : '一騎打ち', say: c.prompt.split('\n')[1] ?? '' }]);
    }
  }, [atChoice, a?.choice?.prompt]);
  useEffect(() => {
    if (speed === 'tap' || atLogEnd || fxNow || logOpen) return;
    const it = items[pos];
    const mul = ({ 1: 1.3, 2: 1, 3: 0.65 } as Record<number, number>)[s?.settings.animSpeed ?? 2] ?? 1;
    const base = it.k === 'band' ? AUTO.log.band : it.k === 'turn' || it.k === 'title' ? AUTO.log.turn : it.k === 'sync' ? 0 : AUTO.log.card;
    const ms = Math.max(0, base * mul * fit * (speed === 'fast' ? AUTO.log.fastMul : 1));
    const t = setTimeout(() => {
      setPos((p) => p + 1);
      effect(it);
    }, ms);
    return () => clearTimeout(t);
  }, [pos, speed, total, fxNow, logOpen]);
  if (!s || !b || !a) return null;
  const nextSquad = !!s.sortie && s.sortie.idx < s.sortie.squads.length - 1 && moreEscorted(s);
  const nextIdx = s.sortie ? s.sortie.squads.findIndex((sq, i) => i > s.sortie!.idx && !squadAway(sq, i)) : -1;
  const leader = a.leader;
  const lo = officerById(s, leader?.officerId);
  const leaderColor = lo ? FACTION_COLOR[lo.faction] : 'var(--accent)';
  const q = s.quests.find((x) => x.id === b.questId);
  const foe = q?.kind === 'monster' ? '魔物' : q?.enemyCountry ? `${COUNTRY_SHORT[q.enemyCountry]}兵` : q && !q.real ? '演習の相手' : '盗賊';
  const grunts = b.units.filter((u) => isGrunt(u, leader?.uid));
  const nameOf = (uid: string): string => {
    const u = b.units.find((x) => x.uid === uid);
    if (!u) return '？';
    if (leader && uid === leader.uid) return leader.name;
    if (u.studentId && s.students[u.studentId]) return s.students[u.studentId].given;
    if (u.side === 'npc') return u.name;
    const i = grunts.indexOf(u);
    return i >= 0 ? `${foe}${String.fromCharCode(65 + (i % 26))}` : u.name;
  };
  const sideOf = (uid: string) => (b.units.find((x) => x.uid === uid)?.side === 'enemy' ? 'foe' : 'ally');
  const Face = ({ uid, size }: { uid: string; size: number }) => {
    const u = b.units.find((x) => x.uid === uid);
    if (!u) return <span class="bl-icon" style={{ width: size, height: size }}>？</span>;
    if (leader && uid === leader.uid) return <OfficerFace o={leaderFace(leader)} size={size} frame={leaderColor} s={s} />;
    if (u.studentId && s.students[u.studentId]) return <Portrait st={s.students[u.studentId]} size={size} frame={u.side === 'enemy' ? 'var(--accent)' : countryColor(s.students[u.studentId].origin)} />;
    const g = a.raised?.find((x) => x.uid === uid);
    if (g) return <OfficerFace o={{ faceImage: g.faceImage, face: g.face, scars: 0 }} size={size} frame="#8f2a20" s={s} />;
    const w = u.weaponId ? WEAPONS[u.weaponId]?.type : undefined;
    return <span class={`bl-icon ${u.side === 'enemy' ? 'foe' : ''}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>{w ? GRUNT_MARK[w] ?? '兵' : '兵'}</span>;
  };
  const { hp, gone } = hpAt(b, items, pos);
  const allies = b.units.filter((u) => (u.side === 'player' || u.side === 'ally') && (a.hp0?.[u.uid] || hp[u.uid] !== undefined));
  const foes = b.units.filter((u) => u.side === 'enemy' && (a.hp0?.[u.uid] || hp[u.uid] !== undefined)).sort((x, y) => Number(y.uid === leader?.uid || !!y.boss) - Number(x.uid === leader?.uid || !!x.boss));
  const down = (u: { uid: string }) => gone.has(u.uid) || (hp[u.uid] ?? 1) <= 0;
  // 今の文（いちばん新しい項目）と、ターン・場面の見出し
  let cur: BItem | null = null; let turn: Extract<BItem, { k: 'turn' }> | null = null; let title = '';
  for (let i = 0; i < Math.min(pos, total); i++) { const it = items[i]; if (it.k === 'turn') turn = it; else if (it.k === 'title') title = it.text; else if (it.k !== 'sync') cur = it; }
  const shown = items.slice(0, pos).filter((x) => x.k !== 'sync' && x.k !== 'turn' && x.k !== 'title');
  const texts = (it: BItem) => sentences(s, b, it, nameOf, leader);
  const now = cur ? texts(cur) : [{ cls: 'narr', text: `${b.title}。${leader ? `敵将${leader.name}が待ち受けている。` : '戦いが始まる。'}` }];
  const prev = shown.length >= 2 ? texts(shown[shown.length - 2]) : [];
  const windowLines = [...prev.slice(-Math.max(0, 3 - now.length)).map((x) => ({ ...x, old: true })), ...now.map((x) => ({ ...x, old: false }))].slice(-3);
  const act0 = cur && (cur.k === 'atk' || cur.k === 'heal') ? cur.e : null;
  const activeA = act0?.a, activeD = act0?.d;
  const alive = foes.filter((u) => !down(u)).length;
  const fsz = foes.length > 10 ? 34 : foes.length > 6 ? 42 : 52;
  const asz = allies.length > 8 ? 28 : allies.length > 4 ? 34 : 44;
  const wkey = `${pos}`;
  return (
    <div class="ab-view rb-view">
      <div class="rb-top">
        <span class="rb-turn">{turn ? `ターン${turn.turn}・${turn.side === 'player' ? '味方の番' : '敵の番'}` : '開戦'}</span>
        {q && <span class="rb-where small"><Icon name={WEATHER_ICON[q.weather]} size={14} />{MAPS[q.template]?.name ?? ''}・{WEATHER_NAMES[q.weather]}</span>}
        <span class="rb-count small">敵 {alive}／{foes.length}</span>
      </div>
      {s.sortie && s.sortie.squads.length > 1 && <div class="small rb-squad"><b>{SQUAD_LABEL[s.sortie.idx]}</b>（{s.sortie.idx + 1}／{s.sortie.squads.length}）{a.plan?.captain && s.students[a.plan.captain] ? `・部隊長 ${s.students[a.plan.captain].given}` : ''}{title ? `・${title}` : ''}</div>}
      <div class="rb-foes">
        {foes.slice(0, 14).map((u) => {
          const v = hp[u.uid] ?? u.maxHp;
          const L = leader && u.uid === leader.uid;
          return (
            <div class={`rb-foe${down(u) ? ' down' : ''}${u.uid === activeA || u.uid === activeD ? ' on' : ''}${L ? ' lead' : ''}`}>
              <span class="rb-circ"><Face uid={u.uid} size={fsz} /></span>
              <span class="rb-fn">{nameOf(u.uid)}</span>
              <span class="rb-bar"><span style={{ width: `${down(u) ? 0 : Math.max(0, Math.min(100, (v / Math.max(1, u.maxHp)) * 100))}%` }} /></span>
            </div>
          );
        })}
        {foes.length > 14 && <span class="small muted">ほか{foes.length - 14}人</span>}
      </div>
      <div class="rb-stage" onClick={() => { if (speed === 'tap') tapNext(); }}>
        <Stage s={s} b={b} it={cur} key={wkey} Face={Face} nameOf={nameOf} leader={leader} fx={fxLevel} />
      </div>
      <div class="rb-window" onClick={() => { if (speed === 'tap') tapNext(); else setSpeed('tap'); }}>
        {windowLines.map((l) => <div class={`rb-line ${l.cls}${l.old ? ' old' : ''}`}>{l.tag && <span class={`rb-tag ${l.cls}`}>{l.tag}</span>}{l.text}</div>)}
        {!atLogEnd && speed === 'tap' && !fxNow && <span class="rb-tap">▼ タップ</span>}
      </div>
      <div class={`rb-allies${allies.length > 8 ? ' many' : ''}`}>
        {allies.slice(0, 12).map((u) => {
          const v = hp[u.uid] ?? u.maxHp;
          const p = Math.max(0, Math.min(100, (v / Math.max(1, u.maxHp)) * 100));
          return (
            <div class={`rb-ally${down(u) ? ' down' : ''}${u.uid === activeA || u.uid === activeD ? ' on' : ''}`}>
              <Face uid={u.uid} size={asz} />
              <b class="rb-an">{nameOf(u.uid)}</b>
              <span class="rb-hp">{down(u) ? '―' : `${Math.max(0, v)}/${u.maxHp}`}</span>
              <span class="rb-bar ally"><span class={p <= 33 ? 'low' : p <= 60 ? 'mid' : ''} style={{ width: `${down(u) ? 0 : p}%` }} /></span>
              {u.studentId && a.roles?.[u.studentId] && <span class="rb-row">{ROW_NAMES[(rowOf(a, u.studentId))]}</span>}
            </div>
          );
        })}
      </div>
      {atChoice && a.choice && !fxNow && (
        <div class="ab-choice rb-choice">
          <div class={`ab-cprompt${a.choice.duo ? ' duo' : ''}`}><Icon name={a.choice.duo ? 'flame' : a.choice.kind === 'wait' ? 'scroll' : 'bell'} size={18} /> {a.choice.duo ? '宿命の対決' : a.choice.kind === 'wait' ? '策を切る' : 'ここぞの判断'}</div>
          {a.choice.duo && a.choice.actor && s.students[a.choice.actor] && leader && (
            <div class="ab-duo small">
              <span class="ab-duoside"><Portrait st={s.students[a.choice.actor]} size={56} frame={countryColor(s.students[a.choice.actor].origin)} /><b>{s.students[a.choice.actor].given}</b></span>
              <span class="ab-vs">VS</span>
              <span class="ab-duoside"><OfficerFace o={leaderFace(leader)} size={56} frame={leaderColor} s={s} /><b>{leader.name}</b></span>
            </div>
          )}
          <div class="ab-cq">{a.choice.prompt.split('\n').map((x) => <div>{x}</div>)}</div>
          {a.choice.options.map((o, i) => (
            <button class="btn block ab-copt" onClick={() => { sfx('ok'); act((g) => { chooseAuto(g, i, battleCtx(g)); }); }}>
              {o.actor && s.students[o.actor] && <Portrait st={s.students[o.actor]} size={32} />}
              <span class="grow"><b>{o.label}</b><span class="small muted">{o.note}</span></span>
            </button>
          ))}
        </div>
      )}
      {fxNow && <FxOverlay s={s} b={b} fx={fxNow} level={fxLevel} leader={leader} leaderColor={leaderColor} nameOf={nameOf} onTap={dismissFx} />}
      {atEnd && <button class="btn primary block ab-endbtn" onClick={() => { sfx('ok'); act((g) => finishBattle(g)); }}>{nextSquad ? `${SQUAD_LABEL[nextIdx]}の戦いへ` : s.sortie && s.sortie.idx < s.sortie.squads.length - 1 ? 'ほかの部隊の結果を待つ' : '結果を見る'}</button>}
      {!atEnd && !atChoice && (
        <div class="rb-ctrl">
          <button class={`btn${speed === 'tap' ? ' primary' : ''}`} onClick={() => { if (speed === 'tap') tapNext(); else setSpeed('tap'); }}>タップで</button>
          <button class={`btn${speed !== 'tap' ? ' primary' : ''}`} onClick={() => setSpeed(speed === 'normal' ? 'fast' : 'normal')}>{speed === 'fast' ? '自動で（速く）' : '自動で'}</button>
          <button class="btn" onClick={() => { sfx('move'); setLogOpen(true); }}>文を見返す</button>
          <button class="btn" onClick={() => { if (!confirm(`残りの判断はおすすめを選んで、${nextSquad ? 'この部隊の戦いを終えます' : '結果まで進めます'}。よろしいですか？`)) return; sfx('ok'); act((g) => { skipAuto(g, battleCtx(g)); finishBattle(g); }); }}>結果へ</button>
        </div>
      )}
      {logOpen && (
        <Sheet title="これまでの文" onClose={() => setLogOpen(false)}>
          <div class="rb-log">
            {items.slice(0, pos).filter((x) => x.k !== 'sync').map((it) => {
              if (it.k === 'turn') return <div class={`bl-turn ${it.side}`}>ターン{it.turn}・{it.side === 'player' ? '味方の番' : '敵の番'}</div>;
              if (it.k === 'title') return <div class="bl-turn title">― {it.text} ―</div>;
              return <div class="rb-logitem">{texts(it).map((l) => <div class={`rb-line ${l.cls}`}>{l.tag && <span class={`rb-tag ${l.cls}`}>{l.tag}</span>}{l.text}</div>)}</div>;
            })}
          </div>
        </Sheet>
      )}
    </div>
  );
}

function rowOf(a: NonNullable<BattleState['auto']>, id: string): 'front' | 'back' {
  return a.plan?.rows?.[id] ?? defaultRow(a.roles[id]);
}

/** まんなか：いま攻撃している子と受けている子だけを大きく。ふだんの攻撃は揺れと数字だけ */
function Stage({ s, b, it, Face, nameOf, leader, fx }: { s: GameState; b: BattleState; it: BItem | null; Face: (p: { uid: string; size: number }) => preact.JSX.Element; nameOf: (uid: string) => string; leader: LeaderInfo | null; fx: FxLevel }) {
  if (!it) return <div class="rb-empty serif">― {b.title} ―</div>;
  if (it.k === 'atk' || it.k === 'heal') {
    const e = it.e;
    const atk = e.k === 'atk' ? e : null;
    const heal = e.k === 'heal';
    const live = fx !== 'low';
    const du = b.units.find((u) => u.uid === e.d);
    return (
      <>
        <div class="rb-label">{nameOf(e.a)} ▶ {nameOf(e.d)}</div>
        <div class="rb-duo">
          <div class={`rb-card ${sideCls(b, e.a)}`}><Face uid={e.a} size={104} /><b>{nameOf(e.a)}</b></div>
          <span class="rb-arrow">▶</span>
          <div class={`rb-card ${sideCls(b, e.d)}${atk?.hit && live ? ' shake' : ''}${atk?.kill ? ' ko' : ''}`}>
            <Face uid={e.d} size={104} /><b>{nameOf(e.d)}</b>
            {heal ? <span class="rb-num heal">+{(e as { amt: number }).amt}</span> : atk && !atk.hit ? <span class="rb-num miss">MISS</span> : <span class={`rb-num${atk?.crit ? ' crit' : ''}`}>−{atk?.dmg ?? 0}</span>}
            {atk?.kill && du?.side === 'enemy' && live && <span class="fx-ministamp">撃破</span>}
          </div>
        </div>
      </>
    );
  }
  if (it.k === 'group') {
    return (
      <>
        <div class="rb-label">{nameOf(it.names[0]).replace(/[A-Z]$/, '')}たち</div>
        <div class="rb-duo"><div class="rb-card foe"><span class="bl-icon foe" style={{ width: 96, height: 96, fontSize: 30 }}>{it.count}人</span><b>まとめて攻撃</b></div>{it.total > 0 && <span class="rb-num">−{it.total}</span>}</div>
      </>
    );
  }
  if (it.k === 'band') {
    const l = it.line;
    const st = s.students[l.by];
    if (l.by === 'leader' && leader) return <div class="rb-duo"><div class="rb-card foe"><Face uid={leader.uid} size={110} /><b>{leader.name}</b></div></div>;
    if (st) { const u = b.units.find((x) => x.studentId === st.id); return <div class="rb-duo"><div class="rb-card ally">{u ? <Face uid={u.uid} size={110} /> : <Portrait st={st} size={110} />}<b>{st.given}</b></div></div>; }
    if (l.by === 'strat' || l.by === 'stratng') return <div class={`rb-stratmark ${l.by}`}><span class="serif">策</span></div>;
    if (l.by === 'loot') return <div class="rb-lootmark"><Icon name="sword" size={56} /></div>;
    if (l.by.startsWith('raise:')) { const g = b.auto?.raised?.[Number(l.by.slice(6))]; return g ? <div class="rb-duo"><div class="rb-card foe"><OfficerFace o={{ faceImage: g.faceImage, face: g.face, scars: 0 }} size={110} frame="#8f2a20" s={s} /><b>{g.given}</b></div></div> : null; }
    return <div class="rb-empty serif">⚡</div>;
  }
  return null;
}
function sideCls(b: BattleState, uid: string): string { return b.units.find((x) => x.uid === uid)?.side === 'enemy' ? 'foe' : 'ally'; }

/** 文の窓の文（1つの項目を1〜3文に）。cls＝色（strat＝黄・leader＝赤・ally・foe・narr） */
interface WLine { cls: string; text: string; tag?: string }
function sentences(s: GameState, b: BattleState, it: BItem, nameOf: (uid: string) => string, leader: LeaderInfo | null): WLine[] {
  if (it.k === 'band') {
    const l = it.line;
    const st = s.students[l.by];
    if (l.by === 'leader' && leader) return [{ cls: 'leader', text: `${leader.name}「${l.text}」` }];
    if (st) return [{ cls: 'ally', text: `${st.given}「${l.text}」` }];
    if (l.by === 'strat') return [{ cls: 'strat', tag: '策', text: l.text.replace(/^策「[^」]+」：/, '') }];
    if (l.by === 'stratng') return [{ cls: 'stratng', tag: '策', text: l.text.replace(/^策「[^」]+」：/, '') }];
    if (l.by.startsWith('raise:')) return [{ cls: 'leader', text: l.text }];
    if (l.by === 'loot') return [{ cls: 'loot', tag: '戦利品', text: l.text.replace(/^戦利品：/, '') }];
    return [{ cls: 'narr', text: l.text }];
  }
  if (it.k === 'group') {
    const who = nameOf(it.names[0]).replace(/[A-Z]$/, '');
    const out: WLine[] = [{ cls: 'foe', text: `${who}たち${it.count}人が攻めかかる！` }];
    out.push({ cls: 'dmg', text: it.total ? `味方は合わせて${it.total}のダメージを受けた！` : '味方は守りを固めて、しのいだ。' });
    if (it.counter) out.push({ cls: 'ally', text: `こちらも反撃し、合わせて${it.counter}のダメージを返した。` });
    return out;
  }
  if (it.k !== 'atk' && it.k !== 'heal') return [];
  const e = it.e;
  const A = nameOf(e.a), D = nameOf(e.d);
  const w = e.w ? WEAPONS[e.w] : null;
  const side = sideCls(b, e.a) === 'foe' ? 'foe' : 'ally';
  if (e.k === 'heal') return e.a === e.d ? [{ cls: side, text: `${A}は${e.w === 'elixir' ? '特効薬' : '傷薬'}を使った。` }, { cls: 'heal', text: `HPが${e.amt}回復した！` }]
    : [{ cls: side, text: `${A}は${w?.name ?? '杖'}をかざした。` }, { cls: 'heal', text: `${D}のHPが${e.amt}回復した！` }];
  const out: WLine[] = [];
  const head = e.role === 'counter' ? '反撃！ ' : e.role === 'follow' ? '追撃！ ' : e.role === 'duel' ? '一騎打ち！ ' : '';
  const isMagic = w?.type === 'magic' || w?.type === 'holy';
  out.push({ cls: side, text: `${head}${A}の${isMagic ? `${w!.name}！` : '攻撃！'}${e.eff ? '（特効）' : e.tri > 0 ? '（相性がいい）' : e.tri < 0 ? '（相性が悪い）' : ''}` });
  const du = b.units.find((u) => u.uid === e.d);
  if (!e.hit) out.push({ cls: 'narr', text: `${D}はひらりとかわした！` });
  else out.push({ cls: 'dmg', text: `${e.crit ? '必殺の一撃！ ' : ''}${D}に${e.dmg}のダメージ！` });
  if (e.kill) out.push({ cls: du?.side === 'enemy' ? 'narr' : 'down', text: du?.side === 'enemy' ? `${D}を倒した！` : `${D}は倒れた……` });
  else if (e.hit && e.hp1 > 0 && e.hp1 <= e.max * 0.25) out.push({ cls: 'narr', text: `${D}はひざをついた……` });
  return out;
}

function HpRow({ name, v, max, down, ally }: { name: string; v: number; max: number; down: boolean; ally?: boolean }) {
  const p = Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100));
  return (
    <div class={`bl-hprow${down ? ' down' : ''}${ally ? ' ally' : ''}`}>
      <span class="bl-hpn">{name}</span>
      <span class="bl-bar"><span class={p <= 33 ? 'low' : ''} style={{ width: `${down ? 0 : p}%` }} /></span>
    </div>
  );
}

function LogItem({ it, s, nameOf, sideOf, Face, leader, leaderColor, fx, fresh, old, chain }: { it: BItem; s: GameState; nameOf: (uid: string) => string; sideOf: (uid: string) => string; Face: (p: { uid: string; size: number }) => preact.JSX.Element; leader: LeaderInfo | null; leaderColor: string; fx: FxLevel; fresh: boolean; old: boolean; chain: number | null }) {
  if (it.k === 'turn') return <div class={`bl-turn ${it.side}`}>ターン{it.turn}・{it.side === 'player' ? '味方の番' : '敵の番'}</div>;
  if (it.k === 'title') return <div class="bl-turn title">― {it.text} ―</div>;
  if (it.k === 'band') {
    const l = it.line;
    const st = s.students[l.by];
    if (l.by === 'leader' && leader) return <div class="bl-band foe"><span class="bl-bface"><OfficerFace o={leaderFace(leader)} size={30} frame={leaderColor} s={s} /></span><span><b>{leader.name}</b>「{l.text}」</span></div>;
    if (st) return <div class="bl-band"><span class="bl-bface"><Portrait st={st} size={30} /></span><span><b>{st.given}</b>「{l.text}」</span></div>;
    if (l.by === 'strat') return <div class="bl-band strat">✦ {l.text}</div>;
    if (l.by === 'stratng') return <div class="bl-band stratng">✕ {l.text}</div>;
    if (l.by.startsWith('raise:')) return <RaiseBand s={s} l={l} />;
    if (l.by === 'loot') return <div class="bl-band strat">⚔ {l.text}</div>;
    return <div class="bl-band">⚡ {l.text}</div>;
  }
  if (it.k === 'sync') return null;
  if (it.k === 'group') {
    const n = it.count;
    return (
      <div class="bl-card group">
        <div class="bl-row"><span class="bl-icon foe" style={{ width: 40, height: 40 }}>{n}人</span><div class="grow"><b class="foe">{nameOf(it.names[0]).replace(/[A-Z]$/, '')}{n}人の攻撃</b><div class="small">{it.counter ? `こちらの反撃で 合計−${it.counter}` : 'こちらは守りを固めた'}</div></div><span class="bl-dmg">{it.total ? `−${it.total}` : 'MISS'}</span></div>
      </div>
    );
  }
  const e = it.e;
  const heal = e.k === 'heal';
  const atk = e.k === 'atk' ? e : null;
  const wt = e.w ? WEAPONS[e.w]?.type : undefined;
  const live = fresh && fx !== 'low';
  const fxCls = live ? (heal ? 'fx-heal' : atk?.hit ? `fx-hit w-${wt ?? 'none'} c-${(e.w && MAGIC_COLOR[e.w]) || (wt === 'holy' ? 'holy' : wt === 'magic' ? 'fire' : '')}${atk.crit ? ' fx-crit' : ''}` : 'fx-miss') : '';
  const du = s.battle?.units.find((u) => u.uid === e.d);
  const downStudent = !!atk?.kill && du?.side !== 'enemy';
  return (
    <div class={`bl-card ${sideOf(e.a)}${old ? ' old' : ''}${live ? ' fresh' : ''}${downStudent ? ' downed' : ''}`}>
      <div class="bl-row">
        <Face uid={e.a} size={40} />
        <span class="bl-arrow">▶</span>
        <span class={`bl-target ${fxCls}`}><Face uid={e.d} size={40} />{live && <span class="fx-slash" />}{live && heal && <span class="fx-sparks"><i /><i /><i /><i /><i /></span>}{atk?.kill && du?.side === 'enemy' && fx !== 'low' && <span class="fx-ministamp">撃破</span>}</span>
        <div class="grow bl-txt">
          <div class="bl-names"><b class={sideOf(e.a)}>{nameOf(e.a)}</b> → <b class={sideOf(e.d)}>{nameOf(e.d)}</b>
            {atk?.crit && <span class="bl-tag crit">必殺</span>}
            {atk && atk.tri > 0 && <span class="bl-tag good">有利</span>}
            {atk && atk.tri < 0 && <span class="bl-tag bad">不利</span>}
            {atk && !atk.hit && <span class="bl-tag miss">MISS</span>}
          </div>
          <div class="small bl-desc">{describe(s, e, nameOf, leader)}</div>
        </div>
        <span class={`bl-dmg${heal ? ' heal' : atk && !atk.hit ? ' miss' : ''}${live ? ' pop' : ''}${atk?.crit ? ' crit' : ''}`}>
          {chain !== null && atk?.hit && <span class="bl-chain">2連撃！<s>−{chain}</s></span>}
          {heal ? `+${(e as { amt: number }).amt}` : atk && !atk.hit ? 'MISS' : `−${atk?.dmg ?? 0}`}
        </span>
      </div>
      <HitBar e={e} name={nameOf(e.d)} foe={sideOf(e.d) === 'foe'} chips={live && !!atk?.hit} />
    </div>
  );
}

/** 受けた側のHPゲージ：減った分を薄い赤で残し、減っていく */
function HitBar({ e, name, foe, chips }: { e: { hp0: number; hp1: number; max: number }; name: string; foe: boolean; chips?: boolean }) {
  const [go, setGo] = useState(false);
  useEffect(() => { const t = setTimeout(() => setGo(true), 60); return () => clearTimeout(t); }, []);
  const p0 = Math.max(0, Math.min(100, (e.hp0 / Math.max(1, e.max)) * 100));
  const p1 = Math.max(0, Math.min(100, (e.hp1 / Math.max(1, e.max)) * 100));
  return (
    <div class="bl-hit">
      <span class={`small bl-hitn ${foe ? 'foe' : 'ally'}`}>{name}</span>
      <span class="bl-hitbar"><span class="lost" style={{ width: `${Math.max(p0, p1)}%` }} /><span class={`now${p1 <= 33 ? ' low' : ''}`} style={{ width: `${go ? p1 : p0}%` }} />{chips && go && p0 > p1 && <span class="fx-chips" style={{ left: `${p1}%`, width: `${p0 - p1}%` }}><i /><i /><i /><i /></span>}</span>
      <b class="small bl-hitv">{go ? e.hp1 : e.hp0}/{e.max}</b>
    </div>
  );
}

function describe(s: GameState, e: BLog, nameOf: (uid: string) => string, leader: LeaderInfo | null): string {
  const b = s.battle!;
  const w = e.k !== 'turn' && e.w ? WEAPONS[e.w] : null;
  const pick = (list: string[] | undefined, salt: number) => (list && list.length ? list[Math.abs(salt) % list.length] : '');
  if (e.k === 'heal') return e.a === e.d ? `${e.w === 'elixir' ? '特効薬' : '傷薬'}を使った` : `${w?.name ?? '杖'}。${nameOf(e.d)}の傷が癒える`;
  if (e.k !== 'atk') return '';
  const parts: string[] = [];
  const salt = e.x * 7 + e.hp0;
  if (leader && e.a === leader.uid && (e.x % 3 === 0 || e.crit)) parts.push(`「${pick(ATTACK_SHOUT[leader.personality], salt)}」`);
  if (e.role === 'counter') parts.push('反撃！');
  if (e.role === 'follow') parts.push('追撃！');
  if (e.role === 'duel') parts.push('一騎打ち。');
  parts.push(`${w?.name ?? ''}で${pick(STRIKE_VERB[w?.type ?? 'none'], salt)}`.replace(/^で/, ''));
  if (e.eff) parts.push('特効！');
  if (e.tri > 0) parts.push('相性がいい。');
  if (e.tri < 0) parts.push('相性が悪い……');
  if (e.kill) { const du = b.units.find((u) => u.uid === e.d); parts.push(du?.side === 'enemy' ? `${nameOf(e.d)}を倒した！` : `${nameOf(e.d)}が倒れた……`); }
  return parts.join(' ');
}

// ================= 見せ場の演出（9夜目） =================
type FxShow =
  | { k: 'strat'; text: string }
  | { k: 'crit'; a: string; d: string; dmg: number; say: string }
  | { k: 'kill'; a: string; d: string }
  | { k: 'fall'; d: string; outcome: 'dead' | 'injured' | 'out' }
  | { k: 'duel'; a: string; title: string; say: string };

/** この攻撃で出す見せ場：必殺（生徒・敵将）、敵将・名のある敵の撃破、生徒が倒れた */
function fxFor(s: GameState, b: BattleState, e: AtkLog, level: FxLevel): FxShow[] {
  if (level === 'low' || !e.hit) return [];
  const out: FxShow[] = [];
  const au = b.units.find((u) => u.uid === e.a);
  const du = b.units.find((u) => u.uid === e.d);
  const L = b.auto?.leader;
  const ast = au?.studentId ? s.students[au.studentId] : null;
  if (e.crit && au && (ast || (L && au.uid === L.uid))) {
    const salt = e.x * 7 + e.dmg;
    const list = ast ? CRIT_SAY[ast.personality] : LEADER_CRIT_SAY[L!.personality] ?? LEADER_CRIT_SAY.proud;
    out.push({ k: 'crit', a: e.a, d: e.d, dmg: e.dmg, say: list[salt % list.length] });
  }
  if (e.kill && du) {
    if (du.side === 'enemy' && (du.boss || (L && du.uid === L.uid) || du.studentId || (level === 'big' && (b.auto?.raised ?? []).some((g) => g.uid === du.uid)))) out.push({ k: 'kill', a: e.a, d: e.d });
    else if (du.side !== 'enemy' && du.studentId) out.push({ k: 'fall', d: e.d, outcome: b.fallen.find((f) => f.studentId === du.studentId)?.outcome ?? 'out' });
  }
  return out;
}

function BigFace({ s, b, uid, size, leader, leaderColor, gray }: { s: GameState; b: BattleState; uid: string; size: number; leader: LeaderInfo | null; leaderColor: string; gray?: boolean }) {
  const u = b.units.find((x) => x.uid === uid);
  const st = u?.studentId ? s.students[u.studentId] : null;
  const style = gray ? { filter: 'grayscale(1) contrast(1.1)' } : undefined;
  if (leader && uid === leader.uid) return <span style={style}><OfficerFace o={leaderFace(leader)} size={size} frame={leaderColor} s={s} /></span>;
  if (st) return <span style={style}><Portrait st={st} size={size} frame={u!.side === 'enemy' ? 'var(--accent)' : countryColor(st.origin)} /></span>;
  const g = b.auto?.raised?.find((x) => x.uid === uid);
  if (g) return <span style={style}><OfficerFace o={{ faceImage: g.faceImage, face: g.face, scars: 0 }} size={size} frame="#222" s={s} /></span>;
  return <span class="bl-icon foe" style={{ width: size, height: size, fontSize: size * 0.4, ...(style ?? {}) }}>兵</span>;
}

function FxOverlay({ s, b, fx, level, leader, leaderColor, nameOf, onTap }: { s: GameState; b: BattleState; fx: FxShow; level: FxLevel; leader: LeaderInfo | null; leaderColor: string; nameOf: (uid: string) => string; onTap: () => void }) {
  const tap = (e: Event) => { e.stopPropagation(); onTap(); };
  if (fx.k === 'strat') {
    const m = /^策「([^」]+)」：(.*)$/.exec(fx.text);
    return (
      <div class={`fx-over fx-strat${level === 'big' ? ' big' : ''}`} onClick={tap}>
        <div class="fx-stratband"><span class="fx-stratmark serif">策</span><b class="serif">{m ? m[1] : '策'}</b></div>
        <div class="fx-stratsay">{m ? m[2] : fx.text}</div>
        <div class="fx-skip">タップで次へ</div>
      </div>
    );
  }
  if (fx.k === 'crit') {
    const foe = b.units.find((u) => u.uid === fx.a)?.side === 'enemy';
    return (
      <div class={`fx-over fx-cutin${foe ? ' foe' : ''}${level === 'big' ? ' big' : ''}`} onClick={tap}>
        <div class="fx-lines" />
        <div class="fx-band"><span class="fx-bandface"><BigFace s={s} b={b} uid={fx.a} size={210} leader={leader} leaderColor={leaderColor} /></span></div>
        <div class="fx-crit-title">必殺！</div>
        <div class="fx-crit-say">{nameOf(fx.a)}「{fx.say}」</div>
        <div class="fx-crit-dmg">−{fx.dmg}</div>
        <div class="fx-skip">タップで早送り</div>
      </div>
    );
  }
  if (fx.k === 'kill') {
    const du = b.units.find((u) => u.uid === fx.d);
    const o = leader && fx.d === leader.uid ? officerById(s, leader.officerId) : null;
    const g = b.auto?.raised?.find((x) => x.uid === fx.d);
    const sub = o ? `${factionName(o.faction)}・${rankName(o)}` : g ? `${g.given}・見込みのある兵` : du?.boss ? '敵の大将' : '';
    return (
      <div class="fx-over fx-kill" onClick={tap}>
        <div class="fx-killface"><BigFace s={s} b={b} uid={fx.d} size={170} leader={leader} leaderColor="#222" gray /><span class="fx-cracks" /><i class="fx-frag f1" /><i class="fx-frag f2" /><i class="fx-frag f3" /><i class="fx-frag f4" /></div>
        <div class="stamp fx-killstamp">撃破</div>
        <div class="fx-killname serif">{nameOf(fx.d)}{sub ? `（${sub}）` : ''}</div>
        <div class="fx-killsub">{nameOf(fx.a)}の一撃に倒れる</div>
        <div class="fx-skip">タップで早送り</div>
      </div>
    );
  }
  if (fx.k === 'fall') {
    const name = nameOf(fx.d);
    const list = fx.outcome === 'dead' ? FALL_TEXT.dead : FALL_TEXT.injured;
    return (
      <div class={`fx-over fx-fall ${fx.outcome}`} onClick={tap}>
        <div class="fx-fallface"><BigFace s={s} b={b} uid={fx.d} size={150} leader={leader} leaderColor={leaderColor} gray={fx.outcome === 'dead'} /></div>
        <div class="fx-falltext serif">{fill(list[name.length % list.length], { a: name })}</div>
        <div class="fx-skip">タップで次へ</div>
      </div>
    );
  }
  const st = s.students[fx.a];
  return (
    <div class="fx-over fx-vs" onClick={tap}>
      <div class="fx-vstitle serif">{fx.title}</div>
      <div class="fx-vsside ally"><span class="fx-vsface">{st && <Portrait st={st} size={170} frame="#3a5f9a" />}</span><b>{st?.given}</b></div>
      <div class="fx-vsside foe"><span class="fx-vsface">{leader && <OfficerFace o={leaderFace(leader)} size={170} frame="#8f2a20" s={s} />}</span><b>{leader?.name}</b></div>
      <div class="fx-vsmark">VS<i class="fx-spark s1" /><i class="fx-spark s2" /><i class="fx-spark s3" /></div>
      {fx.say && <div class="fx-vssay">{fx.say}</div>}
      <div class="fx-skip">タップで判断へ</div>
    </div>
  );
}

/** 戦いで目立った一般兵が名前を得る帯（9夜目） */
function RaiseBand({ s, l }: { s: GameState; l: { by: string; text: string } }) {
  const g = s.battle?.auto?.raised?.[Number(l.by.slice(6))];
  return <div class="bl-band raise">{g && <span class="bl-bface"><OfficerFace o={{ faceImage: g.faceImage, face: g.face, scars: 0 }} size={30} frame="var(--accent)" s={s} /></span>}<span>{l.text}</span></div>;
}

/** 結果画面の上に出す MVP と講評 */
export function AutoResultHead({ s, mvp, review }: { s: GameState; mvp?: string; review?: string[] }) {
  const st = mvp ? s.students[mvp] : null;
  return (
    <>
      {st && (
        <div class="pcard ab-mvp" style={{ ['--band' as string]: 'var(--gold)' }}>
          <div class="row nowrap gap8">
            <Portrait st={st} size={64} frame={countryColor(st.origin)} />
            <div class="grow"><div class="ab-mvpl">MVP</div><NameLine st={st} size={18} /><div class="small"><ClassName classId={st.classId} size={12} /></div></div>
          </div>
        </div>
      )}
      {review && review.length > 0 && <div class="paper small" style={{ margin: '8px 0' }}><b>講評</b>{review.map((r) => <div>・{r}</div>)}</div>}
    </>
  );
}

void B; void officerName;
