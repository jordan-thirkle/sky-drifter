// Persistent Progression System for Sky Drifter
// Save/load, meta-upgrades, character unlocks

export type UpgradeKey = "hp" | "damage" | "xp" | "luck";
export type CharacterId = "wanderer" | "berserker" | "mage" | "tank";

export interface SaveData {
  fragments: number;
  upgrades: Record<UpgradeKey, number>;
  unlocked: CharacterId[];
  selected: CharacterId;
}

export interface RunStats {
  hp: number;
  damage: number;
  xpGain: number;
  luck: number;
  projectiles: number;
  speed: number;
}

const STORAGE_KEY = "sky-drifter-progression-v1";

const UPGRADE_DATA: Record<UpgradeKey, {
  name: string;
  values: number[];
  costs: number[];
  format: (value: number) => string;
}> = {
  hp: { name: "Starting HP", values: [100, 120, 150, 200], costs: [50, 100, 200, 500], format: v => `${v}` },
  damage: { name: "Starting Damage", values: [1, 1.1, 1.25, 1.5], costs: [50, 100, 200, 500], format: v => `×${v.toFixed(2)}` },
  xp: { name: "XP Gain", values: [1, 1.15, 1.3, 1.5], costs: [50, 100, 200, 500], format: v => `${Math.round(v * 100)}%` },
  luck: { name: "Luck", values: [0, 5, 10, 20], costs: [75, 150, 300, 750], format: v => `+${v}%` },
};

const CHARACTERS: Record<CharacterId, { name: string; desc: string; cost: number; apply: (s: RunStats) => void }> = {
  wanderer: { name: "Wanderer", desc: "Balanced stats", cost: 0, apply: () => {} },
  berserker: { name: "Berserker", desc: "+20% dmg, -10% HP", cost: 100, apply: s => { s.damage *= 1.2; s.hp *= 0.9; } },
  mage: { name: "Mage", desc: "+1 projectile, -15% dmg", cost: 200, apply: s => { s.projectiles += 1; s.damage *= 0.85; } },
  tank: { name: "Tank", desc: "+50% HP, -20% speed", cost: 500, apply: s => { s.hp *= 1.5; s.speed *= 0.8; } },
};

export class ProgressionSystem {
  private save: SaveData;

  constructor() {
    this.save = this.load();
  }

  private load(): SaveData {
    const defaults: SaveData = { fragments: 0, upgrades: { hp: 0, damage: 0, xp: 0, luck: 0 }, unlocked: ["wanderer"], selected: "wanderer" };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults;
      const p = JSON.parse(raw) as Partial<SaveData>;
      return { fragments: Math.max(0, Number(p.fragments) || 0), upgrades: { ...defaults.upgrades, ...(p.upgrades || {}) }, unlocked: Array.from(new Set((p.unlocked || ["wanderer"]).filter(id => id in CHARACTERS))) as CharacterId[], selected: p.selected && p.selected in CHARACTERS ? p.selected : "wanderer" };
    } catch { return defaults; }
  }

  private persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.save)); }

  getFragments(): number { return this.save.fragments; }
  getSelected(): CharacterId { return this.save.selected; }
  getUnlocked(): CharacterId[] { return [...this.save.unlocked]; }

  getStartingStats(charId?: CharacterId): RunStats {
    const id = charId || this.save.selected;
    const stats: RunStats = {
      hp: UPGRADE_DATA.hp.values[this.save.upgrades.hp],
      damage: UPGRADE_DATA.damage.values[this.save.upgrades.damage],
      xpGain: UPGRADE_DATA.xp.values[this.save.upgrades.xp],
      luck: UPGRADE_DATA.luck.values[this.save.upgrades.luck],
      projectiles: 1, speed: 1,
    };
    CHARACTERS[id].apply(stats);
    return stats;
  }

  earnFragments(seconds: number, bosses: number): number {
    const earned = Math.floor(seconds / 60) + bosses * 10;
    this.save.fragments += earned;
    this.persist();
    return earned;
  }

  buyUpgrade(key: UpgradeKey): boolean {
    const level = this.save.upgrades[key];
    const data = UPGRADE_DATA[key];
    if (level >= data.values.length - 1) return false;
    const cost = data.costs[level];
    if (this.save.fragments < cost) return false;
    this.save.fragments -= cost;
    this.save.upgrades[key]++;
    this.persist();
    return true;
  }

  unlockCharacter(id: CharacterId): boolean {
    if (this.save.unlocked.includes(id)) return true;
    const c = CHARACTERS[id];
    if (this.save.fragments < c.cost) return false;
    this.save.fragments -= c.cost;
    this.save.unlocked.push(id);
    this.persist();
    return true;
  }

  selectCharacter(id: CharacterId): void {
    if (!this.save.unlocked.includes(id)) return;
    this.save.selected = id;
    this.persist();
  }

  getUpgradeInfo(): { key: UpgradeKey; name: string; current: number; max: number; cost: number; maxed: boolean; canAfford: boolean }[] {
    return (Object.keys(UPGRADE_DATA) as UpgradeKey[]).map(key => {
      const data = UPGRADE_DATA[key];
      const level = this.save.upgrades[key];
      return { key, name: data.name, current: data.values[level], max: data.values.length, cost: level < data.values.length - 1 ? data.costs[level] : 0, maxed: level >= data.values.length - 1, canAfford: level < data.values.length - 1 && this.save.fragments >= data.costs[level] };
    });
  }
}
