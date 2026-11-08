// 音樂與音效：全部用 WebAudio 程式合成，沒有音檔。iOS 要在使用者點擊時才能啟動聲音。
window.PD = window.PD || {};

PD.Sound = (function () {
  // 音量三段：正常 → 小聲 → 靜音（畫面上的按鈕依序切換）
  const VOLUME_STEPS = [
    { gain: 1, icon: 'iconSound' },
    { gain: 0.4, icon: 'iconSoundLow' },
    { gain: 0, icon: 'iconMute' },
  ];
  const MUSIC_LEVEL = 0.15;
  const SFX_LEVEL = 0.9;
  const MAX_VOICES = 24; // 同時發聲的上限，避免 iPad 忙不過來
  const MIN_GAP_MS = 50; // 同一種音效的最短間隔

  // 一個音：[延遲秒數, 起始頻率, 結束頻率, 長度, 波形, 音量]
  // 一段噪音：{ at, d, filter, f, to, v }，用來做水、火、藤鞭這類「沙沙」的聲音
  const PRESETS = {
    tap: [[0, 500, 620, 0.06, 'sine', 0.09]],
    place: [[0, 330, 520, 0.12, 'triangle', 0.15], [0.07, 520, 680, 0.1, 'triangle', 0.1]],
    collect: [[0, 880, 1175, 0.08, 'sine', 0.11], [0.07, 1319, 1568, 0.13, 'sine', 0.09]],
    shot_lightning: [[0, 1300, 520, 0.08, 'sawtooth', 0.028], [0.015, 1900, 900, 0.06, 'square', 0.012]],
    shot_water: [[0, 300, 880, 0.1, 'sine', 0.1]],
    shot_fire: [{ at: 0, d: 0.16, filter: 'lowpass', f: 1100, to: 320, v: 0.13 }, [0, 190, 95, 0.12, 'triangle', 0.06]],
    shot_vine: [{ at: 0, d: 0.13, filter: 'bandpass', f: 2000, to: 700, v: 0.12 }],
    hit: [[0, 250, 140, 0.07, 'triangle', 0.09]],
    bump: [[0, 210, 150, 0.1, 'sine', 0.1]],
    star: [[0, 660, 700, 0.09, 'triangle', 0.11], [0.07, 880, 930, 0.09, 'triangle', 0.11], [0.14, 1320, 1400, 0.2, 'triangle', 0.1]],
    home: [[0, 520, 390, 0.2, 'sine', 0.1]],
    win: [
      [0, 523, 523, 0.14, 'triangle', 0.13], [0.14, 659, 659, 0.14, 'triangle', 0.13],
      [0.28, 784, 784, 0.14, 'triangle', 0.13], [0.42, 1047, 1047, 0.55, 'triangle', 0.14],
      [0.42, 659, 659, 0.55, 'sine', 0.09], [0.42, 784, 784, 0.55, 'sine', 0.08],
    ],
    // 失敗只是「休息一下」，用溫和的下行，不用低沉嚇人的聲音
    lose: [[0, 659, 659, 0.22, 'sine', 0.11], [0.2, 523, 523, 0.22, 'sine', 0.11], [0.4, 440, 440, 0.45, 'sine', 0.1]],
  };

  // 背景音樂：8 小節循環，每小節 8 個八分音符，0 代表休止
  const BPM = 126;
  const MELODY = [
    72, 0, 76, 79, 76, 0, 72, 0,
    74, 0, 79, 74, 71, 0, 74, 0,
    72, 0, 76, 81, 79, 0, 76, 0,
    77, 76, 74, 72, 74, 0, 0, 0,
    79, 0, 76, 79, 84, 0, 79, 0,
    83, 0, 79, 74, 79, 0, 74, 0,
    81, 79, 77, 76, 74, 72, 74, 76,
    74, 0, 71, 74, 79, 0, 0, 0,
  ];
  // 每小節的和弦：[根音, 三音, 五音]
  const CHORDS = [
    [60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60],
    [60, 64, 67], [55, 59, 62], [53, 57, 60], [55, 59, 62],
  ];

  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
  const softWave = (p) => Math.sin(p * 6.283185) + 0.3 * Math.sin(p * 12.56637);
  const triWave = (p) => 4 * Math.abs((p % 1) - 0.5) - 1;

  // 事先把整段音樂算成一段聲音資料再循環播放，戰鬥中幾乎不佔運算
  function buildMusic(ctx) {
    const rate = 22050;
    const step = 60 / BPM / 2;
    const total = Math.round(rate * step * MELODY.length);
    const buf = ctx.createBuffer(1, total, rate);
    const data = buf.getChannelData(0);
    const note = (at, len, midi, vol, wave) => {
      const start = Math.round(rate * step * at);
      const n = Math.round(rate * step * len);
      const f = hz(midi) / rate;
      for (let i = 0; i < n; i++) {
        const env = Math.min(1, i / 80) * Math.pow(1 - i / n, 1.4);
        data[(start + i) % total] += wave(i * f) * vol * env; // 尾音繞回開頭，循環才接得順
      }
    };
    MELODY.forEach((m, i) => { if (m) note(i, 1.7, m, 0.42, softWave); });
    CHORDS.forEach((c, bar) => {
      const at = bar * 8;
      note(at, 3, c[0] - 24 + 12, 0.34, triWave);
      note(at + 4, 3, c[2] - 24 + 12, 0.3, triWave);
      [2, 6].forEach((off) => c.forEach((m) => note(at + off, 1.4, m, 0.08, triWave)));
    });
    let peak = 0;
    for (let i = 0; i < total; i++) peak = Math.max(peak, Math.abs(data[i]));
    if (peak > 0) for (let i = 0; i < total; i++) data[i] /= peak;
    return buf;
  }

  return {
    ctx: null,
    stepIndex: 0,
    voices: 0,
    lastAt: {},
    master: null,
    sfxBus: null,
    musicBus: null,
    noiseBuf: null,
    musicBuf: null,
    music: null, // 正在播放的背景音樂 { src, gain }

    get icon() { return VOLUME_STEPS[this.stepIndex].icon; },
    get silent() { return VOLUME_STEPS[this.stepIndex].gain === 0; },

    // 必須在使用者點擊的當下呼叫
    unlock() {
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        this.ctx = ctx;
        // 播一小段無聲，iOS 才算真的解鎖
        const silence = ctx.createBufferSource();
        silence.buffer = ctx.createBuffer(1, 1, 22050);
        silence.connect(ctx.destination);
        silence.start(0);

        const limiter = ctx.createDynamicsCompressor(); // 很多聲音同時出現時不會爆音
        limiter.connect(ctx.destination);
        this.master = ctx.createGain();
        this.master.gain.value = VOLUME_STEPS[this.stepIndex].gain;
        this.master.connect(limiter);
        this.sfxBus = ctx.createGain();
        this.sfxBus.gain.value = SFX_LEVEL;
        this.sfxBus.connect(this.master);
        this.musicBus = ctx.createGain();
        this.musicBus.gain.value = MUSIC_LEVEL;
        this.musicBus.connect(this.master);

        this.noiseBuf = ctx.createBuffer(1, 11025, 22050);
        const noise = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
      }
      this.wake();
    },

    // iOS 可能把聲音暫停（來電、切到別的 App），下一次點擊時喚醒
    wake() {
      if (this.ctx && this.ctx.state !== 'running' && !document.hidden) this.ctx.resume();
    },

    // 切換音量（正常 → 小聲 → 靜音），回傳新的段數
    cycleVolume() {
      this.stepIndex = (this.stepIndex + 1) % VOLUME_STEPS.length;
      if (this.ctx) this.master.gain.setTargetAtTime(VOLUME_STEPS[this.stepIndex].gain, this.ctx.currentTime, 0.02);
      return this.stepIndex;
    },

    startMusic() {
      if (!this.ctx || this.music) return;
      if (!this.musicBuf) this.musicBuf = buildMusic(this.ctx);
      const src = this.ctx.createBufferSource();
      src.buffer = this.musicBuf;
      src.loop = true;
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(1, t + 0.4);
      src.connect(gain).connect(this.musicBus);
      src.start(t);
      this.music = { src, gain };
    },

    stopMusic() {
      if (!this.ctx || !this.music) return;
      const { src, gain } = this.music;
      const t = this.ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setTargetAtTime(0, t, 0.12);
      src.stop(t + 0.6);
      this.music = null;
    },

    play(name) {
      if (!this.ctx || this.silent) return;
      const nowMs = performance.now();
      if (nowMs - (this.lastAt[name] || 0) < MIN_GAP_MS) return;
      this.lastAt[name] = nowMs;
      const list = PRESETS[name];
      if (!list) return;
      const t = this.ctx.currentTime;
      for (let i = 0; i < list.length && this.voices < MAX_VOICES; i++) {
        const p = list[i];
        if (Array.isArray(p)) this.tone(t + p[0], p[1], p[2], p[3], p[4], p[5]);
        else this.noise(t + p.at, p);
      }
    },

    // 音量包絡：快速起音再自然消失，聲音才不會有爆破感
    envelope(t, d, v) {
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(v, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + d);
      return gain;
    },

    finish(node, gain, extra) {
      this.voices++;
      node.onended = () => {
        this.voices--;
        gain.disconnect();
        if (extra) extra.disconnect();
      };
    },

    tone(t, f, to, d, type, v) {
      const osc = this.ctx.createOscillator();
      const gain = this.envelope(t, d, v);
      osc.type = type;
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(to, t + d);
      osc.connect(gain).connect(this.sfxBus);
      osc.start(t);
      osc.stop(t + d + 0.02);
      this.finish(osc, gain);
    },

    noise(t, p) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = p.filter;
      filter.frequency.setValueAtTime(p.f, t);
      filter.frequency.exponentialRampToValueAtTime(p.to, t + p.d);
      const gain = this.envelope(t, p.d, p.v);
      src.connect(filter).connect(gain).connect(this.sfxBus);
      src.start(t, Math.random() * 0.25, p.d + 0.02);
      this.finish(src, gain, filter);
    },
  };
})();

// 切到別的分頁或鎖屏就立刻安靜；回來或之後任何一次點擊再喚醒
document.addEventListener('visibilitychange', () => {
  const S = PD.Sound;
  if (!S.ctx) return;
  if (document.hidden) S.ctx.suspend(); else S.wake();
});
['pointerup', 'touchend'].forEach((n) => window.addEventListener(n, () => PD.Sound.wake()));
