// The sensei portrait, same drawing as the dashboard, with colours inlined for the popup.
export function Sensei({ size = 120 }) {
  return (
    <svg viewBox="0 0 200 220" width={size} height={size * 1.1} role="img" aria-label="Sensei" className="shrink-0">
      <defs>
        <clipPath id="popup-sensei-disc"><circle cx="100" cy="104" r="96" /></clipPath>
      </defs>
      <circle cx="100" cy="104" r="96" fill="#f0dcc0" />
      <g clipPath="url(#popup-sensei-disc)" strokeLinejoin="round" strokeLinecap="round" stroke="#2a1f17" strokeWidth="2">
        {/* gi */}
        <path fill="#2b2f3a" d="M14 230 Q16 182 64 166 L100 198 L136 166 Q184 182 186 230 Z" />
        <path fill="#e8e1d2" d="M78 168 L100 214 L122 168 L114 166 L100 196 L86 166 Z" />
        <path stroke="#2a1f17" fill="none" d="M64 166 L100 222 M136 166 L100 222 M40 196 Q46 210 44 230 M160 196 Q154 210 156 230" />
        {/* neck */}
        <path fill="#c99a72" d="M82 140 L118 140 L120 172 L80 172 Z" />
        {/* ears */}
        <ellipse fill="#e9c39c" cx="55" cy="100" rx="9" ry="14" />
        <ellipse fill="#e9c39c" cx="145" cy="100" rx="9" ry="14" />
        {/* topknot */}
        <ellipse fill="#f3f1ec" cx="100" cy="27" rx="12" ry="10" />
        {/* head */}
        <path fill="#e9c39c" d="M58 92 Q57 34 100 32 Q143 34 142 92 L140 116 Q136 146 100 152 Q64 146 60 116 Z" />
        <path fill="#b4412d" d="M91 33 Q100 37 109 33 L108 38 Q100 41 92 38 Z" />
        <path fill="#c99a72" fillOpacity="0.45" stroke="none" d="M100 32 Q143 34 142 92 L140 116 Q137 136 122 146 Q134 112 128 70 Q120 42 100 32 Z" />
        <path fill="#c99a72" fillOpacity="0.45" stroke="none" d="M66 112 Q70 128 80 136 Q70 132 64 120 Z" />
        {/* forehead lines */}
        <path stroke="#9a6e4c" strokeWidth="1.6" fill="none" d="M80 58 Q100 52 120 58 M84 67 Q100 62 116 67 M88 75 Q100 72 112 75" />
        {/* white hair at the sides */}
        <path fill="#f3f1ec" d="M70 62 Q56 60 50 72 Q44 84 52 98 Q55 90 60 89 Q55 82 60 77 Q58 70 66 69 Q66 65 70 62 Z" />
        <path fill="#f3f1ec" d="M 130 62 Q 144 60 150 72 Q 156 84 148 98 Q 145 90 140 89 Q 145 82 140 77 Q 142 70 134 69 Q 134 65 130 62 Z" />
        {/* brows: heavy, sweeping down and out */}
        <path fill="#f3f1ec" d="M96 86 Q84 76 66 82 Q58 86 54 96 Q66 86 76 90 Q86 88 96 92 Z" />
        <path fill="#f3f1ec" d="M104 86 Q116 76 134 82 Q142 86 146 96 Q134 86 124 90 Q114 88 104 92 Z" />
        {/* eyes: narrowed, calm */}
        <path fill="#2a1f17" d="M72 99 Q82 94 92 99 Q82 102 72 99 Z" />
        <path fill="#2a1f17" d="M108 99 Q118 94 128 99 Q118 102 108 99 Z" />
        {/* nose */}
        <path stroke="#2a1f17" fill="none" d="M100 96 Q97 108 94 116 Q99 121 106 117" />
        {/* beard */}
        <path fill="#f3f1ec" d="M62 112 Q60 150 78 172 Q90 190 96 214 Q100 222 104 214 Q110 190 122 172 Q140 150 138 112 Q132 130 120 134 Q106 144 100 140 Q94 144 80 134 Q68 130 62 112 Z" />
        <path stroke="#c9c4ba" strokeWidth="2" fill="none" d="M80 150 Q88 170 92 190 M100 150 Q100 176 100 204 M120 150 Q112 170 108 190 M70 136 Q74 152 82 164 M130 136 Q126 152 118 164" />
        {/* moustache */}
        <path fill="#f3f1ec" d="M100 120 Q88 117 78 126 Q70 134 64 146 Q76 136 86 133 Q95 130 100 132 Q105 130 114 133 Q124 136 136 146 Q130 134 122 126 Q112 117 100 120 Z" />
      </g>
      <circle cx="100" cy="104" r="96" fill="none" stroke="#5a3e2b" strokeWidth="4" />
    </svg>
  );
}
