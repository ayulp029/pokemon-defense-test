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

// 按下的回饋：底圖換成「按下」那張（暗一階、往下 4），上面的圖示與字一起往下 4，0.12 秒後彈回（真實時間）。
// 只是外觀，按鈕的功能照舊在點下去時執行。彈回時位置若已被別處改掉（例如覆蓋畫面換了按鈕），就不再動它。
PD.press = function (scene, bg, extras) {
  if (!bg || bg.pdPressed) return;
  const up = bg.frame.name;
  if (!scene.textures.get('atlas').has(up + 'Down')) return;
  const list = [bg].concat(extras || []);
  const ys = list.map((o) => o.y);
  bg.pdPressed = true;
  bg.setFrame(up + 'Down');
  list.forEach((o, i) => { if (i) o.y = ys[i] + 4; });
  scene.time.delayedCall(120, () => {
    bg.pdPressed = false;
    if (bg.frame.name === up + 'Down') bg.setFrame(up);
    list.forEach((o, i) => { if (i && o.y === ys[i] + 4) o.y = ys[i]; });
  });
};

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
    this.panel = scene.add.image(this.cx, 400, 'panel').setScale(PD.TEX_SCALE);
    this.title = PD.txt(scene, this.cx, 280, '', 60, '#ffe9a8', 7);
    this.msg = PD.txt(scene, this.cx, 368, '', 32);
    this.c.add([this.dim, this.panel, this.title, this.msg]);
    // 勝利畫面的星星（其他畫面不顯示）
    this.stars = [0, 1, 2].map((i) => PD.img(scene, this.cx + (i - 1) * 84, 330, 'rankStar').setScale(PD.TEX_SCALE * 1.1).setVisible(false));
    this.starNote = PD.txt(scene, this.cx + 240, 330, '', 26, '#ffe9a8');
    this.c.add(this.stars.concat(this.starNote));
    this.starCount = 0;
    this.btns = [];
    for (let i = 0; i < 4; i++) {
      const bg = PD.img(scene, 0, 0, 'btnWide');
      const label = PD.txt(scene, 0, 0, '', 32, '#3a2a10', 0);
      this.c.add([bg, label]);
      this.btns.push({ bg, label, rect: { x: 0, y: 0, w: 300, h: 92 }, fn: null, on: false });
    }
  }

  // opts.stars：1～3 顯示星星列（勝利畫面）；opts.note：星星旁的小字
  show(title, msg, buttons, opts) {
    this.title.setText(title);
    this.msg.setText(msg || '');
    const starCount = (opts && opts.stars) || 0;
    this.starCount = starCount;
    this.stars.forEach((st, i) => {
      st.setVisible(starCount > 0).setFrame(i < starCount ? 'rankStar' : 'rankStarEmpty');
      this.scene.tweens.killTweensOf(st);
      st.setScale(PD.TEX_SCALE * 1.1).setAngle(0);
      // 拿到的星星一顆一顆輕輕跳出來（真實時間，覆蓋畫面時戰鬥已停）
      if (starCount > 0 && i < starCount && !PD.settings.reduceFx) {
        st.setScale(0.01);
        this.scene.tweens.add({ targets: st, scale: PD.TEX_SCALE * 1.1, duration: 260, delay: 250 + i * 220, ease: 'Back.easeOut' });
      }
    });
    this.starNote.setText((opts && opts.note) || '').setVisible(starCount > 0);
    // 四顆按鈕排成兩列兩行（暫停畫面），其他情況排一列
    const twoRows = buttons.length > 3;
    const perRow = twoRows ? 2 : buttons.length;
    const startX = this.cx - (perRow * 300 + (perRow - 1) * 30) / 2 + 150;
    this.title.setY(twoRows ? 262 : starCount ? 256 : 280);
    this.msg.setY(twoRows ? 336 : starCount ? 398 : 368);
    this.btns.forEach((b, i) => {
      const def = buttons[i];
      b.on = !!def;
      b.bg.setVisible(b.on);
      b.label.setVisible(b.on);
      if (!def) return;
      const x = startX + (i % perRow) * 330;
      const y = twoRows ? 426 + Math.floor(i / perRow) * 100 : 500;
      b.fn = def.fn;
      b.bg.setPosition(x, y);
      b.label.setPosition(x, y).setText(def.label);
      b.rect.x = x - 150;
      b.rect.y = y - 46;
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
      if (b.on && PD.hitRect(b.rect, x, y)) { PD.Sound.play('tap'); PD.press(this.scene, b.bg, [b.label]); b.fn(); return; }
    }
  }
};
