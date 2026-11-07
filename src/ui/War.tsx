import { useStore } from './store';
import { COUNTRIES, COUNTRY_NAMES, COUNTRY_SHORT, COUNTRY_COLOR } from '../data/people';
import { PAIRS, relStage, REL_NAMES, STAGE_NAMES, tensionStage, activeAlumni, diplomats } from '../core/world';
import { OBJECTIVE_NAMES, WEATHER_NAMES } from '../core/quests';
import { Bar, money } from './common';
import type { GameState } from '../core/state';

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
  const { s } = useStore();
  if (!s) return null;
  const st = tensionStage(s.world.tension);
  return (
    <div>
      <h2>戦況</h2>
      <div class="two">
        <div>
          <div class="card">
            <MapSvg s={s} />
            <div class="row between" style={{ marginTop: 6 }}><b>大陸の緊張度：{Math.round(s.world.tension)}（{STAGE_NAMES[st]}）</b></div>
            <Bar v={s.world.tension} max={100} red={st !== 'peace'} />
            <div class="muted small">35未満＝平和期／35〜65＝緊張期／65超＝激戦期。緊張度に合わせて画面の色合いも変わります。</div>
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
            {s.world.vassal && <div class="tag red">学校は{COUNTRY_NAMES[s.world.vassal]}の傘下にある（評判70で独立）</div>}
            {s.world.gunUnlocked && <div class="tag">銃が登場している</div>}
          </div>
          <div class="card">
            <h3>和平への道</h3>
            {COUNTRIES.map((c) => { const n = diplomats(s, c); return <div class="row between"><span>{COUNTRY_SHORT[c]}の大使以上の教え子</span><b style={{ color: n ? 'var(--main)' : 'var(--sub)' }}>{n}人</b></div>; })}
            <div class="muted small">文官の教え子が大使（文官の3段目）以上になると、和平会議を呼びかけられます。三国すべてに大使以上の教え子がいて、学校が独立していれば、和平会議は「和平の円卓」になります。和平会議はこれまでに{s.world.peaceTalksHeld}回。</div>
            {s.world.peaceRoundYear && <div class="tag">{s.world.peaceRoundYear}年目に和平の円卓が開かれた</div>}
          </div>
          <div class="card">
            <h3>依頼掲示板（今月末）</h3>
            {s.quests.map((q) => (
              <div style={{ borderBottom: '1px dashed var(--line)', padding: '4px 0' }}>
                <b>{q.title}</b> <span class="muted small">{q.real ? '実戦' : '演習'}・危険度{'★'.repeat(q.danger)}</span>
                <div class="muted small">依頼主：{q.client}／{OBJECTIVE_NAMES[q.objective]}／推奨Lv{q.level}／{WEATHER_NAMES[q.weather]}{q.reward ? `／報酬${money(q.reward)}` : ''}</div>
              </div>
            ))}
            <div class="muted small">月の最後の週が終わると、この中から1つを選んで出撃します。</div>
          </div>
        </div>
      </div>
    </div>
  );
}
