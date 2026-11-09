// 主動技能的畫面演出：全部用程式畫（Graphics、粒子、縮放、位移），不用圖檔。
// 只讀戰鬥狀態，不改任何數值；隨機數只影響外觀。效果物件用完回收，不反覆新建。
window.PD = window.PD || {};

PD.SkillFx = class SkillFx {
  constructor(scene, cfg) {
    this.scene = scene;
    this.cfg = cfg;
    this.under = scene.add.graphics().setDepth(18); // 地面：在角色底下，不遮住敵人腳下
    this.over = scene.add.graphics().setDepth(210);
    this.list = [];
    this.free = [];
    this.flameT = 0;
  }

  add(type, props) {
    const e = this.free.pop() || {};
    e.type = type; e.t = 0; e.delay = 0; e.fired = false;
    Object.assign(e, props);
    this.list.push(e);
    return e;
  }

  clear() {
    for (let i = 0; i < this.list.length; i++) this.free.push(this.list[i]);
    this.list.length = 0;
    this.under.clear();
    this.over.clear();
  }

  midY(v) { return v.c.y - v.h * 0.5; }

  // 技能剛放出去：依角色開始演出
  cast(ev) {
    const S = this.scene;
    const v = S.viewById.get(ev.id);
    if (!v) return;
    const fx = S.fx;
    const y = this.midY(v);
    const G = this.cfg.layout.grid;
    PD.Anim.skill(v, ev.kind);
    switch (ev.kind) {
      case 'trainer':
        this.add('ring', { x: v.c.x, y, r: G.cellW * 1.5, color: 0xffd54a, width: 8, dur: 0.5, a: 0.8 });
        PD.Sound.play('collect');
        break;
      case 'basicShooter':
        fx.shakePx(2, 100);
        PD.Sound.play('shot_lightning');
        break;
      case 'burnShooter':
        this.add('tongue', { x: v.c.x + v.w * 0.4, y, len: G.cellW * 1.6, dur: 0.3 });
        fx.shakePx(3, 150);
        PD.Sound.play('shot_fire');
        break;
      case 'slowShooter':
        this.add('wave', { x0: v.c.x, x1: S.ruleToX(10.9), y: S.laneY(ev.lane), dur: 0.8, foam: 0 });
        fx.shakePx(2, 200);
        PD.Sound.play('shot_water');
        break;
      case 'doubleStriker':
        for (let lane = ev.lane - 1; lane <= ev.lane + 1; lane++) {
          if (lane < 1 || lane > G.rows) continue;
          this.add('sprout', { x: S.ruleToX(Math.min(ev.col + 1, G.cols)), y: S.footY(lane), dur: 0.9, grow: 0.4 });
        }
        fx.burst('leafP', v.c.x + v.w, y, 0x7ee081, 10, 130, 0.7, 0.8, 0.3, 160);
        PD.Sound.play('shot_vine');
        break;
      case 'tank':
        for (let i = 0; i < 3; i++) {
          fx.emit('zee', v.c.x + 14 + i * 12, y - 30 - i * 12, 0xc9b3f5, { vx: 18, vy: -70, g: 0, life: 0.7, s0: 0.8 + i * 0.25, s1: 1.1 + i * 0.25, a: 1 });
          fx.emit('plus', v.c.x - 22 + i * 22, y + 10, 0x7ee081, { vx: 0, vy: -90, g: 0, life: 0.8, s0: 1, s1: 0.8, a: 1 });
        }
        this.add('shock', { x: v.c.x, y: v.foot, delay: 0.38, dur: 0.5, kick: true });
        PD.Sound.play('bump');
        break;
      case 'pierceShooter':
        this.add('crystals', { v, id: v.id, dur: 0.4 });
        fx.shakePx(4, 250);
        break;
      default: break;
    }
    for (let i = 0; i < ev.hits.length; i++) this.hit(ev.hits[i]);
  }

  hit(id) {
    const t = this.scene.viewById.get(id);
    if (t) t.flash = 0.1;
  }

  comet(ev) {
    const S = this.scene;
    const G = this.cfg.layout.grid;
    for (let lane = 1; lane <= G.rows; lane++) this.add('beam', { y: S.laneY(lane), dur: 0.75, shards: 0 });
    for (let i = 0; i < ev.hits.length; i++) this.hit(ev.hits[i]);
    PD.Sound.play('shot_lightning');
  }

  update(dt) {
    this.under.clear();
    this.over.clear();
    const S = this.scene;
    const s = S.sim.state;
    this.drawZones(s, dt);
    this.drawFrenzy(s, dt);
    this.drawStatus(s);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (e.delay > 0) { e.delay -= dt; continue; }
      e.t += dt;
      if (e.t >= e.dur) {
        this.free.push(e);
        this.list.splice(i, 1);
        continue;
      }
      this['draw_' + e.type](e, e.t / e.dur, dt);
    }
  }

  // ===== 地面火焰帶：由戰鬥狀態決定，重試時會跟著還原 =====
  drawZones(s, dt) {
    const S = this.scene;
    const G = this.cfg.layout.grid;
    if (!s.zones.length) return;
    this.flameT -= dt;
    const emit = this.flameT <= 0;
    if (emit) this.flameT = 0.05;
    const tickS = this.cfg.rules.tickSeconds;
    for (let i = 0; i < s.zones.length; i++) {
      const z = s.zones[i];
      const age = (s.tick - z.start) * tickS;
      const left = (z.end - s.tick) * tickS;
      const fade = left < 1 ? Math.max(0.2, left) : 1;
      const cells = Math.round(z.x1 - z.x0);
      const lit = Math.min(cells, Math.floor(age / 0.1) + 1);
      const foot = S.footY(z.lane);
      const left0 = S.ruleToX(z.x0);
      for (let c = 0; c < lit; c++) {
        const x = left0 + c * G.cellW;
        const flick = 0.5 + Math.sin(S.worldClock * 16 + c * 2) * 0.1;
        this.under.fillStyle(0xff5a1f, 0.42 * fade * flick * 2).fillRect(x + 2, foot - 38, G.cellW - 4, 48);
        this.under.fillStyle(0xffd54a, 0.34 * fade).fillRect(x + 8, foot - 14, G.cellW - 16, 20);
        if (emit && Math.random() < fade) {
          S.fx.ambient('spark', x + Math.random() * G.cellW, foot - Math.random() * 30, 0xffb040, (Math.random() - 0.5) * 16, -70 - Math.random() * 40, 0, 0.5, 0.8, 0.15, 1);
        }
      }
    }
  }

  // ===== 閃電連發：身邊的鋸齒閃電與腳下光圈 =====
  drawFrenzy(s) {
    const S = this.scene;
    for (let i = 0; i < s.units.length; i++) {
      const u = s.units[i];
      const v = S.viewById.get(u.id);
      if (!v) continue;
      const on = u.frenzyEnd > s.tick;
      if (!on) {
        if (v.frenzyOn) S.fx.burst('spark', v.c.x, this.midY(v), 0xfff176, 4, 150, 0.3, 0.7, 0.1);
        v.frenzyOn = false;
        continue;
      }
      v.frenzyOn = true;
      const g = this.over;
      const pulse = 0.45 + Math.sin(S.worldClock * 18) * 0.15;
      g.lineStyle(5, 0xfff176, pulse).strokeEllipse(v.c.x, v.foot, v.w * 1.3, 26);
      const frame = Math.floor(S.worldClock / 0.08);
      for (let b = 0; b < 3; b++) {
        const a0 = b * 2.1 + frame * 0.7 + v.seed;
        let x = v.c.x + Math.cos(a0) * v.w * 0.75;
        let y = this.midY(v) + Math.sin(a0) * v.h * 0.55;
        for (let width = 6; width >= 2; width -= 4) {
          g.lineStyle(width, width > 2 ? 0xfff176 : 0xffffff, 1);
          g.beginPath();
          let px = x; let py = y;
          g.moveTo(px, py);
          for (let k = 1; k <= 4; k++) {
            const seedA = Math.sin(frame * 3.1 + b * 7 + k * 5);
            px += Math.cos(a0 + 1.5) * 9 + seedA * 8;
            py += Math.sin(a0 + 1.5) * 9 - seedA * 8;
            g.lineTo(px, py);
          }
          g.strokePath();
        }
      }
    }
  }

  // ===== 敵人身上的狀態：綠色螺旋（被綁）、繞圈小星星（暈眩）=====
  drawStatus(s) {
    const S = this.scene;
    const g = this.over;
    for (let i = 0; i < s.enemies.length; i++) {
      const e = s.enemies[i];
      const rooted = e.rootEnd > s.tick;
      const stunned = e.stunEnd > s.tick;
      if (!rooted && !stunned) continue;
      const v = S.viewById.get(e.id);
      if (!v) continue;
      if (rooted) {
        v.c.x += Math.sin(S.worldClock * 40 + v.seed); // 輕輕左右抖動 1px
        g.lineStyle(4, 0x2e7d32, 0.95);
        g.beginPath();
        for (let k = 0; k <= 22; k++) {
          const t = k / 22;
          const px = v.c.x + Math.cos(t * 14 + S.worldClock * 2) * v.w * (0.42 + t * 0.1);
          const py = v.foot - 4 - t * v.h * 0.72;
          if (k) g.lineTo(px, py); else g.moveTo(px, py);
        }
        g.strokePath();
      }
      if (stunned) {
        for (let k = 0; k < 3; k++) {
          const a = S.worldClock * 6 + k * 2.09;
          this.star(g, v.c.x + Math.cos(a) * 26, v.c.y - v.h - 22 + Math.sin(a) * 8, 8, 0xffe36b);
        }
      }
    }
  }

  star(g, cx, cy, R, color) {
    g.fillStyle(color, 1);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const d = i % 2 ? R * 0.45 : R;
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath();
    g.fillPath();
  }

  hex(g, cx, cy, R, rot) {
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = rot + (i * Math.PI) / 3;
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath();
    g.fillPath();
  }

  // ===== 一次性的演出 =====
  draw_ring(e, k) {
    this.over.lineStyle(e.width * (1 - k) + 1, e.color, e.a * (1 - k)).strokeCircle(e.x, e.y, e.r * k);
  }

  draw_tongue(e, k) {
    const g = this.over;
    const grow = Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.5) * (1 - k * k * k * 0.4);
    const len = e.len * grow;
    g.fillStyle(0xff7a1a, 0.95).fillTriangle(e.x, e.y - 26, e.x, e.y + 26, e.x + len, e.y);
    g.fillStyle(0xffd54a, 0.95).fillTriangle(e.x, e.y - 13, e.x, e.y + 13, e.x + len * 0.72, e.y);
  }

  draw_wave(e, k, dt) {
    const S = this.scene;
    const g = this.over;
    const head = e.x0 + (e.x1 - e.x0) * k;
    const H = 66;
    const alpha = k > 0.85 ? (1 - k) / 0.15 : 1;
    g.fillStyle(0x4fc3f7, 0.55 * alpha);
    g.beginPath();
    g.moveTo(head - 90, e.y - H);
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      g.lineTo(head - 40 + Math.sin(t * Math.PI) * 58, e.y - H + t * H * 2);
    }
    g.lineTo(head - 90, e.y + H);
    g.closePath();
    g.fillPath();
    g.lineStyle(7, 0xffffff, 0.9 * alpha);
    g.beginPath();
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const x = head - 40 + Math.sin(t * Math.PI) * 58;
      const y = e.y - H + t * H * 2;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.strokePath();
    e.foam -= dt;
    if (e.foam <= 0) {
      e.foam = 0.04;
      S.fx.ambient('spark', head + 12, e.y - H + Math.random() * H * 2, 0xffffff, -20, -80, 0, 0.5, 0.7, 0.2, 0.9);
    }
  }

  draw_sprout(e, k) {
    const g = this.under;
    const growK = e.t < e.grow ? e.t / e.grow : k > 0.75 ? (1 - k) / 0.25 : 1;
    const curl = (side, wide, color) => {
      g.lineStyle(wide, color, 1);
      g.beginPath();
      for (let i = 0; i <= 10; i++) {
        const t = (i / 10) * growK;
        const px = e.x + side * 22 + Math.sin(t * 6 + side) * 13 * t;
        const py = e.y - t * 78;
        if (i) g.lineTo(px, py); else g.moveTo(px, py);
      }
      g.strokePath();
    };
    for (let side = -1; side <= 1; side++) { curl(side, 9, 0x1b5e20); }
    for (let side = -1; side <= 1; side++) { curl(side, 5, 0x43a047); }
  }

  draw_shock(e, k) {
    const S = this.scene;
    if (!e.fired) {
      e.fired = true;
      if (e.kick) {
        S.fx.shakePx(6, 300);
        S.fx.burst('spark', e.x, e.y - 6, 0xd7b58a, 8, 230, 0.5, 0.9, 0.2, 480);
      }
    }
    const g = this.under;
    for (let i = 0; i < 2; i++) {
      const kk = Math.max(0, k * 1.5 - i * 0.4);
      if (kk <= 0 || kk >= 1) continue;
      g.lineStyle(6 - kk * 5, 0x8d6e63, 0.7 * (1 - kk)).strokeEllipse(e.x, e.y, 40 + kk * 230, 14 + kk * 70);
    }
  }

  draw_crystals(e, k) {
    const S = this.scene;
    const v = e.v;
    if (!v || !v.active || v.id !== e.id) return;
    const g = this.over;
    g.fillStyle(0xbfe6ff, 0.9);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + S.worldClock * 6;
      this.hex(g, v.c.x + Math.cos(a) * 44, this.midY(v) + Math.sin(a) * 44, 8 + k * 3, a);
    }
  }

  draw_beam(e, k, dt) {
    const S = this.scene;
    const g = this.over;
    const G = this.cfg.layout.grid;
    const grow = Math.min(1, e.t / 0.3);
    const thin = e.t > 0.6 ? 1 - (e.t - 0.6) / 0.15 : 1;
    const w = G.cols * G.cellW * grow;
    // 光束只佔路中間一條（高約 40），不蓋住整條路，也看得到敵人和腳下
    const h = 20 * Math.max(0, thin);
    const left = G.x;
    g.fillStyle(0xb3e5fc, 0.32).fillRect(left, e.y - h, w, h * 2);
    g.fillStyle(0xdff4ff, 0.5).fillRect(left, e.y - h * 0.55, w, h * 1.1);
    g.fillStyle(0xffffff, 0.75).fillRect(left, e.y - h * 0.2, w, h * 0.4);
    e.shards -= dt;
    if (e.shards <= 0 && grow < 1) {
      e.shards = 0.03;
      S.fx.ambient('hexP', left + w, e.y + (Math.random() - 0.5) * 50, 0xbfe6ff, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, 0, 0.5, 0.9, 0.2, 1);
    }
  }
};
