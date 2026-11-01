// The few themed touches: the sensei, the scroll, and the nav icons.
import { FACETS, FACET, STATUS } from "./words.js";

// A sensei in ink: straw hat, long beard, robe, staff.
export function Sensei({ size = 120 }) {
  return (
    <svg className="sensei" viewBox="0 0 150 210" width={size} height={size * 1.4} role="img" aria-label="Sensei">
      <rect x="22" y="30" width="5" height="180" rx="2.5" />
      <path d="M8 56 L74 18 L140 56 Q74 66 8 56 Z" />
      <ellipse cx="74" cy="68" rx="12" ry="11" />
      <path d="M64 72 Q67 102 65 130 Q72 116 76 136 Q79 112 85 72 Z" />
      <path d="M54 78 Q40 108 44 150 L32 210 L118 210 L104 150 Q108 108 94 78 Q74 70 54 78 Z" />
      <path d="M56 84 Q38 92 27 110 L33 118 Q44 104 60 100 Z" />
      <path d="M92 84 Q110 92 118 112 L112 118 Q102 104 88 100 Z" />
      <path className="sensei-sash" d="M46 142 Q74 148 102 142 L103 150 Q74 156 45 150 Z" />
    </svg>
  );
}

// A hanging scroll: wooden rods top and bottom, paper between. Used for hints and drills.
export function Scroll({ children, className = "", label }) {
  return (
    <section className={`scroll ${className}`} aria-label={label}>
      <span className="scroll-rod" aria-hidden="true" />
      <div className="scroll-paper">{children}</div>
      <span className="scroll-rod" aria-hidden="true" />
    </section>
  );
}

const ICONS = {
  // sensei: hat over a face
  sensei: (
    <g>
      <path d="M1.5 10.5 L12 3.5 L22.5 10.5 Q12 12.5 1.5 10.5 Z" />
      <ellipse cx="12" cy="14" rx="3.4" ry="3" />
      <path d="M9.3 16 Q10 20.5 12 22 Q14 20.5 14.7 16 Q12 17.5 9.3 16 Z" />
    </g>
  ),
  // skills: a katana
  skills: (
    <g transform="rotate(-45 12 12)">
      <path d="M1 12.3 Q8 9.4 15 10.9 L15 13.1 Q8 12.1 1 13.4 Z" />
      <rect x="15" y="8.6" width="1.6" height="6.8" rx="0.8" />
      <rect x="16.8" y="10.7" width="6.2" height="2.6" rx="1" />
    </g>
  ),
  // practice: a hanging punching bag
  practice: (
    <g>
      <rect x="11.2" y="1" width="1.6" height="3.2" />
      <path d="M8 4.2 H16 L15.2 6 H8.8 Z" />
      <path d="M7 10 V9 Q7 6 10 6 H14 Q17 6 17 9 V10 Z" />
      <rect x="7" y="11.3" width="10" height="4.4" />
      <path d="M7 17 H17 V18 Q17 21 14 21 H10 Q7 21 7 18 Z" />
    </g>
  ),
  // history: a rolled scroll
  history: (
    <g>
      <rect x="3" y="2.5" width="18" height="3" rx="1.5" />
      <path d="M5 5.5 H19 V18.5 H5 Z" fillOpacity=".25" />
      <path d="M8 9 H16 M8 12 H16 M8 15 H13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="3" y="18.5" width="18" height="3" rx="1.5" />
    </g>
  ),
  settings: (
    <path fillRule="evenodd" d="M10.3 2 h3.4 l.5 2.6 1.9.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.9 2.6.5 v3.4 l-2.6.5-.8 1.9 1.5 2.2-2.4 2.4-2.2-1.5-1.9.8-.5 2.6 h-3.4 l-.5-2.6-1.9-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.9L2 13.7 v-3.4 l2.6-.5.8-1.9-1.5-2.2 2.4-2.4 2.2 1.5 1.9-.8 Z M15.5 12 a3.5 3.5 0 1 0 -7 0 a3.5 3.5 0 1 0 7 0 Z" />
  ),
};

export function Icon({ name, size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

// Five facet dots: Recognize, Explain, Implement, Trace, Adapt.
export function Dots({ facets }) {
  return (
    <span className="dots" role="img" aria-label={FACETS.filter((f) => facets[f]).map((f) => `${FACET[f].name}: ${STATUS[facets[f].status].name}`).join(", ")}>
      {FACETS.map((f) => (
        <span key={f} className={`dot ${facets[f] ? `d-${facets[f].status}` : "d-none"}`} title={facets[f] ? `${FACET[f].name}: ${STATUS[facets[f].status].name}` : undefined} />
      ))}
    </span>
  );
}

export function Belt({ belt }) {
  if (!belt) return null;
  return (
    <span className="belt" title={`${belt.name} belt: ${belt.solid} of ${belt.total} solid`}>
      <svg viewBox="0 0 30 14" width="26" height="12" aria-hidden="true">
        <rect x="0.5" y="4" width="29" height="5" rx="1" fill={belt.color} stroke="var(--line-strong)" />
        <rect x="11" y="2.5" width="8" height="8" rx="1.5" fill={belt.color} stroke="var(--line-strong)" />
        <path d="M12.5 10.5 L10 13.5 M17.5 10.5 L20 13.5" stroke="var(--line-strong)" strokeWidth="2.2" />
      </svg>
      <span className="sr-only">{belt.name} belt</span>
    </span>
  );
}
