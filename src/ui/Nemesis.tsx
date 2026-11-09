// 19夜目：宿敵の札・再会（昔の札と今の札）・因縁の帳・技を覚えた知らせ
// 顔の絵には傷などを重ねない。変化は札の飾り（枠・色・二つ名の帯・ひび）、昔と今の札を並べる、文、「傷」の欄で見せる
import { useState } from 'preact/hooks';
import type { GameState, EnemyOfficer, OfficerCard, Pending } from '../core/state';
import { Sheet } from './common';
import { OfficerFace, Portrait } from './Portrait';
import { navigate, act } from './store';
import { rng } from '../core/flow';
import { spyReady, spyTargets, spyCandidates, spyChance, sendSpy } from '../core/bonds';
import { sfx } from './sound';
import { officerById, officerName, rankName, rivalriesOf, stageName, whenText } from '../core/officers';
import { memoryOf, intelOf, bondOf, bondText, bondedOfficers, pastNemeses, cardOf } from '../core/nemesis';
import { FACTION_NAMES, FACTION_COLOR } from '../data/officers';
import { HEART_TEXT } from '../data/nemesis';
import { ATK_NAME, TECH_BY_ID } from '../data/tactics';
import { CLASSES } from '../data/classes';
import { LEADER_NAMES, type LeaderPersonality } from '../data/autobattle';

/** 札の飾り：因縁が深いほど色が濃く、傷が多いほどひびが入る */
function frameOf(s: GameState, o: EnemyOfficer): { color: string; tier: number } {
  const b = bondOf(s, o);
  const tier = b >= 8 ? 3 : b >= 4 ? 2 : b >= 1 ? 1 : 0;
  return { color: ['#8a7a66', '#a8742a', '#b0392b', '#6e1020'][tier], tier };
}

/** 宿敵の札（card を渡すと、その時点の札） */
export function NemCard({ s, o, card, small, label }: { s: GameState; o: EnemyOfficer; card?: OfficerCard; small?: boolean; label?: string }) {
  const c = card ?? cardOf(s, o);
  const { color, tier } = frameOf(s, o);
  const intel = intelOf(o);
  const cracks = Math.min(3, c.wounds);
  return (
    <div class={`nem-card t${tier}${small ? ' small' : ''}${o.status !== 'active' && !card ? ' gone' : ''}`} style={{ borderColor: color }}>
      {label && <div class="nem-label">{label}</div>}
      <div class="nem-face"><OfficerFace o={o} size={small ? 64 : 84} frame={color} dim={!!card} /></div>
      {(card ? c.ep : o.epithet) && <div class="nem-band" style={{ background: color }}>{card ? c.ep : o.epithet}</div>}
      <div class="nem-name">{o.given}{o.family && o.kind === 'army' ? `・${o.family}` : ''}</div>
      <div class="nem-sub">{FACTION_NAMES[o.faction]}　{c.rank}{intel >= 1 ? `　Lv${c.level}` : ''}</div>
      {!small && intel >= 1 && <div class="nem-sub">{CLASSES[o.classId]?.name ?? ''}{intel >= 2 ? `・${LEADER_NAMES[o.personality as LeaderPersonality] ?? ''}` : ''}</div>}
      {c.wounds > 0 && <div class="nem-sub red">傷 {c.wounds}</div>}
      {cracks > 0 && <svg class={`nem-crack c${cracks}`} viewBox="0 0 100 140" aria-hidden="true"><path d="M100 18 L82 34 L88 46 L70 60" /><path d="M0 112 L16 100 L10 90" /><path d="M64 140 L58 124 L70 116" /></svg>}
    </div>
  );
}

/** 宿敵のくわしいこと（情報の段階で少しずつ分かる） */
export function NemDetail({ s, o }: { s: GameState; o: EnemyOfficer }) {
  const m = memoryOf(o);
  const intel = intelOf(o);
  const nm = (id: string) => s.students[id]?.given ?? '（だれか）';
  const rows: [string, string][] = [];
  rows.push(['分かっていること', ['顔と名前だけ', '肩書きと戦い方', '弱点と性格', '覚えていること', '恨みの中身まで'][intel]]);
  if (intel >= 1) rows.push(['戦い方', `${CLASSES[o.classId]?.name ?? ''}${o.field ? `・自分の戦場「${o.field === 'fort' ? '砦' : o.field === 'ship' ? '船の上' : o.field === 'ruins' ? '古い遺跡' : o.field === 'snow' ? '雪原' : '野原'}」` : ''}`]);
  if (intel >= 2) rows.push(['弱点', [...(o.weak ?? []).map((w) => ((o.knownWeak ?? []).includes(w) ? ATK_NAME[w] : '？')), ...(o.resist ?? []).map((r) => `${ATK_NAME[r]}は効かない`)].join('・') || 'まだ分からない']);
  if (o.heart && o.heart !== 'steady') rows.push(['心', HEART_TEXT[o.heart]]);
  rows.push(['傷', (o.wounds ?? []).length ? (o.wounds ?? []).map((w) => `${w.text}（${s.year - w.year > 0 ? `${s.year - w.year}年前` : '今年'}${w.by ? `・${nm(w.by)}` : ''}）`).join('、') : 'なし']);
  if (intel >= 3) {
    if (m.beatenBy.length) rows.push(['負けた相手', m.beatenBy.map(nm).join('・')]);
    if (o.victims.length) rows.push(['倒した教え子', o.victims.map((v) => `${v.name}${v.dead ? '（戦死）' : '（重傷）'}`).join('・')]);
    if (m.debts.length) rows.push(['恩', m.debts.map((d) => `${nm(d.id)}：${d.text}`).join('、')]);
    if (m.shame.length) rows.push(['屈辱', m.shame.slice(-2).map((x) => x.text).join('、')]);
  }
  if (intel >= 4) {
    if (m.lost.length) rows.push(['奪われた人', m.lost.map((x) => `${x.name}${x.by ? `（${nm(x.by)}に）` : ''}`).join('・')]);
    if (o.grudge) rows.push(['いちばん恨んでいる', nm(o.grudge)]);
  }
  if (o.reviveNote) rows.push(['蘇り', o.reviveNote]);
  if (o.lastMet) rows.push(['最後に会った日', whenText(s, o.lastMet.year, o.lastMet.month)]);
  if (o.allied) rows.push(['いま', o.allied.why === 'debt' ? '恩を返すため、学校の味方になった' : '国に裏切られ、学校の味方になった']);
  if ((o.spied ?? []).length) { const sp = o.spied![o.spied!.length - 1]; rows.push(['密偵の報告', `${whenText(s, sp.year, sp.month)}：${sp.plan ?? ''}`]); }
  const bonds = Object.values(s.rivalries ?? {}).filter((rv) => rv.oid === o.id && (rv.stage >= 1 || rv.vow || rv.settled) && s.students[rv.sid]);
  return (
    <div>
      <div class="nem-pair"><NemCard s={s} o={o} /></div>
      <table class="nem-tbl">{rows.map(([k, v]) => <tr><th>{k}</th><td>{v}</td></tr>)}</table>
      {spyTargets(s).some((x) => x.id === o.id) && <SpyBox s={s} o={o} />}
      {bonds.length > 0 && <>
        <div class="nem-h">教え子との因縁</div>
        {bonds.map((rv) => { const st = s.students[rv.sid]; return (
          <button class="nem-bond" onClick={() => { sfx('ok'); navigate({ tab: 'students', page: 'detail', id: st.id, sub: 'bonds' }); }}>
            <Portrait st={st} size={36} /><span><b>{st.given}</b>{st.status !== 'enrolled' ? '（卒業生）' : ''}<small>{rv.oath ? '好敵手（決着を約束した）' : rv.settled === 'ally' ? '味方になった' : bondText(s, o, st.id) || stageName(rv.stage)}</small></span>
          </button>); })}
      </>}
    </div>
  );
}

/** 再会・うわさ・蘇り（処理待ち） */
export function NemesisPendingView({ s, p, onDone }: { s: GameState; p: Extract<Pending, { type: 'nemesis' }>; onDone: () => void }) {
  const o = officerById(s, p.officerId);
  if (!o) { onDone(); return null; }
  const title = p.kind === 'reunion' ? '宿敵との再会' : p.kind === 'revived' ? '死んだはずの敵が' : p.kind === 'rumor' ? 'うわさ' : p.kind === 'letter' ? '宿敵からの手紙' : p.kind === 'ally' ? '宿敵が味方に' : p.kind === 'rival' ? '好敵手' : p.kind === 'spy' ? '密偵の報告' : '新しい因縁';
  return (
    <Sheet title={title}>
      {o.lastCard && (p.kind === 'reunion' || p.kind === 'revived') ? (
        <div class="nem-pair two"><NemCard s={s} o={o} card={o.lastCard} small label={`前に会ったとき（${o.lastCard.year}年目）`} /><span class="nem-arrow">→</span><NemCard s={s} o={o} small label="今" /></div>
      ) : <div class="nem-pair"><NemCard s={s} o={o} /></div>}
      <div class="paper serif">{p.text.map((t) => <p>{t}</p>)}</div>
      {p.studentIds.length > 0 && <div class="row gap8" style={{ marginTop: 6 }}>{p.studentIds.map((id) => s.students[id]).filter(Boolean).map((st) => <span class="nem-who"><Portrait st={st} size={36} /><small>{st.given}</small></span>)}</div>}
      <button class="btn primary block" style={{ marginTop: 10 }} onClick={onDone}>閉じる</button>
    </Sheet>
  );
}

/** 因縁の帳（ホームの机から）。宿敵ひとりの札を開ける */
export function Ledger({ s, focus }: { s: GameState; focus?: string }) {
  const [open, setOpen] = useState<string | null>(focus ?? null);
  const list = bondedOfficers(s);
  const past = pastNemeses(s);
  const o = open ? officerById(s, open) : null;
  if (o) return (
    <div class="ledger">
      <button class="btn ghost small" onClick={() => setOpen(null)}>← 帳に戻る</button>
      <NemDetail s={s} o={o} />
    </div>
  );
  return (
    <div class="ledger">
      <div class="paper"><div class="head">因縁の帳</div><p class="small">学校と因縁のある敵の将。戦うたび、密偵の報告があるたびに、分かることが増えていきます。</p></div>
      {list.length === 0 && <p class="muted small">まだ因縁のある敵はいません。戦場で出会った将は、ここに記されます。</p>}
      <div class="nem-grid">{list.map((x) => <button class="nem-btn" onClick={() => { sfx('page'); setOpen(x.id); }}><NemCard s={s} o={x} small /></button>)}</div>
      {past.length > 0 && <>
        <div class="nem-h">終わった因縁</div>
        <div class="nem-grid">{past.map((x) => <button class="nem-btn" onClick={() => setOpen(x.id)}><NemCard s={s} o={x} small /></button>)}</div>
      </>}
    </div>
  );
}

/** 教え子の関係タブ：その子の宿敵 */
export function StudentNemeses({ s, id }: { s: GameState; id: string }) {
  const rvs = rivalriesOf(s, id);
  if (!rvs.length) return <p class="muted small">因縁のある敵の将はいません。</p>;
  return <div class="nem-grid">{rvs.map((rv) => { const o = officerById(s, rv.oid); return o ? <button class="nem-btn" onClick={() => navigate({ tab: 'school', page: 'ledger', id: o.id })}><NemCard s={s} o={o} small label={stageName(rv.stage)} /></button> : null; })}</div>;
}

/** 技を覚えた */
export function TechLearnView({ s, p, onDone }: { s: GameState; p: { studentId: string; ids: string[] }; onDone: () => void }) {
  const st = s.students[p.studentId];
  return (
    <div>
      <div class="row nowrap gap8">{st && <Portrait st={st} size={64} />}<div class="serif"><b>{st?.given}</b>は新しい技を覚えた！</div></div>
      {p.ids.map((id) => { const t = TECH_BY_ID[id]; return t ? <div class="pcard"><b>{t.name}</b>　<span class="chip-o">{ATK_NAME[t.type]}</span><div class="small">{t.desc}・1回の戦いで{t.uses}回まで{t.heal ? '' : `・威力${t.pow >= 0 ? '+' : ''}${t.pow}${t.hits > 1 ? `×${t.hits}回` : ''}`}</div></div> : null; })}
      <button class="btn primary block" style={{ marginTop: 8 }} onClick={onDone}>閉じる</button>
    </div>
  );
}
void FACTION_COLOR; void officerName; void rankName;

/** 20夜目④：密偵を送る（月に1回、宿敵ひとりに）。弱点・性格・次の動きが分かる。見つかると捕らわれる */
function SpyBox({ s, o }: { s: GameState; o: EnemyOfficer }) {
  const [open, setOpen] = useState(false);
  const ready = spyReady(s);
  const cands = spyCandidates(s).slice(0, 6);
  return (
    <div class="spy-box">
      <div class="nem-h">密偵を送る</div>
      <div class="small muted">月に1回、宿敵ひとりの陣へ教え子を送れます。弱点・性格・次の動きが分かります。見つかると捕らわれ、救い出す戦いになります。密偵の系統の子ほど見つかりにくい。</div>
      {!ready ? <div class="small">今月は、もう密偵を送りました。</div> : !open ? (
        <button class="btn block" onClick={() => { sfx('ok'); setOpen(true); }}>{o.given}の陣へ、密偵を送る</button>
      ) : (
        <div class="spy-list">
          {cands.length === 0 && <div class="small muted">送れる子がいません（けが・病気の子は送れません）。</div>}
          {cands.map((st) => (
            <button class="spy-pick" onClick={() => { sfx('ok'); act((g) => { const go = g.officers?.find((x) => x.id === o.id); if (go) sendSpy(g, st.id, go.id, rng(g)); }); setOpen(false); }}>
              <Portrait st={st} size={36} /><span class="grow"><b>{st.given}</b><small>{CLASSES[st.classId]?.name ?? ''}</small></span><span class="spy-pct">見つからない見込み<b>{spyChance(s, st, o)}%</b></span>
            </button>
          ))}
          <button class="btn ghost small block" onClick={() => setOpen(false)}>やめる</button>
        </div>
      )}
    </div>
  );
}
