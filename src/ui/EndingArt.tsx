// エンディングの1枚絵（public/art/ に絵がないときの線画）。円卓・戴冠式・静かな戦場・学校の旗
import { artUrl, ArtSlot } from './HomeDeco';

const INK = '#5b4630';
function Table() {
  return (
    <g fill="none" stroke={INK} stroke-width="2.2" stroke-linecap="round">
      <ellipse cx="160" cy="92" rx="88" ry="26" fill="#efe1c2" />
      <path d="M72 92 L72 104 Q160 140 248 104 L248 92" />
      {[[96, 64, '#2f5fa8'], [160, 54, '#b03a2e'], [224, 64, '#4f8f4a']].map(([x, y, c]) => (
        <g><circle cx={x as number} cy={(y as number) - 14} r="9" fill="#f6ead2" /><path d={`M${(x as number) - 12} ${y} Q${x} ${(y as number) - 8} ${(x as number) + 12} ${y} L${(x as number) + 12} ${(y as number) + 16} L${(x as number) - 12} ${(y as number) + 16} Z`} fill={c as string} opacity=".85" /></g>
      ))}
      <path d="M140 88 L180 88" stroke-width="3" /><path d="M150 96 L172 96" />
    </g>
  );
}
function Crown() {
  return (
    <g fill="none" stroke={INK} stroke-width="2.2" stroke-linejoin="round">
      <path d="M110 110 L118 50 L140 80 L160 40 L180 80 L202 50 L210 110 Z" fill="#e8c34a" />
      <path d="M110 110 L210 110 L210 124 L110 124 Z" fill="#d9a92a" />
      {[118, 160, 202].map((x, i) => <circle cx={x} cy={i === 1 ? 40 : 50} r="5" fill="#b03a2e" />)}
      <path d="M40 130 L280 130" />
      {[60, 90, 230, 260].map((x) => <path d={`M${x} 130 L${x} 70 M${x} 70 L${x + 18} 78 L${x} 86`} />)}
    </g>
  );
}
function Field() {
  return (
    <g fill="none" stroke={INK} stroke-width="2.2" stroke-linecap="round">
      <circle cx="250" cy="44" r="16" fill="#f3d9a4" />
      <path d="M0 112 Q80 96 160 108 T320 100" />
      <path d="M0 132 Q100 118 200 128 T320 122" />
      {[70, 110, 190, 230].map((x, i) => <path d={`M${x} ${118 - (i % 2) * 6} L${x + 10} ${74 - (i % 2) * 6} M${x + 2} ${84 - (i % 2) * 6} L${x + 16} ${88 - (i % 2) * 6}`} />)}
      <path d="M40 40 Q60 30 80 40 M90 30 Q106 22 122 30" stroke-width="1.6" />
    </g>
  );
}
function Flag() {
  return (
    <g fill="none" stroke={INK} stroke-width="2.2" stroke-linejoin="round">
      <path d="M100 132 L100 70 L130 54 L160 70 L160 132 Z" fill="#efe1c2" />
      <path d="M170 132 L170 84 L220 84 L220 132 Z" fill="#efe1c2" />
      <path d="M130 54 L130 10" />
      <path d="M130 12 Q156 4 176 14 Q196 24 214 14 L214 44 Q196 54 176 44 Q156 34 130 42 Z" fill="#f6ead2" />
      <circle cx="172" cy="28" r="7" fill="#8b6b3e" opacity=".6" />
      <path d="M120 132 L120 108 Q130 98 140 108 L140 132" />
      {[180, 198].map((x) => <path d={`M${x} 98 L${x + 10} 98 L${x + 10} 110 L${x} 110 Z`} />)}
      <path d="M40 132 L280 132" />
    </g>
  );
}
const ART: Record<string, () => preact.JSX.Element> = { ending_peace: Table, ending_unify: Crown, ending_ceasefire: Field, ending_neutral: Flag };

/** 1枚絵：public/art/ に絵があればそれを、エンディングの絵がなければ線画を出す */
export function SceneArt({ name, height = 150 }: { name: string; height?: number }) {
  if (artUrl(name) || !ART[name]) return <ArtSlot name={name} height={height} />;
  const A = ART[name];
  return (
    <div class="artslot lineart" style={{ height }}>
      <svg viewBox="0 0 320 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <rect x="1" y="1" width="318" height="148" rx="10" fill="#f7efdc" stroke="#c9b48a" />
        <A />
      </svg>
    </div>
  );
}
