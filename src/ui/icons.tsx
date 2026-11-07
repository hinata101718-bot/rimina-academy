// 線画のアイコン（色は文字色にあわせる）。絵文字の代わりに使う
import type { JSX } from 'preact';

const PATHS: Record<string, JSX.Element> = {
  school: <><path d="M3 21h18M5 21V10l7-5 7 5v11" /><path d="M9 21v-5h6v5M12 5V2l3 1.2-3 1.3" /><path d="M8 12h2M14 12h2" /></>,
  students: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c.6-3.6 2.8-5.5 5.5-5.5s4.9 1.9 5.5 5.5" /><path d="M15.5 5.2a3 3 0 0 1 0 5.6M17 14.8c2 .6 3.2 2.3 3.6 5.2" /></>,
  war: <><path d="M4 4l9 9M4 4v3.5M4 4h3.5" /><path d="M20 4l-9 9M20 4v3.5M20 4h-3.5" /><path d="M7.5 15.5l-3 3M16.5 15.5l3 3M6 17l1.5 1.5M18 17l-1.5 1.5" /></>,
  book: <><path d="M4 5.5C6.5 4 9.5 4 12 5.5 14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0z" /><path d="M12 5.5V19" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></>,
  lesson: <><path d="M3 6l9-3 9 3-9 3z" /><path d="M7 7.5V13c0 1.5 2.2 3 5 3s5-1.5 5-3V7.5M21 6v6" /></>,
  house: <><path d="M3 11l9-7 9 7" /><path d="M5 9.5V20h14V9.5M10 20v-5h4v5" /></>,
  sword: <><path d="M14.5 3.5H20v5.5L9 20l-5-5z" /><path d="M6 13l5 5M3 21l3-3" /></>,
  mail: <><rect x="3" y="5.5" width="18" height="13" rx="1.5" /><path d="M3.5 6.5l8.5 6.5 8.5-6.5" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="1.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></>,
  battle: <><path d="M5 19l9-9M14 10l1.5-4.5L20 4l-1.5 4.5zM5 5l6 6M3.5 18.5l2 2M8 16l-2 2" /></>,
  ceremony: <><path d="M12 3l2.3 4.7 5.2.8-3.8 3.7.9 5.2-4.6-2.4-4.6 2.4.9-5.2-3.8-3.7 5.2-.8z" /></>,
  camp: <><path d="M3 20h18M5 20l7-14 7 14M12 6v14M9 20l3-5 3 5" /></>,
  flag: <><path d="M5 21V3.5M5 4h11l-2.5 3.5L16 11H5" /></>,
  lantern: <><path d="M12 2v2.5M9 4.5h6M8 7c0-1.4 1.8-2.5 4-2.5S16 5.6 16 7v8c0 1.4-1.8 2.5-4 2.5S8 16.4 8 15z" /><path d="M10 17.5V20h4v-2.5M8 11h8" /></>,
  exam: <><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v3h3M9 11h6M9 14.5h6M9 18h3" /></>,
  coin: <><circle cx="12" cy="12" r="8" /><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.6.8-2.6 1.9 0 2.6 5.3 1.4 5.3 4.1 0 1.1-1.2 2-2.7 2-1.2 0-2.2-.5-2.6-1.3M12 6.5V8M12 16v1.5" /></>,
  next: <><path d="M5 12h13M13 6l6 6-6 6" /></>,
  talk: <><path d="M4 5.5h16v10H9l-4 3.5v-3.5H4z" /><path d="M8 10h.01M12 10h.01M16 10h.01" /></>,
  heart: <><path d="M12 20s-7.5-4.5-7.5-10A4.3 4.3 0 0 1 12 7.2 4.3 4.3 0 0 1 19.5 10c0 5.5-7.5 10-7.5 10z" /></>,
  pin: <><path d="M9 3h6l-1 5 3 3H7l3-3zM12 11v10" /></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  shield: <><path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6z" /></>,
};

export function Icon({ name, size = 20, stroke = 1.7 }: { name: keyof typeof PATHS | string; size?: number; stroke?: number }) {
  return (
    <svg class="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {PATHS[name] ?? PATHS.ceremony}
    </svg>
  );
}
