import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './icons';
import { SeasonFx, PageFlip } from './HomeDeco';
import { seasonOf } from '../core/calendar';
import { laneMul } from './anim';
import { useStore, navigate, act } from './store';
import { MONTH_NAMES } from '../core/util';
import { Title } from './Title';
import { SchoolTab } from './School';
import { StudentsTab } from './Students';
import { WarTab } from './War';
import { YearbookTab } from './Yearbook';
import { SettingsTab } from './Settings';
import { PendingView } from './Pending';
import { BattleView } from './Battle';
import { money, stageOf } from './common';
import { STAGE_NAMES } from '../core/world';
import { nextWeek } from '../core/flow';
import { sfx, unlockAudio, playBgm } from './sound';
import { B } from '../data/balance';

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
  if (s.battle) return <BattleView />;
  const unread = s.mail.filter((m) => !m.read).length;
  const exportDays = Math.floor((Date.now() - s.lastExport) / 86400000);
  return (
    <div class="app">
      <div class="header">
        <span class="date">{s.year}年目 {MONTH_NAMES[s.month]} 第{s.week}週</span>
        <span class="chip"><Icon name="coin" size={14} /> {money(s.money)}</span>
        <span class="chip">評判 {Math.round(s.reputation)}</span>
        <span class="chip">{STAGE_NAMES[stage]}</span>
      </div>
      <div class="content">
        {exportDays >= B.exportReminderDays && route.tab === 'school' && !route.page && (
          <div class="guide" onClick={() => navigate({ tab: 'settings' })}>最後の書き出しから{exportDays}日たちました。念のため「設定」からセーブデータを書き出しておきましょう。</div>
        )}
        {route.tab === 'school' && <SchoolTab />}
        {route.tab === 'students' && <StudentsTab />}
        {route.tab === 'war' && <WarTab />}
        {route.tab === 'yearbook' && <YearbookTab />}
        {route.tab === 'settings' && <SettingsTab />}
      </div>
      {route.tab === 'school' && !route.page && !s.pending.length && (
        <button class="btn primary next-week" onClick={() => { sfx('ok'); act((g) => nextWeek(g)); }}>次の週へ <Icon name="next" size={18} /></button>
      )}
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
