// Reef VIP Tier system — single source of truth
// Tiers based on cumulative spend (EGP). Multipliers apply to points & cashback.

import { Award, Medal, Crown, Gem, Sparkles, type LucideIcon } from "lucide-react";

export type TierKey = "bronze" | "silver" | "gold" | "platinum" | "vip";

export type TierDef = {
  key: TierKey;
  label: string;
  /** Min cumulative spend in EGP to reach this tier */
  minSpend: number;
  /** Reward multiplier for points & cashback */
  multiplier: number;
  icon: LucideIcon;
  /** Tailwind chip classes (bg+text+ring) */
  chip: string;
  /** Tailwind gradient stops (from-... via-... to-...) */
  gradient: string;
};

export const TIERS: TierDef[] = [
  {
    key: "bronze",
    label: "برونزي",
    minSpend: 0,
    multiplier: 1,
    icon: Award,
    chip: "bg-[#b87333]/15 text-[#a66425] ring-[#b87333]/40 dark:text-[#e3a06c]",
    gradient: "from-[#a86a3d] via-[#c98a52] to-[#7a4a28]",
  },
  {
    key: "silver",
    label: "فضي",
    minSpend: 2000,
    multiplier: 1.25,
    icon: Medal,
    chip: "bg-slate-400/15 text-slate-600 ring-slate-400/40 dark:text-slate-200",
    gradient: "from-slate-400 via-slate-300 to-slate-500",
  },
  {
    key: "gold",
    label: "ذهبي",
    minSpend: 10000,
    multiplier: 1.5,
    icon: Crown,
    chip: "bg-yellow-500/15 text-yellow-700 ring-yellow-500/40 dark:text-yellow-300",
    gradient: "from-amber-400 via-yellow-300 to-amber-600",
  },
  {
    key: "platinum",
    label: "بلاتيني",
    minSpend: 25000,
    multiplier: 2,
    icon: Gem,
    chip: "bg-cyan-500/15 text-cyan-700 ring-cyan-500/40 dark:text-cyan-200",
    gradient: "from-cyan-300 via-sky-200 to-indigo-400",
  },
  {
    key: "vip",
    label: "VIP",
    minSpend: 60000,
    multiplier: 3,
    icon: Sparkles,
    chip: "bg-fuchsia-500/15 text-fuchsia-700 ring-fuchsia-500/40 dark:text-fuchsia-200",
    gradient: "from-fuchsia-500 via-purple-400 to-amber-400",
  },
];

const TIER_BY_KEY = Object.fromEntries(TIERS.map((t) => [t.key, t])) as Record<TierKey, TierDef>;

export const getTier = (key: TierKey): TierDef => TIER_BY_KEY[key];

/** Resolve a tier from cumulative spend (EGP). */
export const tierForSpend = (spend: number): TierDef => {
  let current = TIERS[0];
  for (const t of TIERS) {
    if (spend >= t.minSpend) current = t;
  }
  return current;
};

/** Next tier above the current one, or null if at top. */
export const nextTier = (current: TierKey): TierDef | null => {
  const idx = TIERS.findIndex((t) => t.key === current);
  return idx >= 0 && idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
};

export type TierProgress = {
  tier: TierDef;
  next: TierDef | null;
  spend: number;
  remaining: number;
  pct: number;
};

/** Compute progress info for a given cumulative spend value. */
export const tierProgress = (spend: number): TierProgress => {
  const tier = tierForSpend(spend);
  const next = nextTier(tier.key);
  if (!next) {
    return { tier, next: null, spend, remaining: 0, pct: 100 };
  }
  const span = next.minSpend - tier.minSpend;
  const done = Math.max(0, spend - tier.minSpend);
  const pct = Math.min(100, Math.max(0, Math.round((done / span) * 100)));
  const remaining = Math.max(0, next.minSpend - spend);
  return { tier, next, spend, remaining, pct };
};

/**
 * Apply tier multiplier to a base reward (points or cashback).
 * Use this everywhere rewards are computed so users see consistent values.
 */
export const applyTierMultiplier = (base: number, key: TierKey): number => {
  return base * TIER_BY_KEY[key].multiplier;
};
