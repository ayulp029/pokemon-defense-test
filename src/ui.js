// 共用的小工具：文字與覆蓋畫面（暫停、勝利、失敗）。
window.PD = window.PD || {};
PD.FONT = '"PingFang TC","Heiti TC","Noto Sans CJK TC","Noto Sans TC",sans-serif';

PD.txt = function (scene, x, y, str, size, color, strokeW) {
  return scene.add.text(x, y, str, {
    fontFamily: PD.FONT, fontSize: size + 'px', fontStyle: 'bold',
    color: color || '#ffffff', stroke: '#1f2a38', strokeThickness: strokeW === undefined ? 4 : strokeW,
  }).setOrigin(0.5).setResolution(PD.RES);
};

PD.img = function (scene, x, y, frame) {
  return scene.add.image(x, y, 'atlas', frame).setScale(PD.TEX_SCALE);
};

PD.hitRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// 全畫面覆蓋層；按鈕事先建好重複使用
PD.Overlay = class Overlay {
  constructor(scene, cfg) {
    const L = cfg.layout;
    this.scene = scene;
    this.cx = L.width / 2;
    this.visible = false;
    this.c = scene.add.container(0, 0).setDepth(500).setVisible(false);
    this.dim = scene.add.image(this.cx, L.height / 2, 'atlas', 'white')
      .setDisplaySize(L.width + 40, L.height + 40).setTint(0x101a24).setAlpha(0.55);
    this.title = PD.txt(scene, this.cx, 280, '', 60, '#ffe9a8', 7);
    this.msg = PD.txt(scene, this.cx, 368, '', 32);
    this.c.add([this.dim, this.title, this.msg]);
    this.btns = [];
    for (let i = 0; i < 3; i++) {
      const bg = PD.img(scene, 0, 0, 'btnWide');
      const label = PD.txt(scene, 0, 0, '', 32, '#3a2a10', 0);
      this.c.add([bg, label]);
      this.btns.push({ bg, label, rect: { x: 0, y: 0, w: 300, h: 92 }, fn: null, on: false });
    }
  }

  show(title, msg, buttons) {
    this.title.setText(title);
    this.msg.setText(msg || '');
    const total = buttons.length * 300 + (buttons.length - 1) * 30;
    let x = this.cx - total / 2 + 150;
    this.btns.forEach((b, i) => {
      const def = buttons[i];
      b.on = !!def;
      b.bg.setVisible(b.on);
      b.label.setVisible(b.on);
      if (!def) return;
      b.fn = def.fn;
      b.bg.setPosition(x, 500);
      b.label.setPosition(x, 500).setText(def.label);
      b.rect.x = x - 150;
      b.rect.y = 454;
      x += 330;
    });
    this.c.setVisible(true);
    this.visible = true;
  }

  hide() {
    this.c.setVisible(false);
    this.visible = false;
  }

  relabel(index, label) { this.btns[index].label.setText(label); }

  tap(x, y) {
    for (let i = 0; i < this.btns.length; i++) {
      const b = this.btns[i];
      if (b.on && PD.hitRect(b.rect, x, y)) { PD.Sound.play('tap'); b.fn(); return; }
    }
  }
};
