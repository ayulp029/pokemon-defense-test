// 用程式合成的簡單音效。iOS 要在使用者點擊時才能啟動聲音。
window.PD = window.PD || {};

PD.Sound = {
  ctx: null,
  muted: false,
  lastAt: {},

  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      // 播一小段無聲，iOS 才算真的解鎖
      const buf = this.ctx.createBuffer(1, 1, 22050);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.ctx.destination);
      src.start(0);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  presets: {
    place: { f: 330, to: 520, d: 0.12, type: 'triangle', v: 0.16 },
    shot: { f: 880, to: 520, d: 0.07, type: 'square', v: 0.035 },
    collect: { f: 700, to: 1200, d: 0.1, type: 'sine', v: 0.12 },
    star: { f: 620, to: 1320, d: 0.22, type: 'triangle', v: 0.14 },
    home: { f: 420, to: 300, d: 0.2, type: 'sine', v: 0.12 },
    win: { f: 520, to: 1040, d: 0.5, type: 'triangle', v: 0.16 },
    tap: { f: 500, to: 600, d: 0.05, type: 'sine', v: 0.08 },
  },

  play(name) {
    if (!this.ctx || this.muted) return;
    const nowMs = performance.now();
    if (nowMs - (this.lastAt[name] || 0) < 50) return;
    this.lastAt[name] = nowMs;
    const p = this.presets[name];
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = p.type;
    osc.frequency.setValueAtTime(p.f, t);
    osc.frequency.exponentialRampToValueAtTime(p.to, t + p.d);
    gain.gain.setValueAtTime(p.v, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + p.d);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + p.d);
  },
};
