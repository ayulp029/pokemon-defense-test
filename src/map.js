// 大地圖選關：過關解鎖下一關，已過的關卡可以重玩。只用程式畫的圖形與現有卡片圖。
// 外觀依 docs/beautify-top5-v1.md 第 2 項：夜空遠山底圖、木頭小路、木牌關卡名、最後一關較大並插隊旗。
window.PD = window.PD || {};

PD.MapScene = class MapScene extends Phaser.Scene {
  constructor() { super('Map'); }

  init(data) { this.modeId = data.mode || 'solo'; }

  create() {
    PD.setupCamera(this);
    const cfg = PD.config;
    const L = cfg.layout;
    const M = L.map;
    this.add.image(0, 0, 'mapBg').setOrigin(0).setScale(PD.TEX_SCALE);

    PD.txt(this, L.width / 2, 62, PD.text.mapTitle, 54, '#ffe9a8', 7);
    PD.txt(this, L.width / 2, 124, PD.text[this.modeId === 'together' ? 'modeTogether' : 'modeSolo'], 30);
    this.drawGoal(L.width / 2, M.goalY);

    this.drawPath(M.nodes);
    const last = cfg.levels.length;
    this.nodes = cfg.levels.map((level, i) => this.drawNode(level, M.nodes[i], M.nodeHit, level.number === last));

    const B = M.backBtn;
    this.backBg = PD.img(this, B.x + B.w / 2, B.y + B.h / 2, 'btnWide').setDisplaySize(B.w, B.h);
    this.backText = PD.txt(this, B.x + B.w / 2, B.y + B.h / 2, PD.text.changeMode, 30, '#3a2a10', 0);
    // 圖鑑鈕：右上角，和「換模式」同一套按鈕圖
    const D = M.bestiaryBtn;
    this.bookBg = PD.img(this, D.x + D.w / 2, D.y + D.h / 2, 'btnWide').setDisplaySize(D.w, D.h);
    this.bookText = PD.txt(this, D.x + D.w / 2, D.y + D.h / 2, PD.text.bestiary, 30, '#3a2a10', 0);

    this.hint = PD.txt(this, L.width / 2, 760, '', 32);
    // 用 pointerdown：從戰鬥畫面按「回地圖」時手指還沒放開，不會誤觸地圖上的關卡
    this.input.on('pointerdown', (p) => this.onTap(p.x / PD.RES, p.y / PD.RES));
  }

  // 最終目標：「目標：打倒魔王○○！」加上還有幾關會遇到他（依這個模式的進度）。
  // 放在模式名稱下面、關卡木牌上面，左右不碰「換模式」與「圖鑑」鈕
  drawGoal(cx, y) {
    const last = PD.config.levels.length;
    const done = PD.Progress.cleared(this.modeId);
    const left = last - (done + 1);
    const sub = done >= last ? PD.text.goalDone : left <= 0 ? PD.text.goalHere : PD.text.goalLeft(left);
    const g = this.add.graphics(); // 底牌先建立，字才會畫在底牌上面
    const t1 = PD.txt(this, 0, y, PD.text.goalLine, 26, '#ffe9a8', 5).setOrigin(0, 0.5);
    const t2 = PD.txt(this, 0, y, sub, 26, done >= last ? '#c9f5d0' : '#ffffff', 5).setOrigin(0, 0.5);
    const gap = 22;
    const flagW = 34;
    const w = flagW + t1.width + gap + t2.width;
    const x0 = cx - w / 2;
    // 底牌：深色半透明圓角板，讓字在夜空與山上都清楚
    g.fillStyle(0x0f1a24, 0.55).fillRoundedRect(x0 - 20, y - 22, w + 40, 44, 20);
    g.lineStyle(2, 0xffe9a8, 0.45).strokeRoundedRect(x0 - 20, y - 22, w + 40, 44, 20);
    this.drawFlag(g, x0 + 4, y + 14, 0.36);
    t1.setX(x0 + flagW);
    t2.setX(x0 + flagW + t1.width + gap);
    this.goal = { line: t1, sub: t2, rect: { x: x0 - 20, y: y - 22, w: w + 40, h: 44 } }; // 測試檢查用
  }

  // 小路：深色外緣、淺色路面，中間一排小石頭
  drawPath(points) {
    const g = this.add.graphics();
    const curve = new Phaser.Curves.Spline(points.map((p) => new Phaser.Math.Vector2(p.x, p.y)));
    this.pathPts = curve.getSpacedPoints(240); // 給星星底牌避開路徑用
    g.lineStyle(52, 0x0f1a24, 0.35);
    curve.draw(g, 96);
    g.lineStyle(44, 0x8a6a3a, 1);
    curve.draw(g, 96);
    g.lineStyle(32, 0xe2c98f, 1);
    curve.draw(g, 96);
    g.fillStyle(0x8a6a3a, 0.9);
    curve.getSpacedPoints(40).forEach((p) => g.fillCircle(p.x, p.y, 4));
  }

  drawNode(level, at, hit, isLast) {
    const open = PD.Progress.isUnlocked(this.modeId, level.number);
    const done = PD.Progress.isCleared(this.modeId, level.number);
    const fill = !open ? 0x7d8794 : done ? 0x58b86a : 0xffcf5a;
    const rect = { x: at.x - hit / 2, y: at.y - hit / 2, w: hit, h: hit };
    const R = isLast ? 100 : 88; // 最後一關的圓鈕大一圈

    if (open && !done) {
      const glow = this.add.image(at.x, at.y, 'atlas', 'glow').setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xffd84a).setScale((R / 88) * 4.2 * PD.TEX_SCALE).setAlpha(0.5);
      this.tweens.add({ targets: glow, alpha: 0.2, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    const g = this.add.graphics();
    if (isLast) this.drawFlag(g, at.x + R * 0.82, at.y - R * 0.5);
    g.fillStyle(0x0f1a24, 0.35).fillCircle(at.x + 3, at.y + 6, R);
    g.fillStyle(0x1f2a38, 1).fillCircle(at.x, at.y, R);
    g.fillStyle(fill, 1).fillCircle(at.x, at.y, R - 10);
    g.fillStyle(0x000000, 0.12).fillCircle(at.x + 6, at.y + 8, R - 22);
    g.fillStyle(fill, 1).fillCircle(at.x - 2, at.y - 2, R - 24);
    g.fillStyle(0xffffff, 0.25).fillEllipse(at.x, at.y - R * 0.45, R * 1.1, R * 0.45);

    // 木牌：關卡名寫在圓鈕上方的小木板上
    const wy = at.y - R + 6;
    g.fillStyle(0x1f2a38, 1).fillRoundedRect(at.x - 70, wy - 24, 140, 48, 12);
    g.fillStyle(0xa77a45, 1).fillRoundedRect(at.x - 67, wy - 21, 134, 42, 10);
    g.fillStyle(0xc89a5e, 1).fillRoundedRect(at.x - 67, wy - 21, 134, 18, { tl: 10, tr: 10, bl: 0, br: 0 });
    g.fillStyle(0x6a4a26, 0.6).fillRect(at.x - 60, wy + 4, 120, 2);
    PD.txt(this, at.x, wy, PD.text.levelLabel(level.number), 30, '#fff4dc', 4);
    if (!open) {
      PD.img(this, at.x, at.y + 22, 'lock').setTint(0xf0f4f8);
      return { level, rect, open };
    }
    if (done) {
      g.lineStyle(14, 0xffffff, 1);
      g.beginPath();
      g.moveTo(at.x - 32, at.y + 14);
      g.lineTo(at.x - 8, at.y + 36);
      g.lineTo(at.x + 36, at.y - 10);
      g.strokePath();
      // 過關的星星（重玩只留最好的一次）；舊存檔沒有星星紀錄時照舊寫「過關了」
      const stars = PD.Progress.stars(this.modeId, level.number);
      if (stars) {
        // 星星底牌：和關卡名木牌同一套（深色外框＋木板＋上緣亮條＋木紋），但木色較深，
        // 每顆星底下再一個深色圓槽，空心星的淺色外框在草地／山坡上也看得清楚
        const sy = at.y + R + 22;
        const sx = at.x + this.plateShift(at.x, sy, 82, 29);
        at = { x: sx, y: at.y }; // 底下只用來畫底牌與星星；圓鈕與點擊範圍上面已經算好
        g.fillStyle(0x0f1a24, 0.35).fillRoundedRect(at.x - 82 + 3, sy - 29 + 5, 164, 58, 16);
        g.fillStyle(0x1f2a38, 1).fillRoundedRect(at.x - 82, sy - 29, 164, 58, 16);
        g.fillStyle(0x7a532c, 1).fillRoundedRect(at.x - 79, sy - 26, 158, 52, 13);
        g.fillStyle(0x956a3c, 1).fillRoundedRect(at.x - 79, sy - 26, 158, 16, { tl: 13, tr: 13, bl: 0, br: 0 });
        g.fillStyle(0x5a3a1c, 0.55).fillRect(at.x - 70, sy + 2, 140, 2).fillRect(at.x - 64, sy + 14, 128, 2);
        for (let i = 0; i < 3; i++) g.fillStyle(0x2a1a0c, 0.75).fillCircle(at.x + (i - 1) * 46, sy + 1, 22);
        for (let i = 0; i < 3; i++) {
          PD.img(this, at.x + (i - 1) * 46, sy, i < stars ? 'rankStar' : 'rankStarEmpty').setScale(PD.TEX_SCALE * 0.66);
        }
      } else {
        PD.txt(this, at.x, at.y + R + 24, PD.text.levelCleared, 26, '#c9f5d0');
      }
      return { level, rect, open, stars };
    }
    // 這一關第一次出現的朋友，用現有的卡片圖
    const fresh = PD.config.cardOrder.filter((k) => PD.config.units[k].unlock === level.number);
    fresh.forEach((k, i) => {
      PD.img(this, at.x + (i - (fresh.length - 1) / 2) * 62, at.y + 24, 'cardPic_' + k).setScale(PD.TEX_SCALE * 0.72);
    });
    PD.txt(this, at.x, at.y + R + 24, PD.text.newFriend + '：' + fresh.map((k) => PD.names[k]).join('、'), 24, '#ffe9a8');
    return { level, rect, open };
  }

  // 底牌往左右挪到不壓小路（路面半寬 26）：第 3 關下方是往下轉彎的路，置中會壓到；其他關不用挪
  plateShift(cx, cy, hw, hh) {
    const pad = 28;
    const tries = [0, -24, 24, -48, 48, -72, 72, -96, 96];
    for (let i = 0; i < tries.length; i++) {
      const x = cx + tries[i];
      const hit = this.pathPts.some((p) => Math.abs(p.x - x) < hw + pad && Math.abs(p.y - cy) < hh + pad);
      if (!hit) return tries[i];
    }
    return 0;
  }

  // 最後一關的小隊旗：旗桿加三角旗，旗上是搗蛋團的歪菱形隊徽（不是文字或字母）
  drawFlag(g, x, y, k) {
    if (k && k !== 1) {
      // 縮小版（目標列用）：用同一套形狀，按比例畫
      const S = (v) => v * k;
      g.fillStyle(0x1f2a38, 1).fillRect(x - S(3), y - S(74), Math.max(2, S(7)), S(86));
      g.fillStyle(0x1f2a38, 1).fillTriangle(x + S(2), y - S(76), x + S(68), y - S(52), x + S(2), y - S(26));
      g.fillStyle(0xff8e6e, 1).fillTriangle(x + S(4), y - S(71), x + S(60), y - S(52), x + S(4), y - S(31));
      const cx = x + S(24);
      const cy = y - S(51);
      g.fillStyle(0xffe082, 1).fillPoints([{ x: cx, y: cy - S(8) }, { x: cx + S(7), y: cy - S(1) }, { x: cx + S(1), y: cy + S(8) }, { x: cx - S(7), y: cy + S(1) }], true);
      g.fillStyle(0xffe082, 1).fillCircle(x + S(1), y - S(77), Math.max(2, S(5)));
      return;
    }
    g.fillStyle(0x1f2a38, 1).fillRect(x - 3, y - 74, 7, 86);
    g.fillStyle(0xd8d2e8, 1).fillRect(x - 1, y - 72, 3, 82);
    g.fillStyle(0x1f2a38, 1).fillTriangle(x + 2, y - 76, x + 68, y - 52, x + 2, y - 26);
    g.fillStyle(0xff8e6e, 1).fillTriangle(x + 4, y - 71, x + 60, y - 52, x + 4, y - 31);
    const cx = x + 24;
    const cy = y - 51;
    g.fillStyle(0x1f2a38, 1).fillPoints([{ x: cx, y: cy - 12 }, { x: cx + 11, y: cy - 1 }, { x: cx + 1, y: cy + 12 }, { x: cx - 11, y: cy + 1 }], true);
    g.fillStyle(0xffe082, 1).fillPoints([{ x: cx, y: cy - 8 }, { x: cx + 7, y: cy - 1 }, { x: cx + 1, y: cy + 8 }, { x: cx - 7, y: cy + 1 }], true);
    g.fillStyle(0xffe082, 1).fillCircle(x + 1, y - 77, 5);
  }

  onTap(x, y) {
    const M = PD.config.layout.map;
    if (PD.hitRect(M.backBtn, x, y)) {
      PD.Sound.play('tap');
      PD.press(this, this.backBg, [this.backText]);
      this.time.delayedCall(90, () => this.scene.start('Start'));
      return;
    }
    if (PD.hitRect(M.bestiaryBtn, x, y)) {
      PD.Sound.play('tap');
      PD.press(this, this.bookBg, [this.bookText]);
      this.time.delayedCall(90, () => this.scene.start('Bestiary', { mode: this.modeId }));
      return;
    }
    const node = this.nodes.find((n) => PD.hitRect(n.rect, x, y));
    if (!node) return;
    if (!node.open) { this.hint.setText(PD.text.levelLocked); return; }
    PD.Sound.play('tap');
    PD.Sound.startMusic();
    this.scene.start('Battle', { mode: this.modeId, level: node.level.number - 1, story: true });
  }
};
