// 成長の演出：経験値ゲージ・技能ランクのゲージ・レベルアップ・魔法を覚えた
import { useEffect, useRef, useState } from 'preact/hooks';
import type { GameState, GrowthEntry, Student } from '../core/state';
import type { Stats, StatId } from '../core/types';
import { B, STATS, RANK_POINTS } from '../data/balance';
import { SKILL_NAMES, STAT_NAMES } from '../data/people';
import { CLASSES } from '../data/classes';
import { WEAPONS } from '../data/weapons';
import { rankOf, nextRankPoints } from '../core/util';
import { Portrait } from './Portrait';
import { Seq } from './anim';
import { sfx } from './sound';

function segPct(p: number): number {
  const cur = RANK_POINTS[rankOf(p)];
  const n = nextRankPoints(p);
  if (n === null) return 100;
  return Math.max(0, Math.min(100, ((p - cur) / (n - cur)) * 100));
}

interface SkillRow { k: string; pct: number; rank: string; label: string; dur: number }
interface LevelShow { st: Student; level: number; before: Stats; gains: Partial<Stats>; lit: number }

export function statsBefore(e: GrowthEntry, upIndex: number): Stats {
  const out = { ...e.stats0 };
  for (let i = 0; i < upIndex; i++) for (const [k, v] of Object.entries(e.ups[i].gains)) out[k as StatId] += v as number;
  return out;
}

/** 生徒ごとに、ゲージが伸びる様子を順に見せる */
export function GrowthPlayer({ s, entries, onDone, title }: { s: GameState; entries: GrowthEntry[]; onDone: () => void; title?: string }) {
  const [cur, setCur] = useState(0);
  const [expLv, setExpLv] = useState(0);
  const [expPct, setExpPct] = useState(0);
  const [expDur, setExpDur] = useState(0);
  const [rows, setRows] = useState<SkillRow[]>([]);
  const [lvShow, setLvShow] = useState<LevelShow | null>(null);
  const [learn, setLearn] = useState<string | null>(null);
  const [trainUp, setTrainUp] = useState<StatId[] | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [done, setDone] = useState(false);
  const [all, setAll] = useState(false);
  const seq = useRef<Seq | null>(null);
  const list = entries.filter((e) => s.students[e.id]);

  useEffect(() => {
    if (all || !list.length) return;
    const q = new Seq();
    seq.current = q;
    const snd = (n: string) => { if (!q.cancelled) sfx(n); };
    // タップするまで止まる（レベルアップ・ランクアップ・魔法・鍛錬の+1。7夜目）
    const hold = async () => { if (q.cancelled) return; setWaiting(true); await q.waitTap(); setWaiting(false); };
    (async () => {
      for (let i = 0; i < list.length; i++) {
        if (q.cancelled) break;
        const e = list[i];
        const st = s.students[e.id];
        setCur(i); setLvShow(null); setLearn(null); setTrainUp(null);
        setExpLv(e.lv0); setExpDur(0); setExpPct(e.exp0);
        let rs: SkillRow[] = e.skills.map((x) => ({ k: x.k, pct: segPct(x.p0), rank: rankOf(x.p0), label: '', dur: 0 }));
        setRows(rs);
        await q.sleep(260);
        // 技能ランクのゲージ
        for (let j = 0; j < e.skills.length; j++) {
          const sk = e.skills[j];
          let p = sk.p0;
          while (rankOf(p) !== rankOf(sk.p1) && nextRankPoints(p) !== null) {
            const from = segPct(p);
            const d = q.dur(B.anim.skillGauge * (100 - from) / 100);
            rs = rs.map((r, z) => (z === j ? { ...r, pct: 100, dur: d } : r)); setRows(rs);
            await q.sleep(B.anim.skillGauge * (100 - from) / 100);
            const r0 = rankOf(p); p = nextRankPoints(p)!; const r1 = rankOf(p);
            snd('pass');
            rs = rs.map((r, z) => (z === j ? { ...r, pct: 0, dur: 0, rank: r1, label: `${SKILL_NAMES[sk.k]} ${r0}→${r1}!` } : r)); setRows(rs);
            await q.sleep(300);
            await hold();
          }
          const to = segPct(sk.p1);
          const d = q.dur(B.anim.skillGauge * Math.max(0.2, (to - segPct(p)) / 100));
          rs = rs.map((r, z) => (z === j ? { ...r, pct: to, dur: d, rank: rankOf(sk.p1) } : r)); setRows(rs);
          await q.sleep(B.anim.skillGauge * Math.max(0.2, (to - segPct(p)) / 100));
        }
        // 経験値ゲージ
        let pct = e.exp0;
        for (let u = 0; u < e.ups.length; u++) {
          setExpDur(q.dur(B.anim.expGauge * (100 - pct) / 100)); setExpPct(100);
          await q.sleep(B.anim.expGauge * (100 - pct) / 100);
          // レベルアップ
          const up = e.ups[u];
          const show: LevelShow = { st, level: up.level, before: statsBefore(e, u), gains: up.gains, lit: 0 };
          setLvShow({ ...show });
          snd('level');
          await q.sleep(650);
          const n = STATS.filter((k) => up.gains[k]).length;
          for (let z = 1; z <= n; z++) { show.lit = z; setLvShow({ ...show }); snd('tick'); await q.sleep(B.anim.levelStat); }
          await q.sleep(300);
          await hold();
          setLvShow(null);
          setExpLv(up.level); setExpDur(0); setExpPct(0); pct = 0;
          await q.sleep(120);
        }
        setExpDur(q.dur(B.anim.expGauge * Math.max(0.15, (e.exp1 - pct) / 100))); setExpPct(e.exp1); setExpLv(e.lv1);
        await q.sleep(B.anim.expGauge * Math.max(0.15, (e.exp1 - pct) / 100));
        // 魔法を覚えた
        for (const id of e.spells) { setLearn(id); snd('pass'); await q.sleep(400); await hold(); }
        setLearn(null);
        // 鍛錬ゲージの+1
        if ((e.train ?? []).length) { setTrainUp(e.train!); snd('level'); await q.sleep(400); await hold(); setTrainUp(null); }
        await q.sleep(420);
      }
      if (!q.cancelled) setDone(true);
    })();
    return () => q.cancel();
  }, [all]);

  if (!list.length) { return <div><button class="btn primary block" onClick={onDone}>閉じる</button></div>; }

  if (all) return <GrowthList s={s} entries={list} onDone={onDone} />;

  const e = list[Math.min(cur, list.length - 1)];
  const st = s.students[e.id];
  return (
    <div class="growth" onPointerDown={() => seq.current?.tap()}>
      {title && <div class="muted small">{title}（{Math.min(cur + 1, list.length)}／{list.length}人）</div>}
      <div class="gcard">
        <div class="row">
          <Portrait st={st} size={64} />
          <div class="grow">
            <div><b>{st.given}</b> <span class="muted small">{CLASSES[st.classId]?.name}</span>{e.why && <span class="tag">{e.why}</span>}</div>
            <div class="row" style={{ gap: 6 }}><span class="small" style={{ width: 52 }}>Lv{expLv}</span>
              <div class="ggauge exp grow"><span style={{ width: `${expPct}%`, transitionDuration: `${expDur}ms` }} /></div>
              <span class="small muted" style={{ width: 44, textAlign: 'right' }}>EXP</span></div>
          </div>
        </div>
        {rows.map((r) => (
          <div class="row" style={{ gap: 6, marginTop: 4 }}>
            <span class="small" style={{ width: 52 }}>{SKILL_NAMES[r.k as keyof typeof SKILL_NAMES]} <b>{r.rank}</b></span>
            <div class="ggauge grow"><span style={{ width: `${r.pct}%`, transitionDuration: `${r.dur}ms` }} /></div>
            <span class={`small rankup${r.label ? ' on' : ''}`} style={{ width: 88, textAlign: 'right' }}>{r.label}</span>
          </div>
        ))}
      </div>
      <div class="row" style={{ marginTop: 8 }}>
        {done ? <button class="btn primary grow" onClick={() => { sfx('ok'); onDone(); }}>次へ</button> : <>
          <button class="btn ghost grow" onClick={(ev) => { ev.stopPropagation(); seq.current?.cancel(); setAll(true); }}>まとめて見る</button>
          <button class="btn ghost" onClick={(ev) => { ev.stopPropagation(); seq.current?.cancel(); onDone(); }}>スキップ</button>
        </>}
      </div>
      <div class={`small ${waiting ? 'ru-next' : 'muted'}`} style={{ textAlign: 'center' }}>{done ? '' : waiting ? 'タップで次へ ▼' : '画面をタップで早送り'}</div>
      {lvShow && <LevelUp show={lvShow} waiting={waiting} />}
      {learn && <div class="learn"><div><div class="small muted">新しい魔法</div><b>{st.given}は {WEAPONS[learn]?.name} を覚えた！</b><div class="small">{WEAPONS[learn]?.desc}</div>{waiting && <div class="small ru-next">タップで次へ ▼</div>}</div></div>}
      {trainUp && <div class="learn train"><div><div class="small muted">鍛錬の成果</div><Portrait st={st} size={56} /><b>{st.given}の{[...new Set(trainUp)].map((k) => `${STAT_NAMES[k]}+${trainUp.filter((x) => x === k).length}`).join('・')}！</b><div class="small">授業でためた鍛錬ゲージが満タンになった</div>{waiting && <div class="small ru-next">タップで次へ ▼</div>}</div></div>}
    </div>
  );
}

function LevelUp({ show, waiting }: { show: LevelShow; waiting?: boolean }) {
  const gained = STATS.filter((k) => show.gains[k]);
  return (
    <div class="levelup">
      <div class="lvbox">
        <div class="row" style={{ gap: 10 }}>
          <Portrait st={show.st} size={72} />
          <div class="grow"><div class="lvtitle">LEVEL UP!</div><div><b>{show.st.given}</b>　Lv{show.level - 1} → <b>Lv{show.level}</b></div></div>
        </div>
        <div class="lvgrid">
          {STATS.map((k) => {
            const gi = gained.indexOf(k);
            const on = gi >= 0 && gi < show.lit;
            const v = show.before[k] + (on ? (show.gains[k] ?? 0) : 0);
            return <div class={`lvstat${on ? ' on' : ''}`}><span>{STAT_NAMES[k]}</span><b>{v}</b><i>{on ? `+${show.gains[k]}` : ''}</i></div>;
          })}
        </div>
        {!gained.length && <div class="muted small" style={{ textAlign: 'center' }}>今回は能力が上がらなかった……</div>}
        {waiting && <div class="small ru-next" style={{ textAlign: 'center' }}>タップで次へ ▼</div>}
      </div>
    </div>
  );
}

/** まとめて見る：結果だけを一覧で */
export function GrowthList({ s, entries, onDone }: { s: GameState; entries: GrowthEntry[]; onDone?: () => void }) {
  return (
    <div>
      {entries.map((e) => {
        const st = s.students[e.id];
        if (!st) return null;
        const gains: Partial<Record<StatId, number>> = {};
        for (const u of e.ups) for (const [k, v] of Object.entries(u.gains)) gains[k as StatId] = (gains[k as StatId] ?? 0) + (v as number);
        return (
          <div class="card small">
            <div class="row"><Portrait st={st} size={32} /><b>{st.given}</b>{e.why && <span class="tag">{e.why}</span>}
              {e.lv1 > e.lv0 && <span class="tag red">Lv{e.lv0}→{e.lv1}</span>}</div>
            {e.lv1 > e.lv0 && <div>{STATS.filter((k) => gains[k]).map((k) => `${STAT_NAMES[k]}+${gains[k]}`).join(' ') || '能力の変化なし'}</div>}
            {e.skills.length > 0 && <div>{e.skills.map((x) => `${SKILL_NAMES[x.k]}${rankOf(x.p0) !== rankOf(x.p1) ? ` ${rankOf(x.p0)}→${rankOf(x.p1)}` : ` +${Math.round(x.p1 - x.p0)}`}`).join('・')}</div>}
            {e.spells.length > 0 && <div><b>{e.spells.map((id) => WEAPONS[id]?.name).join('・')}</b> を覚えた</div>}
            {(e.train ?? []).length > 0 && <div>鍛錬：{[...new Set(e.train)].map((k) => `${STAT_NAMES[k]}+${e.train!.filter((x) => x === k).length}`).join(' ')}</div>}
          </div>
        );
      })}
      {onDone && <button class="btn primary block" onClick={() => { sfx('ok'); onDone(); }}>次へ</button>}
    </div>
  );
}

/** 授業の結果のあとの「成長の瞬間」（ランクアップ・レベルアップ・魔法・鍛錬の+1）。タップするまで止まる */
export function GrowthMoments({ s, entries, onDone }: { s: GameState; entries: GrowthEntry[]; onDone: () => void }) {
  return <GrowthPlayer s={s} entries={entries} onDone={onDone} title="成長の瞬間" />;
}
