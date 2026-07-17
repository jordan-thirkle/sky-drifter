// Level-Up System for Sky Drifter
// Shows 3 random upgrade choices on level up

type AbilityKey = "orbital" | "chain" | "frost" | "multi" | "pierce" | "speed" | "power" | "magnet" | "regen" | "crit";

interface Ability {
  name: string;
  icon: string;
  max: number;
  description: string;
  preview: (next: number) => string;
}

export const ABILITIES: Record<AbilityKey, Ability> = {
  orbital: { name: "Orbital", icon: "🌀", max: 5, description: "Spinning projectiles orbit around you.", preview: n => `+${n} orbital projectile` },
  chain: { name: "Chain", icon: "⚡", max: 5, description: "Lightning jumps between nearby enemies.", preview: n => `+${n} chain damage` },
  frost: { name: "Frost", icon: "❄️", max: 5, description: "Attacks slow enemies they hit.", preview: n => `${n * 8}% enemy slow` },
  multi: { name: "Multi", icon: "🔱", max: 5, description: "Fire additional projectiles per attack.", preview: n => `+${n} projectile` },
  pierce: { name: "Pierce", icon: "🗡️", max: 3, description: "Projectiles pass through more enemies.", preview: n => `+${n} enemy penetration` },
  speed: { name: "Speed", icon: "👟", max: 5, description: "Move faster across the battlefield.", preview: n => `+${n * 10}% move speed` },
  power: { name: "Power", icon: "💥", max: 5, description: "Increase all outgoing damage.", preview: n => `+${n * 15}% damage` },
  magnet: { name: "Magnet", icon: "🧲", max: 5, description: "Attract experience from farther away.", preview: n => `+${n * 20}% pickup range` },
  regen: { name: "Regen", icon: "❤️", max: 5, description: "Regenerate health over time.", preview: n => `+${n} HP per second` },
  crit: { name: "Crit", icon: "🎯", max: 5, description: "Increase the chance to deal double damage.", preview: n => `+${n * 5}% critical chance` },
};

const STYLE = `
#levelup-overlay{position:fixed;inset:0;display:grid;place-items:center;background:#0009;backdrop-filter:blur(7px);z-index:10}
.levelup-panel{width:min(920px,92vw);padding:28px;border:2px solid #d6a83f;border-radius:18px;background:#151923eF;box-shadow:0 0 35px #d6a83f55}
.levelup-panel h1{text-align:center;color:#ffd76a;margin:0 0 22px;font-size:28px}
.levelup-choices{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.levelup-choice{min-height:230px;padding:18px;text-align:left;color:#fff;border:1px solid #6e5b30;border-radius:13px;background:#202532dd;cursor:pointer;transition:.2s;font-family:inherit}
.levelup-choice:hover{border-color:#ffd76a;box-shadow:0 0 22px #e2b84b99;transform:translateY(-4px)}
.levelup-icon{font-size:40px}.levelup-name{display:inline-block;margin:8px 0;color:#ffd76a;font-weight:700;font-size:20px}
.levelup-level{float:right;color:#aeb8ce;font-size:13px}.levelup-desc{color:#c5ccda;min-height:44px}.levelup-preview{margin-top:14px;color:#8ff0ba;font-weight:600}
@media(max-width:700px){.levelup-choices{grid-template-columns:1fr}.levelup-choice{min-height:0}}
`;

let styleInjected = false;

export class LevelUpSystem {
  level = 1;
  xp = 0;
  xpToNext = 10;
  levels: Record<AbilityKey, number> = {
    orbital: 0, chain: 0, frost: 0, multi: 0, pierce: 0, speed: 0,
    power: 0, magnet: 0, regen: 0, crit: 0
  };
  stats = {
    projectiles: 1, chainDamage: 0, slow: 0, moveSpeed: 1,
    damage: 1, pickupRange: 1, hpRegen: 0, critChance: 0, pierce: 0
  };
  private paused = false;
  private onChoice?: (key: AbilityKey) => void;

  constructor(onChoice?: (key: AbilityKey) => void) {
    this.onChoice = onChoice;
    if (!styleInjected) {
      document.head.appendChild(Object.assign(document.createElement("style"), { textContent: STYLE }));
      styleInjected = true;
    }
  }

  isPaused(): boolean { return this.paused; }

  gainXP(amount: number) {
    this.xp += amount;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = Math.floor(this.xpToNext * 1.25);
      this.showChoices();
    }
  }

  showChoices() {
    this.paused = true;
    const available = (Object.keys(ABILITIES) as AbilityKey[])
      .filter(k => this.levels[k] < ABILITIES[k].max)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    const overlay = document.createElement("div");
    overlay.id = "levelup-overlay";
    overlay.innerHTML = `
      <section class="levelup-panel">
        <h1>Level ${this.level} — Choose an Upgrade</h1>
        <div class="levelup-choices">
          ${available.map(key => {
            const a = ABILITIES[key], current = this.levels[key], next = current + 1;
            return `<button class="levelup-choice" data-key="${key}">
              <span class="levelup-icon">${a.icon}</span>
              <span class="levelup-level">Lv. ${current}/${a.max}</span>
              <span class="levelup-name">${a.name}</span>
              <div class="levelup-desc">${a.description}</div>
              <div class="levelup-preview">${a.preview(next)}</div>
            </button>`;
          }).join("")}
        </div>
      </section>`;
    document.body.appendChild(overlay);

    overlay.querySelectorAll<HTMLButtonElement>(".levelup-choice").forEach(button => {
      button.onclick = () => {
        this.apply(button.dataset.key as AbilityKey);
        overlay.remove();
        this.paused = false;
        this.onChoice?.(button.dataset.key as AbilityKey);
      };
    });
  }

  apply(key: AbilityKey) {
    const next = ++this.levels[key];
    switch (key) {
      case "orbital": this.stats.projectiles++; break;
      case "chain": this.stats.chainDamage += next; break;
      case "frost": this.stats.slow = next * 0.08; break;
      case "multi": this.stats.projectiles++; break;
      case "pierce": this.stats.pierce = next; break;
      case "speed": this.stats.moveSpeed = 1 + next * 0.1; break;
      case "power": this.stats.damage = 1 + next * 0.15; break;
      case "magnet": this.stats.pickupRange = 1 + next * 0.2; break;
      case "regen": this.stats.hpRegen = next; break;
      case "crit": this.stats.critChance = next * 0.05; break;
    }
  }
}
