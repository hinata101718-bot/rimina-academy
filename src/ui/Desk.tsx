// ホーム（8夜目）：「教官の机 × 軍記もの」。机の上の物がそのまま各画面の入口
// 作戦地図→戦況、教官手帳→手帳（やること・教官）、急報の書状→郵便受け、新聞→新聞、生徒の写真→個人ページ、本日の授業を命ず→今日の授業
import type { GameState, Student } from '../core/state';
import type { CountryId } from '../core/types';
import { navigate } from './store';
import { enrolled } from '../core/game';
import { examCandidates } from '../core/exam';
import { nextEvent } from '../core/calendar';
import { teacherSick } from '../core/lessons';
import { mentorXp, abilityCost, abilityState } from '../core/mentor';
import { MENTOR_ABILITIES } from '../data/mentor';
import { COUNTRY_NAMES, COUNTRY_SHORT, SKILL_NAMES } from '../data/people';
import { regionShare, mapChanges } from '../core/regions';
import { budKnown } from '../core/aptitude';
import { DAY_NAMES } from '../core/lessons';
import { MONTH_NAMES } from '../core/util';
import { B } from '../data/balance';
import { Portrait } from './Portrait';
import { Icon } from './icons';
import { sfx } from './sound';
import { countryColor, studentFlags } from './cards';
import { stageOf } from './common';
import { kanjiNum } from './Mentor';
import { PAPER_NAME } from '../data/newspaper';
import { REP_TIERS, repTier } from '../data/discovery';

const C_FILL: Record<CountryId, string> = { kingdom: '#5d7fae', empire: '#b85a45', alliance: '#6f9a5e' };
const DIRWORD: Record<string, string> = { 'empire>kingdom': '北上中', 'empire>alliance': '東進中', 'kingdom>empire': '南下中', 'kingdom>alliance': '南下中', 'alliance>empire': '西進中', 'alliance>kingdom': '北上中' };
const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** 作戦地図：三国の勢力・リミナ分校・敵の部隊の駒・方位・「軍事機密」。タップで戦況へ */
export function WarMap({ s }: { s: GameState }) {
  const w = s.world;
  const avg = (w.power.kingdom + w.power.empire + w.power.alliance) / 3;
  const k = clampN((w.power.kingdom - avg) * 0.6, -16, 16);
  const ea = clampN((w.power.empire - w.power.alliance) * 0.7, -30, 30);
  const jy = 96 + k * 0.5;
  const kingdom = `0,0 360,0 360,${88 + k} 255,${110 + k} 190,${jy} 120,${122 + k} 0,${84 + k}`;
  const empire = `0,${84 + k} 120,${122 + k} 190,${jy} ${176 + ea},210 0,210`;
  const alliance = `190,${jy} 255,${110 + k} 360,${88 + k} 360,210 ${176 + ea},210`;
  // 敵の駒：仲の悪い組の、強いほうの兵が相手へ向かう
  const pairs: { a: CountryId; b: CountryId; key: 'ke' | 'ea' | 'ak' }[] = [{ a: 'kingdom', b: 'empire', key: 'ke' }, { a: 'empire', b: 'alliance', key: 'ea' }, { a: 'alliance', b: 'kingdom', key: 'ak' }];
  const hostile = pairs.filter((p) => w.relations[p.key] < -20).sort((x, y) => w.relations[x.key] - w.relations[y.key]);
  const POS: Record<string, [number, number][]> = {
    'empire>kingdom': [[118, 132], [138, 136], [126, 114]], 'kingdom>empire': [[112, 98], [132, 104], [96, 92]],
    'empire>alliance': [[200, 150], [196, 172], [214, 162]], 'alliance>empire': [[226, 150], [238, 170], [220, 176]],
    'alliance>kingdom': [[268, 122], [292, 118], [280, 132]], 'kingdom>alliance': [[262, 98], [286, 94], [300, 104]],
  };
  const pieces: { x: number; y: number; c: CountryId }[] = [];
  let label = '';
  for (const p of hostile.slice(0, 2)) {
    const atk = w.power[p.a] >= w.power[p.b] ? p.a : p.b;
    const def = atk === p.a ? p.b : p.a;
    const n = clampN(Math.round((-w.relations[p.key] - 10) / 20), 1, 3);
    for (const [x, y] of (POS[`${atk}>${def}`] ?? []).slice(0, n)) pieces.push({ x, y, c: atk });
    if (!label) label = `${COUNTRY_SHORT[atk]}の兵 ${DIRWORD[`${atk}>${def}`] ?? '進軍中'}`;
  }
  const stage = stageOf(s);
  // 13夜目：勢力図とつなぐ（地方の数と、前に見たときからの変化）
  const share = regionShare(s);
  const changed = mapChanges(s).length;
  return (
    <button class={`deskmap st-${stage}`} onClick={() => { sfx('move'); navigate({ tab: 'war' }); }} aria-label="作戦地図。押すと戦況を開きます">
      <span class="pin l" /><span class="pin r" />
      <svg viewBox="0 0 360 210" preserveAspectRatio="none">
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(60,30,10,.12)" stroke-width="2" /></pattern>
        </defs>
        <polygon points={kingdom} fill={C_FILL.kingdom} opacity=".78" />
        <polygon points={empire} fill={C_FILL.empire} opacity=".78" />
        <polygon points={alliance} fill={C_FILL.alliance} opacity=".78" />
        <rect width="360" height="210" fill="url(#hatch)" />
        <polyline points={`0,${84 + k} 120,${122 + k} 190,${jy} 255,${110 + k} 360,${88 + k}`} fill="none" stroke="#3a2412" stroke-width="2" stroke-dasharray="6 4" opacity=".7" />
        <polyline points={`190,${jy} ${176 + ea},210`} fill="none" stroke="#3a2412" stroke-width="2" stroke-dasharray="6 4" opacity=".7" />
        <path d="M40 60 l14 -16 l12 14 l10 -10 l14 16" fill="none" stroke="#2e2416" stroke-width="1.6" opacity=".55" />
        <path d="M70 176 q20 -10 40 0 t40 0" fill="none" stroke="#2e2416" stroke-width="1.4" opacity=".4" />
        <path d="M250 158 q24 -10 48 0" fill="none" stroke="#2e2416" stroke-width="1.4" opacity=".4" />
        {pieces.map((p) => <rect x={p.x} y={p.y} width="14" height="17" rx="1.5" fill={C_FILL[p.c]} stroke="#1d1209" stroke-width="1.6" />)}
        <circle cx="190" cy={jy} r="10" fill="#e8c35c" stroke="#3a2412" stroke-width="2.4" />
        <circle cx="190" cy={jy} r="3.5" fill="#3a2412" />
        <g transform="translate(318 40)" opacity=".75"><circle r="18" fill="none" stroke="#3a2412" stroke-width="1.4" /><path d="M0 -24 L0 24 M-24 0 L24 0" stroke="#3a2412" stroke-width="1.2" /><path d="M0 -18 L4 0 L0 18 L-4 0 Z" fill="#3a2412" /></g>
      </svg>
      <span class="mapname k">{COUNTRY_NAMES.kingdom}</span>
      <span class="mapname e">{COUNTRY_NAMES.empire}</span>
      <span class="mapname a">{COUNTRY_NAMES.alliance}</span>
      <span class="mapschool" style={{ top: `${(jy / 210) * 100}%` }}>リミナ分校</span>
      {label && <span class="maplabel">{label}</span>}
      <span class="mapnorth">北</span>
      <span class="stamp mapstamp">軍事機密</span>
      <span class="mapshare">地方　<b class="k">王{share.kingdom}</b>・<b class="e">帝{share.empire}</b>・<b class="a">同{share.alliance}</b></span>
      {changed > 0 && <span class="mapchanged">勢力図に変化 {changed}</span>}
    </button>
  );
}

interface DeskTodo { text: string; go: () => void; red?: boolean }
/** 教官手帳のやること（軍の記録帳らしく、漢数字で） */
export function deskTodos(s: GameState): DeskTodo[] {
  const out: DeskTodo[] = [];
  const list = enrolled(s);
  const day = DAY_NAMES[(s.day ?? 1) - 1];
  out.push({ text: `${day}曜　今日の授業を決める`, go: () => navigate({ tab: 'school', page: 'today' }) });
  if (s.week === 1 && (s.day ?? 1) === 1) out.push({ text: '今月の目標の技能を決める', go: () => navigate({ tab: 'school', page: 'targets' }), red: true });
  for (const st of list) if (st.dropoutSign) out.push({ text: `${st.given}　やめたがっている`, go: () => navigate({ tab: 'students', page: 'detail', id: st.id }), red: true });
  for (const id of s.consults) { const st = s.students[id]; if (st) out.push({ text: `${st.given}　相談したいことがある`, go: () => navigate({ tab: 'students', page: 'detail', id }), red: true }); }
  const ex = examCandidates(s);
  if (ex.length) out.push({ text: `兵種試験を受けられる子　${kanjiNum(ex.length)}名`, go: () => navigate({ tab: 'students', page: 'exam' }), red: true });
  for (const st of list) if (budKnown(st)) { out.push({ text: `${st.given}　${st.bud?.gold ? '金の芽' : `${SKILL_NAMES[st.bud!.skill!]}の芽`}を育てよう`, go: () => navigate({ tab: 'students', page: 'detail', id: st.id, sub: 'skills' }) }); break; }
  for (const st of list) if (st.birthday && st.birthday.month === s.month && st.birthday.week === s.week) out.push({ text: `${st.given}　今週が誕生日`, go: () => navigate({ tab: 'students', page: 'detail', id: st.id }) });
  const ne = nextEvent(s);
  if (ne) out.push({ text: ne.weeks === 0 ? `今週　${ne.label}` : `${ne.label}まで　${kanjiNum(ne.weeks)}週`, go: () => navigate({ tab: 'school', page: 'today' }) });
  const t = repTier(s.reputation);
  if (REP_TIERS[t + 1] && s.year <= 6) out.push({ text: `「${REP_TIERS[t + 1].name}」まで　評判あと${kanjiNum(Math.ceil(REP_TIERS[t + 1].at - s.reputation))}`, go: () => navigate({ tab: 'school', page: 'notebook' }) });
  const ready = MENTOR_ABILITIES.filter((a) => abilityState(s, a) === 'ready');
  if (ready.length) out.push({ text: `教官の心得を覚えられる（${mentorXp(s)}）`, go: () => navigate({ tab: 'school', page: 'instructor' }) });
  else { const next = MENTOR_ABILITIES.filter((a) => abilityState(s, a) === 'poor').map((a) => abilityCost(s, a)).sort((a, b) => a - b)[0]; if (next) out.push({ text: `先生の経験値　${mentorXp(s)}／${next}`, go: () => navigate({ tab: 'school', page: 'instructor' }) }); }
  return out;
}

/** 写真に出す生徒：気にかける生徒 → 今月の主役 → 学年の上から */
function photoStudents(s: GameState): { st: Student; tag: string }[] {
  const out: { st: Student; tag: string }[] = [];
  const add = (st: Student | undefined, tag: string) => { if (st && st.status === 'enrolled' && !out.some((x) => x.st.id === st.id) && out.length < 3) out.push({ st, tag }); };
  const flagOf = (st: Student, def: string) => { const f = studentFlags(s, st)[0]; return f ? f.text.replace(/ あと.*/, '').slice(0, 5) : def; };
  for (const id of s.pinned) add(s.students[id], flagOf(s.students[id], '★'));
  for (const sp of s.spotlight) add(s.students[sp.id], sp.done ? flagOf(s.students[sp.id], '主役') : '主役');
  for (const st of [...enrolled(s)].sort((a, b) => b.grade - a.grade || b.level - a.level)) add(st, flagOf(st, ''));
  return out;
}

export function Desk({ s }: { s: GameState }) {
  const todos = deskTodos(s);
  const unread = s.mail.filter((m) => !m.read);
  const latestMail = unread[0] ?? s.mail[0];
  const paper = s.news[0];
  const photos = photoStudents(s);
  const sick = teacherSick(s);
  return (
    <div class="desk">
      <WarMap s={s} />
      <div class="desk-row">
        <div class="desknote" role="button" onClick={() => { sfx('move'); navigate({ tab: 'school', page: 'notebook' }); }}>
          <div class="dn-title">教官手帳<span>{MONTH_NAMES[s.month].replace('月', '')}月の頁</span></div>
          <ul class="dn-list">
            {todos.slice(0, 5).map((t) => <li class={t.red ? 'red' : ''} onClick={(e) => { e.stopPropagation(); sfx('move'); t.go(); }}>{t.red ? '・' : ''}{t.text}</li>)}
          </ul>
          <div class="dn-foot"><span>手帳を開く ›</span><span onClick={(e) => { e.stopPropagation(); sfx('move'); navigate({ tab: 'school', page: 'instructor' }); }}>教官 ›</span></div>
        </div>
        <div class="desk-col">
          <div class="deskletter" role="button" onClick={() => { sfx('move'); navigate({ tab: 'school', page: 'mail' }); }}>
            {unread.length > 0 && <span class="dl-count">{unread.length}</span>}
            <div class="dl-title">{unread.length ? '急報' : '書状'}</div>
            <div class="dl-text">{latestMail ? `${latestMail.title}。${latestMail.body}` : 'まだ書状は届いていません'}</div>
            <span class="dl-seal">✦</span>
          </div>
          <div class="deskpaper" role="button" onClick={() => { sfx('page'); navigate({ tab: 'school', page: 'news' }); }}>
            <div class="dp-title">{PAPER_NAME}</div>
            <div class="dp-text">{paper ? paper.headline : '次の号は、九月の終わりに出ます'}</div>
          </div>
        </div>
      </div>
      {photos.length > 0 && (
        <div class="deskphotos">
          {photos.map(({ st, tag }, i) => (
            <button class={`photo-card t${i}`} onClick={() => { sfx('move'); navigate({ tab: 'students', page: tag === '試験OK' ? 'exam' : 'detail', id: st.id }); }}>
              <span class="pin red" />
              <Portrait st={st} size={92} frame={countryColor(st.origin)} />
              {tag && <span class="ph-tag">{tag}</span>}
              <span class="ph-name">{st.given}</span>
            </button>
          ))}
        </div>
      )}
      <div class="drawers">
        {([['instructor', '教官', 'crown'], ['targets', '目標技能', 'target'], ['facilities', '施設・講師', 'house'], ['armory', '武器庫', 'sword']] as const).map(([page, label, ic]) => (
          <button class="drawer" onClick={() => { sfx('move'); navigate({ tab: 'school', page }); }}><Icon name={ic} size={16} />{label}</button>
        ))}
      </div>
      <button class="command" onClick={() => { sfx('ok'); navigate({ tab: 'school', page: 'today' }); }}>
        <span class="cmd-seal">授</span>{sick ? '今日は休み（先生が寝込み中）' : '今日の授業を決める'}
      </button>
      <div style={{ height: 20 }} />
    </div>
  );
}
