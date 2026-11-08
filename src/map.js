// 大地圖選關：過關解鎖下一關，已過的關卡可以重玩。只用程式畫的圖形與現有卡片圖。
window.PD = window.PD || {};

PD.MapScene = class MapScene extends Phaser.Scene {
  constructor() { super('Map'); }

  init(data) { this.modeId = data.mode || 'solo'; }

  create() {
    PD.setupCamera(this);
    const cfg = PD.config;
    const L = cfg.layout;
    const M = L.map;
    this.add.image(0, 0, 'bg').setOrigin(0).setScale(PD.TEX_SCALE);
    this.add.image(L.width / 2, L.height / 2, 'atlas', 'white')
      .setDisplaySize(L.width + 40, L.height + 40).setTint(0x101a24).setAlpha(0.45);

    PD.txt(this, L.width / 2, 62, PD.text.mapTitle, 54, '#ffe9a8', 7);
    PD.txt(this, L.width / 2, 124, PD.text[this.modeId === 'together' ? 'modeTogether' : 'modeSolo'], 30);

    this.drawPath(M.nodes);
    this.nodes = cfg.levels.map((level, i) => this.drawNode(level, M.nodes[i], M.nodeHit));

    const B = M.backBtn;
    PD.img(this, B.x + B.w / 2, B.y + B.h / 2, 'btnWide').setDisplaySize(B.w, B.h);
    PD.txt(this, B.x + B.w / 2, B.y + B.h / 2, PD.text.changeMode, 30, '#3a2a10', 0);

    this.hint = PD.txt(this, L.width / 2, 760, '', 32);
    // 用 pointerdown：從戰鬥畫面按「回地圖」時手指還沒放開，不會誤觸地圖上的關卡
    this.input.on('pointerdown', (p) => this.onTap(p.x / PD.RES, p.y / PD.RES));
  }

  drawPath(points) {
    const g = this.add.graphics();
    const curve = new Phaser.Curves.Spline(points.map((p) => new Phaser.Math.Vector2(p.x, p.y)));
    g.lineStyle(44, 0x8a6a3a, 0.9);
    curve.draw(g, 64);
    g.lineStyle(32, 0xe2c98f, 1);
    curve.draw(g, 64);
    g.fillStyle(0x8a6a3a, 0.9);
    curve.getSpacedPoints(26).forEach((p) => g.fillCircle(p.x, p.y, 4));
  }

  drawNode(level, at, hit) {
    const open = PD.Progress.isUnlocked(this.modeId, level.number);
    const done = PD.Progress.isCleared(this.modeId, level.number);
    const fill = !open ? 0x7d8794 : done ? 0x58b86a : 0xffcf5a;
    const rect = { x: at.x - hit / 2, y: at.y - hit / 2, w: hit, h: hit };

    if (open && !done) {
      const glow = this.add.image(at.x, at.y, 'atlas', 'glow').setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xffd84a).setScale(4.2 * PD.TEX_SCALE).setAlpha(0.5);
      this.tweens.add({ targets: glow, alpha: 0.2, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    const g = this.add.graphics();
    g.fillStyle(0x1f2a38, 1).fillCircle(at.x, at.y, 88);
    g.fillStyle(fill, 1).fillCircle(at.x, at.y, 78);
    g.fillStyle(0xffffff, 0.25).fillEllipse(at.x, at.y - 40, 96, 40);

    PD.txt(this, at.x, at.y - (open ? 26 : 34), PD.text.levelLabel(level.number), 34, '#2a2a2a', 0);
    if (!open) {
      PD.img(this, at.x, at.y + 22, 'lock').setTint(0xf0f4f8);
      return { level, rect, open };
    }
    if (done) {
      g.lineStyle(14, 0xffffff, 1);
      g.beginPath();
      g.moveTo(at.x - 32, at.y + 22);
      g.lineTo(at.x - 8, at.y + 44);
      g.lineTo(at.x + 36, at.y - 2);
      g.strokePath();
      PD.txt(this, at.x, at.y + 112, PD.text.levelCleared, 26, '#c9f5d0');
      return { level, rect, open };
    }
    // 這一關第一次出現的朋友，用現有的卡片圖
    const fresh = PD.config.cardOrder.filter((k) => PD.config.units[k].unlock === level.number);
    fresh.forEach((k, i) => {
      PD.img(this, at.x + (i - (fresh.length - 1) / 2) * 62, at.y + 32, 'cardPic_' + k).setScale(PD.TEX_SCALE * 0.72);
    });
    PD.txt(this, at.x, at.y + 112, PD.text.newFriend + '：' + fresh.map((k) => PD.names[k]).join('、'), 24, '#ffe9a8');
    return { level, rect, open };
  }

  onTap(x, y) {
    const M = PD.config.layout.map;
    if (PD.hitRect(M.backBtn, x, y)) {
      PD.Sound.play('tap');
      this.scene.start('Start');
      return;
    }
    const node = this.nodes.find((n) => PD.hitRect(n.rect, x, y));
    if (!node) return;
    if (!node.open) { this.hint.setText(PD.text.levelLocked); return; }
    PD.Sound.play('tap');
    PD.Sound.startMusic();
    this.scene.start('Battle', { mode: this.modeId, level: node.level.number - 1 });
  }
};
