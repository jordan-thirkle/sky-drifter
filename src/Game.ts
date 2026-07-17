import * as THREE from 'three';

// === ABILITIES ===
interface Ability { id: string; name: string; icon: string; maxLevel: number; desc: string; effect: (lvl: number, g: Game) => void; }
const ABILITIES: Ability[] = [
  { id: 'orbital', name: 'Orbital', icon: '🔄', maxLevel: 5, desc: 'Spinning projectiles', effect: (l,g) => { g.orbitalCount = 2+l; g.orbitalDmg = 5+l*3; }},
  { id: 'chain', name: 'Chain', icon: '⚡', maxLevel: 5, desc: 'Lightning chains', effect: (l,g) => { g.chainCount = 1+l; g.chainDmg = 8+l*4; }},
  { id: 'frost', name: 'Frost', icon: '❄️', maxLevel: 5, desc: 'Slows enemies', effect: (l,g) => { g.frostRadius = 3+l*2; }},
  { id: 'multi', name: 'Multi', icon: '🔥', maxLevel: 5, desc: 'More projectiles', effect: (l,g) => { g.projCount = 1+l; }},
  { id: 'pierce', name: 'Pierce', icon: '🗡️', maxLevel: 3, desc: 'Pass through', effect: (l,g) => { g.pierce = l; }},
  { id: 'speed', name: 'Swift', icon: '👟', maxLevel: 5, desc: 'Move faster', effect: (l,g) => { g.speed = 8+l*2; }},
  { id: 'power', name: 'Power', icon: '💪', maxLevel: 5, desc: 'More damage', effect: (l,g) => { g.dmg = 10+l*5; }},
  { id: 'magnet', name: 'Magnet', icon: '🧲', maxLevel: 3, desc: 'Attract XP', effect: (l,g) => { g.magnet = 3+l*3; }},
  { id: 'regen', name: 'Regen', icon: '💚', maxLevel: 3, desc: 'Heal over time', effect: (l,g) => { g.regen = 0.5+l*0.5; }},
  { id: 'crit', name: 'Crit', icon: '🎯', maxLevel: 5, desc: '2x damage chance', effect: (l,g) => { g.crit = 0.05+l*0.05; }},
];

// === ENEMIES ===
const E_TYPES = [
  { id:'basic', color:0xef4444, hp:20, spd:3, dmg:10, sz:0.5, xp:5, w:50 },
  { id:'fast', color:0xfbbf24, hp:10, spd:6, dmg:5, sz:0.35, xp:4, w:25 },
  { id:'tank', color:0xa855f7, hp:60, spd:1.5, dmg:20, sz:0.8, xp:10, w:15 },
  { id:'swarm', color:0x22c55e, hp:8, spd:4, dmg:3, sz:0.25, xp:2, w:40 },
  { id:'elite', color:0xf97316, hp:100, spd:2, dmg:30, sz:1, xp:25, w:5 },
];

// === PARTICLE SYSTEM ===
class Particles {
  private scene: THREE.Scene;
  private pool: THREE.Mesh[] = [];
  private active: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; maxLife: number }[] = [];

  constructor(scene: THREE.Scene) { this.scene = scene; }

  emit(pos: THREE.Vector3, color: number, count: number, speed: number = 5): void {
    for (let i = 0; i < count; i++) {
      let mesh = this.pool.pop();
      if (!mesh) {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 4, 4), new THREE.MeshBasicMaterial({ color }));
        this.scene.add(mesh);
      }
      (mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
      mesh.position.copy(pos);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * speed,
        Math.random() * speed * 0.7,
        (Math.random() - 0.5) * speed
      );
      this.active.push({ mesh, vel, life: 0.6 + Math.random() * 0.4, maxLife: 1 });
    }
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      p.vel.y -= 12 * dt;
      p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
      const t = p.life / p.maxLife;
      p.mesh.scale.setScalar(t);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = t;
      (p.mesh.material as THREE.MeshBasicMaterial).transparent = true;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.pool.push(p.mesh);
        this.active.splice(i, 1);
      }
    }
  }
}

// === DAILY CHALLENGE ===
function getDailySeed(): number { const d = new Date(); return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate(); }
function seededRandom(seed: number): () => number { let s = seed; return () => { s = (s*16807)%2147483647; return (s-1)/2147483646; }; }

// === META ===
interface Meta { coins: number; best: number; bestWave: number; kills: number; games: number; chars: string[]; }
function loadMeta(): Meta { try { const r = localStorage.getItem('sd_meta'); if(r) return JSON.parse(r); } catch {} return { coins:0,best:0,bestWave:0,kills:0,games:0,chars:['drifter'] }; }
function saveMeta(m: Meta) { localStorage.setItem('sd_meta', JSON.stringify(m)); }

const CHARS = [
  { id:'drifter', name:'Drifter', color:0x3b82f6, hp:100, spd:8, dmg:10, rate:0.5, cost:0 },
  { id:'berserker', name:'Berserker', color:0xef4444, hp:80, spd:10, dmg:20, rate:0.3, cost:500 },
  { id:'titan', name:'Titan', color:0x6b7280, hp:200, spd:5, dmg:8, rate:0.8, cost:750 },
  { id:'shadow', name:'Shadow', color:0x8b5cf6, hp:60, spd:12, dmg:30, rate:0.2, cost:1000 },
];

export class Game {
  private r: THREE.WebGLRenderer;
  private s: THREE.Scene;
  private c: THREE.PerspectiveCamera;
  private clk: THREE.Clock;
  private particles: Particles;

  // State
  private running = false;
  private over = false;
  private leveling = false;
  private score = 0;
  private wave = 1;
  private level = 1;
  private xp = 0;
  private xpNext = 10;
  private hp = 100;
  private maxHp = 100;
  private time = 0;
  private kills = 0;
  private daily = false;
  private rng: () => number = Math.random;
  private combo = 0;
  private comboTimer = 0;
  private slowMo = 0;
  private shakeAmount = 0;

  // Player
  private player!: THREE.Group;
  speed = 8;
  private fireRate = 0.5;
  private fireT = 0;
  dmg = 10;
  private range = 15;
  projCount = 1;
  pierce = 0;
  crit = 0;
  regen = 0;
  magnet = 3;
  private charIdx = 0;

  // Abilities
  orbitalCount = 0;
  orbitalDmg = 5;
  private orbitalAngle = 0;
  chainCount = 0;
  chainDmg = 8;
  frostRadius = 0;
  private abilityLvls: {[k:string]:number} = {};

  // Entities
  private enemies: THREE.Mesh[] = [];
  private projs: THREE.Mesh[] = [];
  private orbitals: THREE.Mesh[] = [];
  private xpOrbs: THREE.Mesh[] = [];
  private ground!: THREE.Mesh;

  // Spawn
  private spawnRate = 1.5;
  private spawnT = 0;
  private waveEnemies = 0;
  private waveSpawned = 0;

  // Input
  private keys: {[k:string]:boolean} = {};
  private touchActive = false;
  private touchDelta = {x:0,y:0};
  private touchStart = {x:0,y:0};
  private joyEl!: HTMLElement;
  private joyKnob!: HTMLElement;

  // Meta
  private meta: Meta;
  private ch = CHARS[0];

  // UI
  private scoreEl!: HTMLElement;
  private waveEl!: HTMLElement;
  private hpFill!: HTMLElement;
  private xpFill!: HTMLElement;
  private comboEl!: HTMLElement;
  private menuEl!: HTMLElement;
  private overEl!: HTMLElement;
  private upgradeEl!: HTMLElement;
  private dmgContainer!: HTMLElement;
  private storeEl!: HTMLElement;
  private storeContent!: HTMLElement;

  constructor(canvas: HTMLCanvasElement) {
    this.meta = loadMeta();

    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.r.setSize(window.innerWidth, window.innerHeight);
    this.r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.r.toneMapping = THREE.ACESFilmicToneMapping;
    this.r.toneMappingExposure = 1.1;

    this.s = new THREE.Scene();
    this.s.background = new THREE.Color(0x06060f);
    this.s.fog = new THREE.FogExp2(0x06060f, 0.014);

    this.c = new THREE.PerspectiveCamera(55, window.innerWidth/window.innerHeight, 0.1, 500);
    this.c.position.set(0, 22, 16);

    this.clk = new THREE.Clock();
    this.particles = new Particles(this.s);

    // Lights
    this.s.add(new THREE.AmbientLight(0x404060, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(10, 20, 10);
    this.s.add(sun);
    const glow = new THREE.PointLight(0x3b82f6, 0.6, 40);
    glow.position.set(0, 10, 0);
    this.s.add(glow);

    // Ground
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200, 40, 40),
      new THREE.MeshStandardMaterial({ color: 0x0c0c1a, roughness: 0.95 })
    );
    this.ground.rotation.x = -Math.PI/2;
    this.ground.position.y = -0.1;
    this.s.add(this.ground);

    // Player
    this.player = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.5, 1, 8, 16),
      new THREE.MeshStandardMaterial({ color: this.ch.color, emissive: this.ch.color, emissiveIntensity: 0.4 })
    );
    body.position.y = 1;
    this.player.add(body);
    const gun = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6),
      new THREE.MeshBasicMaterial({ color: 0x60a5fa })
    );
    gun.position.set(0.7, 1, 0);
    gun.rotation.z = Math.PI/2;
    this.player.add(gun);
    this.s.add(this.player);

    // UI cache
    this.scoreEl = document.getElementById('score')!;
    this.waveEl = document.getElementById('wave-num')!;
    this.hpFill = document.getElementById('health-fill')!;
    this.xpFill = document.getElementById('xp-fill')!;
    this.comboEl = document.getElementById('combo')!;
    this.menuEl = document.getElementById('menu')!;
    this.overEl = document.getElementById('gameover')!;
    this.upgradeEl = document.getElementById('upgrade-panel')!;
    this.dmgContainer = document.getElementById('damage-numbers')!;
    this.storeEl = document.getElementById('store')!;
    this.storeContent = document.getElementById('store-content')!;

    this.setupInput();
    this.animate();
  }

  private setupInput(): void {
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if(e.code==='Space'||e.code==='Enter') {
        if(!this.running && !this.over) this.startGame(false);
        else if(this.over) { this.storeEl.style.display='none'; this.restart(); }
      }
    });
    window.addEventListener('keyup', e => this.keys[e.code]=false);

    // Touch
    this.joyEl = document.getElementById('joystick')!;
    this.joyKnob = document.getElementById('joystick-knob')!;
    const zone = document.getElementById('touch-zone')!;
    zone.addEventListener('touchstart', e => {
      e.preventDefault();
      this.touchActive = true;
      this.touchStart.x = e.touches[0].clientX;
      this.touchStart.y = e.touches[0].clientY;
      this.joyEl.style.display = 'block';
      this.joyEl.style.left = `${e.touches[0].clientX-50}px`;
      this.joyEl.style.top = `${e.touches[0].clientY-50}px`;
    }, {passive:false});
    zone.addEventListener('touchmove', e => {
      e.preventDefault();
      if(!this.touchActive) return;
      let dx = e.touches[0].clientX - this.touchStart.x;
      let dy = e.touches[0].clientY - this.touchStart.y;
      const max = 40;
      const d = Math.sqrt(dx*dx+dy*dy);
      if(d>max) { dx=(dx/d)*max; dy=(dy/d)*max; }
      this.touchDelta.x = dx/max;
      this.touchDelta.y = dy/max;
      this.joyKnob.style.transform = `translate(calc(-50%+${dx}px),calc(-50%+${dy}px))`;
    }, {passive:false});
    const endTouch = () => { this.touchActive=false; this.touchDelta.x=0; this.touchDelta.y=0; this.joyEl.style.display='none'; this.joyKnob.style.transform='translate(-50%,-50%)'; };
    zone.addEventListener('touchend', endTouch);
    zone.addEventListener('touchcancel', endTouch);

    // Buttons
    document.getElementById('btn-start')!.addEventListener('click', () => this.startGame(false));
    document.getElementById('btn-daily')!.addEventListener('click', () => { this.reset(); this.startGame(true); });
    document.getElementById('btn-store')!.addEventListener('click', () => this.showStore());
    document.getElementById('btn-restart')!.addEventListener('click', () => { this.storeEl.style.display='none'; this.restart(); });
    document.getElementById('store-close')!.addEventListener('click', () => this.storeEl.style.display='none');

    window.addEventListener('resize', () => {
      this.c.aspect = window.innerWidth/window.innerHeight;
      this.c.updateProjectionMatrix();
      this.r.setSize(window.innerWidth, window.innerHeight);
    });
  }

  private startGame(daily: boolean): void {
    this.reset();
    this.running = true;
    this.over = false;
    this.leveling = false;
    this.daily = daily;
    this.rng = daily ? seededRandom(getDailySeed()) : Math.random;
    this.menuEl.style.display = 'none';
    this.overEl.style.display = 'none';
    this.upgradeEl.style.display = 'none';
    document.getElementById('touch-zone')!.style.display = 'block';
  }

  private restart(): void { this.startGame(this.daily); }

  private reset(): void {
    this.enemies.forEach(e=>this.s.remove(e)); this.enemies=[];
    this.projs.forEach(p=>this.s.remove(p)); this.projs=[];
    this.orbitals.forEach(o=>this.s.remove(o)); this.orbitals=[];
    this.xpOrbs.forEach(x=>this.s.remove(x)); this.xpOrbs=[];
    this.score=0; this.wave=1; this.level=1; this.xp=0; this.xpNext=10;
    this.hp=this.ch.hp; this.maxHp=this.ch.hp; this.time=0; this.kills=0;
    this.combo=0; this.comboTimer=0; this.slowMo=0; this.shakeAmount=0;
    this.speed=this.ch.spd; this.dmg=this.ch.dmg; this.fireRate=this.ch.rate;
    this.fireT=0; this.range=15; this.projCount=1; this.pierce=0; this.crit=0;
    this.regen=0; this.magnet=3; this.orbitalCount=0; this.chainCount=0; this.frostRadius=0;
    this.abilityLvls={}; this.waveEnemies=8; this.waveSpawned=0; this.spawnRate=1.5; this.spawnT=0;
    this.player.position.set(0,0,0);
  }

  // === JUICE ===
  private shake(amount: number): void { this.shakeAmount = Math.max(this.shakeAmount, amount); }

  private flash(color: number, duration: number): void {
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(200,200), new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.3}));
    flash.position.set(this.player.position.x, 0.5, this.player.position.z);
    flash.rotation.x = -Math.PI/2;
    this.s.add(flash);
    const start = Date.now();
    const anim = () => {
      const t = (Date.now()-start)/(duration*1000);
      if(t>=1) { this.s.remove(flash); return; }
      (flash.material as THREE.MeshBasicMaterial).opacity = 0.3*(1-t);
      requestAnimationFrame(anim);
    };
    anim();
  }

  private showCombo(text: string, color: number, size: number = 1): void {
    this.comboEl.textContent = text;
    this.comboEl.style.color = `#${color.toString(16).padStart(6,'0')}`;
    this.comboEl.style.opacity = '1';
    this.comboEl.style.transform = `translate(-50%,-50%) scale(${size})`;
    setTimeout(() => this.comboEl.style.opacity='0', 1200);
  }

  private showDmg(pos: THREE.Vector3, dmg: number, crit: boolean): void {
    const el = document.createElement('div');
    el.className = 'dmg';
    el.textContent = (crit?'💥':'')+Math.floor(dmg);
    el.style.color = crit ? '#ffd700' : '#ef4444';
    el.style.fontSize = crit ? '18px' : '14px';
    this.dmgContainer.appendChild(el);
    const v = pos.clone().project(this.c);
    el.style.left = `${(v.x+1)/2*window.innerWidth}px`;
    el.style.top = `${(-v.y+1)/2*window.innerHeight}px`;
    setTimeout(() => el.remove(), 600);
  }

  // === SPAWNING ===
  private spawnEnemy(): void {
    const angle = this.rng()*Math.PI*2;
    const dist = 22+this.rng()*15;
    let totalW = E_TYPES.reduce((s,e)=>s+e.w,0);
    let roll = this.rng()*totalW;
    let t = E_TYPES[0];
    for(const et of E_TYPES) { roll-=et.w; if(roll<=0){t=et;break;} }
    const hpM = 1+(this.wave-1)*0.15;
    const spdM = 1+(this.wave-1)*0.05;
    const e = new THREE.Mesh(
      new THREE.SphereGeometry(t.sz,8,8),
      new THREE.MeshStandardMaterial({color:t.color, emissive:t.color, emissiveIntensity:0.5})
    );
    e.position.set(Math.cos(angle)*dist, t.sz, Math.sin(angle)*dist);
    (e as any).hp = t.hp*hpM; (e as any).maxHp = t.hp*hpM;
    (e as any).spd = t.spd*spdM; (e as any).dmg = t.dmg;
    (e as any).xp = t.xp; (e as any).type = t.id;
    (e as any).frozen = 0; (e as any).dead = false;
    this.s.add(e); this.enemies.push(e);
  }

  private spawnXp(pos: THREE.Vector3, val: number): void {
    const o = new THREE.Mesh(new THREE.OctahedronGeometry(0.15,0), new THREE.MeshBasicMaterial({color:0x60a5fa, transparent:true, opacity:0.9}));
    o.position.copy(pos); o.position.y=0.3;
    (o as any).val = val;
    this.s.add(o); this.xpOrbs.push(o);
  }

  // === COMBAT ===
  private fire(): void {
    let targets = this.enemies.filter(e=>this.player.position.distanceTo(e.position)<this.range)
      .sort((a,b)=>this.player.position.distanceTo(a.position)-this.player.position.distanceTo(b.position));
    if(!targets.length) return;
    for(let i=0;i<this.projCount;i++) {
      const t = targets[i%targets.length];
      const dir = new THREE.Vector3().subVectors(t.position, this.player.position).normalize();
      if(this.projCount>1) { const s=(i-(this.projCount-1)/2)*0.12; dir.x+=Math.cos(s); dir.z+=Math.sin(s); dir.normalize(); }
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.1,4,4), new THREE.MeshBasicMaterial({color:0xfbbf24}));
      p.position.copy(this.player.position); p.position.y=1;
      (p as any).vel=dir.multiplyScalar(28); (p as any).dmg=this.dmg;
      (p as any).pierce=this.pierce; (p as any).life=2; (p as any).hits=new Set();
      this.s.add(p); this.projs.push(p);
    }
  }

  private dmgEnemy(e: THREE.Mesh, d: number): void {
    if((e as any).dead) return;
    const isCrit = Math.random()<this.crit;
    const final = isCrit ? d*2 : d;
    (e as any).hp -= final;
    const mat = e.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 1;
    setTimeout(()=>mat.emissiveIntensity=0.5, 40);
    this.showDmg(e.position, final, isCrit);
    this.shake(isCrit ? 0.3 : 0.15);
    if((e as any).hp<=0) this.killEnemy(e);
  }

  private killEnemy(e: THREE.Mesh): void {
    (e as any).dead = true;
    this.kills++;
    this.combo++;
    this.comboTimer = 2;
    this.score += (e as any).xp * 2;

    // Juice: particles
    const color = (e.material as THREE.MeshStandardMaterial).color.getHex();
    this.particles.emit(e.position.clone(), color, 8 + this.combo * 2, 4 + this.combo * 0.5);

    // Juice: screen shake scales with combo
    this.shake(0.1 + this.combo * 0.05);

    // Juice: slow-mo on 10+ combo
    if(this.combo >= 10) this.slowMo = 0.3;

    // Juice: flash on 25+ combo
    if(this.combo === 25) this.flash(0xffd700, 0.3);
    if(this.combo === 50) this.flash(0x3b82f6, 0.5);

    // Combo display
    if(this.combo >= 5) {
      const size = 1 + Math.min(this.combo * 0.02, 0.5);
      this.showCombo(`${this.combo}x COMBO`, this.combo >= 25 ? 0xffd700 : this.combo >= 10 ? 0xf97316 : 0xef4444, size);
    }

    // XP orb
    this.spawnXp(e.position.clone(), (e as any).xp);

    // Chain lightning
    if(this.chainCount>0) {
      let last = e.position.clone();
      let hit = new Set<THREE.Mesh>();
      hit.add(e);
      for(let c=0;c<this.chainCount;c++) {
        let near: THREE.Mesh|null=null, nearD=8;
        for(const en of this.enemies) {
          if(hit.has(en)||(en as any).dead) continue;
          const d = last.distanceTo(en.position);
          if(d<nearD){nearD=d;near=en;}
        }
        if(!near) break;
        hit.add(near);
        this.dmgEnemy(near, this.chainDmg);
        // Chain visual
        this.particles.emit(near.position.clone(), 0x60a5fa, 3, 2);
        last = near.position.clone();
      }
    }

    this.s.remove(e);
    this.enemies = this.enemies.filter(x=>x!==e);
  }

  private spawnBoss(): void {
    const e = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2, 1),
      new THREE.MeshStandardMaterial({color:0xff0000, emissive:0xff0000, emissiveIntensity:0.7})
    );
    e.position.set(0, 2, -25);
    (e as any).hp = 500*(1+(this.wave-1)*0.1);
    (e as any).maxHp = 500*(1+(this.wave-1)*0.1);
    (e as any).spd = 2; (e as any).dmg = 40;
    (e as any).xp = 100; (e as any).type = 'boss';
    (e as any).frozen = 0; (e as any).dead = false;
    this.s.add(e); this.enemies.push(e);
    this.showCombo('BOSS', 0xff0000, 1.5);
    this.flash(0xff0000, 0.4);
  }

  private takeDamage(d: number): void {
    this.hp -= d;
    this.shake(0.2);
    this.flash(0xef4444, 0.15);
    if(this.hp<=0) { this.hp=0; this.gameOver(); }
  }

  // === LEVEL UP ===
  private levelUp(): void {
    this.level++;
    this.xp -= this.xpNext;
    this.xpNext = Math.floor(this.xpNext*1.4);
    this.running = false;
    this.leveling = true;
    this.flash(0x3b82f6, 0.4);
    this.showCombo(`LEVEL ${this.level}`, 0x3b82f6, 1.2);
    this.showUpgrades();
  }

  private showUpgrades(): void {
    this.upgradeEl.style.display = 'flex';
    this.upgradeEl.innerHTML = '<h2>CHOOSE UPGRADE</h2>';
    const avail = ABILITIES.filter(a=>(this.abilityLvls[a.id]||0)<a.maxLevel);
    const picks = [...avail].sort(()=>Math.random()-0.5).slice(0,3);
    for(const a of picks) {
      const lvl = (this.abilityLvls[a.id]||0);
      const btn = document.createElement('button');
      btn.className = 'upgrade-btn';
      btn.innerHTML = `<div class="upgrade-icon">${a.icon}</div><div class="upgrade-name">${a.name}</div><div class="upgrade-desc">${a.desc}</div><div class="upgrade-level">Lv${lvl} → ${lvl+1}</div>`;
      btn.onclick = () => {
        this.abilityLvls[a.id] = lvl+1;
        a.effect(lvl+1, this);
        this.upgradeEl.style.display='none';
        this.running=true; this.leveling=false;
        this.updateAbilities();
      };
      this.upgradeEl.appendChild(btn);
    }
  }

  private updateAbilities(): void {
    const c = document.getElementById('abilities')!;
    c.innerHTML = '';
    for(const [id,lvl] of Object.entries(this.abilityLvls)) {
      const a = ABILITIES.find(x=>x.id===id);
      if(!a||lvl<=0) continue;
      const d = document.createElement('div');
      d.className='ability';
      d.innerHTML=`${a.icon}<div class="ability-level">${lvl}</div>`;
      c.appendChild(d);
    }
  }

  // === STORE ===
  private showStore(): void {
    this.storeEl.style.display='flex';
    this.storeContent.innerHTML='';
    this.storeContent.innerHTML+=`<div class="store-coins">💰 ${this.meta.coins}</div>`;
    for(const ch of CHARS) {
      const owned = this.meta.chars.includes(ch.id);
      const btn = document.createElement('button');
      btn.className = `store-item ${owned?'owned':''}`;
      btn.innerHTML=`<div class="store-color" style="background:#${ch.color.toString(16).padStart(6,'0')}"></div><div class="store-name">${ch.name}</div><div class="store-stat">❤️${ch.hp} ⚡${ch.spd} 💪${ch.dmg}</div><div class="store-price">${owned?'✓':'💰'+ch.cost}</div>`;
      btn.onclick = () => {
        if(!owned && this.meta.coins>=ch.cost) {
          this.meta.coins-=ch.cost; this.meta.chars.push(ch.id); saveMeta(this.meta); this.showStore();
        } else if(owned) { this.ch=ch; this.charIdx=CHARS.indexOf(ch); this.storeEl.style.display='none'; }
      };
      this.storeContent.appendChild(btn);
    }
  }

  // === GAME OVER ===
  private gameOver(): void {
    this.running=false; this.over=true;
    document.getElementById('touch-zone')!.style.display='none';
    this.overEl.style.display='flex';
    document.getElementById('final-score')!.textContent=this.score.toString();
    document.getElementById('final-wave')!.textContent=this.wave.toString();
    document.getElementById('final-kills')!.textContent=this.kills.toString();
    document.getElementById('final-coins')!.textContent=Math.floor(this.score/10).toString();
    this.meta.games++; this.meta.kills+=this.kills;
    this.meta.coins+=Math.floor(this.score/10);
    if(this.score>this.meta.best) this.meta.best=this.score;
    if(this.wave>this.meta.bestWave) this.meta.bestWave=this.wave;
    saveMeta(this.meta);
  }

  // === MAIN LOOP ===
  private animate = (): void => {
    requestAnimationFrame(this.animate);
    const rawDt = Math.min(this.clk.getDelta(), 0.1);
    const dt = this.slowMo > 0 ? rawDt * 0.3 : rawDt;
    if(this.slowMo > 0) this.slowMo -= rawDt;

    // Camera shake
    if(this.shakeAmount > 0) {
      this.c.position.x = this.player.position.x + (Math.random()-0.5)*this.shakeAmount;
      this.c.position.z = this.player.position.z + 16 + (Math.random()-0.5)*this.shakeAmount*0.5;
      this.shakeAmount *= 0.85;
      if(this.shakeAmount < 0.01) this.shakeAmount = 0;
    } else {
      this.c.position.x = THREE.MathUtils.lerp(this.c.position.x, this.player.position.x, 0.08);
      this.c.position.z = THREE.MathUtils.lerp(this.c.position.z, this.player.position.z+16, 0.08);
    }
    this.c.lookAt(this.player.position);

    // Particles always update
    this.particles.update(rawDt);

    this.r.render(this.s, this.c);
    if(!this.running||this.leveling) return;

    this.time += dt;

    // Regen
    if(this.regen>0) this.hp=Math.min(this.maxHp, this.hp+this.regen*dt);

    // Movement
    const move = new THREE.Vector3();
    if(this.keys['KeyW']||this.keys['ArrowUp']) move.z-=1;
    if(this.keys['KeyS']||this.keys['ArrowDown']) move.z+=1;
    if(this.keys['KeyA']||this.keys['ArrowLeft']) move.x-=1;
    if(this.keys['KeyD']||this.keys['ArrowRight']) move.x+=1;
    if(this.touchActive) { move.x=this.touchDelta.x; move.z=this.touchDelta.y; }
    if(move.length()>0) {
      move.normalize();
      this.player.position.add(move.multiplyScalar(this.speed*dt));
      this.player.rotation.y = THREE.MathUtils.lerp(this.player.rotation.y, Math.atan2(move.x,move.z), 0.15);
    }

    // Fire
    this.fireT+=dt;
    if(this.fireT>=this.fireRate) { this.fireT=0; this.fire(); }

    // Orbitals
    this.orbitalAngle+=dt*3;
    while(this.orbitals.length>this.orbitalCount) { const o=this.orbitals.pop()!; this.s.remove(o); }
    while(this.orbitals.length<this.orbitalCount) {
      const o=new THREE.Mesh(new THREE.SphereGeometry(0.15,6,6), new THREE.MeshBasicMaterial({color:0x06b6d4}));
      this.s.add(o); this.orbitals.push(o);
    }
    for(let i=0;i<this.orbitals.length;i++) {
      const a=this.orbitalAngle+(i/this.orbitals.length)*Math.PI*2;
      this.orbitals[i].position.set(this.player.position.x+Math.cos(a)*2.5, 1, this.player.position.z+Math.sin(a)*2.5);
      for(const e of this.enemies) {
        if(this.orbitals[i].position.distanceTo(e.position)<0.8) this.dmgEnemy(e, this.orbitalDmg);
      }
    }

    // Waves
    if(this.waveSpawned>=this.waveEnemies&&this.enemies.length===0) {
      this.wave++;
      this.waveEnemies=Math.min(8+this.wave*3,50);
      this.waveSpawned=0;
      this.spawnRate=Math.max(0.3,1.5-this.wave*0.05);
      this.spawnT=0;
      this.showCombo(`WAVE ${this.wave}`, 0xf97316, 1.1);
      this.flash(0xf97316, 0.2);
      if(this.wave%5===0) this.spawnBoss();
    }

    // Spawn
    this.spawnT+=dt;
    if(this.spawnT>=this.spawnRate&&this.waveSpawned<this.waveEnemies) {
      this.spawnT=0;
      const batch=Math.min(3+Math.floor(this.wave/3),8);
      for(let i=0;i<batch&&this.waveSpawned<this.waveEnemies;i++) { this.spawnEnemy(); this.waveSpawned++; }
    }

    // Enemies
    for(const e of this.enemies) {
      const dir=new THREE.Vector3().subVectors(this.player.position, e.position).normalize();
      const spd=(e as any).frozen>0?(e as any).spd*0.3:(e as any).spd;
      e.position.add(dir.multiplyScalar(spd*dt));
      e.rotation.y+=dt*2;
      if(this.frostRadius>0&&this.player.position.distanceTo(e.position)<this.frostRadius)(e as any).frozen=0.5;
      if((e as any).frozen>0)(e as any).frozen-=dt;
      if(this.player.position.distanceTo(e.position)<1.2) this.takeDamage((e as any).dmg*dt);
    }

    // Projectiles
    for(let i=this.projs.length-1;i>=0;i--) {
      const p=this.projs[i];
      p.position.add((p as any).vel.clone().multiplyScalar(dt));
      (p as any).life-=dt;
      if((p as any).life<=0){this.s.remove(p);this.projs.splice(i,1);continue;}
      for(const e of this.enemies) {
        if((p as any).hits?.has(e)) continue;
        if(p.position.distanceTo(e.position)<0.7) {
          this.dmgEnemy(e,(p as any).dmg);
          (p as any).hits?.add(e);
          if((p as any).pierce>0)(p as any).pierce--;
          else{this.s.remove(p);this.projs.splice(i,1);break;}
        }
      }
    }

    // XP orbs
    for(let i=this.xpOrbs.length-1;i>=0;i--) {
      const o=this.xpOrbs[i];
      if(this.player.position.distanceTo(o.position)<this.magnet) {
        const dir=new THREE.Vector3().subVectors(this.player.position,o.position).normalize();
        o.position.add(dir.multiplyScalar(15*dt));
      }
      if(this.player.position.distanceTo(o.position)<0.8) {
        this.xp+=(o as any).val; this.score+=(o as any).val;
        if(this.xp>=this.xpNext) this.levelUp();
        this.s.remove(o); this.xpOrbs.splice(i,1);
      }
    }

    // UI
    this.scoreEl.textContent=this.score.toString();
    this.waveEl.textContent=this.wave.toString();
    this.hpFill.style.width=`${(this.hp/this.maxHp)*100}%`;
    this.xpFill.style.width=`${(this.xp/this.xpNext)*100}%`;
  };
}
