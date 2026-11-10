// 戰鬥畫面：把規則算出來的狀態演出來，並接收點擊。
window.PD = window.PD || {};

// 敵人被變慢時的身體色調（貼圖和色塊都用乘色）
const SLOW_TINT = 0x8fc8ff;
// 燃燒小火苗在身上的位置：[相對身寬, 相對身高, 大小]，都在腳以上，不蓋住接觸點
const FLAME_SPOTS = [[-0.26, -0.3, 0.8], [0.24, -0.52, 0.95], [0.02, -0.72, 0.75]];

PD.BattleScene = class BattleScene extends Phaser.Scene {
  constructor() { super('Battle'); }

  init(data) {
    this.modeId = data.mode || 'solo';
    this.levelIndex = data.level || 0;
  }

  create() {
    PD.setupCamera(this);
    const cfg = PD.config;
    this.cfg = cfg;
    this.L = cfg.layout;
    this.sim = new PD.BattleSim(cfg, this.levelIndex, this.modeId);
    this.fx = new PD.Fx(this, cfg);
    this.skillFx = new PD.SkillFx(this, cfg);
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
    this.speedIndex = PD.settings.speedIndex; // 換關時沿用目前倍率
    this.hintSwapAt = 0;
    this.restoring = false;
    this.fpsTime = 0; this.fpsFrames = 0; this.lowFor = 0;

    this.add.image(0, 0, PD.levelBackground(this, cfg, this.sim.level)).setOrigin(0).setScale(PD.TEX_SCALE).setDepth(0);
    // 隊長登場前，出怪區那一條路輕輕脈衝（不是整個畫面閃）
    this.bossWarnImg = PD.img(this, 0, 0, 'white').setDepth(8).setVisible(false).setTint(0xff9ad8)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.views = [];
    this.viewById = new Map();
    this.actorPool = [];
    this.orbPool = [];
    this.buildGridHelpers();
    this.buildHud();
    this.buildCards();
    this.buildSkillBar();
    this.introDone = new Set();
    this.introKind = '';
    this.skillOrbFloat = false;
    this.skillHinted = false;
    // 用到才建立的圖：換關或重來時 Phaser 會沿用同一個場景、舊圖已被清掉，要歸零才會重建
    // （以前第二次進戰鬥後，新朋友／新敵人的介紹圖和「+50」飄字都不見）
    this.introPic = null;
    this.introArt = null;
    this.plusText = null;
    this.skillTipQueue = [];
    this.skillTipKind = '';
    this.newCards = new Set(); // 新朋友提示看過、還沒放過的卡：卡片慢慢發亮
    this.hintClearAt = 0;
    this.buildSpot();

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
    this.queueFriendTips();
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
    // 預覽格數要夠最遠的射程用，改射程時才不會少畫
    const maxRange = Math.max(...Object.values(this.cfg.units).map((u) => u.range || 0));
    for (let i = 0; i < maxRange; i++) {
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

    // 按鈕底圖與上面的圖示／字：按下時一起往下（PD.press）
    this.pressables = [];
    const squareBtn = (r, icon) => {
      const bg = PD.img(this, r.x + r.w / 2, r.y + r.h / 2, 'btnSquare').setDepth(400);
      const top = PD.img(this, r.x + r.w / 2, r.y + r.h / 2, icon).setDepth(401);
      this.pressables.push({ r, bg, extras: [top] });
      return top;
    };
    this.muteIcon = squareBtn(L.muteBtn, PD.Sound.icon);
    squareBtn(L.pauseBtn, 'iconPause');
    const speedBg = PD.img(this, L.speedBtn.x + L.speedBtn.w / 2, L.speedBtn.y + L.speedBtn.h / 2, 'btnSquare').setDepth(400);
    this.speedText = PD.txt(this, L.speedBtn.x + L.speedBtn.w / 2, L.speedBtn.y + L.speedBtn.h / 2,
      PD.text.speedLabel(this.gameSpeed), 34).setDepth(401);
    this.pressables.push({ r: L.speedBtn, bg: speedBg, extras: [this.speedText] });

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
        .setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setScale(PD.TEX_SCALE * (C.w / 136), PD.TEX_SCALE);
      const bg = PD.img(this, cx, cy, unlocked ? 'card_' + kind : 'cardLocked').setDepth(400);
      // 買得起：亮黃邊慢慢呼吸；買不起：名牌與價格徽章變灰（docs/beautify-top5-v1.md 第 1 項）
      const edge = PD.img(this, cx, cy, 'cardEdge').setDepth(401).setTint(0xffe84a).setVisible(false);
      const plate = PD.img(this, cx, C.y + 102.5, 'cardPlate').setDepth(401).setTint(0xb0b6be).setVisible(false);
      // 價格徽章在左上角、角色圖靠右，兩者不重疊；鎖住的卡沒有徽章，圖放中間
      // 有卡片特寫（assets/local-art/card-<代號>.png）時填滿整個頭像窗（窗的中心就是卡片中心），徽章蓋在左上角
      const face = this.textures.get('atlas').has('cardFace_' + kind);
      const picX = face || !unlocked ? cx : x + C.w - 34;
      const picY = face ? C.y + 49 : C.y + 47;
      const pic = PD.img(this, picX, picY, (face ? 'cardFace_' : 'cardPic_') + kind).setDepth(401);
      const name = PD.txt(this, cx, C.y + 102, PD.names[kind], 20, '#2a2a2a', 0).setDepth(402);
      const badge = PD.img(this, x + 34, C.y + 25, 'costBadge').setDepth(402).setTint(0xd2571a).setScale(PD.TEX_SCALE * 0.84);
      const coin = PD.img(this, x + 15, C.y + 25, 'orb').setDepth(403).setScale(PD.TEX_SCALE * 0.36);
      const cost = PD.txt(this, x + 25, C.y + 25, String(def.cost), 22, '#ffffff', 3).setOrigin(0, 0.5).setDepth(403);
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
      return { kind, rect: { x, y: C.y, w: C.w, h: C.h }, def, bg, pic, picY, name, badge, cost, coin, glow, cd, lockImg, unlocked, edge, plate, pressT: 0, canBuy: null };
    });
    const B = this.L.recallBtn;
    const bx = B.x + B.w / 2;
    const by = B.y + B.h / 2;
    this.recallGlow = PD.img(this, bx, by, 'cardGlow').setDepth(399).setTint(0xfff176)
      .setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    const recallBg = PD.img(this, bx, by, 'recall').setDepth(400);
    const recallIcon = PD.img(this, bx, by - 14, 'iconRecall').setDepth(401);
    const recallText = PD.txt(this, bx, B.y + B.h - 26, PD.text.recall, 24).setDepth(401);
    this.pressables.push({ r: B, bg: recallBg, extras: [recallIcon, recallText] });
    this.recallLabel = PD.txt(this, 0, 0, PD.text.recallAgainLabel, 22, '#ffe9a8', 4).setDepth(410).setVisible(false);
    const R = this.L.cancelBtn;
    this.cancelBg = PD.img(this, R.x + R.w / 2, R.y + R.h / 2, 'cancel').setDepth(400);
    this.cancelIcon = PD.img(this, R.x + R.w / 2, R.y + R.h / 2 - 12, 'iconCancel').setDepth(401);
    this.cancelText = PD.txt(this, R.x + R.w / 2, R.y + R.h - 26, PD.text.cancel, 22).setDepth(401);
    this.pressables.push({ r: R, bg: this.cancelBg, extras: [this.cancelIcon, this.cancelText] });
  }

  // ===== 常駐技能圖示列 =====
  // 每種角色一顆，順序同卡片列；本關還沒解鎖的不畫，位置固定不跳動
  buildSkillBar() {
    const B = this.L.skillBar;
    this.skillSweep = this.add.graphics().setDepth(402);
    this.skillSlots = this.cfg.cardOrder.filter((k) => this.cfg.skills[k]).map((kind, i) => {
      const y = B.firstY + i * B.gap;
      const enabled = this.sim.isUnlocked(kind);
      const glow = this.add.image(B.x, y, 'atlas', 'glow').setDepth(399).setBlendMode(Phaser.BlendModes.ADD)
        .setTint(parseInt(this.cfg.skills[kind].bar[1].slice(1), 16)).setScale(PD.TEX_SCALE * (B.size * 1.5) / 96).setVisible(false);
      const ring = this.add.image(B.x, y, 'atlas', 'ring').setDepth(404).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
      const base = PD.img(this, B.x, y, 'skillLocked').setDepth(400).setVisible(enabled);
      const art = PD.img(this, B.x, y, 'skillArt_' + kind).setDepth(401).setVisible(false);
      const lock = PD.img(this, B.x, y, 'lock').setDepth(401).setScale(PD.TEX_SCALE * 0.6).setVisible(enabled);
      // 冷卻秒數放在圖示下緣的深色小牌子上，不再壓住圖案（只畫一次，跟著數字一起顯示／隱藏）
      const secsBg = this.add.graphics({ x: B.x, y: y + B.size / 2 - 6 }).setDepth(403).setVisible(false);
      secsBg.fillStyle(0x1d2a3a, 0.92).fillRoundedRect(-19, -11, 38, 22, 11);
      secsBg.lineStyle(2, 0xffffff, 0.9).strokeRoundedRect(-19, -11, 38, 22, 11);
      const secs = PD.txt(this, B.x, y + B.size / 2 - 6, '', 17, '#ffffff', 3).setDepth(404).setVisible(false);
      const rect = { x: B.x - B.hit / 2, y: y - B.hit / 2, w: B.hit, h: B.hit };
      return { kind, x: B.x, y, enabled, glow, ring, base, art, lock, secs, secsBg, rect, state: '', shown: -1, readyAt: 0, popT: 0, pressT: 0, ringT: 0 };
    });
  }

  updateSkillBar(dt) {
    const g = this.skillSweep;
    g.clear();
    const reduced = this.fx.reduced;
    const battle = this.sim.state.phase === 'battle';
    for (let i = 0; i < this.skillSlots.length; i++) {
      const s = this.skillSlots[i];
      if (!s.enabled) continue;
      const onField = this.sim.countUnits(s.kind) > 0;
      const left = onField ? this.sim.skillLeft(s.kind) : 0;
      const state = !onField ? 'locked' : (left <= 0 && battle ? 'ready' : 'cool');
      if (state !== s.state) this.setSkillState(s, state, reduced);

      s.popT = Math.max(0, s.popT - dt);
      s.pressT = Math.max(0, s.pressT - dt);
      let scale = 1;
      if (!reduced && s.popT > 0) scale = 1 + 0.15 * Math.sin(Math.PI * (1 - s.popT / 0.3));
      if (!reduced && s.pressT > 0) scale = 1 - 0.1 * Math.sin(Math.PI * (1 - s.pressT / 0.18));
      s.base.setScale(PD.TEX_SCALE * scale);

      if (s.ringT > 0) {
        s.ringT = Math.max(0, s.ringT - dt);
        const p = 1 - s.ringT / 0.4;
        s.ring.setVisible(s.ringT > 0).setAlpha(0.8 * (1 - p)).setScale(PD.TEX_SCALE * (this.L.skillBar.size / 2 / 44) * (1 + 0.4 * p));
      }

      if (state === 'ready') {
        s.glow.setVisible(!reduced);
        s.glow.setAlpha(0.75 + 0.25 * Math.sin(this.clock * Math.PI * 2 / 1.2)); // 每 1.2 秒呼吸一次（0.5～1），用真實時間
        const t = (this.clock - s.readyAt) % 3;
        const bounce = !reduced && t < 0.25 ? 1 + 0.08 * Math.sin(Math.PI * t / 0.25) : 1;
        s.art.setScale(PD.TEX_SCALE * scale * bounce);
      } else if (state === 'cool') {
        s.art.setScale(PD.TEX_SCALE * scale);
        const end = -Math.PI / 2 + (1 - left) * Math.PI * 2; // 從 12 點鐘順時針長滿＝已恢復的部分
        const R = this.L.skillBar.size / 2;
        g.fillStyle(0xffffff, 0.35);
        g.slice(s.x, s.y, (R - 6) * scale, -Math.PI / 2, end, false);
        g.fillPath();
        g.lineStyle(3, 0xffffff, 1);
        g.beginPath();
        g.arc(s.x, s.y, (R - 4) * scale, -Math.PI / 2, end, false);
        g.strokePath();
        if (this.sim.mode.showSkillSeconds) {
          const n = Math.ceil((this.sim.skillReadyAt(s.kind) - this.sim.state.tick) / this.sim.tps);
          if (n !== s.shown) { s.shown = n; s.secs.setText(String(n)); } // 只有數字變了才重畫文字
        }
      }
    }
  }

  setSkillState(s, state, reduced) {
    const was = s.state;
    s.state = state;
    s.glow.setVisible(false);
    s.lock.setVisible(state === 'locked');
    s.art.setVisible(state !== 'locked').setTint(state === 'cool' ? 0xbfc6cf : 0xffffff);
    s.secs.setVisible(state === 'cool' && this.sim.mode.showSkillSeconds);
    s.secsBg.setVisible(s.secs.visible);
    s.shown = -1;
    s.base.setFrame(state === 'locked' ? 'skillLocked' : (state === 'cool' ? 'skillDim_' : 'skillBase_') + s.kind);
    if (state !== 'ready') return;
    s.readyAt = this.clock;
    this.queueSkillTip(s.kind);
    if (was === 'cool') PD.Sound.play('skillReady'); // 聲音不受「減少特效」影響；靜音時本來就不響
    if (was === 'cool' && !reduced) { // 剛冷卻完成：彈一下、光環、星星
      s.popT = 0.3;
      s.ringT = 0.4;
      s.ring.setVisible(true);
      this.fx.burst('star', s.x, s.y, 0xfff3b0, 6, 130, 0.4, 0.5, 0.1);
    }
  }

  tapSkillBar(x, y) {
    for (let i = 0; i < this.skillSlots.length; i++) {
      const s = this.skillSlots[i];
      if (!s.enabled || !PD.hitRect(s.rect, x, y)) continue;
      PD.Sound.play('tap');
      if (!this.sim.countUnits(s.kind)) { this.showHint(PD.text.skillNoUnit(PD.names[s.kind]), 4); return true; }
      const caster = this.sim.skillCaster(s.kind);
      if (!caster) { this.showHint(PD.text.skillWait, 4); return true; }
      s.pressT = 0.18;
      this.sim.command({ type: 'skill', id: caster.id });
      PD.Sound.play('skill');
      if (this.spot.kind === 'nudge-' + s.kind) this.hideSpot(); // 放過招，就不用再指給孩子看
      this.hideRange();
      this.showHint('');
      return true;
    }
    return false;
  }

  // 新朋友第一次解鎖：進關卡時說一次。已過關重玩、同一次開啟遊戲重試都不再跳；debug.unlockAll 沒有「新解鎖」可言
  queueFriendTips() {
    PD.friendTipSeen = PD.friendTipSeen || new Set();
    const n = this.sim.level.number;
    this.friendQueue = [];
    this.friendKind = '';
    if (n === 1 || this.cfg.debug.unlockAll || PD.Progress.isCleared(this.modeId, n)) return;
    this.friendQueue = this.cfg.cardOrder.filter((k) => this.cfg.units[k].unlock === n && !PD.friendTipSeen.has(this.modeId + ':' + k));
    // 有特殊地形的關卡：新朋友之後再說一次這關的場地
    if (PD.text.levelTip[n] && !PD.friendTipSeen.has(this.modeId + ':terrain' + n)) this.friendQueue.push('terrain' + n);
    if (this.friendQueue.length) this.showFriendTip();
  }

  showFriendTip() {
    const kind = this.friendQueue[0];
    this.friendKind = kind;
    this.introKind = 'friend-' + kind; // 自動試玩靠 introKind 知道畫面在等人按鈕
    const terrain = kind.indexOf('terrain') === 0;
    const title = terrain ? PD.text.levelTipTitle : PD.text.newFriendTitle(PD.names[kind]);
    const desc = terrain ? PD.text.levelTip[this.sim.level.number] : PD.text.friendDesc[kind];
    this.overlay.show(title, desc, [{ label: PD.text.gotIt, fn: () => {
      PD.friendTipSeen.add(this.modeId + ':' + kind);
      if (!terrain) this.newCards.add(kind);
      this.friendQueue.shift();
      this.friendKind = '';
      this.introKind = '';
      if (this.introPic) this.introPic.setVisible(false);
      this.hideSpot();
      this.overlay.hide();
      if (this.friendQueue.length) this.showFriendTip();
    } }]);
    PD.Sound.play('tip');
    if (terrain) { this.hideSpot(); if (this.introPic) this.introPic.setVisible(false); return; }
    if (!this.introPic) this.introPic = PD.img(this, this.L.width / 2 - 230, 500, 'unit_' + kind).setDepth(501);
    this.introPic.setFrame('unit_' + kind).setVisible(true).setScale(PD.TEX_SCALE).setPosition(this.L.width / 2 - 230, 500);
    const card = this.cards.find((c) => c.kind === kind);
    if (card) this.showSpot('card-' + kind, card.rect, 'down', PD.text.spotCard, this.cardParts(card));
  }

  // ===== 新招式第一次能用：和新敵人提示同一套畫面，並把左邊那顆圖示亮出來 =====
  // 已過關重玩、同一次開啟遊戲看過、debug.unlockAll 都不再跳（和新朋友提示一樣）
  queueSkillTip(kind) {
    PD.friendTipSeen = PD.friendTipSeen || new Set();
    const key = this.modeId + ':skill:' + kind;
    if (this.cfg.debug.unlockAll || PD.friendTipSeen.has(key) || this.skillTipQueue.indexOf(kind) >= 0 || this.skillTipKind === kind) return;
    if (PD.Progress.isCleared(this.modeId, this.cfg.units[kind].unlock)) return;
    this.skillTipQueue.push(kind);
  }

  // 每一格畫面檢查一次：別的提示或暫停畫面還開著就先等
  pumpSkillTips() {
    if (!this.skillTipQueue.length || this.overlay.visible || this.pausedBy || this.sim.state.phase !== 'battle') return;
    this.showSkillTip(this.skillTipQueue.shift());
  }

  showSkillTip(kind) {
    this.skillTipKind = kind;
    this.introKind = 'skill-' + kind; // 自動試玩靠 introKind 知道畫面在等人按鈕
    this.overlay.show(PD.text.newSkillTitle(PD.names['skill_' + kind]), PD.text.skillDesc[kind], [{ label: PD.text.gotIt, fn: () => {
      PD.friendTipSeen.add(this.modeId + ':skill:' + kind);
      this.skillTipKind = '';
      this.introKind = '';
      this.introPic.setVisible(false);
      this.hideSpot();
      this.overlay.hide();
      const slot = this.skillSlots.find((s) => s.kind === kind);
      if (slot) this.showSpot('nudge-' + kind, slot.rect, 'left', PD.text.spotSkill, [], 6); // 關掉後再指 6 秒
    } }]);
    PD.Sound.play('tip');
    // 右邊放一顆大大的招式圖示（左邊留給指向真正圖示的箭頭）
    const px = this.L.width / 2 + 290;
    if (!this.introPic) this.introPic = PD.img(this, 0, 0, 'skillBase_' + kind).setDepth(501);
    this.introPic.setFrame('skillBase_' + kind).setVisible(true).setPosition(px, 500).setScale(PD.TEX_SCALE * 1.5);
    const slot = this.skillSlots.find((s) => s.kind === kind);
    if (slot) this.showSpot('skill-' + kind, slot.rect, 'left', PD.text.spotSkill, [slot.glow, slot.base, slot.art, slot.lock, slot.secsBg, slot.secs]);
    if (!this.introArt) this.introArt = PD.img(this, 0, 0, 'skillArt_' + kind).setDepth(502);
    this.introArt.setFrame('skillArt_' + kind).setVisible(true).setPosition(px, 500).setScale(PD.TEX_SCALE * 1.5);
  }

  // ===== 高亮提示：把要看的東西提到暗幕上面，旁邊一個輕輕擺動的箭頭和一句話 =====
  buildSpot() {
    this.spot = { kind: '', raised: [], rect: null, dir: 'down', until: 0 };
    this.spotG = this.add.graphics().setDepth(620).setVisible(false);
    this.spotText = PD.txt(this, 0, 0, '', 26, '#fff3b0', 5).setDepth(621).setVisible(false);
  }

  cardParts(card) {
    return [card.glow, card.bg, card.edge, card.plate, card.pic, card.name, card.badge, card.coin, card.cost];
  }

  // parts＝要提到暗幕上面的物件（提示關掉時放回原本的深度）；seconds＞0 表示沒有暗幕、幾秒後（真實時間）自己收起來
  showSpot(kind, rect, dir, label, parts, seconds) {
    this.hideSpot();
    this.spot.kind = kind;
    this.spot.rect = rect;
    this.spot.dir = dir;
    this.spot.until = seconds ? this.clock + seconds : 0;
    this.spot.raised = parts.filter(Boolean).map((o) => [o, o.depth]);
    this.spot.raised.forEach(([o, d]) => o.setDepth(d + 210));
    const t = this.spotText.setText(label).setVisible(true);
    if (dir === 'down') t.setPosition(rect.x + rect.w / 2, rect.y - 70);
    else t.setPosition(rect.x + rect.w + 150, rect.y + rect.h / 2);
    this.spotG.setVisible(true);
  }

  hideSpot() {
    if (this.introArt) this.introArt.setVisible(false);
    if (!this.spot.kind) return;
    this.spot.raised.forEach(([o, d]) => o.setDepth(d));
    this.spot.raised = [];
    this.spot.kind = '';
    this.spotG.clear().setVisible(false);
    this.spotText.setVisible(false);
  }

  // 箭頭每 1 秒輕輕擺一次（真實時間，不跟著速度鈕）；減少特效時不擺動、不呼吸
  updateSpot() {
    const sp = this.spot;
    if (!sp.kind) return;
    if (sp.until && this.clock >= sp.until) { this.hideSpot(); return; }
    const g = this.spotG.clear();
    const r = sp.rect;
    const still = this.fx.reduced;
    const bob = still ? 0 : Math.sin(this.clock * Math.PI * 2) * 6;
    g.lineStyle(5, 0xffe84a, still ? 1 : 0.75 + 0.25 * Math.sin(this.clock * Math.PI * 2 / 1.2));
    if (sp.dir === 'down') {
      g.strokeRoundedRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8, 16);
      this.arrow(g, r.x + r.w / 2, r.y - 10 + bob, 0, 1);
    } else {
      g.strokeCircle(r.x + r.w / 2, r.y + r.h / 2, r.w / 2 + 1);
      this.arrow(g, r.x + r.w + 6 - bob, r.y + r.h / 2, -1, 0);
    }
  }

  // 箭頭尖端在 (x, y)，往 (dx, dy) 指；黃心深色外框，和按鈕同一套風格
  arrow(g, x, y, dx, dy) {
    const px = -dy;
    const py = dx;
    const shape = (s) => {
      const p = [[0, 0], [22, 18], [22, 8], [46, 8], [46, -8], [22, -8], [22, -18]];
      g.beginPath();
      p.forEach(([a, b], i) => {
        const X = x - dx * a * s + px * b * s;
        const Y = y - dy * a * s + py * b * s;
        if (i) g.lineTo(X, Y); else g.moveTo(X, Y);
      });
      g.closePath();
      g.fillPath();
    };
    g.fillStyle(0x1f2a38, 1); shape(1.2);
    g.fillStyle(0xffe84a, 1); shape(1);
  }

  // 重來／再試這一段／過關／失敗時，把半途被蓋掉的提示收乾淨。
  // 以前暫停時剛好開著提示、按「重來」後，提示狀態還留著：之後按「繼續」會跳出過期的介紹，
  // 那顆招式提示也永遠不再出現；自動試玩則會一直等一顆已經不見的按鈕（卡到時間上限＝「異常」局）。
  clearPrompts(reshow) {
    const skill = this.skillTipKind;
    const intro = this.introKind;
    this.skillTipKind = '';
    this.introKind = '';
    // 沒按「好耶」就被打斷的招式提示放回佇列，之後再說一次；沒看完的新敵人介紹也一樣
    if (skill) { if (this.skillTipQueue.indexOf(skill) < 0) this.skillTipQueue.unshift(skill); }
    else if (intro && !this.friendKind) this.introDone.delete(intro);
    if (this.introPic) this.introPic.setVisible(false);
    this.hideSpot();
    this.foot.setVisible(false);
    if (reshow && this.friendKind) this.showFriendTip();
  }

  // 新敵人第一次出現：暫停戰鬥介紹一次
  showEnemyIntro(kind) {
    if (this.introDone.has(kind)) return;
    this.introDone.add(kind);
    this.introKind = kind;
    PD.Sound.play('tip');
    this.overlay.show(PD.text.newEnemyTitle(PD.names[kind]), PD.text.enemyDesc[kind], [
      { label: PD.text.resume, fn: () => { this.introKind = ''; this.introPic.setVisible(false); this.overlay.hide(); } },
    ]);
    if (!this.introPic) this.introPic = PD.img(this, this.L.width / 2 - 230, 500, 'enemy_' + kind).setDepth(501); // 在「繼續」鈕左邊，不壓到按鈕
    const size = this.cfg.enemies[kind].size;
    this.introPic.setFrame('enemy_' + kind).setVisible(true).setPosition(this.L.width / 2 - 230, 500).setScale(PD.TEX_SCALE * Math.min(1, 130 / size.h));
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
      const ready = this.add.image(0, -2, 'atlas', 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe9a0).setVisible(false);
      const burn = PD.img(this, 0, 0, 'iconBurn');
      const slow = PD.img(this, 0, 0, 'iconSlow');
      const flames = FLAME_SPOTS.map(() => PD.img(this, 0, 0, 'iconBurn').setOrigin(0.5, 1).setVisible(false));
      c.add([ready, shadow, body, label, ...flames, hpBack, hpFill, burn, slow]);
      v = { c, ready, shadow, body, label, flames, hpBack, hpFill, burn, slow, kindClass: 'actor', ...PD.Anim.newSlots() };
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
      skillT: -1, skillKeys: null, readyOn: false, frenzyOn: false, slideT: 0, slideDx: 0, hopT: 0, hopDx: 0,
      hover: 0, hpWide: 1, hpTall: 1, cloakOn: false, aura: 0, shimmerT: 0,
    });
    v.ready.setVisible(false).setTint(0xffe9a0).setScale(PD.TEX_SCALE * (size.w / 48), PD.TEX_SCALE * 0.5);
    v.shadow.x = 0;
    v.body.setFrame(frame).clearTint().setScale(PD.TEX_SCALE).setPosition(0, 0).setRotation(0).setAlpha(1);
    v.label.setText(name).setPosition(0, -size.h * 0.5);
    v.hpBack.setPosition(0, -size.h - 8).setScale(PD.TEX_SCALE);
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
        // 新敵人一出現就停（介紹畫面要馬上擋住戰鬥）；卡頓時一格畫面會補跑好幾步，不能在介紹後面繼續跑
        if (this.hasIntroEvent(sim.events)) { this.accum = 0; break; }
      }
    }
    this.drainEvents();
    if (this.hintSwapAt && this.clock >= this.hintSwapAt) { // 用真實時間，3× 時孩子一樣有時間讀完
      this.hintSwapAt = 0;
      if (this.hintText.text === PD.text.autoCollect) this.showHint(PD.text.inRangeHint);
    }
    this.syncViews(this.accum / this.cfg.rules.tickSeconds);
    this.updateHud(dt);
    this.updateSkillBar(dt);
    this.pumpSkillTips();
    this.updateSpot();
    if (this.hintClearAt && this.clock >= this.hintClearAt) { this.hintClearAt = 0; this.showHint(''); }
    this.skillFx.update(worldDt);
    this.fx.update(worldDt);
    this.updateQuality(delta);
  }

  hasIntroEvent(list) {
    for (let i = 0; i < list.length; i++) if (list[i].type === 'enemyNew' && !this.introDone.has(list[i].kind)) return true;
    return false;
  }

  drainEvents() {
    const list = this.sim.events;
    for (let i = 0; i < list.length; i++) this.handleEvent(list[i]);
    list.length = 0;
  }

  handleEvent(ev) {
    const v = ev.id ? this.viewById.get(ev.id) : null;
    switch (ev.type) {
      case 'skill':
        this.skillFx.cast(ev);
        if (ev.kind === 'trainer') this.skillOrbFloat = true;
        break;
      case 'comet': this.skillFx.comet(ev); break;
      case 'enemyNew': this.showEnemyIntro(ev.kind); break;
      case 'enemyThrow': {
        const u = this.viewById.get(ev.unitId);
        if (v && u) {
          this.fx.fire('lob', v.c.x - v.w * 0.3, v.c.y - v.h * 0.7, u, false);
          PD.Anim.release(v, PD.Anim.styleOf(v.kind), false);
        }
        break;
      }
      case 'enemySummon':
        if (v) {
          this.fx.glowPop(v.c.x + v.w * 0.4, v.foot - 40, 0xffd0a0, 1, 0.3);
          this.fx.burst('star', v.c.x + v.w * 0.4, v.foot - 40, 0xffd0a0, 8, 140, 0.4, 0.5, 0.1);
          PD.Sound.play('place');
        }
        break;
      case 'enemyRally':
        if (v) {
          this.fx.emit('ring', v.c.x, v.c.y - v.h * 0.5, 0xff9ad8, { vx: 0, vy: 0, life: 0.6, s0: 0.5, s1: 3, a: 0.8 });
          this.fx.emit('ring', v.c.x, v.c.y - v.h * 0.5, 0xffe082, { vx: 0, vy: 0, life: 0.8, s0: 0.3, s1: 2.4, a: 0.6 });
          PD.Sound.play('bump');
          this.showHint(PD.text.rallyHint, 4);
        }
        break;
      case 'bossWarn': this.warnBoss(ev.lane); break;
      case 'enemyPushed':
        if (v) { v.slideT = 0.3; v.slideDx = -ev.cells * this.L.grid.cellW; }
        break;
      case 'enemyHop':
        if (v) { v.hopT = 0.42; v.hopDx = ev.cells * this.L.grid.cellW; }
        break;
      case 'enemyHeal':
        if (v) this.fx.emit('plus', v.c.x, v.c.y - v.h * 0.7, 0x7ee081, { vx: 0, vy: -70, g: 0, life: 0.5, s0: 0.9, s1: 0.5, a: 1 });
        break;
      case 'enemySplit':
        this.fx.burst('star', this.ruleToX(ev.x), this.footY(ev.lane) - 40, 0xffb0a0, 10, 180, 0.4, 0.6, 0.1);
        break;
      case 'thorns':
        if (v) { v.flash = 0.08; this.fx.burst('spark', v.c.x - v.w * 0.4, v.c.y - v.h * 0.5, 0xdbe6f2, 5, 110, 0.25, 0.5, 0.1); }
        break;
      case 'placed':
        PD.Sound.play('place');
        this.newCards.delete(ev.kind);
        this.setSelected(null);
        this.refreshPrepHint();
        this.pendingLandId = ev.id;
        break;
      case 'placeFail':
        if (ev.reason === 'orbs') this.showHint(PD.text.needMoreOrbs);
        if (ev.reason === 'limit') this.showHint(PD.text.trainerLimit);
        if (ev.reason === 'startersFirst') this.showHint(PD.text.startersFirst);
        if (ev.reason === 'terrain') this.showHint(PD.text.terrainNoPlace);
        break;
      case 'battleStart':
        this.showHint(PD.text.autoCollect);
        this.hintSwapAt = this.clock + 4;
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
        this.showHint(PD.text.rescued, 4);
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
        this.showHint(PD.text.recallDone(PD.names[ev.kind]), 4);
        this.refreshPrepHint();
        break;
      case 'orbCollected':
        if (v) {
          this.fx.flyToCounter(v.c.x, v.c.y, this.L.orbCounter.x, this.L.orbCounter.y);
          this.ballBump = 0.2;
          PD.Sound.play('collect');
          if (ev.source === 'skill') {
            this.fx.burst('star', v.c.x, v.c.y, 0xffe36b, 5, 120, 0.4, 0.5, 0.1);
            if (this.skillOrbFloat) { this.skillOrbFloat = false; this.floatPlus(); }
          }
        }
        break;
      case 'won': this.exitRecall(); this.clearPrompts(false); this.onWon(); break;
      case 'failed': this.exitRecall(); this.clearPrompts(false); this.onFailed(); break;
      case 'restored':
        this.clearAllViews();
        PD.Sound.startMusic();
        this.restoring = true;
        this.overlay.hide();
        this.exitRecall();
        this.skillSlots.forEach((slot) => { slot.state = ''; slot.popT = 0; slot.pressT = 0; slot.ringT = 0; slot.ring.setVisible(false); }); // 還原後不算「剛冷卻完成」
        this.skillFx.clear();
        this.setSelected(null);
        this.accum = 0;
        this.hintSwapAt = 0;
        this.refreshPrepHint();
        this.clearPrompts(true);
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
    this.fx.fire(ev.fx, m.x, m.y, target, ev.big);
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
    const mode = this.sim.mode;
    const stars = PD.levelStars(mode.rescues - this.sim.state.rescues, mode.rescues);
    const hadStars = PD.Progress.stars(this.modeId, this.sim.level.number);
    const better = PD.Progress.markCleared(this.modeId, this.sim.level.number, stars);
    this.lastStars = stars;
    const buttons = [];
    if (this.cfg.levels[this.levelIndex + 1]) buttons.push({ label: PD.text.nextLevel, fn: () => this.goLevel(this.levelIndex + 1) });
    buttons.push({ label: PD.text.backToMap, fn: () => this.goMap() });
    buttons.push({ label: PD.text.playAgain, fn: () => this.sim.restart() });
    this.overlay.show(PD.text.winTitle, PD.text.winMsg, buttons, { stars, note: better && hadStars ? PD.text.starsBetter : '' });
  }

  onFailed() {
    PD.Sound.stopMusic();
    PD.Sound.play('lose');
    this.overlay.show(PD.text.failTitle, PD.text.failMsg, [
      { label: PD.text.retryWave, fn: () => this.sim.retryWave() },
      { label: PD.text.restart, fn: () => this.sim.restart() },
      { label: PD.text.backToMap, fn: () => this.goMap() },
    ]);
  }

  goMap() { this.scene.start('Map', { mode: this.modeId }); }

  goLevel(index) {
    PD.Sound.startMusic();
    this.scene.start('Battle', { mode: this.modeId, level: index });
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
      const big = !!this.cfg.enemies[v.kind].boss;
      this.fx.starBurst(v.c.x, v.c.y - v.h * 0.5, big);
      if (big) {
        this.fx.starBurst(v.c.x - 40, v.c.y - v.h * 0.8, false);
        this.fx.starBurst(v.c.x + 40, v.c.y - v.h * 0.3, false);
      }
      PD.Sound.play('star');
      if (v.kind === 'armored' || big) this.fx.shake();
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
    this.updateReady(v, u);
  }

  // 技能冷卻好了：腳下一圈柔光，並輕輕跳一下
  updateReady(v, u) {
    if (!this.cfg.skills[u.kind]) return;
    const ready = this.sim.state.phase === 'battle' && this.sim.skillReadyAt(u.kind) <= this.sim.state.tick;
    if (ready && !v.readyOn) {
      v.land = 0.2;
      if (!this.skillHinted) { this.skillHinted = true; this.showHint(PD.text.skillReady, 6); }
    }
    v.readyOn = ready;
    v.ready.setVisible(ready);
    if (ready) v.ready.setAlpha(0.55 + Math.sin(this.clock * 4) * 0.25);
  }

  // 「+75」從能量計數器旁飄起來
  floatPlus() {
    const L = this.L;
    if (!this.plusText) this.plusText = PD.txt(this, 0, 0, '', 34, '#ffe36b', 5).setDepth(402);
    this.plusText.setText('+' + this.cfg.skills.trainer.orbs * this.cfg.rules.orbValue)
      .setPosition(L.orbCounter.x + 110, L.orbCounter.y + 32).setAlpha(1).setVisible(true);
    this.plusT = 0.9;
    this.ballBump = 0.3;
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
      if (this.textures.exists('art_' + (def.artFrom || e.kind))) v.label.setText(''); // 有貼圖就不在身上蓋字
      v.c.setDepth(25 + e.lane * 10 + (def.flying ? 5 : 0)); // 飛的畫在同路其他敵人上面
      v.hover = def.hover || 0;
      v.aura = def.aura || 0;
      if (def.boss) {
        // 隊長：血條粗一點，腳下有一圈柔光
        v.hpWide = 1.7; v.hpTall = 1.5;
        v.hpBack.setScale(PD.TEX_SCALE * v.hpWide, PD.TEX_SCALE * v.hpTall);
        v.hpFill.setX(-26 * v.hpWide);
        v.ready.setTint(def.aura).setScale(PD.TEX_SCALE * (def.size.w / 40), PD.TEX_SCALE * 0.6).setVisible(true);
        if (!this.restoring) v.land = 0.38; // 登場時輕跳一下（揮旗亮相）
      }
      if (v.hover) {
        v.hpBack.y -= v.hover; v.hpFill.y -= v.hover; v.burn.y -= v.hover; v.slow.y -= v.hover;
      }
    }
    if (v.aura) v.ready.setAlpha(0.45 + Math.sin(this.worldClock * 3) * 0.2);
    this.updateCloak(v, e);
    v.seen = true;
    const x = e.px + (e.x - e.px) * alpha;
    // 被推回與跳躍只是外觀上的滑動：規則座標早就在終點了
    let slide = 0;
    let lift = 0;
    if (v.slideT > 0) {
      v.slideT -= this.frameDt;
      const k = Math.max(0, v.slideT / 0.3);
      slide = v.slideDx * k * k;
    }
    if (v.hopT > 0) {
      v.hopT -= this.frameDt;
      const k = Math.max(0, v.hopT / 0.42);
      slide += v.hopDx * k;
      lift = Math.sin((1 - k) * Math.PI) * 74;
    }
    v.c.setPosition(this.ruleToX(x) + slide, v.foot - lift);
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

  // 隱身：身體變半透明並慢慢閃著微光（不快速閃爍），旁邊冒小亮點；血條仍看得到
  updateCloak(v, e) {
    if (!e.cloaked) {
      if (v.cloakOn) { v.cloakOn = false; v.body.setAlpha(1); this.fx.glowPop(v.c.x, v.c.y - v.h * 0.5, 0xc9c0ff, 0.8, 0.25); }
      return;
    }
    if (!v.cloakOn) { v.cloakOn = true; this.fx.burst('spark', v.c.x, v.c.y - v.h * 0.5, 0xc9c0ff, 8, 90, 0.4, 0.6, 0.1); }
    v.body.setAlpha(this.fx.reduced ? 0.35 : 0.3 + Math.sin(this.worldClock * 3.5 + v.seed) * 0.1);
    if (this.overlay.visible) return;
    v.shimmerT -= this.frameDt;
    if (v.shimmerT <= 0) {
      v.shimmerT = 0.22;
      this.fx.ambient('spark', v.c.x + (Math.random() - 0.5) * v.w * 0.8, v.c.y - Math.random() * v.h, 0xd8d0ff, 0, -24, 0, 0.5, 0.6, 0.1, 0.9);
    }
  }

  warnBoss(lane) {
    const L = this.L;
    const G = L.grid;
    const sx = G.x + G.cols * G.cellW;
    this.showHint(PD.text.bossComing, 5);
    PD.Sound.play('bossWarn');
    const img = this.bossWarnImg;
    this.tweens.killTweensOf(img);
    img.setPosition(sx + (L.width - sx) / 2, this.laneY(lane)).setDisplaySize(L.width - sx, G.cellH).setVisible(true).setAlpha(0.05);
    // 1.2 秒內柔和地亮暗三次（每次 0.4 秒，不算快速閃爍）；減少特效時只亮一下
    this.tweens.add({
      targets: img, alpha: 0.32, duration: 200, yoyo: true, repeat: this.fx.reduced ? 0 : 2, ease: 'Sine.easeInOut',
      onComplete: () => img.setVisible(false),
    });
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
    if (v.hover) offY -= v.hover + Math.sin(this.worldClock * 3 + v.seed) * 4; // 飛在空中，影子留在地上
    if (v.flash > 0) {
      v.flash -= dt;
      // 隊長／大王很大又一直被打：整隻變白剪影太刺眼，改成淡淡的粉紅色調；
      // 沒有貼圖的色塊敵人（厚殼機器人）閃白會變成一整塊白方塊，也用粉紅色調；其他敵人照舊閃白
      const ed = v.isEnemy && this.cfg.enemies[v.kind];
      if (ed && (ed.boss || ed.noArt)) v.body.setTint(0xffc4cc);
      else v.body.setTintFill(0xffffff);
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
      const lift = Math.max(0.7, 1 + (offY + v.hover) / 60);
      v.shadow.setScale(v.shadowSX * lift, PD.TEX_SCALE * 0.9 * lift);
      this.updateFlames(v, offX, offY);
    }
    // 色塊身上的名字跟著身體動（身體以腳底為軸傾斜）
    const half = v.h * 0.5;
    v.label.setPosition(offX + Math.sin(rot) * half, offY - Math.cos(rot) * half).setRotation(rot);
    const ratio = Math.max(0, hp / maxHp);
    v.hpFill.setScale(PD.TEX_SCALE * ratio * v.hpWide, PD.TEX_SCALE * v.hpTall)
      .setTint(ratio > 0.5 ? 0x7ee081 : ratio > 0.25 ? 0xffd84a : 0xff9a5a);
  }

  syncOrb(o, alpha) {
    let v = this.viewById.get(o.id);
    if (!v) v = this.acquireOrb(o.id);
    v.seen = true;
    const fall = this.sim.ticks(this.cfg.rules.orbFallSeconds);
    const k = Math.min(1, (o.age + alpha) / fall);
    const landY = this.laneY(o.lane) - 20;
    const fromSky = o.source === 'sky' || o.source === 'skill';
    const topY = fromSky ? this.L.grid.y - 10 : landY - 60;
    const x = this.ruleToX(o.x);
    v.c.setPosition(x, topY + (landY - topY) * (1 - (1 - k) * (1 - k)));
    v.orb.setY(k >= 1 ? Math.sin(this.worldClock * 4 + o.id) * 3 : 0);
    v.glow.setAlpha(k >= 1 ? 0.55 + Math.sin(this.worldClock * 5 + o.id) * 0.2 : 0.3);
    // 技能掉的球帶金色拖尾
    if (o.source === 'skill' && k < 1 && !this.overlay.visible) {
      this.fx.ambient('spark', v.c.x, v.c.y - 8, 0xffd54a, 0, -20, 0, 0.3, 0.8, 0.1, 0.9);
    }
    v.landX = x; v.landY = landY;
    v.collectable = o.age >= fall;
  }

  updateHud(dt) {
    const s = this.sim.state;
    const str = String(s.balls);
    if (this.ballText.text !== str) this.ballText.setText(str);
    if (this.ballBump > 0) this.ballBump -= dt;
    if (this.plusT > 0) {
      this.plusT -= dt;
      this.plusText.y -= 34 * dt;
      this.plusText.setAlpha(Math.min(1, this.plusT * 2));
      if (this.plusT <= 0) this.plusText.setVisible(false);
    }
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
      const canBuy = afford && this.cardUsable(card);
      if (canBuy !== card.canBuy) {
        card.canBuy = canBuy;
        card.pic.setAlpha(canBuy ? 1 : 0.45);
        card.badge.setTint(canBuy ? 0xd2571a : 0x7b828c);
        card.plate.setVisible(!canBuy);
        card.name.setColor(canBuy ? '#2a2a2a' : '#4a5058');
        card.edge.setVisible(canBuy);
      }
      // 亮邊每 1.6 秒呼吸一次（0.35～0.85），用真實時間，不是快速閃爍；減少特效時固定亮度
      if (canBuy) card.edge.setAlpha(this.fx.reduced ? 0.6 : 0.6 + 0.25 * Math.sin(this.clock * Math.PI * 2 / 1.6));
      card.pressT = Math.max(0, card.pressT - dt);
      card.cd.setVisible(cdRatio > 0);
      if (cdRatio > 0) card.cd.setDisplaySize(card.rect.w, card.rect.h * cdRatio);
      // 新朋友還沒放過、現在買得起：卡片外圈慢慢發亮，提醒孩子試試看
      const on = this.selected === card.kind || tut === card.kind || (canBuy && this.newCards.has(card.kind));
      card.glow.setVisible(on);
      if (on) card.glow.setAlpha(this.selected === card.kind ? 0.9 : pulse);
      const dy = (card.pressT > 0 ? 4 : 0) - (this.selected === card.kind ? 6 : 0);
      if (dy !== card.dy) {
        const C = this.L.cards;
        card.dy = dy;
        card.bg.y = card.rect.y + card.rect.h / 2 + dy;
        card.edge.y = card.bg.y;
        card.pic.y = card.picY + dy;
        card.name.y = C.y + 102 + dy;
        card.plate.y = C.y + 102.5 + dy;
        card.badge.y = C.y + 25 + dy;
        card.coin.y = C.y + 25 + dy;
        card.cost.y = C.y + 25 + dy;
      }
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

  // seconds＞0：過幾秒（真實時間）自己清掉，舊提示不會一直掛在上面；換成別句時以新的那句為準
  showHint(str, seconds) {
    this.hintText.setText(str);
    this.hintClearAt = seconds ? this.clock + seconds : 0;
  }

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
    let col = t ? t.col : 6;
    while (col > 1 && this.sim.cellBlocked(lane, col)) col--;
    return this.sim.unitAt(lane, col) ? null : { lane, col };
  }

  updateCellGlows() {
    const G = this.L.grid;
    let n = 0;
    for (let r = 1; r <= G.rows; r++) {
      for (let c = 1; c <= G.cols; c++) {
        const g = this.cellGlows[n++];
        const unit = this.sim.unitAt(r, c);
        const show = this.recalling ? !!unit : !!this.selected && this.sim.isLaneOpen(r) && !unit && !this.sim.cellBlocked(r, c);
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
      const on = i < range && col + 1 + i <= this.L.grid.cols;
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
    if (this.tapSkillBar(x, y)) return;
    if (this.tapOrb(x, y)) return;
    const L = this.L;
    for (let i = 0; i < this.pressables.length; i++) {
      const b = this.pressables[i];
      if (PD.hitRect(b.r, x, y)) PD.press(this, b.bg, b.extras);
    }
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

  // 這張卡現在點下去能不能選（不看球數）：開戰前只能選開戰需要的角色、小勇有人數上限
  cardUsable(card) {
    const s = this.sim.state;
    if (s.phase === 'prep' && this.sim.level.requiredToStart.indexOf(card.kind) === -1) return false;
    const max = card.def.maxCount;
    return !(max && this.sim.countUnits(card.kind) >= max);
  }

  tapCard(card) {
    PD.Sound.play('tap');
    card.pressT = 0.12; // 按下去的回饋：整張往下 4（updateHud 依真實時間彈回）
    this.exitRecall();
    const s = this.sim.state;
    if (!card.unlocked) { this.showHint(PD.text.lockedCard(card.def.unlock)); return; }
    if (this.selected === card.kind) { this.setSelected(null); return; }
    if (s.phase === 'prep' && this.sim.level.requiredToStart.indexOf(card.kind) === -1) { this.showHint(PD.text.startersFirst); return; }
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
    PD.settings.speedIndex = this.speedIndex;
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
    // 介紹圖與高亮箭頭不可留在暫停畫面上（按「繼續」後介紹會重新顯示）
    this.hideSpot();
    if (this.introPic) this.introPic.setVisible(false);
    this.overlay.show(T.pauseTitle, T.levelLabel(this.sim.level.number), [
      { label: T.resume, fn: () => this.resume() },
      { label: label(), fn: () => { PD.settings.reduceFx = !PD.settings.reduceFx; this.overlay.relabel(1, label()); } },
      { label: T.restart, fn: () => { this.pausedBy = null; this.sim.restart(); this.drainEvents(); } },
      { label: T.backToMap, fn: () => this.goMap() },
    ]);
  }

  resume() {
    this.pausedBy = null;
    this.overlay.hide();
    this.accum = 0;
    // 切分頁把新敵人介紹蓋掉時，回來要接著顯示
    if (this.friendKind) { this.showFriendTip(); return; }
    if (this.skillTipKind) { this.showSkillTip(this.skillTipKind); return; }
    if (this.introKind) { const k = this.introKind; this.introDone.delete(k); this.showEnemyIntro(k); return; }
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
