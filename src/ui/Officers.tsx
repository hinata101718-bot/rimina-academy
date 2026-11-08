// 敵将の名簿（6夜目）：三国の軍と盗賊団の幹部。会うほど情報が増える
import { useState } from 'preact/hooks';
import type { GameState, EnemyOfficer } from '../core/state';
import { officerName, rankName, factionName, knowledge, stageName, fullName } from '../core/officers';
import { ROSTER_FACTIONS, FACTION_COLOR, OFFICER_TRAITS, ageBand, type FactionId } from '../data/officers';
import { SCAR_TEXT } from '../data/officers_text';
import { LEADER_NAMES } from '../data/autobattle';
import { CLASSES } from '../data/classes';
import { MONTH_NAMES } from '../core/util';
import { OfficerFace, Portrait } from './Portrait';
import { Sheet } from './common';
import { Chip, LvBadge, countryColor } from './cards';
import { Icon } from './icons';
import { navigate } from './store';
import { sfx } from './sound';

const MEET_NAMES: Record<string, string> = { win: '勝ったが取り逃がす', lose: '敗れる', fled: '取り逃がす', fell: '討ち取る', spared: '見逃す', persuaded: '説き伏せる', yielded: '一騎打ちで破る' };
const AGE_NAMES = { young: '若い', middle: '壮年', old: '年配' };
type Tab = FactionId | 'gone';

export function OfficerRoster({ s }: { s: GameState }) {
  const [tab, setTab] = useState<Tab>('kingdom');
  const [open, setOpen] = useState<string | null>(null);
  const all = s.officers ?? [];
  const list = tab === 'gone'
    ? all.filter((o) => o.status !== 'active' && o.meets.length).reverse()
    : tab === 'monster' ? all.filter((o) => o.faction === 'monster')
    : all.filter((o) => o.faction === tab && o.status === 'active').sort((a, c) => a.rank - c.rank || c.meets.length - a.meets.length);
  const monsters = all.some((o) => o.faction === 'monster');
  const tabs: Tab[] = [...ROSTER_FACTIONS, ...(monsters ? ['monster' as Tab] : []), 'gone'];
  const sel = open ? all.find((o) => o.id === open) : null;
  const met = all.filter((o) => o.meets.length).length;
  return (
    <div>
      <div class="card small muted">三国の軍と盗賊団の幹部たち。戦場で会うほど、敵将のことが分かっていきます（会ったことのない敵将は、名前と顔しか分かりません）。これまでに会った敵将：<b>{met}人</b></div>
      <div class="pills ofc-tabs">
        {tabs.map((t) => <button class={tab === t ? 'on' : ''} style={t !== 'gone' ? { ['--band' as string]: FACTION_COLOR[t as FactionId] } : undefined} onClick={() => { sfx('move'); setTab(t); }}>{t === 'gone' ? '去った敵将' : factionName(t as FactionId)}</button>)}
      </div>
      {tab !== 'gone' && tab !== 'monster' && <FactionTree s={s} f={tab as FactionId} onOpen={setOpen} />}
      {(tab === 'gone' || tab === 'monster') && list.map((o) => <OfficerRow s={s} o={o} onOpen={() => setOpen(o.id)} />)}
      {(tab === 'gone' || tab === 'monster') && !list.length && <div class="empty-note">まだいません</div>}
      {sel && <OfficerSheet s={s} o={sel} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** 勢力図：頭を上に、幹部・隊長の順 */
function FactionTree({ s, f, onOpen }: { s: GameState; f: FactionId; onOpen: (id: string) => void }) {
  const list = (s.officers ?? []).filter((o) => o.faction === f && o.status === 'active');
  return (
    <div class="ofc-tree" style={{ ['--band' as string]: FACTION_COLOR[f] }}>
      {[0, 1, 2].map((rank) => {
        const row = list.filter((o) => o.rank === rank).sort((a, c) => c.meets.length - a.meets.length);
        if (!row.length) return null;
        return (
          <div class="ofc-tier">
            <div class="ofc-tiername">{rankName({ kind: f === 'bandit' ? 'bandit' : 'army', rank })}</div>
            {row.map((o) => <OfficerRow s={s} o={o} onOpen={() => onOpen(o.id)} />)}
          </div>
        );
      })}
    </div>
  );
}

function OfficerRow({ s, o, onOpen }: { s: GameState; o: EnemyOfficer; onOpen: () => void }) {
  const k = knowledge(o);
  const rivals = Object.values(s.rivalries ?? {}).filter((r) => r.oid === o.id && (r.stage >= 1 || r.vow));
  return (
    <div class="pcard tap ofc-row" style={{ ['--band' as string]: FACTION_COLOR[o.faction] }} onClick={() => { sfx('ok'); onOpen(); }}>
      <div class="row nowrap gap8">
        <OfficerFace o={o} size={52} frame={FACTION_COLOR[o.faction]} s={s} dim={k === 0 && o.status === 'active' ? false : undefined} />
        <div class="grow" style={{ minWidth: 0 }}>
          <div class="row nowrap gap6"><b class="serif ofc-name" style={{ fontSize: 16 }}>{officerName(o)}</b>{o.alumniId && <Chip tone="gold">教え子</Chip>}{o.status !== 'active' && <span class="flag">{o.status === 'dead' ? '討死' : o.status === 'defeated' ? '敗退' : '引退'}</span>}</div>
          <div class="small">{o.kind === 'monster' ? '魔物の主' : `${factionName(o.faction)}・${rankName(o)}`}{k > 0 ? `・${CLASSES[o.classId]?.name ?? ''}・Lv${o.level}` : '・？'}</div>
          <div class="small muted">{k === 0 ? 'まだ会ったことがない' : `会った回数 ${o.meets.length}回${o.scars ? '・傷あり' : ''}${o.victims.length ? `・教え子を${o.victims.length}人倒した` : ''}`}</div>
        </div>
        {o.kind !== 'monster' && <div class="ofc-mini">{o.traits.map((t) => <span class={o.knownTraits.includes(t) ? (OFFICER_TRAITS[t].weak ? 'w' : 'st') : 'q'}>{o.knownTraits.includes(t) ? (OFFICER_TRAITS[t].weak ? '弱' : '強') : '？'}</span>)}</div>}
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
            {k > 0 ? <div class="small">{CLASSES[o.classId]?.name}・<LvBadge lv={o.level} /></div> : <div class="small muted">兵種・レベル：？</div>}
            <div class="small">性格：{k > 0 || o.rank === 0 ? LEADER_NAMES[o.personality as keyof typeof LEADER_NAMES] ?? '' : '？'}　{o.kind !== 'monster' && `年頃：${AGE_NAMES[ageBand(o.age)]}`}</div>
            {o.scars > 0 && <div class="small muted">{SCAR_TEXT[Math.min(4, o.scars)]}</div>}
            {alum && <div class="small" style={{ color: 'var(--gold)' }}>{alum.cohort}期生の教え子</div>}
          </div>
        </div>
        {o.endNote && <div class="small" style={{ marginTop: 4 }}>{o.endYear}年目：{o.endNote}</div>}
      </div>
      {o.kind !== 'monster' && (
        <>
          <h3>隠れた特徴</h3>
          {o.traits.map((t) => o.knownTraits.includes(t)
            ? <div class="ofc-traitrow"><span class={`ofc-trait ${OFFICER_TRAITS[t].weak ? 'weak' : 'strong'}`}>{OFFICER_TRAITS[t].weak ? '弱点' : '強み'}：{OFFICER_TRAITS[t].name}</span><div class="small">{OFFICER_TRAITS[t].desc}。{OFFICER_TRAITS[t].tip}</div></div>
            : <div class="ofc-traitrow"><span class="ofc-trait unknown">？</span><span class="small muted">まだ分からない（戦う・偵察・卒業生からの手紙で分かる）</span></div>)}
        </>
      )}
      {(o.victims.length > 0 || grudge) && <h3>この敵将の記憶</h3>}
      {o.victims.map((v) => <div class="small"><Icon name="skull" size={14} /> {v.year}年目、{v.name}を{v.dead ? '討った' : '重傷に追いこんだ'}</div>)}
      {grudge && o.status === 'active' && <div class="small ofc-warn"><Icon name="target" size={14} /> {grudge.given}に負けたことを根に持ち、つけ狙っている</div>}
      {rivals.length > 0 && <h3>教え子との因縁</h3>}
      {rivals.map((r) => { const st = s.students[r.sid]; return (
        <div class="row nowrap gap6 ruled" onClick={() => { onClose(); navigate({ tab: 'students', page: 'detail', id: st.id }); }}>
          <Portrait st={st} size={36} frame={countryColor(st.origin)} />
          <div class="grow"><b>{st.given}</b> <span class="small">{r.settled ? '決着' : r.vow ? `仇討ちの誓い（${s.students[r.vow]?.given ?? ''}）` : stageName(r.stage)}</span><div class="small muted">戦った回数 {r.battles}回{r.log.length ? `・${r.log[r.log.length - 1].text}` : ''}</div></div>
        </div>
      ); })}
      <h3>戦いの記録</h3>
      {o.meets.length ? <ul class="list small" style={{ margin: 0 }}>{o.meets.map((m) => <li>{m.year}年目 {MONTH_NAMES[m.month]}「{m.title}」：{MEET_NAMES[m.result] ?? m.result}{m.foes?.length ? `（${m.foes.map((id) => s.students[id]?.given).filter(Boolean).slice(0, 3).join('・')}）` : ''}</li>)}</ul> : <div class="small muted">まだ戦ったことがない</div>}
    </Sheet>
  );
}
