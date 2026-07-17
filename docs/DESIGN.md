# Sky Drifter — 3D Survivor-like

> Game 2 in AI Game Studio portfolio. Browser-native 3D survivor-like.
> Target: CrazyGames + Poki launch.

---

## Concept

**Genre:** 3D Survivor-like (Vampire Survivors meets Three.js)
**Platform:** Browser (HTML5/WebGL)
**Target:** 10-30 minute sessions, high replayability

---

## Core Loop

```
Move → Auto-attack → Kill enemies → Collect XP → Level up → Choose upgrade → Repeat
```

### Why It Works
- **Variable ratio reinforcement:** Random enemy spawns, random upgrades
- **Flow state:** Easy to learn, hard to master
- **"One more run":** Progression persists across sessions
- **Browser-native:** Most survivor-likes are Steam ports. We're first to browser.

---

## Mechanics

### Player
- **Movement:** WASD/Arrow keys
- **Auto-fire:** Nearest enemy targeting
- **Health:** Takes damage on contact with enemies
- **Abilities:** Unlock through leveling

### Enemies
- **Types:** Basic (red), Fast (yellow), Tank (purple), Swarm (small, many)
- **Spawns:** Wave-based, increasing difficulty
- **Behavior:** Chase player

### Progression
- **XP:** Dropped by killed enemies
- **Level up:** Every level, choose 1 of 3 upgrades
- **Upgrades:** Damage, speed, fire rate, health, abilities

### Abilities (Unlockable)
1. **Orbital shield** — Spinning projectiles around player
2. **Lightning chain** — Hits multiple enemies
3. **Meteor rain** — Area damage
4. **Frost aura** — Slows nearby enemies
5. **Dash** — Quick movement burst

---

## Visual Style

- **Low-poly 3D** (performant on browser)
- **Dark background** (space/sky theme)
- **Glowing enemies** (easy to see)
- **Particle effects** (kills, level ups)
- **Screen shake** (juice)

---

## Technical Stack

- Three.js (rendering)
- TypeScript (type safety)
- Vite (build)
- Procedural audio (Web Audio API)
- No external assets (all code-generated)

---

## Monetization

- **CrazyGames:** Rewarded ads (revive, bonus XP)
- **Poki:** Ad revenue share
- **Itch.io:** PWYW supporter edition

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Core prototype | 1 week | Playable game loop |
| Juice & polish | 3 days | Screen shake, particles, sound |
| Enemy variety | 2 days | 4+ enemy types |
| Ability system | 3 days | 5+ unlockable abilities |
| UI polish | 2 days | Health, XP, combo display |
| Testing | 2 days | Balance, performance |
| **Total** | **3 weeks** | **Launch-ready** |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Session length | >5 minutes |
| Tutorial completion | >80% |
| Day 1 retention | >30% |
| Day 7 retention | >10% |
| Revenue per 1K plays | >€5 |

---

## Competitive Advantage

1. **Browser-native** — Most survivor-likes are Steam ports
2. **3D** — Unique visual style in browser
3. **AI-generated** — Built by AI agents, not human devs
4. **Free** — No upfront cost
5. **Instant play** — No download required

---

## Research Applied

- ✅ Trending genres (survivor-like = high opportunity)
- ✅ Juice techniques (screen shake, particles, combos)
- ✅ Monetization (CrazyGames + Poki)
- ✅ Leverage (Three.js examples, pmndrs ecosystem)
- ✅ Security (checklist applied)
