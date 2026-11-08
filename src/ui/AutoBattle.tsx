// 自動の戦闘（5夜目）：出撃前の画面と、場面をタップで送る画面
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { act, useStore } from './store';
import { Sheet } from './common';
import { Portrait, OfficerFace } from './Portrait';
import { Icon } from './icons';
import { sfx } from './sound';
import { countryColor, Chip, Num, LvBadge, NameLine, ClassName, classIcon, OBJECTIVE_ICON, WEATHER_ICON, Stars } from './cards';
import type { GameState, Quest, Student } from '../core/state';
import type { Deploy } from '../core/battle/setup';
import { enrolled, available, deployLimit } from '../core/game';
import { deployFor, canEquip } from '../core/autoplay';
import { startAutoQuest, startBattle, battleCtx, finishBattle } from '../core/flow';
import { previewBattle, enemyIntel, estimateWin, recommendDeploy, defaultRole, roleFit, tacticFits, chooseAuto, skipAuto, scoutQuest, type AutoPlan, type LeaderInfo } from '../core/battle/auto';
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

// ================= 出撃前 =================
export function AutoPrep({ s, q, onBack }: { s: GameState; q: Quest; onBack?: () => void }) {
  const limit = deployLimit(s) - (q.scouted && !q.scoutFree ? 1 : 0);
  const [deploy, setDeploy0] = useState<Deploy[]>(() => recommendDeploy(s, q, limit, (ids) => deployFor(s, ids)));
  const setDeploy = (d: Deploy[]) => setDeploy0(d.slice(0, Math.max(1, limit)));
  const [scoutMsg, setScoutMsg] = useState<string | null>(null);
  const [tactic, setTactic] = useState<TacticId>(TACTIC_OPTIONS[q.objective][0]);
  const [roleOver, setRoleOver] = useState<Record<string, RoleId>>({});
  const [manual, setManual] = useState(false);
  const [est, setEst] = useState<{ key: string; label: string } | null>(null);
  const [gearOpen, setGearOpen] = useState<string | null>(null);
  const ids = deploy.map((d) => d.studentId);
  const roles: Record<string, RoleId> = {};
  for (const id of ids) roles[id] = roleOver[id] ?? defaultRole(s.students[id].classId, s.students[id]);
  const plan: AutoPlan = { tactic, roles };
  const key = `${ids.join(',')}|${deploy.map((d) => d.armoryUid).join(',')}|${tactic}|${ids.map((i) => roles[i]).join(',')}|${q.scouted ? 1 : 0}`;
  const preview = useMemo(() => previewBattle(s, q, deploy.length ? deploy : deployFor(s, enrolled(s).filter(available).slice(0, 1).map((x) => x.id)), plan), [key]);
  const intel = enemyIntel(s, preview);
  // 勝ち目：少し待ってから裏で試しに戦わせる
  useEffect(() => {
    if (!deploy.length) { setEst({ key, label: '—' }); return; }
    const t = setTimeout(() => setEst({ key, label: estimateWin(s, q, deploy, plan, battleCtx(s)).label }), 350);
    return () => clearTimeout(t);
  }, [key]);
  const avail = enrolled(s).filter(available).sort((x, y) => Number(ids.includes(y.id)) - Number(ids.includes(x.id)) || y.level - x.level);
  const toggle = (st: Student) => {
    sfx('move');
    if (ids.includes(st.id)) setDeploy(deploy.filter((d) => d.studentId !== st.id));
    else if (deploy.length < limit) setDeploy(deployFor(s, [...ids, st.id]).map((d) => deploy.find((x) => x.studentId === d.studentId) ?? d));
  };
  const usedArms = new Set(deploy.flatMap((x) => [x.armoryUid, x.staffUid]).filter(Boolean) as string[]);
  const L = intel.leader;
  const mapName = MAPS[q.template]?.name ?? '';
  const go = () => {
    sfx('ok');
    act((g) => {
      for (const x of deploy) if (x.item) g.items[x.item] = Math.max(0, g.items[x.item] - 1);
      if (manual) startBattle(g, q.id, deploy);
      else startAutoQuest(g, q.id, deploy, plan);
    });
  };
  return (
    <Sheet title={`出撃前：${q.title}`} onClose={onBack}>
      <div class="pcard" style={{ ['--band' as string]: q.clientCountry ? countryColor(q.clientCountry) : 'var(--main)' }}>
        <div class="infogrid">
          <div><Icon name={OBJECTIVE_ICON[q.objective]} size={17} />{OBJECTIVE_NAMES[q.objective]}</div>
          <div><Icon name={WEATHER_ICON[q.weather]} size={17} />{WEATHER_NAMES[q.weather]}・{mapName}</div>
          <div>危険度 <Stars n={q.danger} /></div>
          <div class={q.real ? '' : 'muted'}>{q.real ? <><Icon name="skull" size={17} />戦死あり</> : '誰も死なない'}</div>
        </div>
        {q.weather === 'rain' && <div class="small muted">雨：移動しにくく、銃は使えない</div>}
        {q.weather === 'fog' && <div class="small muted">霧：弓・魔法・銃が届きにくい</div>}
      </div>

      <h3>敵の情報</h3>
      <div class="pcard ab-intel" style={{ ['--band' as string]: q.enemyCountry ? countryColor(q.enemyCountry) : '#7a6a55' }}>
        {L ? <LeaderIntel s={s} q={q} leader={preview.auto?.leader ?? null} intel={L} ids={ids} onScout={(free) => {
          sfx('ok');
          let got: string | null = null;
          act((g) => { got = scoutQuest(g, q.id, free); });
          const ln = preview.auto?.leader?.name ?? '';
          setScoutMsg(got ? fill(SCOUT_TEXT.done, { leader: ln, trait: OFFICER_TRAITS[got].name, tip: OFFICER_TRAITS[got].tip }) : fill(SCOUT_TEXT.none, { leader: ln }));
          if (!free && deploy.length >= limit) setDeploy0(deploy.slice(0, Math.max(1, limit - 1)));
        }} scoutMsg={scoutMsg} /> : <div class="row nowrap gap6"><Icon name={classIcon(preview.units.find((u) => u.side === 'enemy')?.classId ?? 'fighter')} size={28} /><span class="muted">{q.real ? '敵将の名は分からない' : '演習の相手'}</span></div>}
        <div class="row gap4" style={{ marginTop: 6 }}>
          <span class="small">敵 <Num v={intel.count} unit="人" /></span>
          {intel.types.map((t) => <Chip>{t.name}×{t.n}</Chip>)}
        </div>
        <div class={`small ab-match ${intel.matchup >= 0.8 ? 'good' : intel.matchup <= -0.8 ? 'bad' : ''}`}>{intel.matchText}</div>
        {intel.alumni && s.students[intel.alumni] && <div class="small" style={{ color: 'var(--accent)' }}>敵の中に、教え子の{s.students[intel.alumni].given}の姿があるらしい</div>}
      </div>

      <div class="row between nowrap" style={{ marginTop: 10 }}>
        <h3 style={{ margin: 0 }}>出撃メンバー <span class="muted small">{deploy.length}／{limit}人</span></h3>
        <button class="btn small" onClick={() => { sfx('ok'); setDeploy(recommendDeploy(s, q, limit, (x) => deployFor(s, x))); setRoleOver({}); }}>おすすめの編成</button>
      </div>
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
            </button>
          );
        })}
      </div>

      <h3>作戦の方針</h3>
      <div class="ab-tactics">
        {TACTIC_OPTIONS[q.objective].map((id) => {
          const t = TACTICS[id];
          return (
            <button class={`ab-tac${tactic === id ? ' on' : ''}`} onClick={() => { sfx('move'); setTactic(id); }}>
              <b>{t.name}</b>{tacticFits(id, q) && <span class="ab-fit">この依頼に合う</span>}
              <span class="small">{t.desc}</span>
            </button>
          );
        })}
      </div>

      <h3>役割 <span class="muted small">兵種から自動で決まります（◎向いている ○ふつう △向かない）</span></h3>
      {deploy.map((d) => {
        const st = s.students[d.studentId];
        const role = roles[st.id];
        const arms = s.armory.filter((a) => canEquip(st, a.weaponId) && WEAPONS[a.weaponId].type !== 'staff' && (!usedArms.has(a.uid) || d.armoryUid === a.uid));
        const spells = usableSpells(st).map((id) => WEAPONS[id]?.name).filter(Boolean);
        return (
          <div class="ab-role">
            <div class="row nowrap gap6">
              <Portrait st={st} size={36} />
              <div class="grow" style={{ minWidth: 0 }}>
                <NameLine st={st} size={15} family={false} />
                <div class="small row nowrap gap4"><ClassName classId={st.classId} size={12} /><span class={`ab-weapon ${!d.armoryUid && !spells.length ? 'none' : 'muted'}`} onClick={() => setGearOpen(gearOpen === st.id ? null : st.id)}>{d.armoryUid ? WEAPONS[s.armory.find((a) => a.uid === d.armoryUid)!.weaponId].name : spells[0] ?? '武器なし'} ▾</span></div>
              </div>
            </div>
            <div class="seg ab-roleseg">
              {ROLE_IDS.map((r) => <button class={role === r ? 'on' : ''} onClick={() => { sfx('move'); setRoleOver({ ...roleOver, [st.id]: r }); }}>{ROLES[r].name}<small>{FIT_MARK[roleFit(st.classId, r)]}</small></button>)}
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
      <label class="row nowrap gap6 ab-manual"><input type="checkbox" checked={manual} onChange={(e) => setManual((e.target as HTMLInputElement).checked)} />この戦いは自分で指揮する（マスを動かす戦闘）</label>
      <button class="btn accent block" disabled={!deploy.length} onClick={go}>出撃する（{deploy.length}人）</button>
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
type Speed = 'stop' | 'normal' | 'fast';

/** 戦いの記録：1回の攻撃ごとのカード、上に両軍のHP。ここぞの判断は途中で止まる */
export function AutoBattleView() {
  const { s } = useStore();
  const b = s?.battle;
  const a = b?.auto;
  const items = useMemo(() => (b ? battleItems(b) : []), [a?.scenes.length, b?.units.length]);
  // 再開したときは、見終わった場面のあとから
  const startPos = useMemo(() => { if (!a) return 0; const i = items.findIndex((x) => (x.k === 'band' || x.k === 'title' || x.k === 'sync') && x.scene >= (a.shown ?? 0)); return a.shown ? (i < 0 ? items.length : i) : 0; }, []);
  const [pos, setPos] = useState(startPos);
  const [speed, setSpeed] = useState<Speed>('normal');
  const ref = useRef<HTMLDivElement>(null);
  const total = items.length;
  const atLogEnd = pos >= total;
  const atChoice = !!a?.choice && atLogEnd;
  const atEnd = !!a && a.seg >= 3 && atLogEnd && !a.choice;
  useEffect(() => { ref.current?.scrollTo?.({ top: ref.current.scrollHeight, behavior: 'smooth' }); }, [pos]);
  // 行動の多い戦いは、ふつうでも2分ほどに収まるよう少し速く
  const fit = useMemo(() => { const sec = items.reduce((t, x) => t + (x.k === 'band' ? AUTO.log.band : x.k === 'turn' || x.k === 'title' ? AUTO.log.turn : x.k === 'sync' ? 0 : AUTO.log.card), 0) / 1000; return sec > AUTO.log.maxSec ? AUTO.log.maxSec / sec : 1; }, [total]);
  // 再生
  useEffect(() => {
    if (speed === 'stop' || atLogEnd) return;
    const it = items[pos];
    const mul = ({ 1: 1.3, 2: 1, 3: 0.65 } as Record<number, number>)[s?.settings.animSpeed ?? 2] ?? 1;
    const base = it.k === 'band' ? AUTO.log.band : it.k === 'turn' || it.k === 'title' ? AUTO.log.turn : it.k === 'sync' ? 0 : AUTO.log.card;
    const ms = Math.max(0, base * mul * fit * (speed === 'fast' ? AUTO.log.fastMul : 1));
    const t = setTimeout(() => {
      setPos((p) => p + 1);
      if (it.k === 'sync') act((g) => { if (g.battle?.auto) g.battle.auto.shown = Math.max(g.battle.auto.shown, it.scene + 1); });
      if (it.k === 'atk' && it.e.hit) sfx(it.e.crit ? 'crit' : 'hit');
    }, ms);
    return () => clearTimeout(t);
  }, [pos, speed, total]);
  if (!s || !b || !a) return null;
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
        <div class="bl-title"><b class="serif">{b.title}</b>{q && <span class="small">{WEATHER_NAMES[q.weather]}・{OBJECTIVE_NAMES[q.objective]}{leader ? `（敵将${leader.name}）` : ''}</span>}</div>
        <div class="bl-hp">
          <div class="bl-side"><div class="bl-sidet ally">味方</div>{allies.slice(0, 10).map((u) => <HpRow name={nameOf(u.uid)} v={hp[u.uid] ?? u.maxHp} max={u.maxHp} down={gone.has(u.uid) || (hp[u.uid] ?? 1) <= 0} ally />)}</div>
          <div class="bl-side"><div class="bl-sidet foe">敵</div>{foes.slice(0, 10).map((u) => <HpRow name={nameOf(u.uid)} v={hp[u.uid] ?? u.maxHp} max={u.maxHp} down={gone.has(u.uid) || (hp[u.uid] ?? 1) <= 0} />)}{foes.length > 10 && <div class="small muted">ほか{foes.length - 10}人</div>}</div>
        </div>
      </div>
      <div class="ab-scene bl-log" ref={ref} onClick={() => { if (speed === 'stop') setSpeed('normal'); }}>
        {shown.length > view.length && <div class="small muted" style={{ textAlign: 'center' }}>（前の記録は省略）</div>}
        {view.map((it, n) => <LogItem key={shown.length - view.length + n} it={it} s={s} nameOf={nameOf} sideOf={sideOf} Face={Face} leader={leader} leaderColor={leaderColor} />)}
        {!atLogEnd && speed === 'stop' && <div class="ab-tap">止めています（タップで再開）</div>}
      </div>
      {atChoice && a.choice && (
        <div class="ab-choice">
          <div class={`ab-cprompt${a.choice.duo ? ' duo' : ''}`}><Icon name={a.choice.duo ? 'flame' : 'bell'} size={18} /> {a.choice.duo ? '宿命の対決' : 'ここぞの判断'}</div>
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
      {atEnd && <button class="btn primary block ab-endbtn" onClick={() => { sfx('ok'); act((g) => finishBattle(g)); }}>結果を見る</button>}
      {!atEnd && !atChoice && (
        <div class="ab-ctrl bl-ctrl">
          <button class={`btn small${speed === 'stop' ? ' primary' : ''}`} onClick={() => setSpeed('stop')}>⏸ 止める</button>
          <button class={`btn small${speed === 'normal' ? ' primary' : ''}`} onClick={() => setSpeed('normal')}>▶ ふつう</button>
          <button class={`btn small${speed === 'fast' ? ' primary' : ''}`} onClick={() => setSpeed('fast')}>▶▶ 速く</button>
          <button class="btn small" onClick={() => { if (!confirm('残りの判断はおすすめを選んで、結果まで進めます。よろしいですか？')) return; sfx('ok'); act((g) => { skipAuto(g, battleCtx(g)); finishBattle(g); }); }}>結果へ</button>
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
