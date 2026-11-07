import { useEffect } from 'preact/hooks';
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
  { id: 'school', label: '学校', ic: '🏫' },
  { id: 'students', label: '生徒', ic: '🎓' },
  { id: 'war', label: '戦況', ic: '⚔️' },
  { id: 'yearbook', label: '年鑑', ic: '📖' },
  { id: 'settings', label: '設定', ic: '⚙️' },
] as const;

export function App() {
  const { s, route } = useStore();
  useEffect(() => {
    const u = () => unlockAudio();
    window.addEventListener('pointerdown', u);
    return () => window.removeEventListener('pointerdown', u);
  }, []);
  const stage = s ? stageOf(s) : 'peace';
  useEffect(() => { document.body.dataset.stage = stage; if (s) playBgm(s.battle ? 'battle' : stage); }, [stage, !!s?.battle]);
  if (!s) return <Title />;
  if (s.battle) return <BattleView />;
  const unread = s.mail.filter((m) => !m.read).length;
  const exportDays = Math.floor((Date.now() - s.lastExport) / 86400000);
  return (
    <div class="app">
      <div class="header">
        <span class="date">{s.year}年目 {MONTH_NAMES[s.month]} 第{s.week}週</span>
        <span class="chip">💰{money(s.money)}</span>
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
        <button class="btn primary next-week" onClick={() => { sfx('ok'); act((g) => nextWeek(g)); }}>次の週へ ▶</button>
      )}
      <nav class="tabs"><div>
        {TABS.map((t) => (
          <button class={route.tab === t.id ? 'on' : ''} onClick={() => { sfx('move'); navigate({ tab: t.id }); }}>
            <span class="ic">{t.ic}</span>{t.label}
            {t.id === 'school' && unread > 0 && <span class="badge">{unread}</span>}
          </button>
        ))}
      </div></nav>
      {s.pending.length > 0 && <PendingView />}
    </div>
  );
}
