import { useStore, navigate } from './store';
import { OfficerRoster } from './Officers';
import { sfx } from './sound';
import { COUNTRIES, COUNTRY_NAMES, COUNTRY_SHORT, COUNTRY_COLOR } from '../data/people';
import { PAIRS, relStage, REL_NAMES, STAGE_NAMES, tensionStage, activeAlumni, diplomats } from '../core/world';
import { OBJECTIVE_NAMES, WEATHER_NAMES } from '../core/quests';
import { Bar, money, HelpTip } from './common';
import { Icon } from './icons';
import { countryColor, Stars, OBJECTIVE_ICON, WEATHER_ICON } from './cards';
import type { GameState } from '../core/state';
import { neutralProgress, neutralRevealed, seedFactor, smolderStage, endingTitle } from '../core/ending';
import { SEEDS, warOrdinal } from '../data/aftermath';

const POS: Record<string, [number, number]> = { kingdom: [150, 50], empire: [70, 175], alliance: [240, 165] };
const REL_COLOR = { war: '#b03a2e', tense: '#d08a2a', friendly: '#4f8f4a', allied: '#2f5fa8' };

function MapSvg({ s }: { s: GameState }) {
  return (
    <svg viewBox="0 0 310 230" class="mapsvg">
      <rect x="0" y="0" width="310" height="230" rx="12" fill="var(--paper2)" stroke="var(--line)" />
      {PAIRS.map((p) => { const a = POS[p.a], b = POS[p.b]; const st = relStage(s.world.relations[p.key]); return (
        <g><line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={REL_COLOR[st]} stroke-width={st === 'war' ? 6 : 4} stroke-dasharray={st === 'tense' ? '8 6' : undefined} />
          <text x={(a[0] + b[0]) / 2} y={(a[1] + b[1]) / 2 - 6} font-size="12" text-anchor="middle" fill={REL_COLOR[st]} font-weight="bold">{REL_NAMES[st]}</text></g>
      ); })}
      {COUNTRIES.map((c) => { const [x, y] = POS[c]; const r = 18 + s.world.power[c] / 6; return (
        <g><circle cx={x} cy={y} r={r} fill={COUNTRY_COLOR[c]} opacity=".9" /><text x={x} y={y + 4} font-size="13" text-anchor="middle" fill="#fff" font-weight="bold">{COUNTRY_SHORT[c]}</text></g>
      ); })}
      <g><rect x="140" y="128" width="30" height="22" rx="4" fill="#fff" stroke="var(--main)" /><text x="155" y="143" font-size="10" text-anchor="middle" fill="var(--main)">学校</text></g>
    </svg>
  );
}

export function WarTab() {
  const { s, route } = useStore();
  if (!s) return null;
  const st = tensionStage(s.world.tension);
  const seg = (
    <div class="seg" style={{ marginBottom: 8 }}>
      <button class={route.page !== 'officers' ? 'on' : ''} onClick={() => { sfx('move'); navigate({ tab: 'war' }); }}>大陸の様子</button>
      <button class={route.page === 'officers' ? 'on' : ''} onClick={() => { sfx('move'); navigate({ tab: 'war', page: 'officers' }); }}>敵将の名簿</button>
    </div>
  );
  if (route.page === 'officers') return <div><h2>戦況</h2>{seg}<OfficerRoster s={s} /></div>;
  return (
    <div>
      <h2>戦況</h2>
      {seg}
      <div class="two">
        <div>
          <div class="card">
            <MapSvg s={s} />
            <div class="row between" style={{ marginTop: 6 }}><b>大陸の緊張度：{Math.round(s.world.tension)}（{STAGE_NAMES[st]}）</b></div>
            <Bar v={s.world.tension} max={100} red={st !== 'peace'} />
            <div class="muted small">緊張度が上がるほど、戦いがはげしくなります。画面の色合いも、緊張度に合わせて変わります。<HelpTip text="35より下は平和期、35から65は緊張期、65より上は激戦期です。" /></div>
          </div>
          <div class="card">
            <h3>三国の国力</h3>
            {COUNTRIES.map((c) => <div><div class="row between"><span>{COUNTRY_NAMES[c]}</span><b>{Math.round(s.world.power[c])}</b></div><Bar v={s.world.power[c]} max={100} /></div>)}
          </div>
        </div>
        <div>
          <div class="card">
            <h3>国どうしの関係</h3>
            {PAIRS.map((p) => <div class="row between"><span>{COUNTRY_SHORT[p.a]}⇔{COUNTRY_SHORT[p.b]}</span><span><b style={{ color: REL_COLOR[relStage(s.world.relations[p.key])] }}>{REL_NAMES[relStage(s.world.relations[p.key])]}</b> <span class="muted small">({Math.round(s.world.relations[p.key])})</span></span></div>)}
          </div>
          <div class="card">
            <h3>学校との友好度</h3>
            {COUNTRIES.map((c) => <div class="row between"><span>{COUNTRY_NAMES[c]}{s.world.vassal === c ? '（傘下）' : ''}</span><span>{Math.round(s.world.friendship[c])}　<span class="muted small">卒業生{activeAlumni(s, c).length}人</span></span></div>)}
            {s.world.vassal && <div class="tag red">学校は{COUNTRY_NAMES[s.world.vassal]}の傘下です（評判70で独立できます）</div>}
            {s.world.gunUnlocked && <div class="tag">銃が戦場に出てきました</div>}
          </div>
          <div class="card">
            <h3>和平への道</h3>
            {COUNTRIES.map((c) => { const n = diplomats(s, c); return <div class="row between"><span>{COUNTRY_SHORT[c]}の大使以上の教え子</span><b style={{ color: n ? 'var(--main)' : 'var(--sub)' }}>{n}人</b></div>; })}
            <div class="muted small">文官の教え子が大使になると、和平会議を呼びかけられます。三国すべてに大使の教え子がいて、学校が独立していれば、「和平の円卓」が開けます。<HelpTip text={`大使は文官の3段目で、それより上でもかまいません。和平会議は、これまでに${s.world.peaceTalksHeld}回開かれました。`} /></div>
            {s.world.peaceRoundYear && <div class="tag">{s.world.peaceRoundYear}年目に、和平の円卓が開かれました</div>}
          </div>
          {s.world.era === 'peace' && <SeedCard s={s} />}
          <NeutralCard s={s} />
          <div class="card">
            <h3>依頼掲示板（今月末）</h3>
            {s.quests.map((q) => (
              <div class="pcard" style={{ ['--band' as string]: q.clientCountry ? countryColor(q.clientCountry) : 'var(--main)', margin: '6px 0' }}>
                <div class="row between nowrap"><span class="ptitle" style={{ fontSize: 15 }}>{q.title}</span><span class={`flag ${q.real ? 'red' : ''}`}>{q.real ? '実戦' : '演習'}</span></div>
                <div class="infogrid">
                  <div><Icon name={OBJECTIVE_ICON[q.objective]} size={16} />{OBJECTIVE_NAMES[q.objective]}</div>
                  <div><Icon name={WEATHER_ICON[q.weather]} size={16} />{WEATHER_NAMES[q.weather]}</div>
                  <div>危険度 <Stars n={q.danger} /></div>
                  <div><Icon name="coin" size={16} />{q.reward ? money(q.reward) : 'なし'}　目安Lv{q.level}</div>
                </div>
              </div>
            ))}
            <div class="muted small">月の最後の週が終わったら、この中から依頼を選んで出撃します。</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 次の戦争の火種（7夜目：平和な時代だけ） */
function SeedCard({ s }: { s: GameState }) {
  const sd = s.world.seed;
  if (!sd) return <div class="card"><h3>火種</h3><div class="muted small">いまのところ、大陸は静かです。</div></div>;
  const def = SEEDS[sd.kind];
  const f = seedFactor(s);
  const v = Math.round(sd.smolder);
  const last = (s.endings ?? [])[(s.endings ?? []).length - 1];
  const tone = v >= 85 ? 'red' : v >= 60 ? 'warn' : 'main';
  return (
    <div class="card seedcard">
      <h3>次の戦争の火種</h3>
      <div class="small muted">{last ? `${endingTitle(last.kind, last.country, last.n)}から${s.year - sd.since}年。` : ''}平和な時代にも、火種は少しずつくすぶっています。</div>
      <div class="row between nowrap" style={{ marginTop: 6 }}><b>{def.name}</b><span class={`flag ${tone === 'red' ? 'red' : ''}`}>{smolderStage(v)}</span></div>
      <Bar v={v} max={100} red={tone !== 'main'} />
      <div class="small" style={{ marginTop: 6 }}><b class="ngmark">▲</b> 強まる：{def.grows}{f.up.length ? `（いま：${f.up.join('・')}）` : ''}</div>
      <div class="small"><b class="okmark">▼</b> 遅らせる：{def.slows}{f.down.length ? `（いま：${f.down.join('・')}）` : ''}</div>
      <div class="muted small">くすぶりの速さ：{f.mul >= 1.25 ? '速い' : f.mul <= 0.75 ? 'ゆっくり' : 'ふつう'}です。いっぱいになると、{warOrdinal((s.world.warNo ?? 1) + 1)}の戦争が始まります。</div>
    </div>
  );
}

/** 中立宣言への道（隠しエンド：評判70までは伏せる） */
function NeutralCard({ s }: { s: GameState }) {
  const open = neutralRevealed(s);
  const steps = neutralProgress(s);
  return (
    <div class="card">
      <h3>{open ? '中立宣言への道' : '？？？への道'}</h3>
      {open ? (
        <>
          {steps.map((x) => (
            <div class="neutralstep">
              <div><b class={x.ok ? 'okmark' : 'ngmark'}>{x.ok ? '✓' : '×'}</b> {x.label}</div>
              <div class="muted small neutralnow">{x.now}</div>
            </div>
          ))}
          <div class="muted small">どの国にも属さない「学校の中立」を宣言できるかもしれません。条件がすべてそろった年度に、学校防衛戦に勝つと……。</div>
          {(s.endings ?? []).some((e) => e.kind === 'neutral') && <div class="tag">学校の中立を宣言しました</div>}
        </>
      ) : (
        <>
          {steps.map(() => <div class="neutralstep"><b class="ngmark">？</b> ？？？</div>)}
          <div class="muted small">学校の名が大陸に広まれば、何かが見えてくるかもしれません。</div>
        </>
      )}
    </div>
  );
}
