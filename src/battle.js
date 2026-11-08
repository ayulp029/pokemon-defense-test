// 戰鬥畫面：把規則算出來的狀態演出來，並接收點擊。
window.PD = window.PD || {};

// 敵人被變慢時的身體色調（貼圖和色塊都用乘色）
const SLOW_TINT = 0x8fc8ff;
// 燃燒小火苗在身上的位置：[相對身寬, 相對身高, 大小]，都在腳以上，不蓋住接觸點
const FLAME_SPOTS = [[-0.26, -0.3, 0.8], [0.24, -0.52, 0.95], [0.02, -0.72, 0.75]];

PD.BattleScene = class BattleScene extends Phaser.Scene {
  constructor() { super('Battle'); }

  init(data) { this.modeId = data.mode || 'solo'; }

  create() {
    PD.setupCamera(this);
    const cfg = PD.config;
    this.cfg = cfg;
    this.L = cfg.layout;
    this.sim = new PD.BattleSim(cfg, 0, this.modeId);
    this.fx = new PD.Fx(this, cfg);
    this.overlay = new PD.Overlay(this, cfg);
    this.accum = 0;
    this.pausedBy = null;
    this.selected = null;
    this.recalling = false;
    this.recallTargetId = 0;
    this.recallArmedAt = 0;
    this.hintKey = '';
    this.clock = 0; // 真實時間：防手抖、按鈕閃爍用，不跟著速度鈕變快
    this.worldClock = 0; // 戰場時間：角色與特效的動畫用，跟著速度鈕變快
    this.speedIndex = 0;
    this.hintSwapTick = 0;
    this.restoring = false;
    this.fpsTime = 0; this.fpsFrames = 0; this.lowFor = 0;

    this.add.image(0, 0, 'bg').setOrigin(0).setScale(PD.TEX_SCALE).setDepth(0);

    this.views = [];
    this.viewById = new Map();
    this.actorPool = [];
    this.orbPool = [];
    this.buildGridHelpers();
    this.buildHud();
    this.buildCards();

    this.input.on('pointerdown', (p) => this.onTap(p.x / PD.RES, p.y / PD.RES));
    this.onHidden = () => { if (document.hidden) this.freeze('hidden'); };
    this.onPortrait = () => this.checkOrientation();
    document.addEventListener('visibilitychange', this.onHidden);
    window.addEventListener('pagehide', this.onHidden);
    window.addEventListener('resize', this.onPortrait);
    this.events.once('shutdown', () => {
      document.removeEventListener('visibilitychange', this.onHidden);
      window.removeEventListener('pagehide', this.onHidden);
      window.removeEventListener('resize', this.onPortrait);
    });
    this.checkOrientation();
    this.refreshPrepHint();
  }

  // ===== 座標換算 =====
  ruleToX(x) { return this.L.originX + this.L.grid.cellW * x; }
  laneY(lane) { return this.L.laneY[lane - 1]; }
  footY(lane) {
    const G = this.L.grid;
    return this.laneY(lane) + G.cellH / 2 - G.cellH * this.L.footFromBottom;
  }

  // ===== 介面建構 =====
  buildGridHelpers() {
    const G = this.L.grid;
    this.cellGlows = [];
    for (let i = 0; i < G.cols * G.rows; i++) {
      this.cellGlows.push(PD.img(this, 0, 0, 'cell').setDepth(5).setTint(0xfff3b0)
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setVisible(false));
    }
    this.rangeImgs = [];
    for (let i = 0; i < 3; i++) {
      this.rangeImgs.push(PD.img(this, 0, 0, 'range').setDepth(6).setTint(0xffe36b)
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setVisible(false));
    }
    this.rangeTimer = 0;
    this.foot = PD.img(this, 0, 0, 'foot').setDepth(7).setTint(0xfff176)
      .setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
  }

  buildHud() {
    const L = this.L;
    this.orbIcon = PD.img(this, L.orbCounter.x, L.orbCounter.y, 'orb').setDepth(400);
    this.orbGlow = this.add.image(L.orbCounter.x, L.orbCounter.y, 'atlas', 'glow').setDepth(399)
      .setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd84a).setScale(1.6 * PD.TEX_SCALE).setAlpha(0.6);
    this.ballText = PD.txt(this, L.orbCounter.x + 32, L.orbCounter.y, '', 38, '#ffe9a8', 5)
      .setOrigin(0, 0.5).setDepth(400);
    this.ballBump = 0;

    this.rescueIcons = [];
    const n = this.sim.mode.rescues;
    PD.img(this, L.rescue.x - 25 + (n * 30 + 20) / 2, L.rescue.y, 'plateRescue_' + n).setDepth(399);
    for (let i = 0; i < n; i++) {
      this.rescueIcons.push(PD.img(this, L.rescue.x + i * 30, L.rescue.y, 'shield').setDepth(400));
    }

    this.hintText = PD.txt(this, L.hint.x, L.hint.y, '', 30, '#ffffff', 5).setDepth(400);

    const squareBtn = (r, icon) => {
      PD.img(this, r.x + r.w / 2, r.y + r.h / 2, 'btnSquare').setDepth(400);
      return PD.img(this, r.x + r.w / 2, r.y + r.h / 2, icon).setDepth(401);
    };
    this.muteIcon = squareBtn(L.muteBtn, PD.Sound.icon);
    squareBtn(L.pauseBtn, 'iconPause');
    PD.img(this, L.speedBtn.x + L.speedBtn.w / 2, L.speedBtn.y + L.speedBtn.h / 2, 'btnSquare').setDepth(400);
    this.speedText = PD.txt(this, L.speedBtn.x + L.speedBtn.w / 2, L.speedBtn.y + L.speedBtn.h / 2,
      PD.text.speedLabel(this.gameSpeed), 34).setDepth(401);

    if (this.cfg.debug.dev) {
      this.fpsText = PD.txt(this, 1140, 110, '', 18).setDepth(450);
    }
  }

  buildCards() {
    const C = this.L.cards;
    this.cards = this.cfg.cardOrder.map((kind, i) => {
      const def = this.cfg.units[kind];
      const x = C.x + i * (C.w + C.gap);
      const cx = x + C.w / 2;
      const cy = C.y + C.h / 2;
      const unlocked = this.sim.isUnlocked(kind);
      const glow = PD.img(this, cx, cy, 'cardGlow').setDepth(399).setTint(0xfff176)
        .setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
      const bg = PD.img(this, cx, cy, unlocked ? 'card_' + kind : 'cardLocked').setDepth(400);
      // 價格徽章在左上角、角色圖靠右，兩者不重疊；鎖住的卡沒有徽章，圖放中間
      const picX = unlocked ? x + 102 : cx;
      const pic = PD.img(this, picX, C.y + 47, 'cardPic_' + kind).setDepth(401);
      const name = PD.txt(this, cx, C.y + 102, PD.names[kind], 20, '#2a2a2a', 0).setDepth(402);
      const badge = PD.img(this, x + 39, C.y + 25, 'costBadge').setDepth(402).setTint(0xd2571a);
      const coin = PD.img(this, x + 17, C.y + 25, 'orb').setDepth(403).setScale(PD.TEX_SCALE * 0.4);
      const cost = PD.txt(this, x + 28, C.y + 25, String(def.cost), 24, '#ffffff', 3).setOrigin(0, 0.5).setDepth(403);
      const cd = this.add.image(x, C.y + C.h, 'atlas', 'white').setOrigin(0, 1).setDepth(403)
        .setTint(0x202a34).setAlpha(0.55).setDisplaySize(C.w, 0).setVisible(false);
      let lockImg = null;
      if (!unlocked) {
        pic.setAlpha(0.35);
        name.setColor('#e8edf2');
        badge.setVisible(false);
        cost.setVisible(false);
        coin.setVisible(false);
        lockImg = PD.img(this, cx, C.y + 46, 'lock').setDepth(403).setTint(0xf0f4f8);
      }
      return { kind, rect: { x, y: C.y, w: C.w, h: C.h }, def, bg, pic, name, badge, cost, coin, glow, cd, lockImg, unlocked };
    });
    const B = this.L.recallBtn;
    const bx = B.x + B.w / 2;
    const by = B.y + B.h / 2;
    this.recallGlow = PD.img(this, bx, by, 'cardGlow').setDepth(399).setTint(0xfff176)
      .setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    PD.img(this, bx, by, 'recall').setDepth(400);
    PD.img(this, bx, by - 14, 'iconRecall').setDepth(401);
    PD.txt(this, bx, B.y + B.h - 26, PD.text.recall, 24).setDepth(401);
    this.recallLabel = PD.txt(this, 0, 0, PD.text.recallAgainLabel, 22, '#ffe9a8', 4).setDepth(410).setVisible(false);
    const R = this.L.cancelBtn;
    this.cancelBg = PD.img(this, R.x + R.w / 2, R.y + R.h / 2, 'cancel').setDepth(400);
    this.cancelIcon = PD.img(this, R.x + R.w / 2, R.y + R.h / 2 - 12, 'iconCancel').setDepth(401);
    this.cancelText = PD.txt(this, R.x + R.w / 2, R.y + R.h - 26, PD.text.cancel, 22).setDepth(401);
  }

  // ===== 物件池：角色／敵人 =====
  acquireActor(id, frame, name, size, foot, isEnemy) {
    let v = this.actorPool.pop();
    if (!v) {
      const c = this.add.container(0, 0);
      const shadow = PD.img(this, 0, -1, 'shadow');
      const body = PD.img(this, 0, 0, 'white').setOrigin(0.5, 1);
      const label = PD.txt(this, 0, 0, '', 14, '#ffffff', 3);
      const hpBack = PD.img(this, 0, 0, 'hpBack');
      const hpFill = PD.img(this, 0, 0, 'hpFill').setOrigin(0, 0.5);
      const burn = PD.img(this, 0, 0, 'iconBurn');
      const slow = PD.img(this, 0, 0, 'iconSlow');
      const flames = FLAME_SPOTS.map(() => PD.img(this, 0, 0, 'iconBurn').setOrigin(0.5, 1).setVisible(false));
      c.add([shadow, body, label, ...flames, hpBack, hpFill, burn, slow]);
      v = { c, shadow, body, label, flames, hpBack, hpFill, burn, slow, kindClass: 'actor', ...PD.Anim.newSlots() };
    }
    v.shadowSX = PD.TEX_SCALE * (size.w * 1.15) / 96;
    v.shadow.setScale(v.shadowSX, PD.TEX_SCALE * 0.9);
    for (let i = 0; i < v.flames.length; i++) v.flames[i].setVisible(false);
    Object.assign(v, {
      id, active: true, w: size.w, h: size.h, isEnemy, foot, seen: true,
      flash: 0, land: 0, dying: 0, gone: false, defeated: false, homed: false, seed: id * 1.7, emberT: 0,
      lane: 0, kind: '',
      charge: 0, relT: -1, relDur: 0, relStrike: null, hurtT: 0, swing: 0, lastHitTick: -999, lastGen: -1,
      walking: 0, lastContact: 0, lastBlockedId: 0,
      walkBlend: 0, walkPhase: id * 1.7, walkStep: Math.floor(id * 1.7 / Math.PI), stepped: false, stopT: 0,
      breath: 0, actRate: 1, walkRate: 1, slowed: false, burning: false, flamesOn: false, tintNow: 0, dropT: 0,
      baseFrame: frame, idleFrames: 0, idleMs: 0, idleT: 0, idleShown: -1,
    });
    v.shadow.x = 0;
    v.body.setFrame(frame).clearTint().setScale(PD.TEX_SCALE).setPosition(0, 0).setRotation(0).setAlpha(1);
    v.label.setText(name).setPosition(0, -size.h * 0.5);
    v.hpBack.setPosition(0, -size.h - 8);
    v.hpFill.setPosition(-26, -size.h - 8).setScale(PD.TEX_SCALE, PD.TEX_SCALE);
    v.burn.setPosition(-22, -size.h - 24).setVisible(false);
    v.slow.setPosition(22, -size.h - 24).setVisible(false);
    v.c.setAlpha(1).setVisible(true).setRotation(0);
    this.views.push(v);
    this.viewById.set(id, v);
    return v;
  }

  acquireOrb(id) {
    let v = this.orbPool.pop();
    if (!v) {
      const c = this.add.container(0, 0).setDepth(300);
      const glow = this.add.image(0, 0, 'atlas', 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd84a).setScale(1.6 * PD.TEX_SCALE);
      const orb = PD.img(this, 0, 0, 'orb');
      c.add([glow, orb]);
      v = { c, glow, orb, kindClass: 'orb' };
    }
    Object.assign(v, { id, active: true, seen: true, dying: 0, gone: false, defeated: false, homed: false, flash: 0 });
    v.c.setVisible(true).setAlpha(1);
    this.views.push(v);
    this.viewById.set(id, v);
    return v;
  }

  releaseView(index) {
    const v = this.views[index];
    this.views.splice(index, 1);
    this.viewById.delete(v.id);
    v.active = false;
    v.c.setVisible(false);
    (v.kindClass === 'orb' ? this.orbPool : this.actorPool).push(v);
  }

  clearAllViews() {
    for (let i = this.views.length - 1; i >= 0; i--) this.releaseView(i);
  }

  // ===== 主迴圈 =====
  update(time, delta) {
    if (this.pausedBy) return;
    const dt = Math.min(delta, 100) / 1000;
    this.clock += dt;
    // 跳出提示或結算時戰鬥已停，慶祝動畫維持正常速度
    const worldDt = dt * (this.overlay.visible ? 1 : this.gameSpeed);
    this.worldClock += worldDt;
    this.frameDt = worldDt;
    const sim = this.sim;
    if (!this.overlay.visible) {
      this.accum += dt * this.cfg.debug.timeScale * this.gameSpeed;
      const tick = this.cfg.rules.tickSeconds;
      while (this.accum >= tick) {
        this.accum -= tick;
        sim.step();
      }
    }
    this.drainEvents();
    if (this.hintSwapTick && sim.state.tick >= this.hintSwapTick) {
      this.hintSwapTick = 0;
      if (this.hintText.text === PD.text.autoCollect) this.showHint(PD.text.inRangeHint);
    }
    this.syncViews(this.accum / this.cfg.rules.tickSeconds);
    this.updateHud(dt);
    this.fx.update(worldDt);
    this.updateQuality(delta);
  }

  drainEvents() {
    const list = this.sim.events;
    for (let i = 0; i < list.length; i++) this.handleEvent(list[i]);
    list.length = 0;
  }

  handleEvent(ev) {
    const v = ev.id ? this.viewById.get(ev.id) : null;
    switch (ev.type) {
      case 'placed':
        PD.Sound.play('place');
        this.setSelected(null);
        this.refreshPrepHint();
        this.pendingLandId = ev.id;
        break;
      case 'placeFail':
        if (ev.reason === 'orbs') this.showHint(PD.text.needMoreOrbs);
        if (ev.reason === 'limit') this.showHint(PD.text.trainerLimit);
        break;
      case 'battleStart':
        this.showHint(PD.text.autoCollect);
        this.hintSwapTick = this.sim.state.tick + this.sim.ticks(4);
        break;
      case 'wave':
        if (this.sim.mode.autoWaveHint) this.showWaveHint(ev);
        break;
      case 'shot': this.onShot(ev); break;
      case 'burn': {
        const t = this.viewById.get(ev.targetId);
        if (t) {
          t.flash = 0.08;
          this.fx.burst('spark', t.c.x, t.c.y - t.h * 0.5, 0xff8a3c, 6, 90, 0.35, 0.6, 0.1, -60);
        }
        break;
      }
      case 'enemyDown':
        if (v) { v.defeated = true; }
        break;
      case 'enemyHome':
        if (v) { v.homed = true; }
        PD.Sound.play('home');
        this.fx.shake();
        this.showHint(PD.text.rescued);
        break;
      case 'unitHit':
        if (v) {
          v.flash = 0.1;
          PD.Anim.hurt(v, PD.Anim.styleOf(v.kind));
          PD.Sound.play('bump');
          this.fx.burst('spark', v.c.x, v.c.y - v.h * 0.5, 0xffffff, 6, 90, 0.25, 0.5, 0.1);
        }
        break;
      case 'unitGone':
        if (v) v.gone = true;
        if (this.recalling) this.onRecallUnitLost(ev.id);
        break;
      case 'unitRecalled':
        if (v) {
          v.gone = true;
          this.fx.flyToCounter(v.c.x, v.c.y - v.h * 0.5, this.L.orbCounter.x, this.L.orbCounter.y);
        }
        this.ballBump = 0.2;
        PD.Sound.play('collect');
        this.exitRecall();
        this.showHint(PD.text.recallDone(PD.names[ev.kind]));
        this.refreshPrepHint();
        break;
      case 'orbCollected':
        if (v) {
          this.fx.flyToCounter(v.c.x, v.c.y, this.L.orbCounter.x, this.L.orbCounter.y);
          this.ballBump = 0.2;
          PD.Sound.play('collect');
        }
        break;
      case 'won': this.exitRecall(); this.onWon(); break;
      case 'failed': this.exitRecall(); this.onFailed(); break;
      case 'restored':
        this.clearAllViews();
        PD.Sound.startMusic();
        this.restoring = true;
        this.overlay.hide();
        this.exitRecall();
        this.setSelected(null);
        this.accum = 0;
        this.hintSwapTick = 0;
        this.refreshPrepHint();
        break;
      default: break;
    }
  }

  onShot(ev) {
    const shooter = this.viewById.get(ev.unitId);
    const target = this.viewById.get(ev.targetId);
    if (!shooter || !target) return;
    const def = this.cfg.units[shooter.kind];
    const style = PD.Anim.styleOf(shooter.kind);
    // 雙擊：上一下剛打完才算第二下（第二下落空時，下一輪仍從第一下開始）
    const tick = this.sim.state.tick;
    const second = !!def.secondHitDelay && shooter.swing === 1 &&
      tick - shooter.lastHitTick <= this.sim.ticks(def.secondHitDelay) + 2;
    shooter.swing = second ? 2 : 1;
    shooter.lastHitTick = tick;
    const strike = PD.Anim.release(shooter, style, second);
    const m = PD.Anim.muzzle(shooter, strike);
    PD.Sound.play('shot_' + ev.fx);
    this.fx.fire(ev.fx, m.x, m.y, target);
    if (ev.fx !== 'vine' && !this.fx.reduced) this.fx.glowPop(m.x, m.y, PD.Fx.COLORS[ev.fx], 0.45, 0.12);
  }

  // 蓄力進度 0～1：讀規則裡下一次出手的時間，讓蓄力剛好在出手那一刻結束
  chargeProgress(u, def, style) {
    const s = this.sim.state;
    if (!style.windup || s.phase !== 'battle') return 0;
    if (!def.genEvery && !u.targetId) return 0;
    const next = def.genEvery ? u.genNext : u.fireTick;
    const left = (next - s.tick) * this.cfg.rules.tickSeconds - this.accum;
    return left > 0 && left < style.windup ? 1 - left / style.windup : 0;
  }

  showWaveHint(ev) {
    const y = this.laneY(ev.lane);
    this.foot.setPosition(this.ruleToX(10), y).setVisible(true);
    this.overlay.show(PD.text.waveHintTitle(ev.lane), '', [
      { label: PD.text.resume, fn: () => { this.overlay.hide(); this.foot.setVisible(false); this.sim.command({ type: 'continue' }); } },
    ]);
  }

  onWon() {
    this.fx.shake();
    this.fx.confetti(this.L.width);
    PD.Sound.stopMusic();
    PD.Sound.play('win');
    this.overlay.show(PD.text.winTitle, PD.text.winMsg, [
      { label: PD.text.playAgain, fn: () => this.sim.restart() },
    ]);
  }

  onFailed() {
    PD.Sound.stopMusic();
    PD.Sound.play('lose');
    this.overlay.show(PD.text.failTitle, PD.text.failMsg, [
      { label: PD.text.retryWave, fn: () => this.sim.retryWave() },
      { label: PD.text.restart, fn: () => this.sim.restart() },
    ]);
  }

  // 把狀態同步到畫面
  syncViews(alpha) {
    const s = this.sim.state;
    for (let i = 0; i < this.views.length; i++) this.views[i].seen = false;

    for (let i = 0; i < s.units.length; i++) this.syncUnit(s.units[i]);
    for (let i = 0; i < s.enemies.length; i++) this.syncEnemy(s.enemies[i], alpha);
    for (let i = 0; i < s.orbs.length; i++) this.syncOrb(s.orbs[i], alpha);
    this.restoring = false;

    for (let i = this.views.length - 1; i >= 0; i--) {
      const v = this.views[i];
      if (!v.seen && this.endView(v, i)) continue;
    }
    this.pendingLandId = 0;
  }

  // 回傳 true 表示已回收
  endView(v, index) {
    if (v.kindClass === 'orb') { this.releaseView(index); return true; }
    if (v.defeated) {
      if (v.dying === 0) { v.dying = 0.13; return false; }
      v.dying -= this.frameDt;
      if (v.dying > 0) return false;
      this.fx.starBurst(v.c.x, v.c.y - v.h * 0.5);
      PD.Sound.play('star');
      if (v.kind === 'armored') this.fx.shake();
      this.releaseView(index);
      return true;
    }
    if (v.gone) {
      // 揮手休息：往上飄並輕輕左右擺
      if (v.dying === 0) v.dying = 0.6;
      v.dying -= this.frameDt;
      v.c.rotation = Math.sin(v.dying * 18) * 0.15;
      v.c.y -= 42 * this.frameDt;
      v.c.alpha = Math.max(0, v.dying / 0.6);
      if (v.dying > 0) return false;
      this.releaseView(index);
      return true;
    }
    if (v.homed) this.fx.glowPop(v.c.x, v.c.y - 40, 0x9ad8ff, 1, 0.35);
    this.releaseView(index);
    return true;
  }

  syncUnit(u) {
    let v = this.viewById.get(u.id);
    const def = this.cfg.units[u.kind];
    if (!v) {
      v = this.acquireActor(u.id, 'unit_' + u.kind, PD.names[u.kind], def.size, this.footY(u.lane), false);
      v.kind = u.kind;
      if (this.textures.exists('art_' + u.kind)) v.label.setText(''); // 有貼圖就不在身上蓋字
      if (def.idleSheet && this.textures.exists('idle_' + u.kind)) {
        v.idleFrames = def.idleSheet.frames;
        v.idleMs = def.idleSheet.frameMs;
      }
      v.c.setDepth(20 + u.lane * 10);
      v.c.setPosition(this.ruleToX(u.col), v.foot);
      if (u.id === this.pendingLandId && !this.restoring) {
        v.land = 0.38;
        this.fx.landPuff(v.c.x, v.foot, def.color);
      }
    }
    v.seen = true;
    const style = PD.Anim.styleOf(u.kind);
    if (def.genEvery) {
      // 產球沒有專屬事件，看下一次產球時間有沒有往後跳
      if (v.lastGen >= 0 && u.genNext !== v.lastGen) PD.Anim.release(v, style, false);
      v.lastGen = u.genNext;
    }
    this.animateActor(v, u.hp, u.maxHp, 0, style, this.chargeProgress(u, def, style));
    if (v.idleFrames) this.updateIdleFrame(v);
  }

  // 待機時逐格播放；蓄力和出手時換回原本的靜態圖，讓原有的攻擊動作照舊
  updateIdleFrame(v) {
    v.idleT += this.frameDt * 1000;
    const attacking = v.relT >= 0 || v.charge > 0;
    const shown = attacking ? -1 : Math.floor(v.idleT / v.idleMs) % v.idleFrames;
    if (shown === v.idleShown) return;
    v.idleShown = shown;
    v.body.setFrame(shown < 0 ? v.baseFrame : v.baseFrame + '_idle' + shown);
  }

  syncEnemy(e, alpha) {
    let v = this.viewById.get(e.id);
    const def = this.cfg.enemies[e.kind];
    if (!v) {
      v = this.acquireActor(e.id, 'enemy_' + e.kind, PD.names[e.kind], def.size, this.footY(e.lane), true);
      v.kind = e.kind;
      if (this.textures.exists('art_' + e.kind)) v.label.setText(''); // 有貼圖就不在身上蓋字
      v.c.setDepth(25 + e.lane * 10);
    }
    v.seen = true;
    const x = e.px + (e.x - e.px) * alpha;
    v.c.setPosition(this.ruleToX(x), v.foot);
    const burning = e.burnNext >= 0;
    const slowed = e.slowEnd > this.sim.state.tick;
    v.burn.setVisible(burning);
    v.slow.setVisible(slowed);
    v.burning = burning;
    v.slowed = slowed;
    // 只影響動作快慢的外觀；實際走速仍由規則計算
    v.actRate = slowed ? e.slowFactor : 1;
    v.walkRate = this.sim.mode.speedMul * v.actRate;
    const running = !this.overlay.visible; // 跳出提示時戰鬥停住，動作和粒子也要停
    if (running) this.emitStatusFx(v);

    const style = PD.Anim.styleOf(e.kind);
    if (e.blockedId && !v.lastBlockedId && !this.restoring) {
      PD.Anim.brake(v);
      this.fx.dust(v.c.x + v.w * 0.25, v.foot, style.walk.dust * 1.2);
    }
    // 接觸計時歸零、擋路的還是同一位，代表這一刻出手了（規則沒有敵人出手的事件）
    if (e.blockedId && e.blockedId === v.lastBlockedId && e.contact < v.lastContact) {
      PD.Anim.release(v, style, false);
      this.fx.contactHit(v.c.x - v.w * 0.5, v.c.y - v.h * 0.5);
    }
    v.lastContact = e.contact;
    v.lastBlockedId = e.blockedId;
    this.animateActor(v, e.hp, e.maxHp, !e.blockedId && running ? 1 : 0, style, this.enemyCharge(e, style, v));
    if (v.stepped) {
      v.stepped = false;
      this.fx.dust(v.c.x + v.w * 0.25, v.foot, style.walk.dust);
    }
  }

  // 燃燒的小火星、變慢的水滴（各自有間隔，不是每格畫面都出）
  emitStatusFx(v) {
    const dt = this.frameDt;
    if (v.burning) {
      v.emberT -= dt;
      if (v.emberT <= 0) {
        v.emberT = 0.2;
        this.fx.ember(v.c.x + (Math.random() - 0.5) * v.w * 0.5, v.c.y - Math.random() * v.h * 0.7);
      }
    }
    if (v.slowed) {
      v.dropT -= dt;
      if (v.dropT <= 0) {
        v.dropT = 0.3;
        this.fx.drip(v.c.x + (Math.random() - 0.5) * v.w * 0.6, v.c.y - v.h * (0.5 + Math.random() * 0.4));
      }
    }
  }

  // 敵人的蓄力進度 0～1，只讀規則的接觸計時；變慢時蓄力拉長，但出手時間仍照規則
  enemyCharge(e, style, v) {
    if (!e.blockedId || this.sim.state.phase !== 'battle') return 0;
    const R = this.cfg.rules;
    const windup = style.windup / v.actRate;
    const left = (this.sim.ticks(R.enemyContactEvery) - e.contact) * R.tickSeconds - this.accum;
    return left > 0 && left < windup ? 1 - left / windup : 0;
  }

  // 燃燒時身上的小火苗：圖片跟著角色一起建立，這裡只改位置和大小
  updateFlames(v, offX, offY) {
    if (!v.burning && !v.flamesOn) return;
    v.flamesOn = v.burning;
    const count = this.fx.reduced ? 1 : FLAME_SPOTS.length;
    for (let i = 0; i < FLAME_SPOTS.length; i++) {
      const f = v.flames[i];
      const show = v.burning && i < count;
      f.setVisible(show);
      if (!show) continue;
      const S = FLAME_SPOTS[i];
      const k = 1 + Math.sin(this.worldClock * (11 + i * 3) + v.seed + i * 2) * 0.18;
      f.setPosition(offX + S[0] * v.w, offY + S[1] * v.h)
        .setScale(PD.TEX_SCALE * S[2] * (2 - k), PD.TEX_SCALE * S[2] * k);
    }
  }

  animateActor(v, hp, maxHp, walking, style, charge) {
    const dt = this.frameDt;
    let sx = 1;
    let sy = 1;
    v.walking = walking;
    const P = PD.Anim.compute(v, style, charge, dt, this.worldClock, this.cfg.debug.timeScale, this.fx.reduced);
    sx += P.sx; sy += P.sy;
    const rot = P.r;
    let offX = P.x;
    let offY = P.y;

    if (v.land > 0) {
      v.land -= dt;
      const k = Math.max(0, v.land / 0.38);
      offY -= Math.sin(k * Math.PI) * 26;
      sx += k * 0.12; sy -= k * 0.08;
    }
    if (v.flash > 0) {
      v.flash -= dt;
      v.body.setTintFill(0xffffff);
      v.tintNow = -1; // 閃白結束後重新套色
      offX += Math.sin(v.flash * 90) * 2;
    } else {
      const tint = v.slowed ? SLOW_TINT : 0;
      if (v.tintNow !== tint) {
        if (tint) v.body.setTint(tint); else v.body.clearTint();
        v.tintNow = tint;
      }
    }
    v.body.setScale(PD.TEX_SCALE * sx, PD.TEX_SCALE * sy).setPosition(offX, offY).setRotation(rot);
    v.shadow.x = offX * 0.6;
    if (v.isEnemy) {
      // 跳起來時影子變小，看起來真的離地
      const lift = Math.max(0.7, 1 + offY / 60);
      v.shadow.setScale(v.shadowSX * lift, PD.TEX_SCALE * 0.9 * lift);
      this.updateFlames(v, offX, offY);
    }
    // 色塊身上的名字跟著身體動（身體以腳底為軸傾斜）
    const half = v.h * 0.5;
    v.label.setPosition(offX + Math.sin(rot) * half, offY - Math.cos(rot) * half).setRotation(rot);
    const ratio = Math.max(0, hp / maxHp);
    v.hpFill.setScale(PD.TEX_SCALE * ratio, PD.TEX_SCALE)
      .setTint(ratio > 0.5 ? 0x7ee081 : ratio > 0.25 ? 0xffd84a : 0xff9a5a);
  }

  syncOrb(o, alpha) {
    let v = this.viewById.get(o.id);
    if (!v) v = this.acquireOrb(o.id);
    v.seen = true;
    const fall = this.sim.ticks(this.cfg.rules.orbFallSeconds);
    const k = Math.min(1, (o.age + alpha) / fall);
    const landY = this.laneY(o.lane) - 20;
    const topY = o.source === 'sky' ? this.L.grid.y - 10 : landY - 60;
    const x = this.ruleToX(o.x);
    v.c.setPosition(x, topY + (landY - topY) * (1 - (1 - k) * (1 - k)));
    v.orb.setY(k >= 1 ? Math.sin(this.worldClock * 4 + o.id) * 3 : 0);
    v.glow.setAlpha(k >= 1 ? 0.55 + Math.sin(this.worldClock * 5 + o.id) * 0.2 : 0.3);
    v.landX = x; v.landY = landY;
    v.collectable = o.age >= fall;
  }

  updateHud(dt) {
    const s = this.sim.state;
    const str = String(s.balls);
    if (this.ballText.text !== str) this.ballText.setText(str);
    if (this.ballBump > 0) this.ballBump -= dt;
    this.orbIcon.setScale(PD.TEX_SCALE * (1 + Math.max(0, this.ballBump) * 1.4));

    for (let i = 0; i < this.rescueIcons.length; i++) {
      this.rescueIcons[i].setFrame(i < s.rescues ? 'shieldUsed' : 'shield');
    }

    const cdTotal = this.sim.ticks(this.cfg.rules.placeCooldown);
    const cdRatio = s.placeCd / cdTotal;
    const pulse = 0.55 + Math.sin(this.clock * 6) * 0.35;
    const tut = this.tutorialKind();
    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i];
      if (!card.unlocked) continue;
      const afford = s.balls >= card.def.cost;
      card.pic.setAlpha(afford ? 1 : 0.45);
      card.badge.setTint(afford ? 0xd2571a : 0x7b828c);
      card.cd.setVisible(cdRatio > 0);
      if (cdRatio > 0) card.cd.setDisplaySize(card.rect.w, card.rect.h * cdRatio);
      const on = this.selected === card.kind || tut === card.kind;
      card.glow.setVisible(on);
      if (on) card.glow.setAlpha(this.selected === card.kind ? 0.9 : pulse);
      card.bg.y = card.rect.y + card.rect.h / 2 - (this.selected === card.kind ? 6 : 0);
    }

    const cellPulse = 0.26 + Math.sin(this.clock * 5) * 0.1;
    for (let i = 0; i < this.cellGlows.length; i++) {
      if (this.cellGlows[i].visible) this.cellGlows[i].setAlpha(cellPulse);
    }

    if (this.rangeTimer > 0) {
      this.rangeTimer -= dt;
      if (this.rangeTimer <= 0) this.hideRange();
    }
    if (this.foot.visible) this.foot.setAlpha(0.45 + Math.sin(this.clock * 5) * 0.35);
  }

  updateQuality(delta) {
    // 只調特效量，不影響戰鬥
    this.fpsFrames++;
    this.fpsTime += delta;
    if (this.fpsTime < 1000) return;
    const fps = (this.fpsFrames * 1000) / this.fpsTime;
    this.fpsFrames = 0;
    this.fpsTime = 0;
    if (this.fpsText) this.fpsText.setText(Math.round(fps) + ' fps');
    this.lowFor = fps < 40 ? this.lowFor + 1 : 0;
    if (this.lowFor >= 2) { this.fx.quality = fps < 30 ? 0.35 : 0.6; }
    else if (fps > 55) this.fx.quality = 1;
  }

  // ===== 教學提示 =====
  tutorialKind() {
    const s = this.sim.state;
    if (s.phase !== 'prep' || this.selected || this.recalling) return null;
    const need = this.sim.level.requiredToStart;
    for (let i = 0; i < need.length; i++) {
      if (this.sim.countUnits(need[i]) === 0) return need[i];
    }
    return null;
  }

  refreshPrepHint() {
    const s = this.sim.state;
    if (s.phase !== 'prep') {
      if (!this.selected) this.foot.setVisible(false);
      return;
    }
    const k = this.tutorialKind();
    if (this.selected) {
      this.showHint(PD.text.tapGlowCell);
    } else if (k) {
      this.showHint(k === 'trainer' ? PD.text.pickTrainer : PD.text.pickShooter);
      this.foot.setVisible(false);
    }
  }

  showHint(str) { this.hintText.setText(str); }

  // ===== 選卡與射程預覽 =====
  setSelected(kind) {
    this.selected = kind;
    this.updateCellGlows();
    this.hideRange();
    this.foot.setVisible(false);
    if (kind) {
      const spot = this.suggestedSpot(kind);
      const def = this.cfg.units[kind];
      if (spot) {
        this.foot.setPosition(this.ruleToX(spot.col), this.laneY(spot.lane)).setVisible(true);
        if (def.range) this.showRange(spot.lane, spot.col, def.range, 0);
      }
    }
    this.refreshPrepHint();
  }

  suggestedSpot(kind) {
    const t = this.sim.level.tutorial[kind];
    const lane = t ? t.lane : this.sim.level.openLanes[0];
    const col = t ? t.col : 6;
    return this.sim.unitAt(lane, col) ? null : { lane, col };
  }

  updateCellGlows() {
    const G = this.L.grid;
    let n = 0;
    for (let r = 1; r <= G.rows; r++) {
      for (let c = 1; c <= G.cols; c++) {
        const g = this.cellGlows[n++];
        const unit = this.sim.unitAt(r, c);
        const show = this.recalling ? !!unit : !!this.selected && this.sim.isLaneOpen(r) && !unit;
        g.setVisible(show);
        if (!show) continue;
        g.setPosition(this.ruleToX(c), this.laneY(r));
        if (!this.recalling) g.setTint(0xfff3b0);
        else g.setTint(unit.id === this.recallTargetId ? 0xff7a3c : 0xffc48a);
      }
    }
  }

  // ===== 請回角色：點「請回」→ 點角色 → 再點同一個角色 =====
  enterRecall() {
    if (this.sim.state.units.length === 0) { this.showHint(PD.text.recallNone); return; }
    this.setSelected(null);
    this.recalling = true;
    this.recallTargetId = 0;
    this.recallGlow.setVisible(true);
    this.recallLabel.setVisible(false);
    this.updateCellGlows();
    this.showHint(PD.text.recallPick);
  }

  exitRecall() {
    if (!this.recalling) return;
    this.recalling = false;
    this.recallTargetId = 0;
    this.recallGlow.setVisible(false);
    this.recallLabel.setVisible(false);
    this.updateCellGlows();
    this.showHint('');
    this.refreshPrepHint();
  }

  tapRecallCell(unit) {
    if (!unit) {
      this.recallTargetId = 0;
      this.recallLabel.setVisible(false);
      this.updateCellGlows();
      this.showHint(PD.text.recallPick);
      return;
    }
    if (unit.id === this.recallTargetId) {
      if (this.clock - this.recallArmedAt >= this.L.recallGuardSeconds) {
        this.sim.command({ type: 'recall', id: unit.id });
      }
      return;
    }
    PD.Sound.play('tap');
    this.recallTargetId = unit.id;
    this.recallArmedAt = this.clock;
    this.recallLabel.setPosition(this.ruleToX(unit.col), this.laneY(unit.lane) + 10).setVisible(true);
    this.updateCellGlows();
    this.showHint(PD.text.recallConfirm(PD.names[unit.kind], this.cfg.units[unit.kind].cost));
  }

  // 請回途中，有角色被敵人打敗
  onRecallUnitLost(id) {
    if (this.sim.state.units.length === 0) { this.exitRecall(); return; }
    if (id === this.recallTargetId) {
      this.recallTargetId = 0;
      this.recallLabel.setVisible(false);
      this.showHint(PD.text.recallPick);
    }
    this.updateCellGlows();
  }

  showRange(lane, col, range, seconds) {
    for (let i = 0; i < this.rangeImgs.length; i++) {
      const on = i < range;
      this.rangeImgs[i].setVisible(on);
      if (on) this.rangeImgs[i].setPosition(this.ruleToX(col + 1 + i), this.laneY(lane));
    }
    this.rangeTimer = seconds;
  }

  hideRange() {
    this.rangeTimer = 0;
    for (let i = 0; i < this.rangeImgs.length; i++) this.rangeImgs[i].setVisible(false);
  }

  // ===== 點擊處理（所有輸入都走這裡，不靠滑鼠移過）=====
  onTap(x, y) {
    if (this.pausedBy) {
      if (this.pausedBy !== 'portrait') this.overlay.tap(x, y);
      return;
    }
    if (this.overlay.visible) { this.overlay.tap(x, y); return; }
    if (this.tapOrb(x, y)) return;
    const L = this.L;
    if (PD.hitRect(L.pauseBtn, x, y)) { PD.Sound.play('tap'); this.freeze('user'); return; }
    if (PD.hitRect(L.muteBtn, x, y)) { this.toggleMute(); return; }
    if (PD.hitRect(L.speedBtn, x, y)) { this.cycleSpeed(); return; }
    if (PD.hitRect(L.cancelBtn, x, y)) { PD.Sound.play('tap'); this.exitRecall(); this.setSelected(null); return; }
    if (PD.hitRect(L.recallBtn, x, y)) {
      PD.Sound.play('tap');
      if (this.recalling) this.exitRecall(); else this.enterRecall();
      return;
    }
    for (let i = 0; i < this.cards.length; i++) {
      if (PD.hitRect(this.cards[i].rect, x, y)) { this.tapCard(this.cards[i]); return; }
    }
    this.tapGrid(x, y);
  }

  tapOrb(x, y) {
    const half = this.L.orbHitSize / 2;
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < this.views.length; i++) {
      const v = this.views[i];
      if (v.kindClass !== 'orb' || !v.collectable) continue;
      const dx = Math.abs(v.landX - x);
      const dy = Math.abs(v.landY - y);
      if (dx <= half && dy <= half && dx + dy < bestD) { best = v; bestD = dx + dy; }
    }
    if (!best) return false;
    this.sim.command({ type: 'collect', id: best.id });
    return true;
  }

  tapCard(card) {
    PD.Sound.play('tap');
    this.exitRecall();
    const s = this.sim.state;
    if (!card.unlocked) { this.showHint(PD.text.lockedCard(card.def.unlock)); return; }
    if (this.selected === card.kind) { this.setSelected(null); return; }
    if (s.balls < card.def.cost) { this.showHint(PD.text.needMoreOrbs); return; }
    this.setSelected(card.kind);
  }

  tapGrid(x, y) {
    const G = this.L.grid;
    if (x < G.x || x >= G.x + G.cols * G.cellW || y < G.y || y >= G.y + G.rows * G.cellH) return;
    const col = Math.floor((x - G.x) / G.cellW) + 1;
    const lane = Math.floor((y - G.y) / G.cellH) + 1;
    if (!this.sim.isLaneOpen(lane)) { this.showHint(PD.text.restLane); return; }
    const occupant = this.sim.unitAt(lane, col);
    if (this.recalling) { this.tapRecallCell(occupant); return; }
    if (occupant) {
      if (this.selected) { this.showHint(PD.text.occupied); return; }
      const def = this.cfg.units[occupant.kind];
      if (def.range) this.showRange(lane, col, def.range, 2);
      return;
    }
    if (!this.selected) { this.showHint(PD.text.pickCardFirst); return; }
    this.sim.command({ type: 'place', kind: this.selected, lane, col });
  }

  get gameSpeed() { return this.cfg.speedSteps[this.speedIndex]; }

  cycleSpeed() {
    this.speedIndex = (this.speedIndex + 1) % this.cfg.speedSteps.length;
    this.speedText.setText(PD.text.speedLabel(this.gameSpeed));
    PD.Sound.play('tap');
  }

  toggleMute() {
    PD.Sound.cycleVolume();
    this.muteIcon.setFrame(PD.Sound.icon);
    PD.Sound.play('tap');
  }

  // ===== 暫停、切分頁、轉向 =====
  freeze(reason) {
    if (this.pausedBy === 'portrait' || this.pausedBy === reason) return;
    // 已經結束時不暫停，以免蓋掉勝利／失敗畫面
    const phase = this.sim.state.phase;
    if (phase === 'won' || phase === 'failed') return;
    this.pausedBy = reason;
    if (reason !== 'portrait') this.showPauseOverlay();
  }

  showPauseOverlay() {
    const T = PD.text;
    const label = () => (PD.settings.reduceFx ? T.reduceFxOn : T.reduceFxOff);
    this.overlay.show(T.pauseTitle, '', [
      { label: T.resume, fn: () => this.resume() },
      { label: label(), fn: () => { PD.settings.reduceFx = !PD.settings.reduceFx; this.overlay.relabel(1, label()); } },
      { label: T.restart, fn: () => { this.pausedBy = null; this.sim.restart(); this.drainEvents(); } },
    ]);
  }

  resume() {
    this.pausedBy = null;
    this.overlay.hide();
    this.accum = 0;
    // 從暫停回來時，若剛好在波次提示要重新顯示
    if (this.sim.state.waitingHint) {
      const next = this.sim.level.script[this.sim.state.nextSpawn];
      this.showWaveHint({ lane: next.lane });
    }
  }

  checkOrientation() {
    PD.updateTurnHint();
    const portrait = PD.isPortrait();
    if (portrait && this.pausedBy !== 'portrait') {
      this.pausedBy = 'portrait';
    } else if (!portrait && this.pausedBy === 'portrait') {
      // 轉回橫向後要按「繼續」才開始
      this.pausedBy = null;
      this.freeze('user');
    }
  }
};
