// 角色成長（chunk A）：存檔、過關給經驗，以及勝利畫面之後的「大家長大了！」與進化演出。
// 存在 localStorage 的 pd.growth.v1（和過關進度 pd.progress.v1、圖鑑 pd.bestiary.v1 分開），兩種模式各記各的：
//   {"v":1,"solo":{"trainer":{"xp":28},"basicShooter":{"xp":32}},"together":{"trainer":{"xp":14}}}
// 只存累積經驗，等級由 config.js 的 growth.xpTable 算出來。讀不到、損毀、代號不認得或數字不合理，
// 一律當作 Lv1、經驗 0，不影響過關進度與圖鑑；存不進去（例如私密瀏覽）就只記在這次開啟的記憶體裡。
window.PD = window.PD || {};

PD.Growth = (function () {
  const KEY = 'pd.growth.v1';
  const MODES = ['solo', 'together'];
  let memory = null;

  function read() {
    if (memory) return memory;
    try {
      const data = JSON.parse(localStorage.getItem(KEY));
      if (data && typeof data === 'object' && !Array.isArray(data) && data.v === 1) return data;
    } catch (e) { /* 損毀或無法讀取：當作都是 Lv1 */ }
    return { v: 1 };
  }

  function write(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      memory = null;
    } catch (e) {
      memory = data;
    }
  }

  function table(data, mode) {
    const t = data[mode];
    return t && typeof t === 'object' && !Array.isArray(t) ? t : {};
  }

  function xp(mode, kind) {
    if (MODES.indexOf(mode) === -1 || !PD.config.units[kind]) return 0;
    const e = table(read(), mode)[kind];
    const n = e && typeof e === 'object' ? e.xp : undefined;
    return Number.isInteger(n) && n >= 0 ? Math.min(n, PD.growthXpCap()) : 0;
  }

  const level = (mode, kind) => PD.growthLevelOf(xp(mode, kind));

  return {
    KEY,
    xp,
    level,
    // 戰鬥規則用：{ 種類: 等級 }（debug.unlockAll 不會把等級加滿）
    levels(mode) {
      const out = {};
      PD.config.cardOrder.forEach((k) => { out[k] = level(mode, k); });
      return out;
    },
    // 過關：counts＝{ 種類: 放過幾隻 }；replay＝這一關之前已經過關（要在 markCleared 之前判斷），經驗打折。
    // 回傳每一種的前後變化（照卡片順序），已經封頂的也列出來（gain 0）
    award(mode, counts, replay) {
      const data = Object.assign({}, read(), { v: 1 });
      const t = Object.assign({}, table(data, mode));
      const list = [];
      PD.config.cardOrder.forEach((k) => {
        if (!(counts[k] > 0)) return;
        const before = xp(mode, k);
        const after = Math.min(PD.growthXpCap(), before + PD.growthXpFor(counts[k], !!replay));
        list.push({ kind: k, before, after, gain: after - before, lvBefore: PD.growthLevelOf(before), lvAfter: PD.growthLevelOf(after) });
        t[k] = { xp: after };
      });
      data[mode] = t;
      if (MODES.indexOf(mode) !== -1) write(data);
      return list;
    },
  };
})();

// ===== 勝利畫面之後的成長演出 =====
// 流程：星星勝利畫面（按「繼續」）→「大家長大了！」經驗條往上跑、升級時跳「升級了！」→
// 每一種有進化的角色各一個進化瞬間 → 回到原本的星星勝利畫面（下一關／回地圖／再玩一次）。
// 經驗已經在過關那一刻存好；這裡只是演出，規則的 phase 一直是 'won'。動畫跑一半點任何地方就直接跳到結果。
PD.GrowthShow = class GrowthShow {
  constructor(scene) {
    this.scene = scene;
    this.c = scene.add.container(0, 0).setDepth(505).setVisible(false);
    this.cols = [];
    this.active = false;
    this.step = '';
    this.evoPic = null;
  }

  // list：PD.Growth.award 的結果；done：全部看完後要做的事（顯示原本的勝利按鈕）
  start(list, done) {
    this.list = list.filter((r) => r.gain > 0 || r.lvAfter >= PD.config.growth.maxLevel);
    this.done = done;
    this.evolves = list.filter((r) => PD.evoStage(r.lvAfter) > PD.evoStage(r.lvBefore));
    if (!this.list.length) { done(); return; }
    this.active = true;
    this.showRows();
  }

  showRows() {
    const sc = this.scene;
    const ov = sc.overlay;
    const reduced = PD.settings.reduceFx;
    this.step = 'rows';
    ov.show(PD.text.growthTitle, '', [{ label: PD.text.growthNext, fn: () => this.next() }]);
    ov.title.setY(252);
    const n = this.list.length;
    const gap = Math.min(140, 960 / n);
    this.cols.forEach((col) => col.parts.forEach((o) => o.setVisible(false)));
    this.list.forEach((r, i) => {
      const x = sc.L.width / 2 + (i - (n - 1) / 2) * gap;
      const col = this.col(i);
      col.r = r;
      col.lv = r.lvBefore;
      col.t = 0;
      col.delay = reduced ? 0 : 0.25 + i * 0.22;
      col.dur = reduced ? 0.35 : 1.1;
      col.popT = 0;
      col.glow.setPosition(x, 340).setVisible(true).setAlpha(PD.evoStage(r.lvBefore) ? 0.45 : 0);
      col.pic.setFrame('cardPic_' + r.kind).setPosition(x, 340).setScale(PD.TEX_SCALE).setVisible(true);
      col.lvText.setPosition(x, 400).setText(PD.text.lvLabel(r.lvBefore)).setVisible(true);
      col.gain.setPosition(x, 300).setText(r.gain ? PD.text.xpGain(r.gain) : PD.text.growthMax).setVisible(true).setAlpha(1);
      col.pop.setPosition(x, 300).setVisible(false);
      col.x = x;
      col.barW = Math.min(110, gap - 18);
      this.drawBar(col, this.frac(r.before));
      col.bar.setVisible(true);
    });
    this.c.setVisible(true);
  }

  col(i) {
    if (this.cols[i]) return this.cols[i];
    const sc = this.scene;
    const glow = sc.add.image(0, 0, 'atlas', 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd84a).setScale(PD.TEX_SCALE * 1.6);
    const pic = PD.img(sc, 0, 0, 'white');
    const lvText = PD.txt(sc, 0, 0, '', 30, '#ffe9a8', 5);
    const gain = PD.txt(sc, 0, 0, '', 22, '#c9f5d0', 4);
    const pop = PD.txt(sc, 0, 0, PD.text.levelUp, 26, '#ffe36b', 6);
    const bar = sc.add.graphics();
    const parts = [glow, pic, bar, lvText, gain, pop];
    this.c.add(parts);
    this.cols[i] = { glow, pic, lvText, gain, pop, bar, parts };
    return this.cols[i];
  }

  // 目前這一級裡走了幾成（封頂時是滿的）
  frac(xp) {
    const T = PD.config.growth.xpTable;
    const lv = PD.growthLevelOf(xp);
    if (lv >= PD.config.growth.maxLevel) return 1;
    return (xp - T[lv - 1]) / (T[lv] - T[lv - 1]);
  }

  drawBar(col, f) {
    const w = col.barW;
    const x = col.x - w / 2;
    const y = 426;
    col.bar.clear();
    col.bar.fillStyle(0x1f2a38, 1).fillRoundedRect(x - 3, y - 3, w + 6, 20, 9);
    col.bar.fillStyle(0x3a4a5a, 1).fillRoundedRect(x, y, w, 14, 7);
    if (f > 0.02) col.bar.fillStyle(0x7ee081, 1).fillRoundedRect(x, y, Math.max(14, w * f), 14, 7);
    if (f > 0.02) col.bar.fillStyle(0xffffff, 0.35).fillRoundedRect(x + 3, y + 2, Math.max(8, w * f - 6), 4, 2);
  }

  busy() {
    return this.step === 'rows' && this.list.some((r, i) => this.cols[i].t < 1);
  }

  // 動畫跑一半被點：直接跳到結果
  finish() {
    this.list.forEach((r, i) => { const col = this.cols[i]; col.delay = 0; col.t = 1; this.paint(col, true); });
  }

  update(dt) {
    if (!this.active) return;
    if (this.step === 'rows') {
      this.cols.forEach((col, i) => {
        if (i >= this.list.length) return;
        if (col.popT > 0) {
          col.popT -= dt;
          const k = Math.max(0, col.popT / 0.5);
          if (!PD.settings.reduceFx) col.pop.setScale(1 + 0.35 * Math.sin(k * Math.PI));
        }
        if (col.t >= 1) return;
        if (col.delay > 0) { col.delay -= dt; return; }
        col.t = Math.min(1, col.t + dt / col.dur);
        this.paint(col, false);
      });
    } else if (this.step === 'evolve' && this.evoPic && !PD.settings.reduceFx) {
      this.evoT += dt;
      this.evoGlow.setAlpha(0.55 + 0.25 * Math.sin(this.evoT * 4));
    }
  }

  paint(col, quiet) {
    const r = col.r;
    const e = 1 - (1 - col.t) * (1 - col.t);
    const xp = r.before + (r.after - r.before) * e;
    const lv = PD.growthLevelOf(Math.floor(xp + 1e-6));
    this.drawBar(col, this.frac(Math.min(xp, r.after)));
    if (lv !== col.lv) {
      col.lv = lv;
      col.lvText.setText(PD.text.lvLabel(lv));
      col.gain.setVisible(false);
      col.pop.setVisible(true).setScale(1);
      col.popT = 0.5;
      if (PD.evoStage(lv)) col.glow.setAlpha(0.45);
      if (!quiet) {
        PD.Sound.play('levelUp');
        if (!PD.settings.reduceFx) this.sparkle(col.x, 340, 0xffe36b, 6, 70);
      }
    }
  }

  next() {
    if (this.step === 'rows' && this.busy()) { this.finish(); return; }
    if (this.evolves.length) { this.showEvolve(this.evolves.shift()); return; }
    this.end();
  }

  // 進化瞬間：閃光＋變大＋一句短話（還沒有進化圖，用同一張圖放大、加光環）
  showEvolve(r) {
    const sc = this.scene;
    const ov = sc.overlay;
    const reduced = PD.settings.reduceFx;
    this.step = 'evolve';
    this.evoKind = r.kind;
    this.c.setVisible(true);
    this.cols.forEach((col) => col.parts.forEach((o) => o.setVisible(false)));
    ov.show(PD.text.evolveTitle(PD.names[r.kind]), PD.text.evolveMsg, [{ label: PD.text.growthNext, fn: () => this.next() }]);
    ov.title.setY(256);
    ov.msg.setY(442).setFontSize(28);
    const cx = sc.L.width / 2;
    if (!this.evoPic) {
      this.evoGlow = sc.add.image(0, 0, 'atlas', 'glow').setBlendMode(Phaser.BlendModes.ADD);
      this.evoRing = sc.add.image(0, 0, 'atlas', 'ring').setBlendMode(Phaser.BlendModes.ADD);
      this.evoPic = PD.img(sc, 0, 0, 'white').setOrigin(0.5, 1);
      this.evoShine = PD.img(sc, 0, 0, 'white').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD);
      this.evoFlash = sc.add.image(0, 0, 'atlas', 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffffff);
      this.c.add([this.evoGlow, this.evoRing, this.evoPic, this.evoShine, this.evoFlash]);
    }
    const stage = PD.evoStage(r.lvAfter);
    const tint = stage >= 2 ? 0xffb0f0 : 0xffd84a;
    const big = PD.TEX_SCALE * 1.05 * PD.evoScaleOf(r.kind, r.lvAfter) / PD.evoScaleOf(r.kind, 1);
    const footY = 392;
    this.evoT = 0;
    sc.tweens.killTweensOf([this.evoPic, this.evoShine, this.evoFlash, this.evoRing, this.evoGlow]);
    this.evoGlow.setPosition(cx, footY - 55).setTint(tint).setScale(PD.TEX_SCALE * 3.2).setAlpha(0.6).setVisible(true);
    this.evoRing.setPosition(cx, footY - 2).setTint(tint).setScale(PD.TEX_SCALE * 1.2, PD.TEX_SCALE * 0.34).setAlpha(0.9).setVisible(true);
    this.evoPic.setFrame('unit_' + r.kind).setPosition(cx, footY).setVisible(true);
    this.evoShine.setFrame('unit_' + r.kind).setPosition(cx, footY).setVisible(true).setAlpha(0.2);
    PD.Sound.play('evolve');
    if (reduced) {
      this.evoPic.setScale(big);
      this.evoShine.setScale(big);
      this.evoFlash.setVisible(false);
      return;
    }
    // 先是原本大小，白光一閃之後變大（真實時間；覆蓋畫面時戰鬥已停）
    const small = PD.TEX_SCALE * 0.85;
    this.evoPic.setScale(small);
    this.evoShine.setScale(small).setAlpha(0.9);
    this.evoFlash.setPosition(cx, footY - 55).setScale(PD.TEX_SCALE * 0.5).setAlpha(0).setVisible(true);
    sc.tweens.add({ targets: this.evoFlash, alpha: 0.85, scale: PD.TEX_SCALE * 3.4, duration: 260, delay: 200, yoyo: true, hold: 60, ease: 'Sine.easeOut' });
    sc.tweens.add({ targets: [this.evoPic, this.evoShine], scale: big, duration: 380, delay: 380, ease: 'Back.easeOut' });
    sc.tweens.add({ targets: this.evoShine, alpha: 0.2, duration: 500, delay: 420 });
    sc.time.delayedCall(420, () => {
      if (this.step !== 'evolve') return;
      this.sparkle(cx, footY - 60, tint, 12, 150);
    });
  }

  // 小星星往外散開（戰場的粒子畫在覆蓋畫面底下，這裡用自己的一小池星星，畫在面板上面）
  sparkle(x, y, tint, n, dist) {
    const sc = this.scene;
    this.stars = this.stars || [];
    for (let i = 0; i < n; i++) {
      let st = this.stars.find((o) => !o.visible);
      if (!st) {
        if (this.stars.length >= 24) return;
        st = PD.img(sc, 0, 0, 'rankStar');
        this.c.add(st);
        this.stars.push(st);
      }
      const a = (i / n) * Math.PI * 2 + 0.3;
      st.setPosition(x, y).setTint(tint).setScale(PD.TEX_SCALE * 0.35).setAlpha(1).setVisible(true);
      sc.tweens.add({ targets: st, x: x + Math.cos(a) * dist, y: y + Math.sin(a) * dist, alpha: 0, scale: PD.TEX_SCALE * 0.15,
        duration: 600, ease: 'Sine.easeOut', onComplete: () => st.setVisible(false) });
    }
  }

  end() {
    this.step = '';
    this.active = false;
    this.c.setVisible(false);
    this.scene.overlay.msg.setFontSize(32);
    this.done();
  }
};
