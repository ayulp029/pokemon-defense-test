// 特效：粒子、彈道、飛進計數器的球都用物件池，戰鬥中不新建。
// 這裡的隨機數只影響外觀，不影響戰鬥。
window.PD = window.PD || {};

PD.Fx = class Fx {
  constructor(scene, cfg) {
    this.scene = scene;
    this.cfg = cfg;
    this.quality = 1;
    this.lastShake = -99999;

    this.particles = [];
    this.freeParticles = [];
    for (let i = 0; i < cfg.fx.maxParticles; i++) {
      const img = scene.add.image(0, 0, 'atlas', 'spark')
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(200).setVisible(false);
      this.particles.push({ img, on: false, vx: 0, vy: 0, g: 0, life: 0, max: 1, s0: 1, s1: 1, a0: 1, spin: 0, idx: i });
      this.freeParticles.push(i);
    }

    this.shots = [];
    for (let i = 0; i < 40; i++) {
      this.shots.push({
        on: false,
        img: scene.add.image(0, 0, 'atlas', 'bolt').setBlendMode(Phaser.BlendModes.ADD).setDepth(201).setVisible(false),
        glow: scene.add.image(0, 0, 'atlas', 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(200).setVisible(false),
        fx: '', t: 0, dur: 1, x0: 0, y0: 0, x1: 0, y1: 0, view: null, viewId: 0, landed: false,
      });
    }

    this.flyers = [];
    for (let i = 0; i < 30; i++) {
      this.flyers.push({
        on: false,
        img: scene.add.image(0, 0, 'atlas', 'orb').setDepth(320).setVisible(false),
        t: 0, x0: 0, y0: 0, x1: 0, y1: 0,
      });
    }
  }

  get reduced() { return PD.settings.reduceFx; }

  // 依品質換算粒子數（畫面吃力或減少特效時變少）
  amount(n) {
    const q = this.reduced ? Math.min(this.quality, 0.35) : this.quality;
    return Math.max(1, Math.round(n * q));
  }

  emit(frame, x, y, color, opt) {
    const i = this.freeParticles.pop();
    if (i === undefined) return;
    const p = this.particles[i];
    p.on = true;
    p.vx = opt.vx; p.vy = opt.vy; p.g = opt.g || 0;
    p.life = 0; p.max = opt.life;
    p.s0 = opt.s0; p.s1 = opt.s1;
    p.a0 = opt.a === undefined ? 1 : opt.a;
    p.spin = opt.spin || 0;
    p.img.setFrame(frame).setPosition(x, y).setTint(color).setAlpha(p.a0)
      .setScale(p.s0 * PD.TEX_SCALE).setRotation(0).setVisible(true);
  }

  burst(frame, x, y, color, count, speed, life, s0, s1, g) {
    const n = this.amount(count);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.8);
      this.emit(frame, x, y, color, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: g || 0,
        life: life * (0.6 + Math.random() * 0.6), s0, s1, spin: (Math.random() - 0.5) * 8,
      });
    }
  }

  glowPop(x, y, color, size, life) {
    this.emit('glow', x, y, color, { vx: 0, vy: 0, life, s0: size, s1: size * 1.5, a: 0.8 });
  }

  fire(fx, x0, y0, view) {
    const shot = this.shots.find((s) => !s.on);
    if (!shot) return;
    const x1 = view.c.x;
    const y1 = view.c.y - view.h * 0.5;
    const isVine = fx === 'vine';
    const dur = this.cfg.fx.projectileSeconds * (isVine ? 1.3 : 1);
    Object.assign(shot, { on: true, fx, t: 0, dur, x0, y0, x1, y1, view, viewId: view.id, landed: false });
    const frame = fx === 'lightning' ? 'bolt' : fx === 'vine' ? 'vine'
      : fx === 'water' ? 'dropP' : 'glow';
    const color = PD.Fx.COLORS[fx];
    shot.img.setFrame(frame).setPosition(x0, y0).setTint(color).setVisible(true).setAlpha(1);
    shot.img.setRotation(Math.atan2(y1 - y0, x1 - x0));
    shot.img.setOrigin(isVine ? 0 : 0.5, 0.5);
    shot.img.setScale(fx === 'fire' ? 0.6 * PD.TEX_SCALE : PD.TEX_SCALE);
    if (fx === 'water') shot.img.setRotation(Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2);
    shot.glow.setPosition(x0, y0).setTint(color).setScale((isVine ? 0.02 : 0.9) * PD.TEX_SCALE).setAlpha(0.8).setVisible(!isVine);
  }

  impact(fx, x, y) {
    const color = PD.Fx.COLORS[fx];
    const n = this.cfg.fx.hitParticles;
    this.glowPop(x, y, color, 0.7, 0.18);
    if (fx === 'lightning') this.burst('spark', x, y, 0xfff176, n, 200, 0.28, 0.7, 0.1);
    if (fx === 'fire') this.burst('spark', x, y, 0xff8a3c, n, 150, 0.4, 0.8, 0.1, -60);
    if (fx === 'water') this.burst('dropP', x, y, 0x7fd4ff, n, 170, 0.42, 0.6, 0.2, 380);
    if (fx === 'vine') this.burst('leafP', x, y, 0x7ee081, n, 130, 0.5, 0.7, 0.3, 160);
  }

  starBurst(x, y) {
    const star = this.freeParticles.length ? 1 : 0;
    if (star) {
      this.emit('star', x, y, 0xffe36b, {
        vx: 200, vy: -340, g: 120, life: 0.75, s0: 2.2, s1: 1.1, spin: 9,
      });
    }
    this.emit('ring', x, y, 0xfff4b0, { vx: 0, vy: 0, life: 0.4, s0: 0.3, s1: 1.7, a: 0.85 });
    this.glowPop(x, y, 0xffe36b, 1.1, 0.3);
    this.burst('star', x, y, 0xffe36b, this.cfg.fx.starParticles, 260, 0.55, 0.7, 0.1, 160);
  }

  landPuff(x, y, color) {
    this.glowPop(x, y - 30, color, 1, 0.3);
    this.burst('spark', x, y, color, 10, 120, 0.3, 0.6, 0.1);
  }

  confetti(width) {
    const colors = [0xff7a7a, 0xffd84a, 0x7fd4ff, 0x7ee081, 0xd59bff];
    const n = this.amount(70);
    for (let i = 0; i < n; i++) {
      this.emit('confetti', Math.random() * width, -20 - Math.random() * 200, colors[i % colors.length], {
        vx: (Math.random() - 0.5) * 80, vy: 120 + Math.random() * 140, g: 40,
        life: 3 + Math.random() * 1.5, s0: 1.4, s1: 1.1, spin: (Math.random() - 0.5) * 10,
      });
    }
  }

  flyToCounter(x, y, tx, ty) {
    const f = this.flyers.find((o) => !o.on);
    if (!f) return;
    Object.assign(f, { on: true, t: 0, x0: x, y0: y, x1: tx, y1: ty });
    f.img.setPosition(x, y).setScale(PD.TEX_SCALE).setAlpha(1).setVisible(true);
  }

  shake() {
    if (this.reduced) return;
    const nowMs = this.scene.time.now;
    if (nowMs - this.lastShake < this.cfg.fx.shakeMinGapMs) return;
    this.lastShake = nowMs;
    this.scene.cameras.main.shake(this.cfg.fx.shakeMs, this.cfg.fx.shakeIntensity);
  }

  update(dt) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.on) continue;
      p.life += dt;
      if (p.life >= p.max) {
        p.on = false;
        p.img.setVisible(false);
        this.freeParticles.push(i);
        continue;
      }
      const k = p.life / p.max;
      p.vy += p.g * dt;
      p.img.x += p.vx * dt;
      p.img.y += p.vy * dt;
      p.img.rotation += p.spin * dt;
      p.img.setScale((p.s0 + (p.s1 - p.s0) * k) * PD.TEX_SCALE);
      p.img.alpha = p.a0 * (1 - k * k);
    }

    for (let i = 0; i < this.shots.length; i++) {
      const s = this.shots[i];
      if (s.on) this.updateShot(s, dt);
    }

    for (let i = 0; i < this.flyers.length; i++) {
      const f = this.flyers[i];
      if (!f.on) continue;
      f.t += dt / 0.42;
      if (f.t >= 1) { f.on = false; f.img.setVisible(false); continue; }
      const e = f.t * f.t;
      f.img.x = f.x0 + (f.x1 - f.x0) * e;
      f.img.y = f.y0 + (f.y1 - f.y0) * e - Math.sin(f.t * Math.PI) * 50;
    }
  }

  updateShot(s, dt) {
    s.t += dt;
    const k = Math.min(1, s.t / s.dur);
    const alive = s.view && s.view.id === s.viewId && s.view.active;
    if (alive) { s.x1 = s.view.c.x; s.y1 = s.view.c.y - s.view.h * 0.5; }
    const x = s.x0 + (s.x1 - s.x0) * k;
    const y = s.y0 + (s.y1 - s.y0) * k;
    if (s.fx === 'vine') {
      // 藤鞭圖的邏輯寬度是 100；揮出再收回
      const fullScale = (Math.hypot(s.x1 - s.x0, s.y1 - s.y0) / 100) * PD.TEX_SCALE;
      s.img.scaleX = Math.max(0.01, fullScale * Math.sin(k * Math.PI));
    } else {
      s.img.setPosition(x, y);
      s.glow.setPosition(x, y);
      if (s.fx === 'fire' && Math.random() < this.amount(10) / 10) {
        this.emit('spark', x, y, 0xffa040, {
          vx: (Math.random() - 0.5) * 40, vy: -40 - Math.random() * 40, life: 0.25, s0: 0.7, s1: 0.1,
        });
      }
    }
    if (!s.landed && k >= (s.fx === 'vine' ? 0.5 : 1)) {
      s.landed = true;
      this.impact(s.fx, s.x1, s.y1);
      if (alive) s.view.flash = 0.1;
    }
    if (k >= 1) {
      if (s.fx === 'vine') this.burst('leafP', s.x1, s.y1, 0x7ee081, 4, 90, 0.5, 0.6, 0.2, 200);
      s.on = false;
      s.img.setVisible(false);
      s.glow.setVisible(false);
    }
  }
};

PD.Fx.COLORS = { lightning: 0xfff176, fire: 0xff8a3c, water: 0x6cc7ff, vine: 0x7ee081 };
