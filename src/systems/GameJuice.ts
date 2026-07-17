// Game Juice System for Sky Drifter
// Damage numbers, hit flash, screen shake, wave notifications, boss warnings

import * as THREE from "three";

interface FloatingLabel { el: HTMLDivElement; pos: THREE.Vector3; born: number; life: number; dx: number; scale: number }
interface HitFlash { mesh: THREE.Mesh; original: THREE.Material | THREE.Material[]; flashed: THREE.Material | THREE.Material[]; end: number }
interface Banner { el: HTMLDivElement; born: number; life: number }

export class GameJuice {
  private root: HTMLDivElement;
  private labels: FloatingLabel[] = [];
  private flashes: HitFlash[] = [];
  private cameraBase = new THREE.Vector3();
  private shakeUntil = 0;
  private shakePower = 0;
  private banner?: Banner;
  private warning?: Banner;

  constructor(private renderer: THREE.WebGLRenderer, private camera: THREE.Camera) {
    const host = renderer.domElement.parentElement || document.body;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    this.root = document.createElement("div");
    Object.assign(this.root.style, { position: "absolute", inset: "0", pointerEvents: "none", overflow: "hidden", fontFamily: "system-ui,sans-serif" });
    host.appendChild(this.root);
  }

  damageNumber(amount: number, worldPos: THREE.Vector3, kind: "normal" | "crit" | "player" = "normal") {
    const el = document.createElement("div");
    const color = kind === "crit" ? "#ffd43b" : kind === "player" ? "#ff3d3d" : "#fff";
    const scale = THREE.MathUtils.clamp(0.8 + Math.log10(Math.max(1, amount)) * 0.28, 0.8, 2);
    Object.assign(el.style, { position: "absolute", color, fontWeight: "900", whiteSpace: "nowrap", textShadow: "2px 2px 0 #111, -1px -1px 0 #111", transform: `translate(-50%,-50%) scale(${scale})`, fontSize: "20px", opacity: "1" });
    el.textContent = `${kind === "crit" ? "✦ " : ""}${Math.round(amount)}`;
    this.root.appendChild(el);
    this.labels.push({ el, pos: worldPos.clone(), born: performance.now(), life: 850, dx: (Math.random() - 0.5) * 28, scale });
  }

  hitFlash(object: THREE.Object3D, duration = 100) {
    const now = performance.now();
    const entries: HitFlash[] = [];
    object.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const original = mesh.material;
      const makeFlash = (m: THREE.Material) => {
        if (!(m instanceof THREE.MeshStandardMaterial)) return m;
        const f = m.clone();
        f.color.setRGB(1, 1, 1);
        f.emissive.setRGB(1, 1, 1);
        f.emissiveIntensity = 1.5;
        return f;
      };
      const flashed = Array.isArray(original) ? original.map(makeFlash) : makeFlash(original);
      mesh.material = flashed;
      entries.push({ mesh, original, flashed, end: now + duration });
    });
    this.flashes.push(...entries);
  }

  shake(damage: number) {
    this.cameraBase.copy(this.camera.position);
    this.shakePower = Math.min(0.45, 0.04 + Math.sqrt(Math.max(0, damage)) * 0.018);
    this.shakeUntil = performance.now() + 200;
  }

  waveBanner(waveNumber: number) {
    this.banner?.el.remove();
    const el = document.createElement("div");
    Object.assign(el.style, { position: "absolute", top: "8%", left: "50%", padding: "12px 30px", color: "#ffd43b", background: "rgba(12,10,16,.92)", border: "2px solid #b88620", borderRadius: "6px", fontSize: "26px", fontWeight: "900", whiteSpace: "nowrap", transform: "translate(-50%,-180%)", opacity: "0", textShadow: "0 2px 3px #000", zIndex: "5" });
    el.textContent = `Wave ${waveNumber} — Enemies Stronger!`;
    this.root.appendChild(el);
    this.banner = { el, born: performance.now(), life: 3000 };
  }

  bossWarning() {
    this.warning?.el.remove();
    const el = document.createElement("div");
    Object.assign(el.style, { position: "absolute", inset: "0", display: "grid", placeItems: "center", color: "#ff3030", fontSize: "clamp(24px,5vw,64px)", fontWeight: "1000", letterSpacing: "3px", textAlign: "center", opacity: "0", border: "10px solid rgba(255,0,0,0)", boxSizing: "border-box", textShadow: "0 0 12px #000, 0 0 24px #f00", zIndex: "6" });
    el.textContent = "WARNING: ELITE INCOMING";
    this.root.appendChild(el);
    this.warning = { el, born: performance.now(), life: 3000 };
  }

  update(now = performance.now()) {
    const rect = this.renderer.domElement.getBoundingClientRect();

    // Floating labels
    this.labels = this.labels.filter(x => {
      const t = (now - x.born) / x.life;
      if (t >= 1) { x.el.remove(); return false; }
      const p = x.pos.clone().project(this.camera);
      x.el.style.left = `${(p.x * 0.5 + 0.5) * rect.width + x.dx * t}px`;
      x.el.style.top = `${(-p.y * 0.5 + 0.5) * rect.height - t * 70}px`;
      x.el.style.opacity = `${1 - t}`;
      x.el.style.transform = `translate(-50%,-50%) scale(${x.scale * (1 + t * 0.15)})`;
      return true;
    });

    // Hit flashes
    this.flashes = this.flashes.filter(f => {
      if (now < f.end) return true;
      f.mesh.material = f.original;
      if (Array.isArray(f.flashed)) f.flashed.forEach(m => m.dispose());
      else f.flashed.dispose();
      return false;
    });

    // Screen shake
    if (now < this.shakeUntil) {
      const t = (this.shakeUntil - now) / 200;
      this.camera.position.copy(this.cameraBase);
      this.camera.position.x += (Math.random() - 0.5) * this.shakePower * t;
      this.camera.position.y += (Math.random() - 0.5) * this.shakePower * t;
    } else if (this.shakePower) {
      this.camera.position.lerp(this.cameraBase, 0.35);
      if (this.camera.position.distanceTo(this.cameraBase) < 0.001) this.shakePower = 0;
    }

    // Wave banner
    if (this.banner) {
      const t = (now - this.banner.born) / this.banner.life;
      if (t >= 1) { this.banner.el.remove(); this.banner = undefined; }
      else {
        const slide = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1;
        this.banner.el.style.opacity = `${slide}`;
        this.banner.el.style.transform = `translate(-50%,${-180 + slide * 240}%)`;
      }
    }

    // Boss warning
    if (this.warning) {
      const t = (now - this.warning.born) / this.warning.life;
      if (t >= 1) { this.warning.el.remove(); this.warning = undefined; }
      else {
        const pulse = 0.35 + Math.abs(Math.sin(t * Math.PI * 8)) * 0.65;
        this.warning.el.style.opacity = `${Math.min(1, t * 8, (1 - t) * 8)}`;
        this.warning.el.style.background = `rgba(180,0,0,${pulse * 0.12})`;
        this.warning.el.style.borderColor = `rgba(255,0,0,${pulse})`;
      }
    }
  }
}
