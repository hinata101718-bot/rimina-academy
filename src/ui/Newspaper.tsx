// 新聞「リンデルガ通信」（8夜目。見本 docs/mockups/newspaper.png）：一面・各組織の移り変わり・政治の動き・卒業生の消息・学校の話題・次号の案内
import { useState } from 'preact/hooks';
import type { GameState, NewsPaper } from '../core/state';
import type { CountryId } from '../core/types';
import { useStore, act, navigate } from './store';
import { Back } from './common';
import { Portrait, OfficerFace } from './Portrait';
import { artUrl, ArtSlot } from './HomeDeco';
import { officerById } from '../core/officers';
import { COUNTRY_SHORT } from '../data/people';
import { PAPER_NAME } from '../data/newspaper';
import { FACTION_COLOR } from '../data/officers';
import { countryColor } from './cards';
import { sfx } from './sound';

const KIND_NAMES = { first: '前期号', second: '後期号', extra: '号外' } as const;

/** 一面の挿絵：public/art に news_front などの絵があれば出す。なければ線画 */
function FrontArt({ name }: { name?: string }) {
  const url = name ? artUrl(name) : null;
  if (url) return <div class="np-art"><img src={url} alt="" /></div>;
  return (
    <div class="np-art line" aria-hidden="true">
      <svg viewBox="0 0 300 110" preserveAspectRatio="xMidYMid meet">
        <path d="M10 98 H290" stroke="#5a4a32" stroke-width="1.5" />
        <path d="M40 98 V60 h12 v-8 h8 v8 h12 v-8 h8 v8 h12 V98" fill="none" stroke="#5a4a32" stroke-width="1.6" />
        <path d="M60 52 V30 l14 6 l-14 6" fill="none" stroke="#5a4a32" stroke-width="1.4" />
        <path d="M120 98 l26 -46 l26 46 M150 98 l30 -60 l30 60 M200 98 l22 -36 l22 36" fill="none" stroke="#5a4a32" stroke-width="1.4" opacity=".75" />
        <path d="M230 70 q12 -10 24 0 t24 0" fill="none" stroke="#5a4a32" stroke-width="1.2" opacity=".6" />
        {[0, 1, 2, 3, 4].map((i) => <path d={`M${96 + i * 9} 98 v-14 m-3 3 l3 -3 l3 3`} stroke="#5a4a32" stroke-width="1.2" fill="none" />)}
      </svg>
    </div>
  );
}

function Gauge({ v, tone }: { v: number; tone: 'red' | 'green' }) {
  return <span class={`np-gauge ${tone}`}><span style={{ width: `${Math.max(0, Math.min(100, v))}%` }} /></span>;
}

export function NewsView({ id, onLeave }: { id: string; onLeave?: () => void }) {
  const { s } = useStore();
  const n = s?.news.find((x) => x.id === id);
  if (!s || !n) return null;
  const leave = () => { act((g) => { g.pending = g.pending.filter((p) => !(p.type === 'newspaper' && p.id === id)); }); onLeave?.(); };
  if (!n.kind) return <OldNews s={s} n={n} leave={leave} />;
  const war = n.tension > 65;
  const issue = n.kind ? KIND_NAMES[n.kind] : '';
  return (
    <div class={`newspaper${war ? ' war' : ''}${n.kind === 'extra' ? ' extra' : ''}`}>
      <div class="np-name">{n.kind === 'extra' ? <><span class="np-extra">号外</span>{PAPER_NAME}</> : PAPER_NAME}</div>
      <div class="np-meta"><span>大陸暦 第{n.year}年 {issue}</span><span>リミナ分校 図書室 備え付け</span></div>
      <div class="np-rule" />
      {n.front && (
        <section class="np-front">
          <span class="np-tag">一面</span>
          <h2 class="np-head">{n.front.head}{n.front.sub && <><br /><small>{n.front.sub}</small></>}</h2>
          <FrontArt name={n.front.art} />
          <p class="np-body">{n.front.text}</p>
        </section>
      )}
      {(n.orgs?.length || n.politics?.length) ? (
        <div class="np-cols">
          <section class="np-col">
            <h3 class="np-sec">各組織の移り変わり</h3>
            {!(n.orgs ?? []).length && <div class="small muted">目立った動きはなかった</div>}
            {(n.orgs ?? []).map((o) => {
              const off = officerById(s, o.officerId);
              return (
                <div class="np-org" onClick={() => { if (off) { sfx('move'); leave(); navigate({ tab: 'war', page: 'officers', id: off.id }); } }}>
                  {off ? <span class="np-face"><OfficerFace o={off} size={40} frame={FACTION_COLOR[off.faction]} s={s} /></span> : null}
                  <div class="grow"><span class="np-box">{o.tag}</span>{o.name && <b>{o.name}</b>}{o.text}</div>
                </div>
              );
            })}
            {(n.orgs ?? []).length > 0 && <div class="np-link" onClick={() => { sfx('move'); leave(); navigate({ tab: 'war', page: 'officers' }); }}>→ 組織図を見る</div>}
          </section>
          <section class="np-col">
            <h3 class="np-sec">政治の動き</h3>
            {(n.politics ?? []).map((p) => (
              <div class="np-pol">
                <b style={{ color: p.country === 'seed' ? 'var(--accent)' : countryColor(p.country as CountryId) }}>{p.country === 'seed' ? '火種' : COUNTRY_SHORT[p.country as CountryId]} ― {p.stance}</b>
                <div>{p.text}</div>
              </div>
            ))}
            {n.gauges && (
              <div class="np-gauges">
                <div><span>緊張度</span><Gauge v={n.gauges.tension} tone="red" /><span>{n.gauges.tensionLabel}</span></div>
                <div><span>和平</span><Gauge v={n.gauges.peace} tone="green" /><span>{n.gauges.peaceLabel}</span></div>
              </div>
            )}
          </section>
        </div>
      ) : n.gauges ? (
        <div class="np-gauges solo">
          <div><span>緊張度</span><Gauge v={n.gauges.tension} tone="red" /><span>{n.gauges.tensionLabel}</span></div>
          <div><span>和平</span><Gauge v={n.gauges.peace} tone="green" /><span>{n.gauges.peaceLabel}</span></div>
        </div>
      ) : null}
      {n.alumni.length > 0 && (
        <section>
          <div class="np-rule thin" />
          <h3 class="np-sec">卒業生の消息</h3>
          <div class="np-alumni">
            {n.alumni.map((a) => {
              const st = a.id ? s.students[a.id] : null;
              return (
                <div class={`np-al${st ? ' tap' : ''}`} onClick={() => { if (st) { sfx('move'); leave(); navigate({ tab: 'students', page: 'detail', id: st.id }); } }}>
                  {st && <span class="np-alface"><Portrait st={st} size={56} /></span>}
                  <div class="small">{a.text}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {(n.school ?? []).length > 0 && (
        <section>
          <div class="np-rule thin" />
          <h3 class="np-sec">学校の話題</h3>
          <ul class="np-list">{(n.school ?? []).map((x) => <li>{x}</li>)}</ul>
        </section>
      )}
      {n.next && <div class="np-next">{n.next}</div>}
    </div>
  );
}

/** 7夜目までの新聞（見た目は新しい紙面にそろえる） */
function OldNews({ s, n, leave }: { s: GameState; n: NewsPaper; leave: () => void }) {
  return (
    <div class={`newspaper${n.tension > 65 ? ' war' : ''}`}>
      <ArtSlot name="event_newspaper" height={110} />
      <div class="np-name small-name">リンデルガ新報</div>
      <div class="np-meta"><span>{n.year}年目</span><span>リミナ分校 図書室 備え付け</span></div>
      <div class="np-rule" />
      <h2 class="np-head">{n.headline}</h2>
      {n.body.map((l) => <p class="np-body" style={{ margin: '4px 0' }}>{l}</p>)}
      {n.alumni.length > 0 && <>
        <h3 class="np-sec">卒業生の消息</h3>
        {n.alumni.map((a) => <div class="small" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { leave(); navigate({ tab: 'students', page: 'detail', id: a.id }); }}>・{a.text}</div>)}
      </>}
      {void s}
    </div>
  );
}

/** 机の上の新聞から開く頁：いちばん新しい号と、これまでの号 */
export function NewsPage({ s }: { s: GameState }) {
  const [open, setOpen] = useState<string | null>(s.news[0]?.id ?? null);
  return (
    <div class="deskpage">
      <Back to={() => navigate({ tab: 'school' })} />
      {!s.news.length && <div class="ledger"><div class="empty-note">新聞はまだ届いていません（9月の終わりに前期号、3月に後期号。大事件の月は号外）</div></div>}
      {open && <NewsView id={open} />}
      {s.news.length > 1 && (
        <div class="ledger">
          <h3 class="ledger-title">これまでの号</h3>
          {s.news.map((n) => (
            <div class={`row between nowrap ruled tap${open === n.id ? ' on' : ''}`} style={{ minHeight: 44 }} onClick={() => { sfx('page'); setOpen(n.id); window.scrollTo?.(0, 0); }}>
              <span class="grow small"><b>{n.kind ? KIND_NAMES[n.kind] : '新報'}</b>　{n.headline.replace(/^[^：]*：/, '')}</span>
              <span class="muted small">{n.year}年目</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
