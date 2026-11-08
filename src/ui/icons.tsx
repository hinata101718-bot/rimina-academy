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
  lance: <><path d="M5 19L18 6" /><path d="M15.5 4.5L20 4l-.5 4.5-2 .5-2-2z" /><path d="M7 15l2 2" /></>,
  axe: <><path d="M6 20L16 8" /><path d="M13 5c2.5-1.8 5.5-1.2 7 .8-.8 2.6-3.2 4.6-6 4.4z" /></>,
  bow: <><path d="M6 3c7 2 11 8 12 15" /><path d="M6 3l12 15M4 13l9-4M13 9l-1-2.5M13 9l2.6.4" /></>,
  tome: <><path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z" /><path d="M5 18a2 2 0 0 1 2-2h11M10 8h5M10 11h3" /></>,
  staff: <><path d="M8 21L15 9" /><circle cx="16.5" cy="6.5" r="3" /><path d="M16.5 2v1.2M20.8 6.5h-1.2M12.2 6.5h1.2" /></>,
  gun: <><path d="M3 9h15l2 2h1v2h-6l-2 1-1 3H8l1-4H3z" /></>,
  star: <><path d="M12 3.5l2.5 5.2 5.6.7-4.1 3.9 1 5.6L12 16.2 7 18.9l1-5.6-4.1-3.9 5.6-.7z" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></>,
  rain: <><path d="M7 15a4 4 0 0 1 .5-8 5 5 0 0 1 9.5 1.5A3.3 3.3 0 0 1 17 15z" /><path d="M8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5" /></>,
  fog: <><path d="M4 9h13M7 13h13M4 17h12" /><path d="M8 5.5h8" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  skull: <><path d="M5 11a7 7 0 0 1 14 0v3l-2 1v3H7v-3l-2-1z" /><circle cx="9.5" cy="11.5" r="1.5" /><circle cx="14.5" cy="11.5" r="1.5" /><path d="M10 18v-2M14 18v-2" /></>,
  crown: <><path d="M4 18L3 7l5 4 4-6 4 6 5-4-1 11z" /><path d="M4 21h16" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l2 2M15 8l2 2" /></>,
  run: <><circle cx="14" cy="4.5" r="2" /><path d="M8 21l3-6 3 3v3M6 11l3-3 4 1 2 4 3 1" /><path d="M10 8l-1 5" /></>,
  hand: <><path d="M7 12V6.5a1.5 1.5 0 0 1 3 0V11M10 10V4.5a1.5 1.5 0 0 1 3 0V11M13 10V5.5a1.5 1.5 0 0 1 3 0V12M16 11a1.5 1.5 0 0 1 3 0v3a7 7 0 0 1-7 7c-3 0-4.5-1.5-6-4l-2.2-3.6A1.5 1.5 0 0 1 6.5 12L8 14" /></>,
  castle: <><path d="M4 21V9h3V6h2v3h2V6h2v3h2V6h2v3h3v12z" /><path d="M10 21v-4a2 2 0 0 1 4 0v4" /></>,
  cake: <><path d="M4 20h16v-7H4z" /><path d="M4 15.5c2 1.3 4 1.3 6 0s4-1.3 6 0 3 1 4 0M12 13V9M12 6.5v-1" /></>,
  scroll: <><path d="M7 4h11a2 2 0 0 1 0 4h-1v10a2 2 0 0 1-2 2H6a2 2 0 0 1 0-4h1z" /><path d="M7 16V6M10 9h4M10 12h4" /></>,
  medal: <><circle cx="12" cy="15" r="5" /><path d="M8.5 11L6 3h4l2 5 2-5h4l-2.5 8" /></>,
  chest: <><rect x="3.5" y="8" width="17" height="11" rx="1.5" /><path d="M3.5 12h17M12 10.5v3M6 8a6 6 0 0 1 12 0" /></>,
  door: <><path d="M6 21V4h12v17M3 21h18" /><circle cx="14.5" cy="13" r=".8" /></>,
  heal: <><path d="M12 5v14M5 12h14" /></>,
  shield: <><path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6z" /></>,
  flame: <><path d="M12 21c-4 0-6.5-2.6-6.5-6.2 0-3.4 2.6-5.2 3.6-8.3.4 1.9 1.4 3 2.5 3.5-.2-2.8.9-5.2 3-7 .3 3.4 2.4 5 3.3 7.4.6 1.5.6 2.7.6 4.4 0 3.6-2.5 6.2-6.5 6.2z" /><path d="M12 21c-1.7 0-2.8-1.2-2.8-2.8 0-1.8 1.4-2.6 2-4.2.9 1 2.1 1.7 2.8 3 .5 1.6-.3 4-2 4z" /></>,
  scout: <><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5.5 5.5M8 10.5a2.5 2.5 0 0 1 2.5-2.5" /></>,
};

export function Icon({ name, size = 20, stroke = 1.7 }: { name: keyof typeof PATHS | string; size?: number; stroke?: number }) {
  return (
    <svg class="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {PATHS[name] ?? PATHS.ceremony}
    </svg>
  );
}
