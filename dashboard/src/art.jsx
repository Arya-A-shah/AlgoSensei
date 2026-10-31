// Original silhouette artwork, drawn as inline SVG so it scales and recolours with CSS.
import { FACETS, FACET, STATUS, WEAPONS, SCHOOLS } from "./game.js";

// ---------- the sensei ----------
// An old master in a straw hat, staff in one hand, pointing the way with the other.
export function Sensei({ className = "" }) {
  return (
    <svg className={`sensei ${className}`} viewBox="0 0 230 320" role="img" aria-label="The sensei">
      <g className="sensei-body">
        {/* staff */}
        <rect x="52" y="44" width="6" height="276" rx="3" />
        <ellipse cx="55" cy="96" rx="5" ry="8" />
        {/* hat */}
        <path d="M30 82 L112 34 L194 82 Q112 94 30 82 Z" />
        <path d="M106 37 L112 26 L118 37 Z" />
        {/* head and beard */}
        <ellipse cx="112" cy="96" rx="15" ry="14" />
        <path d="M99 100 Q104 140 101 178 Q110 160 114 186 Q118 156 125 100 Z" />
        {/* robe */}
        <path d="M88 108 Q70 146 76 206 L58 318 L170 318 L150 206 Q156 146 136 108 Q112 98 88 108 Z" />
        {/* sleeve holding the staff */}
        <path d="M92 114 Q70 122 58 146 L66 156 Q80 138 96 134 Z" />
        {/* pointing arm */}
        <path d="M132 114 Q170 112 204 104 L207 111 Q174 128 136 138 Z" />
        <path d="M203 103 L226 99 L227 104 L206 111 Z" />
      </g>
      {/* sash: the one touch of colour on the silhouette */}
      <path className="sensei-sash" d="M80 196 Q113 204 148 196 L149 206 Q113 214 79 206 Z" />
    </svg>
  );
}

// The student: a fighting stance, facing the sensei.
export function Student({ className = "", belt = "#ece4d6" }) {
  return (
    <svg className={`student ${className}`} viewBox="0 0 160 240" role="img" aria-label="You">
      <g className="student-body">
        <circle cx="86" cy="40" r="15" />
        <path d="M70 34 Q86 20 102 32 L112 26 L104 38 Q86 30 70 40 Z" />
        <path d="M74 58 Q86 52 100 58 L104 122 L72 122 Z" />
        <path d="M76 64 L44 84 L30 70 L36 64 L46 72 L72 58 Z" />
        <path d="M100 62 L124 90 L114 104 L108 98 L114 90 L96 74 Z" />
        <path d="M72 120 L104 120 L108 132 Q118 170 132 236 L116 236 L96 152 L86 150 L62 236 L44 236 Q62 170 70 132 Z" />
      </g>
      <rect className="student-belt" x="70" y="117" width="36" height="6" rx="1" fill={belt} />
    </svg>
  );
}

// Dusk backdrop: sun, mountain ridges, a distant pagoda, the ground.
export function Backdrop() {
  return (
    <svg className="backdrop" viewBox="0 0 1200 420" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--night)" />
          <stop offset=".38" stopColor="var(--wine)" />
          <stop offset=".7" stopColor="var(--ember)" />
          <stop offset="1" stopColor="var(--amber)" />
        </linearGradient>
        <radialGradient id="sunglow" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="var(--sun)" stopOpacity=".9" />
          <stop offset="1" stopColor="var(--sun)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="420" fill="url(#sky)" />
      <circle cx="1030" cy="230" r="210" fill="url(#sunglow)" />
      <circle cx="1030" cy="236" r="104" fill="var(--sun)" />
      <path className="ridge ridge-far" d="M0 300 L120 236 L210 270 L330 196 L450 262 L560 214 L700 280 L820 226 L960 278 L1080 240 L1200 270 L1200 420 L0 420 Z" />
      {/* a pagoda on the far hills */}
      <g className="pagoda" transform="translate(268 6)">
        <rect x="604" y="246" width="4" height="12" />
        <path d="M586 262 Q606 256 616 246 Q626 256 646 262 L640 264 Q626 260 616 254 Q606 260 592 264 Z" />
        <rect x="596" y="263" width="40" height="10" />
        <path d="M580 276 Q604 270 616 258 Q628 270 652 276 L646 279 Q628 274 616 266 Q604 274 586 279 Z" />
        <rect x="592" y="278" width="48" height="16" />
      </g>
      <path className="ridge ridge-mid" d="M0 330 L90 290 L200 318 L300 268 L420 322 L540 286 L660 330 L780 290 L900 330 L1010 304 L1120 324 L1200 310 L1200 420 L0 420 Z" />
      <path className="ridge ridge-near" d="M0 352 Q300 336 600 348 T1200 344 L1200 420 L0 420 Z" />
    </svg>
  );
}

// ---------- weapons (data structures) ----------
const WEAPON_ART = {
  staff: (
    <g transform="rotate(-45 32 32)">
      {[2, 14, 26, 38, 50].map((x) => <rect key={x} x={x} y="29" width="11" height="6" rx="1.5" />)}
    </g>
  ),
  katana: (
    <g transform="rotate(-45 32 32)">
      <path d="M2 33 Q24 24 44 29.5 L44 34.5 Q24 31 2 35 Z" />
      <ellipse cx="46" cy="32" rx="2.4" ry="7" />
      <rect x="48.5" y="29.3" width="14" height="5.4" rx="1.6" />
    </g>
  ),
  shield: (
    <g fill="none" stroke="currentColor">
      <circle cx="32" cy="32" r="25" strokeWidth="5" />
      <path d="M19 12 V52 M32 7 V57 M45 12 V52 M12 19 H52 M7 32 H57 M12 45 H52" strokeWidth="3" />
    </g>
  ),
  shuriken: <path fillRule="evenodd" d="M32 3 L38.5 25.5 L61 32 L38.5 38.5 L32 61 L25.5 38.5 L3 32 L25.5 25.5 Z M36.5 32 a4.5 4.5 0 1 0 -9 0 a4.5 4.5 0 1 0 9 0 Z" />,
  kunai: (
    <g transform="rotate(-45 32 32)">
      <path d="M2 32 L22 24.5 L31 32 L22 39.5 Z" />
      <rect x="30" y="30" width="20" height="4" rx="1" />
      <circle cx="55.5" cy="32" r="5.5" fill="none" stroke="currentColor" strokeWidth="3" />
    </g>
  ),
};

export function Weapon({ id, size = 64, className = "" }) {
  const art = WEAPONS[id]?.art;
  return (
    <svg className={`weapon ${className}`} viewBox="0 0 64 64" width={size} height={size} fill="currentColor" aria-hidden="true">
      {WEAPON_ART[art] ?? WEAPON_ART.staff}
    </svg>
  );
}

// ---------- school glyphs ----------
const GLYPHS = {
  stance: (
    <g>
      <ellipse cx="8" cy="15" rx="3.6" ry="6.5" transform="rotate(-12 8 15)" />
      <ellipse cx="16.5" cy="9" rx="3.6" ry="6.5" transform="rotate(12 16.5 9)" />
    </g>
  ),
  forge: (
    <g>
      <rect x="3" y="4" width="13" height="7" rx="1.5" transform="rotate(-30 9.5 7.5)" />
      <rect x="10.5" y="9" width="3.4" height="14" rx="1.2" transform="rotate(-30 12 16)" />
    </g>
  ),
  weapon: <path fillRule="evenodd" d="M12 1.5 L14.6 9.4 L22.5 12 L14.6 14.6 L12 22.5 L9.4 14.6 L1.5 12 L9.4 9.4 Z M13.8 12 a1.8 1.8 0 1 0 -3.6 0 a1.8 1.8 0 1 0 3.6 0 Z" />,
  strike: <path d="M3 21 L12 12.5 L9.6 11.6 L21 3 L13.6 12.4 L16 13.2 Z" />,
  mind: <path fillRule="evenodd" d="M1.5 12 Q12 2.5 22.5 12 Q12 21.5 1.5 12 Z M15.5 12 a3.5 3.5 0 1 0 -7 0 a3.5 3.5 0 1 0 7 0 Z" />,
};

export function Glyph({ name, size = 24, className = "" }) {
  return (
    <svg className={`glyph ${className}`} viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      {GLYPHS[name]}
    </svg>
  );
}

// ---------- skill emblem: a seal with a progress ring ----------
export function Emblem({ node, size = 64 }) {
  const status = node.summary?.status ?? "unknown";
  const m = node.summary?.mastery ?? 0;
  const r = 27;
  const c = 2 * Math.PI * r;
  const isWeapon = node.layer === 2;
  return (
    <span className={`emblem em-${status}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={r} className="em-track" />
        {status !== "unknown" && (
          <circle cx="32" cy="32" r={r} className="em-ring" strokeDasharray={`${c * Math.max(0.06, m)} ${c}`} transform="rotate(-90 32 32)" />
        )}
      </svg>
      <span className="em-art">
        {isWeapon ? <Weapon id={node.id} size={size * 0.52} /> : <Glyph name={SCHOOLS[node.layer]?.glyph} size={size * 0.4} />}
      </span>
    </span>
  );
}

// ---------- five facet pips ----------
export function Pips({ facets, labels = false }) {
  return (
    <span className={`pips ${labels ? "pips-labelled" : ""}`} role="img" aria-label={FACETS.filter((f) => facets[f]).map((f) => `${FACET[f].full}: ${STATUS[facets[f].status].name}`).join(", ")}>
      {FACETS.map((f) => (
        <span key={f} className={`pip ${facets[f] ? `pip-${facets[f].status}` : "pip-none"}`} title={facets[f] ? `${FACET[f].full}: ${STATUS[facets[f].status].name}` : undefined}>
          {labels && <span className="pip-label">{FACET[f].name}</span>}
        </span>
      ))}
    </span>
  );
}

// ---------- a belt ----------
export function BeltIcon({ color, size = 44 }) {
  return (
    <svg className="belt-icon" viewBox="0 0 44 22" width={size} height={size / 2} aria-hidden="true">
      <rect x="1" y="6" width="42" height="7" rx="1.5" fill={color} stroke="var(--line-strong)" strokeWidth="1" />
      <path d="M17 13 L13 21 L18 21 L21 14 Z M27 13 L31 21 L26 21 L23 14 Z" fill={color} stroke="var(--line-strong)" strokeWidth="1" />
      <rect x="17" y="4" width="10" height="11" rx="2" fill={color} stroke="var(--line-strong)" strokeWidth="1" />
    </svg>
  );
}

// ---------- nav icons ----------
const NAV = {
  sensei: <path d="M2 13 L12 4 L22 13 Q12 15 2 13 Z M9 15 h6 v6 h-6 Z" />,
  dojo: <path d="M1 10 Q7 9 12 4 Q17 9 23 10 L21 11.5 L20 11.5 V20 H4 V11.5 L3 11.5 Z M10 14 h4 v6 h-4 Z" fillRule="evenodd" />,
  arena: <path d="M3 3 L5 3 L14 12 L12 14 Z M21 3 L19 3 L10 12 L12 14 Z M4 17 L7 20 L5 22 L2 19 Z M20 17 L17 20 L19 22 L22 19 Z M6 14 L10 18 M18 14 L14 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  log: <path d="M5 3 H17 Q20 3 20 6 V18 Q20 21 17 21 H7 Q4 21 4 18 V6 M8 8 H16 M8 12 H16 M8 16 H13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  settings: <path fillRule="evenodd" d="M10.3 2 h3.4 l.5 2.6 1.9.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.9 2.6.5 v3.4 l-2.6.5-.8 1.9 1.5 2.2-2.4 2.4-2.2-1.5-1.9.8-.5 2.6 h-3.4 l-.5-2.6-1.9-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.9L2 13.7 v-3.4 l2.6-.5.8-1.9-1.5-2.2 2.4-2.4 2.2 1.5 1.9-.8 Z M15.5 12 a3.5 3.5 0 1 0 -7 0 a3.5 3.5 0 1 0 7 0 Z" />,
};

export function NavIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      {NAV[name]}
    </svg>
  );
}

// Win / loss marks for the fight log.
export function VerdictMark({ verdict }) {
  const win = verdict === "Accepted";
  return (
    <span className={`vmark ${win ? "vmark-win" : verdict === "Compile Error" ? "vmark-ce" : "vmark-loss"}`} aria-hidden="true">
      <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        {win ? <path d="M4 10.5 L8.5 15 L16 5" /> : <path d="M5 5 L15 15 M15 5 L5 15" />}
      </svg>
    </span>
  );
}
