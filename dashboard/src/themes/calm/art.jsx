// The few themed touches: the sensei, the scroll, and the nav icons.
import { FACETS, FACET, STATUS } from "./words.js";

// The sensei: an old master's portrait, drawn in flat colour with ink outlines.
export function Sensei({ size = 120 }) {
  return (
    <svg className="sensei" viewBox="0 0 200 220" width={size} height={size * 1.1} role="img" aria-label="Sensei">
      <defs>
        <clipPath id="sensei-disc"><circle cx="100" cy="104" r="96" /></clipPath>
      </defs>
      <circle cx="100" cy="104" r="96" className="s-disc" />
      <g clipPath="url(#sensei-disc)" strokeLinejoin="round" strokeLinecap="round">
        {/* gi */}
        <path className="s-gi" d="M14 230 Q16 182 64 166 L100 198 L136 166 Q184 182 186 230 Z" />
        <path className="s-under" d="M78 168 L100 214 L122 168 L114 166 L100 196 L86 166 Z" />
        <path className="s-line" fill="none" d="M64 166 L100 222 M136 166 L100 222 M40 196 Q46 210 44 230 M160 196 Q154 210 156 230" />
        {/* neck */}
        <path className="s-skin-dark" d="M82 140 L118 140 L120 172 L80 172 Z" />
        {/* ears */}
        <ellipse className="s-skin" cx="55" cy="100" rx="9" ry="14" />
        <ellipse className="s-skin" cx="145" cy="100" rx="9" ry="14" />
        {/* topknot */}
        <ellipse className="s-hair" cx="100" cy="27" rx="12" ry="10" />
        {/* head */}
        <path className="s-skin" d="M58 92 Q57 34 100 32 Q143 34 142 92 L140 116 Q136 146 100 152 Q64 146 60 116 Z" />
        <path className="s-tie" d="M91 33 Q100 37 109 33 L108 38 Q100 41 92 38 Z" />
        <path className="s-shade" d="M100 32 Q143 34 142 92 L140 116 Q137 136 122 146 Q134 112 128 70 Q120 42 100 32 Z" />
        <path className="s-shade" d="M66 112 Q70 128 80 136 Q70 132 64 120 Z" />
        {/* forehead lines */}
        <path className="s-wrinkle" fill="none" d="M80 58 Q100 52 120 58 M84 67 Q100 62 116 67 M88 75 Q100 72 112 75" />
        {/* white hair at the sides */}
        <path className="s-hair" d="M70 62 Q56 60 50 72 Q44 84 52 98 Q55 90 60 89 Q55 82 60 77 Q58 70 66 69 Q66 65 70 62 Z" />
        <path className="s-hair" d="M 130 62 Q 144 60 150 72 Q 156 84 148 98 Q 145 90 140 89 Q 145 82 140 77 Q 142 70 134 69 Q 134 65 130 62 Z" />
        {/* brows: heavy, sweeping down and out */}
        <path className="s-hair" d="M96 86 Q84 76 66 82 Q58 86 54 96 Q66 86 76 90 Q86 88 96 92 Z" />
        <path className="s-hair" d="M104 86 Q116 76 134 82 Q142 86 146 96 Q134 86 124 90 Q114 88 104 92 Z" />
        {/* eyes: narrowed, calm */}
        <path className="s-eye" d="M72 99 Q82 94 92 99 Q82 102 72 99 Z" />
        <path className="s-eye" d="M108 99 Q118 94 128 99 Q118 102 108 99 Z" />
        {/* nose */}
        <path className="s-line" fill="none" d="M100 96 Q97 108 94 116 Q99 121 106 117" />
        {/* beard */}
        <path className="s-hair" d="M62 112 Q60 150 78 172 Q90 190 96 214 Q100 222 104 214 Q110 190 122 172 Q140 150 138 112 Q132 130 120 134 Q106 144 100 140 Q94 144 80 134 Q68 130 62 112 Z" />
        <path className="s-hair-shade" fill="none" d="M80 150 Q88 170 92 190 M100 150 Q100 176 100 204 M120 150 Q112 170 108 190 M70 136 Q74 152 82 164 M130 136 Q126 152 118 164" />
        {/* moustache */}
        <path className="s-hair" d="M100 120 Q88 117 78 126 Q70 134 64 146 Q76 136 86 133 Q95 130 100 132 Q105 130 114 133 Q124 136 136 146 Q130 134 122 126 Q112 117 100 120 Z" />
      </g>
      <circle cx="100" cy="104" r="96" className="s-ring" />
    </svg>
  );
}

// A hanging scroll (kakejiku): cord, top rod, a fabric mount, the paper, and a weighted roller.
// Every page hangs on one.
export function HangingScroll({ children }) {
  return (
    <div className="kake">
      <svg className="kake-cord" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
        <path d="M22 30 L50 3 L78 30" fill="none" />
        <circle cx="50" cy="3" r="2.6" />
      </svg>
      <div className="kake-rod" aria-hidden="true" />
      <div className="kake-mount">
        <div className="kake-paper">{children}</div>
      </div>
      <div className="kake-roller" aria-hidden="true" />
    </div>
  );
}

// A small rolled scroll: wooden rods top and bottom, paper between. Used for hints and drills.
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
