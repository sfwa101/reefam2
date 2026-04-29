/**
 * VectorBackdrop — gossamer pastel SVG art for section tiles.
 * Pure CSS/SVG: zero network requests, GPU-friendly, scales to any size.
 *
 * Each motif uses a soft pastel palette + ghosted oversized icon shapes.
 */

type MotifId =
  | "village" | "supermarket" | "kitchen" | "produce"
  | "dairy" | "meat" | "restaurants" | "sweets" | "baskets" | "recipes"
  | "pharmacy" | "library" | "home" | "gifts"
  | "subs" | "wholesale";

interface Palette {
  /** soft base wash (top of gradient) */
  base: string;
  /** deeper accent (bottom of gradient) */
  accent: string;
  /** ghost color of vector motif */
  ghost: string;
  /** ink color for text on this tile */
  ink: string;
}

/* Hand-picked pastel palettes — muted, magazine-like, never neon */
const PALETTES: Record<MotifId, Palette> = {
  village:     { base: "hsl(82 35% 90%)",  accent: "hsl(95 28% 78%)",  ghost: "hsl(92 32% 62%)",  ink: "hsl(95 38% 22%)" },
  supermarket: { base: "hsl(165 28% 90%)", accent: "hsl(170 25% 78%)", ghost: "hsl(168 30% 58%)", ink: "hsl(172 38% 22%)" },
  kitchen:     { base: "hsl(28 50% 92%)",  accent: "hsl(22 42% 82%)",  ghost: "hsl(20 45% 64%)",  ink: "hsl(20 50% 28%)" },
  produce:     { base: "hsl(70 40% 90%)",  accent: "hsl(85 32% 80%)",  ghost: "hsl(95 38% 56%)",  ink: "hsl(95 42% 24%)" },

  dairy:       { base: "hsl(40 50% 94%)",  accent: "hsl(38 40% 84%)",  ghost: "hsl(35 42% 64%)",  ink: "hsl(32 45% 26%)" },
  meat:        { base: "hsl(8 35% 92%)",   accent: "hsl(12 30% 82%)",  ghost: "hsl(8 38% 58%)",   ink: "hsl(8 45% 26%)" },
  restaurants: { base: "hsl(205 28% 90%)", accent: "hsl(210 25% 80%)", ghost: "hsl(208 30% 56%)", ink: "hsl(210 40% 24%)" },
  sweets:      { base: "hsl(335 38% 93%)", accent: "hsl(340 30% 84%)", ghost: "hsl(338 42% 64%)", ink: "hsl(338 42% 28%)" },
  baskets:     { base: "hsl(35 45% 92%)",  accent: "hsl(28 38% 82%)",  ghost: "hsl(28 45% 60%)",  ink: "hsl(28 50% 26%)" },
  recipes:     { base: "hsl(18 45% 92%)",  accent: "hsl(15 38% 82%)",  ghost: "hsl(15 45% 60%)",  ink: "hsl(15 48% 26%)" },

  pharmacy:    { base: "hsl(168 32% 90%)", accent: "hsl(172 28% 80%)", ghost: "hsl(168 38% 56%)", ink: "hsl(170 42% 22%)" },
  library:     { base: "hsl(210 32% 91%)", accent: "hsl(215 28% 82%)", ghost: "hsl(210 35% 56%)", ink: "hsl(212 42% 24%)" },
  home:        { base: "hsl(220 18% 91%)", accent: "hsl(218 16% 82%)", ghost: "hsl(218 22% 56%)", ink: "hsl(218 30% 24%)" },
  gifts:       { base: "hsl(345 38% 93%)", accent: "hsl(348 30% 84%)", ghost: "hsl(348 42% 64%)", ink: "hsl(348 45% 28%)" },

  subs:        { base: "hsl(150 30% 90%)", accent: "hsl(160 25% 78%)", ghost: "hsl(155 32% 56%)", ink: "hsl(158 42% 22%)" },
  wholesale:   { base: "hsl(32 50% 92%)",  accent: "hsl(28 42% 82%)",  ghost: "hsl(28 48% 56%)",  ink: "hsl(28 50% 26%)" },
};

/* ------------------------------------------------------------------ */
/* Motif definitions — minimalist vector silhouettes (single path/group)
/* Each viewBox is 200x200; rendered translucent.                      */
/* ------------------------------------------------------------------ */

const Motif = ({ id, color }: { id: MotifId; color: string }) => {
  const common = { fill: color, fillOpacity: 0.16 };
  switch (id) {
    case "village":
      return (
        <g {...common}>
          {/* barn + tree silhouette */}
          <path d="M30 140 L30 90 L70 60 L110 90 L110 140 Z" />
          <rect x="55" y="105" width="30" height="35" fillOpacity={0.10} />
          <circle cx="155" cy="95" r="32" />
          <rect x="148" y="115" width="14" height="35" />
        </g>
      );
    case "supermarket":
      return (
        <g {...common}>
          {/* shopping bag */}
          <path d="M55 70 L55 50 Q55 30 80 30 Q105 30 105 50 L105 70 M40 70 L120 70 L130 170 L30 170 Z" />
        </g>
      );
    case "kitchen":
      return (
        <g {...common}>
          {/* skillet */}
          <circle cx="100" cy="105" r="55" />
          <rect x="155" y="98" width="50" height="14" rx="6" />
          <circle cx="100" cy="105" r="35" fillOpacity={0.10} />
        </g>
      );
    case "produce":
      return (
        <g {...common}>
          {/* leaf */}
          <path d="M40 160 Q40 60 140 40 Q160 100 120 150 Q90 175 40 160 Z" />
          <path d="M50 155 Q90 110 140 60" stroke={color} strokeWidth="3" strokeOpacity="0.18" fill="none" />
        </g>
      );
    case "dairy":
      return (
        <g {...common}>
          {/* milk bottle */}
          <path d="M75 30 L125 30 L125 55 L135 75 L135 165 Q135 175 125 175 L75 175 Q65 175 65 165 L65 75 L75 55 Z" />
        </g>
      );
    case "meat":
      return (
        <g {...common}>
          {/* drumstick */}
          <circle cx="70" cy="70" r="32" />
          <circle cx="95" cy="55" r="22" />
          <rect x="80" y="80" width="90" height="22" rx="11" transform="rotate(35 80 80)" />
        </g>
      );
    case "restaurants":
      return (
        <g {...common}>
          {/* fork & knife crossed */}
          <rect x="60" y="20" width="10" height="160" rx="5" transform="rotate(-15 60 20)" />
          <rect x="130" y="20" width="10" height="160" rx="5" transform="rotate(15 130 20)" />
          <ellipse cx="55" cy="40" rx="14" ry="22" />
          <ellipse cx="145" cy="40" rx="10" ry="22" />
        </g>
      );
    case "sweets":
      return (
        <g {...common}>
          {/* cupcake */}
          <path d="M55 100 L145 100 L130 175 L70 175 Z" />
          <circle cx="80" cy="90" r="22" />
          <circle cx="100" cy="78" r="26" />
          <circle cx="120" cy="90" r="22" />
        </g>
      );
    case "baskets":
      return (
        <g {...common}>
          {/* basket */}
          <path d="M40 90 L160 90 L145 175 L55 175 Z" />
          <path d="M55 90 Q100 30 145 90" stroke={color} strokeWidth="6" strokeOpacity="0.20" fill="none" />
        </g>
      );
    case "recipes":
      return (
        <g {...common}>
          {/* chef hat */}
          <path d="M50 110 Q50 60 100 60 Q150 60 150 110 L150 150 L50 150 Z" />
          <circle cx="70" cy="80" r="22" />
          <circle cx="100" cy="65" r="26" />
          <circle cx="130" cy="80" r="22" />
        </g>
      );
    case "pharmacy":
      return (
        <g {...common}>
          {/* plus cross */}
          <rect x="80" y="30" width="40" height="140" rx="8" />
          <rect x="30" y="80" width="140" height="40" rx="8" />
        </g>
      );
    case "library":
      return (
        <g {...common}>
          {/* stacked books */}
          <rect x="40" y="50" width="120" height="22" rx="3" />
          <rect x="50" y="80" width="100" height="22" rx="3" />
          <rect x="40" y="110" width="120" height="22" rx="3" />
          <rect x="55" y="140" width="90" height="22" rx="3" />
        </g>
      );
    case "home":
      return (
        <g {...common}>
          {/* house */}
          <path d="M30 100 L100 40 L170 100 L170 170 L30 170 Z" />
          <rect x="80" y="120" width="40" height="50" fillOpacity={0.08} />
        </g>
      );
    case "gifts":
      return (
        <g {...common}>
          {/* gift box */}
          <rect x="40" y="70" width="120" height="100" rx="6" />
          <rect x="40" y="60" width="120" height="20" rx="4" />
          <rect x="92" y="40" width="16" height="130" />
          <path d="M100 60 Q70 30 60 50 Q70 60 100 60 Q130 60 140 50 Q130 30 100 60 Z" />
        </g>
      );
    case "subs":
      return (
        <g {...common}>
          {/* calendar repeat */}
          <rect x="35" y="50" width="130" height="120" rx="10" />
          <rect x="35" y="50" width="130" height="28" />
          <circle cx="100" cy="120" r="30" fillOpacity={0.10} />
          <path d="M100 100 L120 120 L100 140" stroke={color} strokeWidth="6" strokeOpacity="0.25" fill="none" strokeLinecap="round" />
        </g>
      );
    case "wholesale":
      return (
        <g {...common}>
          {/* stacked boxes */}
          <rect x="30" y="100" width="60" height="60" />
          <rect x="95" y="100" width="60" height="60" />
          <rect x="62" y="40" width="60" height="55" />
        </g>
      );
  }
};

/* ------------------------------------------------------------------ */

interface BackdropProps {
  motif: MotifId;
  className?: string;
  /** when true, ink (text/badge) gets darker for legibility on busy hero */
  contrast?: "light" | "dark";
}

export const VectorBackdrop = ({ motif, className = "" }: BackdropProps) => {
  const p = PALETTES[motif];
  return (
    <svg
      viewBox="0 0 200 200"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      className={`absolute inset-0 h-full w-full ${className}`}
    >
      <defs>
        <linearGradient id={`bg-${motif}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={p.base} />
          <stop offset="100%" stopColor={p.accent} />
        </linearGradient>
        <radialGradient id={`gl-${motif}`} cx="0.85" cy="0.15" r="0.8">
          <stop offset="0%" stopColor="white" stopOpacity="0.55" />
          <stop offset="60%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="200" height="200" fill={`url(#bg-${motif})`} />
      {/* oversized motif, off-center for editorial feel */}
      <g transform="translate(20 20) scale(1.05)">
        <Motif id={motif} color={p.ghost} />
      </g>
      {/* gentle highlight wash */}
      <rect width="200" height="200" fill={`url(#gl-${motif})`} />
    </svg>
  );
};

export const motifInk = (motif: MotifId) => PALETTES[motif].ink;

export type { MotifId };
