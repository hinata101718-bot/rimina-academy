import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './icons';
import { SeasonFx, PageFlip } from './HomeDeco';
import { seasonOf } from '../core/calendar';
import { laneMul } from './anim';
import { useStore, navigate } from './store';
import { MONTH_NAMES } from '../core/util';
import { DAY_NAMES } from '../core/lessons';
import { Title } from './Title';
import { SchoolTab } from './School';
import { StudentsTab } from './Students';
import { WarTab } from './War';
import { YearbookTab } from './Yearbook';
import { SettingsTab } from './Settings';
import { PendingView } from './Pending';
import { BattleView } from './Battle';
import { AutoBattleView } from './AutoBattle';
import { money, stageOf } from './common';
import { STAGE_NAMES } from '../core/world';
import { sfx, unlockAudio, playBgm } from './sound';
import { B } from '../data/balance';
import { teacherStamina } from '../core/lessons';

const TABS = [
  { id: 'school', label: '学校', ic: 'school' },
  { id: 'students', label: '生徒', ic: 'students' },
  { id: 'war', label: '戦況', ic: 'war' },
  { id: 'yearbook', label: '年鑑', ic: 'book' },
  { id: 'settings', label: '設定', ic: 'gear' },
] as const;

export function App() {
  const { s, route } = useStore();
  const [flip, setFlip] = useState<{ from: { m: number; w: number }; to: { m: number; w: number } } | null>(null);
  const prev = useRef<{ y: number; m: number; w: number } | null>(null);
  useEffect(() => {
    if (!s) { prev.current = null; return; }
    const cur = { y: s.year, m: s.month, w: s.week };
    const p = prev.current;
    prev.current = cur;
    if (p && s.settings.flip && !s.battle && (p.m !== cur.m || p.w !== cur.w) && (p.y === cur.y || cur.m === 0)) {
      setFlip({ from: { m: p.m, w: p.m !== cur.m ? 5 : p.w }, to: { m: cur.m, w: cur.w } });
      sfx('page');
    }
  });
  useEffect(() => {
    const u = () => unlockAudio();
    window.addEventListener('pointerdown', u);
    return () => window.removeEventListener('pointerdown', u);
  }, []);
  const stage = s ? stageOf(s) : 'peace';
  useEffect(() => { document.body.dataset.stage = stage; if (s) playBgm(s.battle ? 'battle' : stage); }, [stage, !!s?.battle]);
  const season = s ? seasonOf(s.month) : 'spring';
  useEffect(() => { document.body.dataset.season = season; }, [season]);
  if (!s) return <Title />;
  if (s.battle?.auto) return <AutoBattleView key={`${s.battle.questId}${s.sortie?.idx ?? ''}`} />;
  if (s.battle) return <BattleView key={`${s.battle.questId}${s.sortie?.idx ?? ''}`} />;
  const unread = s.mail.filter((m) => !m.read).length;
  const stamina = Math.round(teacherStamina(s));
  // 8夜目：机の世界。ホームと机の上の頁は木の上に、ほかの画面は紙の頁（名簿＝綴じた名簿、個人ページ＝機密の書類、戦況＝作戦書）
  const desk = route.tab === 'school' && !route.page;
  const wood = desk || (route.tab === 'school' && ['today', 'instructor', 'notebook', 'news'].includes(route.page ?? '')) || (route.tab === 'students' && route.page === 'classbook');
  const paperKind = route.tab === 'students' ? (route.page === 'detail' || (route.page === 'exam' && route.id) ? 'dossier' : !route.page ? 'binder' : 'sheet-exam') : route.tab === 'war' ? 'secret' : route.tab === 'yearbook' ? 'annals' : '';
  const paperStamp = route.tab === 'students' && !route.page ? '在籍' : route.tab === 'students' && (route.page === 'detail' || (route.page === 'exam' && route.id)) ? '機密' : route.tab === 'war' ? '作戦' : route.tab === 'students' && route.page === 'exam' && !route.id ? '試験' : '';
  const page = <>
    {route.tab === 'school' && <SchoolTab />}
    {route.tab === 'students' && <StudentsTab />}
    {route.tab === 'war' && <WarTab />}
    {route.tab === 'yearbook' && <YearbookTab />}
    {route.tab === 'settings' && <SettingsTab />}
  </>;
  const exportDays = Math.floor((Date.now() - s.lastExport) / 86400000);
  return (
    <div class="app">
      <div class="header">
        <div class="plates">
          <span class="plate date"><b>第{s.year}年 {MONTH_NAMES[s.month]} 第{s.week}週 {DAY_NAMES[(s.day ?? 1) - 1]}</b><small>大陸暦・{STAGE_NAMES[stage]}</small></span>
          <span class="plate"><small>金</small><b>{s.money.toLocaleString()}</b></span>
          <span class="plate"><small>評判</small><b>{Math.round(s.reputation)}</b></span>
          <span class={`plate${stamina < B.teacher.lowAt ? ' low' : ''}`} onClick={() => navigate({ tab: 'school', page: 'instructor' })}><small>体力</small><b>{stamina}</b></span>
        </div>
      </div>
      <div class={`content${desk ? ' desk-wrap' : ''}`}>
        {exportDays >= B.exportReminderDays && route.tab === 'school' && !route.page && (
          <div class="guide" onClick={() => navigate({ tab: 'settings' })}>最後の書き出しから{exportDays}日たちました。念のため「設定」からセーブデータを書き出しておきましょう。</div>
        )}
        {wood ? page : <div class={`page-paper ${paperKind}`}>{paperStamp && <span class="stamp page-stamp">{paperStamp}</span>}{page}</div>}
      </div>
      <nav class="tabs"><div>
        {TABS.map((t) => (
          <button class={route.tab === t.id ? 'on' : ''} onClick={() => { sfx('move'); navigate({ tab: t.id }); }}>
            <span class="ic"><Icon name={t.ic} size={22} /></span>{t.label}
            {t.id === 'school' && unread > 0 && <span class="badge">{unread}</span>}
          </button>
        ))}
      </div></nav>
      <SeasonFx month={s.month} stage={stage} />
      {s.pending.length > 0 && <PendingView />}
      {flip && <PageFlip from={flip.from} to={flip.to} ms={Math.round(B.anim.flip * laneMul('anim'))} onEnd={() => setFlip(null)} />}
    </div>
  );
}
