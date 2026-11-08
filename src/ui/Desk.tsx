// ホーム（8夜目）：「教官の机 × 軍記もの」。机の上の物がそのまま各画面の入口
// （14夜目に作戦地図をなくした）教官手帳→手帳（やること・教官）、急報の書状→郵便受け、新聞→新聞、生徒の写真→個人ページ、本日の授業を命ず→今日の授業
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
import { mapChanges } from '../core/regions';
import { REGION_BY_ID } from '../data/regions';
import { orgChanges, factionName } from '../core/officers';
import { ROSTER_FACTIONS } from '../data/officers';
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
import { DeskTour, tourFocus } from './Guide';

// 14夜目：ホームの作戦地図（8夜目）はなくした。戦況は下の「戦況」の札から、勢力図・組織図の変化は教官手帳の赤い字で

interface DeskTodo { text: string; go: () => void; red?: boolean }
/** 教官手帳のやること（軍の記録帳らしく、漢数字で） */
export function deskTodos(s: GameState): DeskTodo[] {
  const out: DeskTodo[] = [];
  const list = enrolled(s);
  const day = DAY_NAMES[(s.day ?? 1) - 1];
  out.push({ text: `${day}曜　今日の授業を決める`, go: () => navigate({ tab: 'school', page: 'today' }) });
  // 14夜目：ホームの作戦地図をなくしたので、勢力図・組織図の大きな変化は手帳の赤い字で知らせる（見たら消える）
  const mc = mapChanges(s);
  if (mc.length) { const r0 = REGION_BY_ID[mc[0].id]; out.push({ text: `勢力図が動いた ― ${r0?.short ?? r0?.name ?? ''}が${OWNER_SHORT[mc[0].to] ?? ''}の手に${mc.length > 1 ? ` ほか${mc.length - 1}つ` : ''} ▶`, go: () => navigate({ tab: 'war', sub: 'play' }), red: true }); }
  const oc = bigOrgChange(s);
  if (oc) out.push({ text: `組織図が動いた ― ${oc.text} ▶`, go: () => navigate({ tab: 'war', page: 'officers', id: oc.id }), red: true });
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

const OWNER_SHORT: Record<string, string> = { ...COUNTRY_SHORT, school: '学校', wild: '無主地' };
/** 組織図の大きな変化（将軍の交代・宿敵の昇進など）。いちばん大きいものを1つ */
function bigOrgChange(s: GameState): { id: string; text: string } | null {
  for (const f of ROSTER_FACTIONS) {
    const name = factionName(f);
    for (const c of orgChanges(s, f)) {
      const o = (s.officers ?? []).find((x) => x.id === c.id);
      if (!o) continue;
      const rival = Object.values(s.rivalries ?? {}).some((rv) => rv.oid === o.id && rv.stage >= 2 && !rv.settled);
      if (c.to === 0 || c.from === 0 || (o.rank === 0 && (c.kind === 'new' || c.kind === 'fell' || c.kind === 'gone')) || (rival && c.kind === 'promote')) return { id: o.id, text: `${name}：${c.text}` };
    }
  }
  return null;
}

export function Desk({ s }: { s: GameState }) {
  const todos = deskTodos(s);
  const unread = s.mail.filter((m) => !m.read);
  const latestMail = unread[0] ?? s.mail[0];
  const paper = s.news[0];
  const photos = photoStudents(s);
  const sick = teacherSick(s);
  return (
    <div class={`desk st-${stageOf(s)}`}>
      <span class="desk-candle" aria-hidden="true" />
      <div class="desk-row">
        <div class={`desknote${tourFocus(s, 'note')}`} role="button" onClick={() => { sfx('move'); navigate({ tab: 'school', page: 'notebook' }); }}>
          <div class="dn-title">教官手帳<span>{MONTH_NAMES[s.month].replace('月', '')}月の頁</span></div>
          <ul class="dn-list">
            {todos.slice(0, 5).map((t) => <li class={t.red ? 'red' : ''} onClick={(e) => { e.stopPropagation(); sfx('move'); t.go(); }}>{t.red ? '・' : ''}{t.text}</li>)}
          </ul>
          <div class="dn-foot"><span>手帳を開く ›</span><span onClick={(e) => { e.stopPropagation(); sfx('move'); navigate({ tab: 'school', page: 'instructor' }); }}>教官 ›</span></div>
        </div>
        <div class="desk-col">
          <div class={`deskletter${tourFocus(s, 'letter')}`} role="button" onClick={() => { sfx('move'); navigate({ tab: 'school', page: 'mail' }); }}>
            {unread.length > 0 && <span class="dl-count">{unread.length}</span>}
            <div class="dl-title">{unread.length ? '急報' : '書状'}</div>
            <div class="dl-text">{latestMail ? `${latestMail.title}。${latestMail.body}` : 'まだ書状は届いていません'}</div>
            <span class="dl-seal">✦</span>
          </div>
          <div class={`deskpaper${tourFocus(s, 'paper')}`} role="button" onClick={() => { sfx('page'); navigate({ tab: 'school', page: 'news' }); }}>
            <div class="dp-title">{PAPER_NAME}</div>
            <div class="dp-text">{paper ? paper.headline : '次の号は、九月の終わりに出ます'}</div>
          </div>
        </div>
      </div>
      {photos.length > 0 && (
        <div class={`deskphotos${tourFocus(s, 'photos')}`}>
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
      <div class={`drawers${tourFocus(s, 'drawers')}`}>
        {([['instructor', '教官', 'crown'], ['targets', '目標技能', 'target'], ['facilities', '施設・講師', 'house'], ['armory', '武器庫', 'sword']] as const).map(([page, label, ic]) => (
          <button class="drawer" onClick={() => { sfx('move'); navigate({ tab: 'school', page }); }}><Icon name={ic} size={16} />{label}</button>
        ))}
      </div>
      <button class={`command${tourFocus(s, 'command')}`} onClick={() => { sfx('ok'); navigate({ tab: 'school', page: 'today' }); }}>
        <span class="cmd-seal">授</span>{sick ? '今日は休み（先生が寝込み中）' : '今日の授業を決める'}
      </button>
      <div style={{ height: 20 }} />
      <DeskTour s={s} />
    </div>
  );
}
