export type Tier = "free" | "beginner" | "master";

const order: Record<Tier, number> = { free: 0, beginner: 1, master: 2 };

export function tierMeets(required: Tier, actual: Tier): boolean {
  return order[actual] >= order[required];
}

export function parseTier(input: string | undefined): Tier | null {
  if (!input) return null;
  const t = input.trim().toLowerCase();
  if (t === "free" || t === "beginner" || t === "master") return t;
  return null;
}

export function maxTopForTier(tier: Tier): number {
  switch (tier) {
    case "free":
      return 10;
    case "beginner":
      return 25;
    case "master":
      return 50;
  }
}
