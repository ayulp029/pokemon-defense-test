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
    // 星星置中一排；「星星變多了！」放在星星正下方（以前擠在星星右邊，小螢幕不好對齊）
    this.starY = 322;
    // 拿到的金星背後一團暖色柔光（現成的 glow 圖＋疊加混色），讓金星更有光澤；沒拿到的空星不加
    this.starGlows = [0, 1, 2].map((i) => scene.add.image(this.cx + (i - 1) * 84, this.starY, 'atlas', 'glow')
      .setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc83a).setScale(PD.TEX_SCALE * 1.35).setVisible(false));
    this.stars = [0, 1, 2].map((i) => PD.img(scene, this.cx + (i - 1) * 84, this.starY, 'rankStar').setScale(PD.TEX_SCALE * 1.1).setVisible(false));
    this.starNote = PD.txt(scene, this.cx, this.starY + 52, '', 26, '#ffe9a8');
    this.c.add(this.starGlows.concat(this.stars, this.starNote));
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
      const glow = this.starGlows[i];
      const earned = starCount > 0 && i < starCount;
      this.scene.tweens.killTweensOf(glow);
      glow.setVisible(earned).setAlpha(0.5);
      // 拿到的星星一顆一顆輕輕跳出來（真實時間，覆蓋畫面時戰鬥已停）；柔光跟著出現後慢慢呼吸。
      // 「減少特效」時星星不跳、柔光固定亮度
      if (earned && !PD.settings.reduceFx) {
        st.setScale(0.01);
        glow.setAlpha(0);
        this.scene.tweens.add({ targets: st, scale: PD.TEX_SCALE * 1.1, duration: 260, delay: 250 + i * 220, ease: 'Back.easeOut' });
        this.scene.tweens.add({ targets: glow, alpha: 0.6, duration: 300, delay: 250 + i * 220, onComplete: () => {
          this.scene.tweens.add({ targets: glow, alpha: 0.35, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        } });
      }
    });
    const note = (opts && opts.note) || '';
    this.starNote.setText(note).setVisible(starCount > 0 && !!note);
    // 四顆按鈕排成兩列兩行（暫停畫面），其他情況排一列
    const twoRows = buttons.length > 3;
    const perRow = twoRows ? 2 : buttons.length;
    const startX = this.cx - (perRow * 300 + (perRow - 1) * 30) / 2 + 150;
    this.title.setY(twoRows ? 262 : starCount ? 254 : 280);
    this.msg.setY(twoRows ? 336 : starCount ? (note ? 416 : 398) : 368);
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
    if (this.onToggle) this.onToggle(true);
  }

  hide() {
    this.c.setVisible(false);
    this.visible = false;
    if (this.onToggle) this.onToggle(false);
  }

  relabel(index, label) { this.btns[index].label.setText(label); }

  tap(x, y) {
    for (let i = 0; i < this.btns.length; i++) {
      const b = this.btns[i];
      if (b.on && PD.hitRect(b.rect, x, y)) { PD.Sound.play('tap'); PD.press(this.scene, b.bg, [b.label]); b.fn(); return; }
    }
  }
};
