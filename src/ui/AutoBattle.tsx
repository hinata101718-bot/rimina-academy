// 出撃前の画面（9夜目：部隊ごとの編成・策・部隊長・陣形。16夜目：山札を見る）と、戦いの見せ場の演出（札の戦いで使う）
import { useEffect, useMemo, useState } from 'preact/hooks';
import { act } from './store';
import { Sheet, HelpTip } from './common';
import { Portrait, OfficerFace } from './Portrait';
import { Icon } from './icons';
import { sfx } from './sound';
import { countryColor, Chip, Num, LvBadge, NameLine, ClassName, classIcon, OBJECTIVE_ICON, WEATHER_ICON, Stars } from './cards';
import type { GameState, Quest, Student, SquadPlan } from '../core/state';
import { STRATS, MAP_TAGS, TAG_NAMES, ROW_NAMES, type StratId } from '../data/stratagems';
import { knownStrats, stratSlots, stratOdds, oddsLabel, captainScore, plannerScore, defaultCaptain, defaultPlanner, defaultRow } from '../core/stratagems';
import type { Deploy } from '../core/battle/setup';
import { enrolled, available } from '../core/game';
import { deployFor, canEquip } from '../core/autoplay';
import { battleCtx } from '../core/flow';
import { isCardMode, previewBattle, enemyIntel, estimateWin, recommendDeploy, defaultRole, roleFit, tacticFits, scoutQuest, defaultPlan, recommendStrats, type AutoPlan, type LeaderInfo } from '../core/battle/auto';
import { FALL_TEXT, type FxLevel } from '../data/battlefx';
import type { BattleState } from '../core/battle/types';
import { officerById, rivalryOf, stageName, isScout, factionName, rankName, officerName } from '../core/officers';
import { OFFICER_TRAITS, FACTION_COLOR } from '../data/officers';
import { SCAR_TEXT, SCOUT_TEXT } from '../data/officers_text';
import { MONTH_NAMES } from '../core/util';
import { TACTICS, TACTIC_OPTIONS, ROLES, ROLE_IDS, LEADER_NAMES, type TacticId, type RoleId } from '../data/autobattle';
import { OBJECTIVE_NAMES, WEATHER_NAMES } from '../core/quests';
import { MAPS } from '../data/maps';
import { WEAPONS } from '../data/weapons';
import { CLASSES } from '../data/classes';
import { B, RANK_POINTS } from '../data/balance';
import { rankOf } from '../core/util';
import { armoryItem, armoryName, isStock, stockList } from '../core/loot';
import { legendFits } from '../core/rarity';
import { fallLines } from '../data/warprose';
import { officerArts, artsLabel, equippedSpells } from '../core/arts';
import { DeckPreview } from './CardBattle';

const FIT_MARK = ['△', '○', '◎'];

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
  return { questId: sq.questId, deploy: sq.deploy, tactic: sq.plan.tactic, roleOver: {}, rows: { ...(sq.plan.rows ?? {}) }, strats: [...(sq.plan.strats ?? [])], captain: sq.plan.captain, planner: sq.plan.planner, manual: false, away: sq.away };
}
export function newDraft(s: GameState, q: Quest, limit: number, exclude?: Set<string>, usedArms?: Set<string>): SquadDraft {
  const deploy = recommendDeploy(s, q, limit, (ids) => deployFor(s, ids, usedArms ? new Set(usedArms) : undefined), exclude);
  return draftFromSquad(s, { questId: q.id, deploy, plan: defaultPlan(s, q, deploy) });
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
export function squadOf(s: GameState, d: SquadDraft): SquadPlan { return { questId: d.questId, deploy: d.deploy, plan: planOf(s, d), away: d.away }; }

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
  // 15夜目：部隊長・策を立てる子・方針・策・役割と陣形は、はじめはたたむ（おすすめのままでよいとき、スクロールしない）
  const [more, setMore] = useState(false);
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
          {quests.map((x) => <button class={`sq-q${x.id === q.id ? ' on' : ''}`} onClick={() => { if (x.id === q.id) return; sfx('move'); setDraft({ ...draft, questId: x.id, strats: recommendStrats(s, x, ids, plan.planner, plan.captain) }); }}><b>{x.title}</b><small>{x.real ? `実戦・危険度${'★'.repeat(x.danger)}${x.hot ? '・争いの地' : ''}` : x.kind === 'exhibition' ? '演武会' : '演習'}</small></button>)}
        </div>
      )}
      <div class="pcard" style={{ ['--band' as string]: q.clientCountry ? countryColor(q.clientCountry) : 'var(--main)' }}>
        <div class="infogrid">
          <div><Icon name={OBJECTIVE_ICON[q.objective]} size={17} />{OBJECTIVE_NAMES[q.objective]}</div>
          <div><Icon name={WEATHER_ICON[q.weather]} size={17} />{WEATHER_NAMES[q.weather]}・{mapName}</div>
          <div>危険度 <Stars n={q.danger} />{q.hot && <span class="flag red" style={{ marginLeft: 4 }}>争いの地</span>}</div>
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

      <div class="pcard sq-fold">
        <div class="small">部隊長：<b>{plan.captain ? s.students[plan.captain]?.given : '—'}</b>　策を立てる子：<b>{plan.planner ? s.students[plan.planner]?.given : '—'}</b></div>
        <div class="small">方針：<b>{TACTICS[draft.tactic]?.name ?? ''}</b>　策：{draft.strats.length ? draft.strats.map((x) => <span class="st-chip">{STRATS[x].mark} {STRATS[x].name}</span>) : <span class="muted">なし</span>}</div>
        <button class="btn ghost small block" onClick={() => { sfx('move'); setMore(!more); }}>{more ? '部隊長・方針・策・陣形をたたむ ▲' : '部隊長・方針・策・陣形を変える ▼'}</button>
      </div>
      {more && <>
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
      {isCardMode() && <div class="small muted">選んだ策は「先生の策」の札として山札に入ります。策を立てる子の軍略が高いほど、早く手札に来ます。</div>}
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
                <b>{d.name}</b><small class="st-when">{isCardMode() ? '札' : d.when === 'open' ? '開戦で' : 'ぶつかり合いのあと'}</small>
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
        const spells = equippedSpells(st).map((id) => WEAPONS[id]?.name).filter(Boolean);
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
                  {arms.map((a) => <option value={a.uid} disabled={!!a.legend && !legendFits(st, a.legend)}>{armoryName(a)}{isStock(a.uid) ? '（学校の備え）' : a.engraved ? `（${a.engraved}の遺品）` : a.legend ? (legendFits(st, a.legend) ? '（伝説）' : '（伝説・持ち主を選ぶ）') : a.named ? '（ユニーク）' : '（レア）'}</option>)}
                </select>
                <select value={d.item ?? ''} onChange={(e) => setDeploy(deploy.map((x) => x.studentId === st.id ? { ...x, item: ((e.target as HTMLSelectElement).value || null) as Deploy['item'] } : x))}>
                  <option value="">道具なし</option>
                  <option value="vulnerary" disabled={s.items.vulnerary <= deploy.filter((x) => x.studentId !== st.id && x.item === 'vulnerary').length}>傷薬（残{s.items.vulnerary}）</option>
                  <option value="elixir" disabled={s.items.elixir <= deploy.filter((x) => x.studentId !== st.id && x.item === 'elixir').length}>特効薬（残{s.items.elixir}）</option>
                </select>
                {spells.length > 0 && <div class="small muted" style={{ width: '100%' }}><Icon name="tome" size={14} /> つけている魔法：{spells.join('・')}</div>}
              </div>
            )}
          </div>
        );
      })}

      </>}

      {preview.auto?.cards && <DeckPreview s={s} b={preview} />}
      <div class="ab-odds">
        <span>勝ち目の目安</span>
        <b class={`ab-oddsv ${est?.key === key ? ({ 優勢: 'good', 五分: 'even', 苦しい: 'bad' } as Record<string, string>)[est.label] ?? '' : ''}`}>{est?.key === key ? est.label : '…'}</b>
      </div>
      <button class="btn accent block sticky-bottom" disabled={!deploy.length} onClick={() => { sfx('ok'); onGo(); }}>{goLabel}</button>
    </Sheet>
  );
}

export function fill(t: string, v: Record<string, string>): string { return t.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m); }
/** 部隊長・策を立てる子のひとこと（10夜目：技能ランクで） */
function captainNote(st: Student): string { const p = st.skills.command ?? 0; return p >= RANK_POINTS.B ? '部隊の命中・回避がよく上がる' : p >= RANK_POINTS.D ? '部隊の命中・回避が少し上がる' : 'まだ部隊をまとめるのは不慣れ'; }
function plannerNote(st: Student): string { const p = st.skills.tactics ?? 0; return p >= RANK_POINTS.B ? '策がとても決まりやすい' : p >= RANK_POINTS.D ? '策が決まりやすい' : 'まだ策を立てるのは不慣れ'; }
export function leaderFace(L: LeaderInfo | null) { return L ? { faceImage: L.faceImage, face: L.face, scars: L.scars, alumniId: L.alumniId } : null; }

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
          {officerArts(o, s).length > 0 && <span class="ofc-trait art">{artsLabel(officerArts(o, s))}</span>}
          <span class="small muted">特徴</span>
          {o.traits.map((t) => o.knownTraits.includes(t) ? <span class={`ofc-trait ${OFFICER_TRAITS[t].style ? 'style' : OFFICER_TRAITS[t].weak ? 'weak' : 'strong'}`}>{OFFICER_TRAITS[t].style ? '型' : OFFICER_TRAITS[t].weak ? '弱点' : '強み'}：{OFFICER_TRAITS[t].name}</span> : <span class="ofc-trait unknown">？</span>)}
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

// ================= 戦いの記録（7夜目） =================
export const GRUNT_ICON: Record<string, string> = { sword: 'sword', lance: 'lance', axe: 'axe', bow: 'bow', magic: 'tome', holy: 'staff', staff: 'staff', gun: 'gun' };
export const GRUNT_MARK: Record<string, string> = { sword: '剣', lance: '槍', axe: '斧', bow: '弓', magic: '魔', holy: '聖', staff: '杖', gun: '銃' };
export type FxShow =
  | { k: 'strat'; text: string }
  | { k: 'crit'; a: string; d: string; dmg: number; say: string }
  | { k: 'kill'; a: string; d: string }
  | { k: 'fall'; d: string; outcome: 'dead' | 'injured' | 'out'; key?: string }
  | { k: 'duel'; a: string; title: string; say: string }
  /** 16夜目：開花の技・伝説の武器の札 */
  | { k: 'art'; a: string; title: string; name: string }
  /** 18夜目：連携技（2人の顔が寄って合わさる） */
  | { k: 'combo'; a: string; d: string; name: string; label: string; say: [string, string] };

/** この攻撃で出す見せ場：必殺（生徒・敵将）、敵将・名のある敵の撃破、生徒が倒れた */
export function BigFace({ s, b, uid, size, leader, leaderColor, gray }: { s: GameState; b: BattleState; uid: string; size: number; leader: LeaderInfo | null; leaderColor: string; gray?: boolean }) {
  const u = b.units.find((x) => x.uid === uid);
  const st = u?.studentId ? s.students[u.studentId] : null;
  const style = gray ? { filter: 'grayscale(1) contrast(1.1)' } : undefined;
  if (leader && uid === leader.uid) return <span style={style}><OfficerFace o={leaderFace(leader)} size={size} frame={leaderColor} s={s} /></span>;
  if (st) return <span style={style}><Portrait st={st} size={size} frame={u!.side === 'enemy' ? 'var(--accent)' : countryColor(st.origin)} /></span>;
  const g = b.auto?.raised?.find((x) => x.uid === uid);
  if (g) return <span style={style}><OfficerFace o={{ faceImage: g.faceImage, face: g.face, scars: 0 }} size={size} frame="#222" s={s} /></span>;
  return <span class="bl-icon foe" style={{ width: size, height: size, fontSize: size * 0.4, ...(style ?? {}) }}>兵</span>;
}

export function FxOverlay({ s, b, fx, level, leader, leaderColor, nameOf, onTap }: { s: GameState; b: BattleState; fx: FxShow; level: FxLevel; leader: LeaderInfo | null; leaderColor: string; nameOf: (uid: string) => string; onTap: () => void }) {
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
  if (fx.k === 'combo') {
    return (
      <div class={`fx-over fx-combo${level === 'big' ? ' big' : ''}`} onClick={tap}>
        <div class="fx-lines" />
        <div class="fx-cbkind">{fx.label}</div>
        <div class="fx-cbfaces"><span class="fx-cbl"><BigFace s={s} b={b} uid={fx.a} size={120} leader={leader} leaderColor={leaderColor} /></span><span class="fx-cbx">✕</span><span class="fx-cbr"><BigFace s={s} b={b} uid={fx.d} size={120} leader={leader} leaderColor={leaderColor} /></span></div>
        <div class="fx-crit-title fx-cbname">{fx.name}</div>
        <div class="fx-crit-say">{nameOf(fx.a)}「{fx.say[0]}」　{nameOf(fx.d)}「{fx.say[1]}」</div>
        <div class="fx-skip">タップで早送り</div>
      </div>
    );
  }
  if (fx.k === 'art') {
    return (
      <div class={`fx-over fx-cutin art${level === 'big' ? ' big' : ''}`} onClick={tap}>
        <div class="fx-lines" />
        <div class="fx-band"><span class="fx-bandface"><BigFace s={s} b={b} uid={fx.a} size={210} leader={leader} leaderColor={leaderColor} /></span></div>
        <div class="fx-crit-title">{fx.title}</div>
        <div class="fx-crit-say">{nameOf(fx.a)}の『{fx.name}』！</div>
        <div class="fx-skip">タップで早送り</div>
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
      <div class={`fx-over fx-kill${s.settings.battleProse === 'brutal' && (o || g || du?.studentId) ? ' splat' : ''}`} onClick={tap}>
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
    const lv = s.settings.battleProse ?? 'dense';
    const list = lv === 'normal' ? (fx.outcome === 'dead' ? FALL_TEXT.dead : FALL_TEXT.injured) : fallLines(fx.key ?? 'none', fx.outcome === 'dead' ? 'dead' : 'injured', lv);
    return (
      <div class={`fx-over fx-fall ${fx.outcome}${s.settings.battleProse === 'brutal' ? ' splat' : ''}`} onClick={tap}>
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
