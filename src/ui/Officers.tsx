// 敵将の名簿（6夜目）：三国の軍と盗賊団の幹部。会うほど情報が増える
import { KILL_REACT } from '../data/aftermath_war';
import { officerArts, artsLabel } from '../core/arts';
import { ARTS } from '../data/arts';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { GameState, EnemyOfficer } from '../core/state';
import { officerName, rankName, factionName, knowledge, stageName, fullName, officerById, orgChanges, markOrgSeen, prospectsOf, type OrgChange, type OrgChangeKind } from '../core/officers';
import { ROSTER_FACTIONS, FACTION_COLOR, OFFICER_TRAITS, RANK_NAMES, ageBand, type FactionId } from '../data/officers';
import { SCAR_TEXT } from '../data/officers_text';
import { LEADER_NAMES } from '../data/autobattle';
import { CLASSES } from '../data/classes';
import { MONTH_NAMES } from '../core/util';
import { OfficerFace, Portrait } from './Portrait';
import { Sheet } from './common';
import { Chip, LvBadge, countryColor } from './cards';
import { Icon } from './icons';
import { navigate, useStore, act } from './store';
import { sfx } from './sound';

const MEET_NAMES: Record<string, string> = { win: '勝ったが取り逃がす', lose: '敗れる', fled: '取り逃がす', fell: '討ち取る', spared: '見逃す', persuaded: '説き伏せる', yielded: '一騎打ちで破る' };
const AGE_NAMES = { young: '若い', middle: '壮年', old: '年配' };
type Tab = FactionId | 'gone';

export function OfficerRoster({ s }: { s: GameState }) {
  const { route } = useStore();
  const focus = route.page === 'officers' && route.id ? officerById(s, route.id) : null;
  const [tab, setTab] = useState<Tab>(() => (focus && focus.faction !== 'monster' ? focus.faction : 'kingdom'));
  const [open, setOpen] = useState<string | null>(null);
  // 前に見たときからの変化：はじめて開いたときに決めて、画面を離れるときに「見た」にする（9夜目）
  const [diffs] = useState<Record<string, OrgChange[]>>(() => Object.fromEntries(ROSTER_FACTIONS.map((f) => [f, orgChanges(s, f)])));
  const viewed = useRef(new Set<FactionId>());
  if (tab !== 'gone' && tab !== 'monster') viewed.current.add(tab as FactionId);
  useEffect(() => () => { const v = [...viewed.current]; if (v.length) act((g) => { for (const f of v) markOrgSeen(g, f); }); }, []);
  const all = s.officers ?? [];
  const list = tab === 'gone'
    ? all.filter((o) => o.status !== 'active' && o.meets.length && !o.prospect).reverse()
    : tab === 'monster' ? all.filter((o) => o.faction === 'monster')
    : [];
  const monsters = all.some((o) => o.faction === 'monster');
  const tabs: Tab[] = [...ROSTER_FACTIONS, ...(monsters ? ['monster' as Tab] : []), 'gone'];
  const sel = open ? all.find((o) => o.id === open) : null;
  const met = all.filter((o) => o.meets.length && !o.prospect).length;
  return (
    <div>
      <div class="card small muted">三国の軍と盗賊団の組織図です。戦場で会うほど、敵将のことが分かっていきます。これまでに会った敵将は<b>{met}人</b>です。</div>
      <div class="pills ofc-tabs">
        {tabs.map((x) => <button class={tab === x ? 'on' : ''} style={x !== 'gone' ? { ['--band' as string]: FACTION_COLOR[x as FactionId] } : undefined} onClick={() => { sfx('move'); setTab(x); }}>{x === 'gone' ? '去った敵将' : factionName(x as FactionId)}{x !== 'gone' && x !== 'monster' && (diffs[x]?.length ?? 0) > 0 && <span class="org-dot">{diffs[x].length}</span>}</button>)}
      </div>
      {tab !== 'gone' && tab !== 'monster' && <OrgChart key={tab} s={s} f={tab as FactionId} changes={diffs[tab] ?? []} focus={focus?.faction === tab ? focus.id : null} onOpen={setOpen} />}
      {(tab === 'gone' || tab === 'monster') && list.map((o) => <OfficerRow s={s} o={o} onOpen={() => setOpen(o.id)} />)}
      {(tab === 'gone' || tab === 'monster') && !list.length && <div class="empty-note">まだいません</div>}
      {sel && <OfficerSheet s={s} o={sel} onClose={() => setOpen(null)} />}
    </div>
  );
}

// ================= 組織図（9夜目） =================
const CH_LABEL: Record<OrgChangeKind, string> = { new: '✦ 新任', promote: '↑ 昇進', fell: '✕ 討ち取り', gone: '✕ 去った', contest: '⚔ 争い中', epithet: '二つ名', raised: '⇧ 抜擢', prospect: '✦ 見込み' };
const CH_ICON: Record<OrgChangeKind, string> = { new: '✦', promote: '↑', fell: '✕', gone: '✕', contest: '⚔', epithet: '名', raised: '⇧', prospect: '✦' };
interface ONode { o: EnemyOfficer; rank: number; parent?: string; gone?: boolean; change?: OrgChange; ep?: string }

function buildNodes(s: GameState, f: FactionId, prev: boolean, changes: OrgChange[]): ONode[] {
  const seen = s.orgSeen?.[f]?.o ?? {};
  const all = (s.officers ?? []).filter((o) => o.faction === f);
  if (prev && Object.keys(seen).length) {
    return Object.entries(seen).filter(([, m]) => m.status === 'active' && !m.prospect).map(([id, m]) => ({ id, m, o: all.find((x) => x.id === id) })).filter((x) => x.o).map((x) => ({ o: x.o!, rank: x.m.rank, parent: x.m.parent, ep: x.m.ep ?? '' }));
  }
  const ch = new Map(changes.map((c) => [c.id, c]));
  const out: ONode[] = [];
  for (const o of all) {
    if (o.prospect) continue;
    if (o.status === 'active') { out.push({ o, rank: o.rank, parent: o.parent, change: ch.get(o.id) }); continue; }
    // 前に見たあとで討ち取られた・去った敵将は、元の場所に灰色で
    const m = seen[o.id];
    if (m && m.status === 'active' && ch.has(o.id)) out.push({ o, rank: m.rank, parent: m.parent, gone: true, change: ch.get(o.id) });
  }
  return out;
}

function OrgChart({ s, f, changes, focus, onOpen }: { s: GameState; f: FactionId; changes: OrgChange[]; focus: string | null; onOpen: (id: string) => void }) {
  const [prev, setPrev] = useState(false);
  const [play, setPlay] = useState<number | null>(null);
  // 最後に引く：場面のあと、木の全体を見せて、変わった席だけを強く光らせる（13夜目）
  const [finale, setFinale] = useState(false);
  const endPlay = () => { setPlay(null); setFinale(true); setTimeout(() => treeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); setTimeout(() => setFinale(false), 2600); };
  const nodes = buildNodes(s, f, prev, changes);
  const kind = f === 'bandit' ? 'bandit' : 'army';
  const head = nodes.find((n) => n.rank === 0);
  const mids = nodes.filter((n) => n.rank === 1);
  const kidsOf = (id: string) => nodes.filter((n) => n.rank === 2 && n.parent === id);
  const orphans = nodes.filter((n) => n.rank === 2 && !mids.some((m) => m.o.id === n.parent));
  const prospects = prospectsOf(s, f);
  const treeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // 木が画面より広いときは、真ん中（将軍）が見えるように
    const el = treeRef.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    if (focus) setTimeout(() => document.querySelector(`[data-oid="${focus}"]`)?.scrollIntoView?.({ block: 'center', inline: 'center', behavior: 'smooth' }), 200);
  }, [prev]);
  const Node = ({ n }: { n: ONode }) => <OrgNode s={s} n={n} prev={prev} focus={focus === n.o.id} onOpen={() => onOpen(n.o.id)} />;
  return (
    <div class="org-wrap" style={{ ['--band' as string]: FACTION_COLOR[f] }}>
      {changes.length > 0 && (
        <div class="org-changes">
          <button class="org-bigplay" onClick={() => { sfx('ok'); setPlay(0); }}>✦ この前から{changes.length}つの変化があります　▶ 見る</button>
          {changes.slice(0, 8).map((c, i) => <div class={`org-ch ${c.kind}`} onClick={() => { sfx('ok'); setPlay(i); }}><span class="org-chi">{CH_ICON[c.kind]}</span><span>{c.text}</span></div>)}
          {changes.length > 8 && <div class="small muted">ほか{changes.length - 8}件</div>}
          <div class="row nowrap gap6" style={{ marginTop: 6 }}>
            <div class="seg org-seg"><button class={prev ? 'on' : ''} onClick={() => { sfx('move'); setPrev(true); }}>前回</button><button class={!prev ? 'on' : ''} onClick={() => { sfx('move'); setPrev(false); }}>今</button></div>
            <button class="btn small org-playbtn" onClick={() => { sfx('ok'); setPlay(0); }}>▶ 変わったところを見る</button>
          </div>
        </div>
      )}
      <div class={`org-tree${finale ? ' finale' : ''}`} ref={treeRef}>
        <ul class="org-root">
          <li>
            {head ? <Node n={head} /> : <div class="org-vacant">{RANK_NAMES[kind][0]}の座は空いています</div>}
            {(mids.length > 0 || orphans.length > 0) && (
              <ul>
                {mids.map((m) => (
                  <li>
                    <Node n={m} />
                    {kidsOf(m.o.id).length > 0 && <ul>{kidsOf(m.o.id).map((k) => <li><Node n={k} /></li>)}</ul>}
                  </li>
                ))}
                {orphans.length > 0 && <li><div class="org-vacant small">直属の{RANK_NAMES[kind][2]}</div><ul>{orphans.map((k) => <li><Node n={k} /></li>)}</ul></li>}
              </ul>
            )}
          </li>
        </ul>
      </div>
      <div class="org-legend small"><span class="lg new">新任</span><span class="lg promote">昇進</span><span class="lg fell">討ち取り</span><span class="lg contest">争い中</span><span class="lg epithet">二つ名</span><span class="lg raised">抜擢</span><span class="lg alumni">教え子</span></div>
      <h3 style={{ marginBottom: 2 }}>見込みのある兵 <span class="small muted">戦いで目立った兵です。{RANK_NAMES[kind][2]}の席が空くと、選ばれることがあります</span></h3>
      {prospects.length ? (
        <div class="org-prospects">
          {prospects.map((o) => (
            <div class="org-pro" onClick={() => { sfx('ok'); onOpen(o.id); }}>
              <span class="org-face"><OfficerFace o={o} size={44} frame={FACTION_COLOR[o.faction]} s={s} /></span>
              <b class="small">{officerName(o)}</b>
              <span class="small muted">{o.deed}</span>
              {changes.some((c) => c.id === o.id) && <span class="org-tag new">✦ 新しく</span>}
            </div>
          ))}
        </div>
      ) : <div class="small muted">まだいません</div>}
      {play !== null && changes[play] && <ChangePlayer s={s} c={changes[play]} i={play} n={changes.length} onNext={() => { if (play + 1 < changes.length) setPlay(play + 1); else endPlay(); }} onClose={() => setPlay(null)} />}
    </div>
  );
}

function OrgNode({ s, n, prev, focus, onOpen }: { s: GameState; n: ONode; prev: boolean; focus: boolean; onOpen: () => void }) {
  const o = n.o;
  const k = knowledge(o);
  const unknown = k === 0 && n.rank > 0 && !o.alumniId && !n.change;
  const c = prev ? undefined : n.change;
  const alum = o.alumniId ? s.students[o.alumniId] : null;
  const size = n.rank === 0 ? 64 : 46;
  const name = prev ? (n.ep ? `${n.ep}${o.given}` : fullName(o)) : officerName(o);
  const rk = rankName({ kind: o.kind, rank: n.rank, title: o.title });
  const killer = c?.kind === 'fell' ? c.text.match(/（(.+)）/)?.[1] : null;
  let note = '';
  if (killer) note = `${killer}が討った`;
  else if (c?.kind === 'promote' && c.from !== undefined) note = `元・${rankName({ kind: o.kind, rank: c.from })}`;
  else if (c?.kind === 'raised') note = '元・一兵卒';
  else if (alum) note = `${alum.cohort}期生・${factionName(o.faction)}へ`;
  else if (o.victims.length && !prev) note = `${o.victims[o.victims.length - 1].name}の仇`;
  const tag = alum && !c ? { cls: 'alumni', text: '教え子' } : c ? { cls: c.kind, text: CH_LABEL[c.kind] } : o.contest && !prev ? { cls: 'contest', text: CH_LABEL.contest } : null;
  return (
    <div class={`org-node r${n.rank}${n.gone ? ' gone' : ''}${c && !n.gone ? ' lit' : ''}${focus ? ' focus' : ''}${unknown ? ' unknown' : ''}`} data-oid={o.id} onClick={() => { sfx('ok'); onOpen(); }}>
      {tag && <span class={`org-tag ${tag.cls}`}>{tag.text}</span>}
      <span class={`org-face${alum ? ' alum' : ''}`} style={{ ['--ring' as string]: alum ? '#2f5fa8' : FACTION_COLOR[o.faction] }}>
        {unknown ? <span class="org-q" style={{ width: size, height: size }}>？</span> : <OfficerFace o={{ ...o, status: n.gone ? 'dead' : 'active' }} size={size} frame={alum ? '#2f5fa8' : FACTION_COLOR[o.faction]} s={s} />}
      </span>
      <b class={`org-name${n.gone ? ' strike' : ''}`}>{unknown ? '？？？' : name}</b>
      <span class="org-rank">{rk}</span>
      {note && !unknown && <span class="org-note">{note}</span>}
    </div>
  );
}

/** 変化の演出：昇進は顔が線をたどって上の段へ、討ち取りは白黒とひび、抜擢は一般兵から顔へ（タップで次の変化へ） */
/** 組織図の変化を1つずつ場面で（13夜目：見本 orgchart-fx.png）。上に「変化 1／3」、変化のあった席を大きく、下の黒い窓に見出しと説明 */
function ChangePlayer({ s, c, i, n, onNext, onClose }: { s: GameState; c: OrgChange; i: number; n: number; onNext: () => void; onClose: () => void }) {
  const o = officerById(s, c.id);
  const [go, setGo] = useState(false);
  useEffect(() => { setGo(false); sfx(c.kind === 'fell' ? 'kill' : c.kind === 'promote' || c.kind === 'raised' ? 'level' : 'pass'); const t = setTimeout(() => setGo(true), 450); return () => clearTimeout(t); }, [c.id, c.kind]);
  if (!o) return null;
  const ring = FACTION_COLOR[o.faction];
  const rn = (r: number) => (r >= 3 ? '一兵卒' : rankName({ kind: o.kind, rank: r }));
  const m = o.meets[o.meets.length - 1];
  const killer = c.kind === 'fell' && m?.foes?.length ? s.students[m.foes[0]] : null;
  const react = killer ? (KILL_REACT[killer.personality] ?? KILL_REACT.serious)[0] : null;
  const fl = (x: string) => x.replace(/\{a\}/g, killer?.given ?? '').replace(/\{l\}/g, officerName(o));
  const head = f0(s, o.faction);
  const title = c.kind === 'fell' ? `${officerName(o)}、${killer ? `${killer.given}に` : ''}討たれる` : c.kind === 'raised' ? `${officerName(o)}、${rn(c.to ?? o.rank)}に抜擢` : c.kind === 'promote' ? `${officerName(o)}、${rn(c.to ?? o.rank)}の座に` : c.kind === 'new' ? `${officerName(o)}、新しく${rn(o.rank)}に` : c.kind === 'gone' ? `${officerName(o)}、去る` : c.kind === 'contest' ? `${officerName(o)}、${RANK_NAMES[o.kind === 'army' ? 'army' : 'bandit'][0]}の座をねらう` : c.kind === 'epithet' ? `${o.given}、「${officerName(o)}」と呼ばれる` : c.text;
  const desc = c.kind === 'fell' ? `${rn(o.rank)}の席が空いた（このあと、だれかが座る）` : c.kind === 'raised' ? `「見込みのある兵」から上がった。${o.deed ?? ''}` : c.kind === 'promote' ? `${o.given}のいた${rn(c.from ?? o.rank + 1)}の席が空く → 次の変化で埋まる` : c.kind === 'new' ? `空いていた${rn(o.rank)}の席に、新しい顔が座った。戦場で会うかもしれない` : c.kind === 'gone' ? `${o.endNote ?? '戦場を去った'}。${rn(o.rank)}の席が空いた` : c.text;
  const say = c.kind === 'raised' ? `「この席は、おれが継ぐ」` : c.kind === 'promote' ? '「上の席が空いたなら、座るまでだ」' : c.kind === 'new' ? '「名を覚えておけ。すぐに思い知らせてやる」' : c.kind === 'contest' ? '「頭の座は、力ずくでいただく」' : '';
  return (
    <div class="oc-player" onClick={(e) => { e.stopPropagation(); sfx('move'); onNext(); }}>
      <div class="oc-phead"><b class="serif">{factionName(o.faction)}の組織図</b><span class="oc-pcount">変化 {i + 1}／{n}</span></div>
      <div class={`oc-stage ${c.kind}${go ? ' go' : ''}`} key={c.id + c.kind}>
        {c.kind === 'promote' && <div class="oc-seat empty"><span class="oc-ring" /><b>空いた席</b><span class="small">{rn(c.to ?? o.rank)}</span></div>}
        {c.kind === 'promote' && <div class="oc-arrow">▲</div>}
        {c.kind === 'contest' && head && head.id !== o.id && <div class="oc-seat top"><OfficerFace o={head} size={90} frame={FACTION_COLOR[head.faction]} s={s} /><b>{officerName(head)}</b><span class="small">{rn(0)}</span></div>}
        {c.kind === 'contest' && <div class="oc-arrow red">⚔</div>}
        <div class={`oc-seat main ${c.kind}`}>
          <span class="oc-face">
            <OfficerFace o={c.kind === 'fell' || c.kind === 'gone' ? { ...o, status: 'dead' } : o} size={150} frame={c.kind === 'fell' || c.kind === 'gone' ? '#555' : ring} s={s} />
            {c.kind === 'fell' && <span class="stamp oc-stamp">討取</span>}
            {c.kind === 'fell' && <span class="org-crackline" />}
            {(c.kind === 'raised' || c.kind === 'promote' || c.kind === 'new') && <span class={`oc-badge ${c.kind}`}>{c.kind === 'raised' ? '⇧ 抜擢' : c.kind === 'promote' ? '↑ 昇進' : '✦ 新任'}</span>}
          </span>
          <b class={`serif${c.kind === 'fell' || c.kind === 'gone' ? ' oc-strike' : ''}`}>{officerName(o)}</b>
          <span class="small">{c.kind === 'raised' ? `${rn(c.to ?? o.rank)}（もと一般兵）` : c.kind === 'gone' ? `${rn(o.rank)}（${o.endNote ?? '引退'}）` : rn(c.kind === 'promote' ? (c.from ?? o.rank + 1) : o.rank)}</span>
        </div>
        {say && <div class="oc-bubble">{say}</div>}
        {c.kind === 'raised' && (
          <div class="oc-pros">
            <span class="small">見込みのある兵</span>
            <div class="row nowrap gap6">{prospectsOf(s, o.faction).slice(0, 3).map((p) => <OfficerFace o={p} size={40} frame={FACTION_COLOR[p.faction]} s={s} />)}</div>
          </div>
        )}
        {killer && (
          <div class="oc-killer">
            <Portrait st={killer} size={64} frame="#3a6ad0" />
            <span class="oc-x">⚔</span>
            <div class="oc-bubble small"><div>「{react ? fl(react.say) : 'これで、終わりだ'}」</div>{react && <div class="muted">{fl(react.n)}</div>}</div>
          </div>
        )}
      </div>
      <div class="oc-pwin"><b class="serif">{title}</b><div class="small">{desc}</div></div>
      <div class="oc-pbtns" onClick={(e) => e.stopPropagation()}>
        <button class="btn primary" onClick={() => { sfx('move'); onNext(); }}>タップで次へ</button>
        <button class="btn" onClick={() => { sfx('cancel'); onClose(); }}>全部とばす</button>
      </div>
    </div>
  );
}
/** その陣営の今の頭（将軍・頭目） */
function f0(s: GameState, f: string): EnemyOfficer | undefined { return (s.officers ?? []).find((x) => x.faction === f && x.status === 'active' && x.rank === 0); }

function OfficerRow({ s, o, onOpen }: { s: GameState; o: EnemyOfficer; onOpen: () => void }) {
  const k = knowledge(o);
  const rivals = Object.values(s.rivalries ?? {}).filter((r) => r.oid === o.id && (r.stage >= 1 || r.vow));
  return (
    <div class="pcard tap ofc-row" style={{ ['--band' as string]: FACTION_COLOR[o.faction] }} onClick={() => { sfx('ok'); onOpen(); }}>
      <div class="row nowrap gap8">
        <OfficerFace o={o} size={52} frame={FACTION_COLOR[o.faction]} s={s} dim={k === 0 && o.status === 'active' ? false : undefined} />
        <div class="grow" style={{ minWidth: 0 }}>
          <div class="row nowrap gap6"><b class="serif ofc-name" style={{ fontSize: 16 }}>{officerName(o)}</b>{o.alumniId && <Chip tone="gold">教え子</Chip>}{o.status !== 'active' && <span class="flag">{o.status === 'dead' ? '討死' : o.status === 'defeated' ? '敗退' : '引退'}</span>}</div>
          <div class="small">{o.kind === 'monster' ? '魔物の主' : `${factionName(o.faction)}・${rankName(o)}`}{k > 0 ? `　兵種：${CLASSES[o.classId]?.name ?? ''}・Lv${o.level}` : '　兵種：？'}</div>
          <div class="small muted">{k === 0 ? 'まだ会ったことがありません' : `会った回数 ${o.meets.length}回${o.scars ? '・傷あり' : ''}${o.victims.length ? `・教え子を${o.victims.length}人倒した` : ''}`}</div>
        </div>
        {o.kind !== 'monster' && <div class="ofc-mini">{o.traits.map((t) => <span class={o.knownTraits.includes(t) ? (OFFICER_TRAITS[t].weak ? 'w' : 'st') : 'q'}>{o.knownTraits.includes(t) ? (OFFICER_TRAITS[t].style ? (t === 'valor' ? '武' : '采') : OFFICER_TRAITS[t].weak ? '弱' : '強') : '？'}</span>)}</div>}
      </div>
      {rivals.length > 0 && <div class="row gap4" style={{ marginTop: 4 }}>{rivals.slice(0, 4).map((r) => s.students[r.sid] && <span class="ofc-rival"><Portrait st={s.students[r.sid]} size={22} />{s.students[r.sid].given}：{r.settled ? '決着' : r.vow ? '仇討ちの誓い' : stageName(r.stage)}</span>)}</div>}
    </div>
  );
}

export function OfficerSheet({ s, o, onClose }: { s: GameState; o: EnemyOfficer; onClose: () => void }) {
  const k = knowledge(o);
  const alum = o.alumniId ? s.students[o.alumniId] : null;
  const rivals = Object.values(s.rivalries ?? {}).filter((r) => r.oid === o.id && (r.stage >= 1 || r.vow || r.settled) && s.students[r.sid]);
  const grudge = o.grudge ? s.students[o.grudge] : null;
  return (
    <Sheet title="敵将" onClose={onClose}>
      <div class="pcard" style={{ ['--band' as string]: FACTION_COLOR[o.faction] }}>
        <div class="row nowrap gap8" style={{ alignItems: 'flex-start' }}>
          <OfficerFace o={o} size={112} frame={FACTION_COLOR[o.faction]} s={s} />
          <div class="grow" style={{ minWidth: 0 }}>
            <div class="serif" style={{ fontSize: 19, fontWeight: 'bold', lineHeight: 1.3 }}>{officerName(o)}</div>
            {o.epithet && o.kind === 'army' && <div class="small muted">本名 {fullName(o)}</div>}
            <div class="small">{o.kind === 'monster' ? '魔物の主' : `${factionName(o.faction)}・${rankName(o)}`}</div>
            {k > 0 ? <div class="small">兵種：{CLASSES[o.classId]?.name}・<LvBadge lv={o.level} /></div> : <div class="small muted">兵種・レベル：？</div>}
            <div class="small">性格：{k > 0 || o.rank === 0 ? LEADER_NAMES[o.personality as keyof typeof LEADER_NAMES] ?? '' : '？'}　{o.kind !== 'monster' && `年頃：${AGE_NAMES[ageBand(o.age)]}`}</div>
            {o.scars > 0 && <div class="small muted">{SCAR_TEXT[Math.min(4, o.scars)]}</div>}
            {alum && <div class="small" style={{ color: 'var(--gold)' }}>{alum.cohort}期生の教え子</div>}
          </div>
        </div>
        {o.endNote && <div class="small" style={{ marginTop: 4 }}>{o.endYear}年目：{o.endNote}</div>}
        {o.prospect && <div class="small" style={{ marginTop: 4 }}>見込みのある兵：{o.deed}</div>}
        {o.raisedYear && <div class="small" style={{ marginTop: 4 }}>{o.raisedYear}年目に、一兵卒から取り立てられました（{o.deed}）</div>}
      </div>
      {o.kind !== 'monster' && officerArts(o, s).length > 0 && <div class="small" style={{ marginTop: 4 }}>戦技：<b>{officerArts(o, s).map((x) => ARTS[x]?.name).join('・')}</b>（{artsLabel(officerArts(o, s))}）</div>}
      {o.kind !== 'monster' && (
        <>
          <h3>隠れた特徴</h3>
          {o.traits.map((t) => o.knownTraits.includes(t)
            ? <div class="ofc-traitrow"><span class={`ofc-trait ${OFFICER_TRAITS[t].style ? 'style' : OFFICER_TRAITS[t].weak ? 'weak' : 'strong'}`}>{OFFICER_TRAITS[t].style ? '型' : OFFICER_TRAITS[t].weak ? '弱点' : '強み'}：{OFFICER_TRAITS[t].name}</span><div class="small">{OFFICER_TRAITS[t].desc}。{OFFICER_TRAITS[t].tip}</div></div>
            : <div class="ofc-traitrow"><span class="ofc-trait unknown">？</span><span class="small muted">まだ分かりません。戦ったり、偵察したり、卒業生から手紙が来たりすると分かります</span></div>)}
        </>
      )}
      {(o.victims.length > 0 || grudge) && <h3>この敵将の記憶</h3>}
      {o.victims.map((v) => <div class="small"><Icon name="skull" size={14} /> {v.year}年目、{v.name}を{v.dead ? '討った' : '重傷に追いこんだ'}</div>)}
      {grudge && o.status === 'active' && <div class="small ofc-warn"><Icon name="target" size={14} /> {grudge.given}に負けたことを根に持って、つけ狙っています</div>}
      {rivals.length > 0 && <h3>教え子との因縁</h3>}
      {rivals.map((r) => { const st = s.students[r.sid]; return (
        <div class="row nowrap gap6 ruled" onClick={() => { onClose(); navigate({ tab: 'students', page: 'detail', id: st.id }); }}>
          <Portrait st={st} size={36} frame={countryColor(st.origin)} />
          <div class="grow"><b>{st.given}</b> <span class="small">{r.settled ? '決着' : r.vow ? `仇討ちの誓い（${s.students[r.vow]?.given ?? ''}）` : stageName(r.stage)}</span><div class="small muted">戦った回数 {r.battles}回{r.log.length ? `・${r.log[r.log.length - 1].text}` : ''}</div></div>
        </div>
      ); })}
      <h3>戦いの記録</h3>
      {o.meets.length ? <ul class="list small" style={{ margin: 0 }}>{o.meets.map((m) => <li>{m.year}年目 {MONTH_NAMES[m.month]}「{m.title}」：{MEET_NAMES[m.result] ?? m.result}{m.foes?.length ? `（${m.foes.map((id) => s.students[id]?.given).filter(Boolean).slice(0, 3).join('・')}）` : ''}</li>)}</ul> : <div class="small muted">まだ戦ったことがありません</div>}
    </Sheet>
  );
}
