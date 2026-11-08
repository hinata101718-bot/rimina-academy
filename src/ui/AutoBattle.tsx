// 自動の戦闘（5夜目）：出撃前の画面と、場面をタップで送る画面
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { act, useStore } from './store';
import { Sheet } from './common';
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
import { battleCtx, finishBattle } from '../core/flow';
import { previewBattle, enemyIntel, estimateWin, recommendDeploy, defaultRole, roleFit, tacticFits, chooseAuto, skipAuto, scoutQuest, defaultPlan, recommendStrats, type AutoPlan, type LeaderInfo } from '../core/battle/auto';
import { battleItems, hpAt, isGrunt, type BItem } from '../core/battle/blog';
import type { BLog } from '../core/battle/types';
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
import { B } from '../data/balance';
import { usableSpells } from '../core/spells';

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
}
export function draftFromSquad(s: GameState, sq: SquadPlan): SquadDraft {
  return { questId: sq.questId, deploy: sq.deploy, tactic: sq.plan.tactic, roleOver: {}, rows: { ...(sq.plan.rows ?? {}) }, strats: [...(sq.plan.strats ?? [])], captain: sq.plan.captain, planner: sq.plan.planner, manual: !!sq.manual };
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
export function squadOf(s: GameState, d: SquadDraft): SquadPlan { return { questId: d.questId, deploy: d.deploy, plan: planOf(s, d), manual: d.manual || undefined }; }

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
          <label class="sq-lead"><span><Icon name="flag" size={15} /> 部隊長</span>
            <select value={plan.captain ?? ''} onChange={(e) => setDraft({ ...draft, captain: (e.target as HTMLSelectElement).value || undefined })}>
              {members.sort((a, c) => captainScore(c) - captainScore(a)).map((st) => <option value={st.id}>{st.given}（{st.grade}年・腕前{captainScore(st)}）</option>)}
            </select>
          </label>
          <label class="sq-lead"><span><Icon name="scroll" size={15} /> 策を立てる子</span>
            <select value={plan.planner ?? ''} onChange={(e) => setDraft({ ...draft, planner: (e.target as HTMLSelectElement).value || undefined })}>
              {[...members].sort((a, c) => plannerScore(c) - plannerScore(a)).map((st) => <option value={st.id}>{st.given}（軍略{stratOf(st)}・魅力{effectiveStats(st).cha}）</option>)}
            </select>
          </label>
          <div class="small muted">部隊長の腕前（魅力＋軍略）が高いと部隊の命中が少し上がる。策を立てる子の軍略・魅力で策が決まりやすくなる</div>
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
        const arms = s.armory.filter((a) => canEquip(st, a.weaponId) && WEAPONS[a.weaponId].type !== 'staff' && (!usedHere.has(a.uid) || d.armoryUid === a.uid));
        const spells = usableSpells(st).map((id) => WEAPONS[id]?.name).filter(Boolean);
        return (
          <div class="ab-role">
            <div class="row nowrap gap6">
              <Portrait st={st} size={36} />
              <div class="grow" style={{ minWidth: 0 }}>
                <NameLine st={st} size={15} family={false} />
                <div class="small row nowrap gap4"><ClassName classId={st.classId} size={12} /><span class={`ab-weapon ${!d.armoryUid && !spells.length ? 'none' : 'muted'}`} onClick={() => setGearOpen(gearOpen === st.id ? null : st.id)}>{d.armoryUid ? WEAPONS[s.armory.find((a) => a.uid === d.armoryUid)!.weaponId].name : spells[0] ?? '武器なし'} ▾</span></div>
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
                  {arms.map((a) => <option value={a.uid}>{WEAPONS[a.weaponId].name}{a.engraved ? `（${a.engraved}）` : ''}</option>)}
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

/** 戦いの記録：1回の攻撃ごとのカード、上に両軍のHP。ここぞの判断は途中で止まる */
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
  const ref = useRef<HTMLDivElement>(null);
  const total = items.length;
  const atLogEnd = pos >= total;
  const atChoice = !!a?.choice && atLogEnd;
  const atEnd = !!a && a.seg >= 3 && atLogEnd && !a.choice;
  useEffect(() => { ref.current?.scrollTo?.({ top: ref.current.scrollHeight, behavior: 'smooth' }); }, [pos]);
  // 行動の多い戦いは、ふつうでも2分ほどに収まるよう少し速く
  const fit = useMemo(() => { const sec = items.reduce((t, x) => t + (x.k === 'band' ? AUTO.log.band : x.k === 'turn' || x.k === 'title' ? AUTO.log.turn : x.k === 'sync' ? 0 : AUTO.log.card), 0) / 1000; return sec > AUTO.log.maxSec ? AUTO.log.maxSec / sec : 1; }, [total]);
  const effect = (it: (typeof items)[number]) => {
    if (it.k === 'sync') act((g) => { if (g.battle?.auto) g.battle.auto.shown = Math.max(g.battle.auto.shown, it.scene + 1); });
    if (it.k === 'atk' && it.e.hit) sfx(it.e.crit ? 'crit' : 'hit');
  };
  /** タップで進む（8夜目）：1枚ずつ。区切りの見出しは次のカードといっしょに出す */
  const tapNext = () => {
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
  // 再生
  useEffect(() => {
    if (speed === 'tap' || atLogEnd) return;
    const it = items[pos];
    const mul = ({ 1: 1.3, 2: 1, 3: 0.65 } as Record<number, number>)[s?.settings.animSpeed ?? 2] ?? 1;
    const base = it.k === 'band' ? AUTO.log.band : it.k === 'turn' || it.k === 'title' ? AUTO.log.turn : it.k === 'sync' ? 0 : AUTO.log.card;
    const ms = Math.max(0, base * mul * fit * (speed === 'fast' ? AUTO.log.fastMul : 1));
    const t = setTimeout(() => {
      setPos((p) => p + 1);
      effect(it);
    }, ms);
    return () => clearTimeout(t);
  }, [pos, speed, total]);
  if (!s || !b || !a) return null;
  const nextSquad = !!s.sortie && s.sortie.idx < s.sortie.squads.length - 1;
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
    const w = u.weaponId ? WEAPONS[u.weaponId]?.type : undefined;
    return <span class={`bl-icon ${u.side === 'enemy' ? 'foe' : ''}`} style={{ width: size, height: size }}>{w ? GRUNT_MARK[w] ?? '兵' : '兵'}</span>;
  };
  const { hp, gone } = hpAt(b, items, pos);
  const allies = b.units.filter((u) => (u.side === 'player' || u.side === 'ally') && (a.hp0?.[u.uid] || hp[u.uid] !== undefined));
  const foes = b.units.filter((u) => u.side === 'enemy' && (a.hp0?.[u.uid] || hp[u.uid] !== undefined));
  const shown = items.slice(0, pos).filter((x) => x.k !== 'sync');
  const view = shown.slice(-AUTO.log.keep);
  return (
    <div class="ab-view bl-view">
      <div class="ab-head bl-head">
        <div class="bl-title"><span class="stamp bl-stamp">戦闘報告</span><b class="serif">{b.title}</b>{q && <span class="small">{WEATHER_NAMES[q.weather]}・{OBJECTIVE_NAMES[q.objective]}{leader ? `（敵将${leader.name}）` : ''}</span>}</div>
        {s.sortie && s.sortie.squads.length > 1 && <div class="small bl-squad"><b>{SQUAD_LABEL[s.sortie.idx]}</b>（{s.sortie.idx + 1}／{s.sortie.squads.length}）{a.plan?.captain && s.students[a.plan.captain] ? `・部隊長 ${s.students[a.plan.captain].given}` : ''}{(a.strats ?? []).length + (a.held ?? []).length ? `・策 ${[...(a.strats ?? []).map((x) => x.id), ...(a.held ?? [])].map((x) => STRATS[x].name).join('・')}` : ''}</div>}
        <div class="bl-hp">
          <div class="bl-side"><div class="bl-sidet ally">味方</div>{allies.slice(0, 10).map((u) => <HpRow name={nameOf(u.uid)} v={hp[u.uid] ?? u.maxHp} max={u.maxHp} down={gone.has(u.uid) || (hp[u.uid] ?? 1) <= 0} ally />)}</div>
          <div class="bl-side"><div class="bl-sidet foe">敵</div>{foes.slice(0, 10).map((u) => <HpRow name={nameOf(u.uid)} v={hp[u.uid] ?? u.maxHp} max={u.maxHp} down={gone.has(u.uid) || (hp[u.uid] ?? 1) <= 0} />)}{foes.length > 10 && <div class="small muted">ほか{foes.length - 10}人</div>}</div>
        </div>
      </div>
      <div class="ab-scene bl-log" ref={ref} onClick={() => { if (speed === 'tap') tapNext(); }}>
        {shown.length > view.length && <div class="small muted" style={{ textAlign: 'center' }}>（前の記録は省略）</div>}
        {view.map((it, n) => <LogItem key={shown.length - view.length + n} it={it} s={s} nameOf={nameOf} sideOf={sideOf} Face={Face} leader={leader} leaderColor={leaderColor} />)}
        {!atLogEnd && speed === 'tap' && <div class="ab-tap">タップで次へ ▼</div>}
      </div>
      {atChoice && a.choice && (
        <div class="ab-choice">
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
      {atEnd && <button class="btn primary block ab-endbtn" onClick={() => { sfx('ok'); act((g) => finishBattle(g)); }}>{nextSquad ? `${SQUAD_LABEL[s.sortie!.idx + 1]}の戦いへ` : '結果を見る'}</button>}
      {!atEnd && !atChoice && (
        <div class="ab-ctrl bl-ctrl">
          <button class={`btn small${speed === 'tap' ? ' primary' : ''}`} onClick={() => { if (speed === 'tap') tapNext(); else setSpeed('tap'); }}>☝ タップで</button>
          <button class={`btn small${speed === 'normal' ? ' primary' : ''}`} onClick={() => setSpeed('normal')}>▶ ふつう</button>
          <button class={`btn small${speed === 'fast' ? ' primary' : ''}`} onClick={() => setSpeed('fast')}>▶▶ 速く</button>
          <button class="btn small" onClick={() => { if (!confirm(`残りの判断はおすすめを選んで、${nextSquad ? 'この部隊の戦いを終えます' : '結果まで進めます'}。よろしいですか？`)) return; sfx('ok'); act((g) => { skipAuto(g, battleCtx(g)); finishBattle(g); }); }}>結果へ</button>
        </div>
      )}
    </div>
  );
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

function LogItem({ it, s, nameOf, sideOf, Face, leader, leaderColor }: { it: BItem; s: GameState; nameOf: (uid: string) => string; sideOf: (uid: string) => string; Face: (p: { uid: string; size: number }) => preact.JSX.Element; leader: LeaderInfo | null; leaderColor: string }) {
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
  return (
    <div class={`bl-card ${sideOf(e.a)}`}>
      <div class="bl-row">
        <Face uid={e.a} size={40} />
        <span class="bl-arrow">▶</span>
        <Face uid={e.d} size={40} />
        <div class="grow bl-txt">
          <div class="bl-names"><b class={sideOf(e.a)}>{nameOf(e.a)}</b> → <b class={sideOf(e.d)}>{nameOf(e.d)}</b>
            {atk?.crit && <span class="bl-tag crit">必殺</span>}
            {atk && atk.tri > 0 && <span class="bl-tag good">有利</span>}
            {atk && atk.tri < 0 && <span class="bl-tag bad">不利</span>}
            {atk && !atk.hit && <span class="bl-tag miss">MISS</span>}
          </div>
          <div class="small bl-desc">{describe(s, e, nameOf, leader)}</div>
        </div>
        <span class={`bl-dmg${heal ? ' heal' : atk && !atk.hit ? ' miss' : ''}`}>{heal ? `+${(e as { amt: number }).amt}` : atk && !atk.hit ? 'MISS' : `−${atk?.dmg ?? 0}`}</span>
      </div>
      <HitBar e={e} name={nameOf(e.d)} foe={sideOf(e.d) === 'foe'} />
    </div>
  );
}

/** 受けた側のHPゲージ：減った分を薄い赤で残し、減っていく */
function HitBar({ e, name, foe }: { e: { hp0: number; hp1: number; max: number }; name: string; foe: boolean }) {
  const [go, setGo] = useState(false);
  useEffect(() => { const t = setTimeout(() => setGo(true), 60); return () => clearTimeout(t); }, []);
  const p0 = Math.max(0, Math.min(100, (e.hp0 / Math.max(1, e.max)) * 100));
  const p1 = Math.max(0, Math.min(100, (e.hp1 / Math.max(1, e.max)) * 100));
  return (
    <div class="bl-hit">
      <span class={`small bl-hitn ${foe ? 'foe' : 'ally'}`}>{name}</span>
      <span class="bl-hitbar"><span class="lost" style={{ width: `${Math.max(p0, p1)}%` }} /><span class={`now${p1 <= 33 ? ' low' : ''}`} style={{ width: `${go ? p1 : p0}%` }} /></span>
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
