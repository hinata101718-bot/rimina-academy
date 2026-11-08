// 自動の戦闘（5夜目）：出撃前の画面と、場面をタップで送る画面
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { act, useStore } from './store';
import { Sheet } from './common';
import { Portrait, FaceSvg } from './Portrait';
import { Icon } from './icons';
import { sfx } from './sound';
import { countryColor, Chip, Num, LvBadge, NameLine, ClassName, classIcon, OBJECTIVE_ICON, WEATHER_ICON, Stars } from './cards';
import type { GameState, Quest, Student } from '../core/state';
import type { Deploy } from '../core/battle/setup';
import { enrolled, available, deployLimit } from '../core/game';
import { deployFor, canEquip } from '../core/autoplay';
import { startAutoQuest, startBattle, battleCtx, finishBattle } from '../core/flow';
import { previewBattle, enemyIntel, estimateWin, recommendDeploy, defaultRole, roleFit, tacticFits, chooseAuto, skipAuto, type AutoPlan } from '../core/battle/auto';
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
  const limit = deployLimit(s);
  const [deploy, setDeploy] = useState<Deploy[]>(() => recommendDeploy(s, q, limit, (ids) => deployFor(s, ids)));
  const [tactic, setTactic] = useState<TacticId>(TACTIC_OPTIONS[q.objective][0]);
  const [roleOver, setRoleOver] = useState<Record<string, RoleId>>({});
  const [manual, setManual] = useState(false);
  const [est, setEst] = useState<{ key: string; label: string } | null>(null);
  const [gearOpen, setGearOpen] = useState<string | null>(null);
  const ids = deploy.map((d) => d.studentId);
  const roles: Record<string, RoleId> = {};
  for (const id of ids) roles[id] = roleOver[id] ?? defaultRole(s.students[id].classId, s.students[id]);
  const plan: AutoPlan = { tactic, roles };
  const key = `${ids.join(',')}|${deploy.map((d) => d.armoryUid).join(',')}|${tactic}|${ids.map((i) => roles[i]).join(',')}`;
  const preview = useMemo(() => previewBattle(s, q, deploy.length ? deploy : deployFor(s, enrolled(s).filter(available).slice(0, 1).map((x) => x.id)), plan), [key]);
  const intel = enemyIntel(s, preview);
  // 勝ち目：少し待ってから裏で試しに戦わせる
  useEffect(() => {
    if (!deploy.length) { setEst({ key, label: '—' }); return; }
    const t = setTimeout(() => setEst({ key, label: estimateWin(s, q, deploy, plan, battleCtx(s)).label }), 350);
    return () => clearTimeout(t);
  }, [key]);
  const avail = enrolled(s).filter(available);
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
        {L ? (
          <div class="row nowrap gap8">
            <span class="ab-leaderface"><FaceSvg face={L.face} size={56} /></span>
            <div class="grow">
              <div class="row nowrap gap6"><b class="serif" style={{ fontSize: 17 }}>{L.name}</b>{L.again && <Chip tone="red">因縁</Chip>}</div>
              <div class="small">{L.className}・<LvBadge lv={L.level} />　性格：{LEADER_NAMES[L.personality]}</div>
            </div>
          </div>
        ) : <div class="row nowrap gap6"><Icon name={classIcon(preview.units.find((u) => u.side === 'enemy')?.classId ?? 'fighter')} size={28} /><span class="muted">{q.real ? '敵将の名は分からない' : '演習の相手'}</span></div>}
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
              {st.fatigue >= AUTO.fatigueFrom && <span class="ab-warn">疲</span>}
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
                <div class="small row nowrap gap4"><ClassName classId={st.classId} size={12} /><span class="muted ab-weapon" onClick={() => setGearOpen(gearOpen === st.id ? null : st.id)}>{d.armoryUid ? WEAPONS[s.armory.find((a) => a.uid === d.armoryUid)!.weaponId].name : spells[0] ?? '武器なし'} ▾</span></div>
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

export function AutoBattleView() {
  const { s } = useStore();
  const b = s?.battle;
  const a = b?.auto;
  const [line, setLine] = useState(1);
  const [fast, setFast] = useState(false);
  const sceneIdx = Math.min(a?.shown ?? 0, Math.max(0, (a?.scenes.length ?? 1) - 1));
  const sc = a?.scenes[sceneIdx];
  const lastScene = !!a && sceneIdx >= a.scenes.length - 1;
  const allLines = !!sc && line >= sc.lines.length;
  const atChoice = !!a?.choice && lastScene && allLines;
  const atEnd = !!a && a.seg >= 3 && lastScene && allLines;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { setLine(1); }, [sceneIdx]);
  useEffect(() => { ref.current?.scrollTo?.({ top: ref.current.scrollHeight, behavior: 'smooth' }); }, [line, sceneIdx]);
  const next = () => {
    if (!s || !a || !sc) return;
    if (!allLines) { sfx('move'); setLine(line + 1); return; }
    if (!lastScene) { sfx('page'); act((g) => { if (g.battle?.auto) g.battle.auto.shown = sceneIdx + 1; }); }
  };
  useEffect(() => {
    if (!fast || atChoice || atEnd) return;
    const ms = AUTO.fastMs / ({ 1: 0.8, 2: 1, 3: 1.6 } as Record<number, number>)[s?.settings.animSpeed ?? 2];
    const t = setTimeout(next, ms);
    return () => clearTimeout(t);
  });
  if (!s || !b || !a || !sc) return null;
  const leader = a.leader;
  const isLast = (i: number) => i === line - 1;
  return (
    <div class="ab-view">
      <div class="ab-head">
        <div class="row between nowrap"><b class="serif">{b.title}</b><span class="small">{b.real ? '実戦' : '演習'}・{TACTICS[a.tactic].name}</span></div>
        <Gauge2 m={sc.momentum} />
      </div>
      <div class="ab-scene" ref={ref} onClick={next}>
        <div class="ab-stitle"><span>{sceneLabel(a.scenes, sceneIdx)}</span>{sc.title}</div>
        <div class="ab-faces">
          {sc.faces.map((id) => { const st = s.students[id]; if (!st) return null; const hurt = sc.hurt.includes(id); const down = sc.down.includes(id); return (
            <span class={`ab-face${down ? ' down' : ''}`}><Portrait st={st} size={44} frame={countryColor(st.origin)} />{hurt && !down && <span class="ab-hurt">傷</span>}{down && <span class="ab-hurt down">✕</span>}<span class="ab-fname">{st.given}</span></span>
          ); })}
        </div>
        {sc.lines.slice(0, line).map((l, i) => {
          const st = s.students[l.by];
          if (l.by === 'leader' && leader) return <div class={`ab-line say foe${isLast(i) ? ' new' : ''}`}><span class="ab-lface"><FaceSvg face={leader.face} size={40} /></span><div><div class="ab-who">{leader.name}</div><div>「{l.text}」</div></div></div>;
          if (st) return <div class={`ab-line say${isLast(i) ? ' new' : ''}`}><Portrait st={st} size={40} /><div><div class="ab-who">{st.given}</div><div>「{l.text}」</div></div></div>;
          return <div class={`ab-line narr${isLast(i) ? ' new' : ''}`}>{l.text.split('\n').map((x) => <div>{x}</div>)}</div>;
        })}
        {!allLines || !lastScene ? <div class="ab-tap">タップで次へ ▼</div> : null}
      </div>
      {atChoice && a.choice && (
        <div class="ab-choice">
          <div class="ab-cprompt"><Icon name="bell" size={18} /> ここぞの判断</div>
          <div class="ab-cq">{a.choice.prompt.split('\n').map((x) => <div>{x}</div>)}</div>
          {a.choice.options.map((o, i) => (
            <button class="btn block ab-copt" onClick={() => { sfx('ok'); setFast(false); act((g) => { chooseAuto(g, i, battleCtx(g)); if (g.battle?.auto) g.battle.auto.shown = sceneIdx + 1; }); }}>
              {o.actor && s.students[o.actor] && <Portrait st={s.students[o.actor]} size={32} />}
              <span class="grow"><b>{o.label}</b><span class="small muted">{o.note}</span></span>
            </button>
          ))}
        </div>
      )}
      {atEnd && <button class="btn primary block ab-endbtn" onClick={() => { sfx('ok'); act((g) => finishBattle(g)); }}>結果を見る</button>}
      {!atEnd && (
        <div class="ab-ctrl">
          <button class={`btn small${fast ? ' primary' : ''}`} onClick={() => setFast(!fast)}>{fast ? '早送り中' : '早送り'}</button>
          <button class="btn small ghost" onClick={() => { if (!confirm('残りの判断はおすすめを選んで、結果まで進めます。よろしいですか？')) return; sfx('ok'); act((g) => { skipAuto(g, battleCtx(g)); finishBattle(g); }); }}>結果だけ見る</button>
        </div>
      )}
    </div>
  );
}

function sceneLabel(list: { title: string }[], i: number): string {
  const n = list.slice(0, i + 1).filter((x) => x.title !== '指示').length;
  return list[i].title === '指示' ? '判断' : `第${n}幕`;
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

void B;
