// 啟動遊戲、開始畫面。
window.PD = window.PD || {};
PD.settings = { reduceFx: false };

PD.setupCamera = function (scene) {
  scene.cameras.main.setOrigin(0, 0).setZoom(PD.RES);
};

PD.BootScene = class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  // 本機貼圖（我方與敵人）：不存在的檔案載入失敗就略過，該角色自動用色塊
  preload() {
    [...PD.config.cardOrder, ...Object.keys(PD.config.enemies)]
      .forEach((k) => this.load.image('art_' + k, 'assets/local-art/' + k + '.png'));
  }

  create() {
    PD.buildAtlas(this, PD.config);
    PD.buildBackground(this, PD.config, PD.config.levels[0]);
    PD.buildPanel(this);
    this.scene.start('Start');
  }
};

PD.StartScene = class StartScene extends Phaser.Scene {
  constructor() { super('Start'); }

  create() {
    PD.setupCamera(this);
    const L = PD.config.layout;
    this.add.image(0, 0, 'bg').setOrigin(0).setScale(PD.TEX_SCALE);
    this.add.image(L.width / 2, L.height / 2, 'atlas', 'white')
      .setDisplaySize(L.width + 40, L.height + 40).setTint(0x101a24).setAlpha(0.5);
    this.add.image(L.width / 2, 230, 'atlas', 'glow')
      .setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd84a).setScale(14 * PD.TEX_SCALE, 4.8 * PD.TEX_SCALE).setAlpha(0.35);
    PD.txt(this, L.width / 2, 230, PD.names.game, 76, '#ffe9a8', 9);
    PD.txt(this, L.width / 2, 340, PD.text.teamComing, 32);
    PD.txt(this, L.width / 2, 420, PD.text.tapToStart, 30, '#ffffff');

    const button = (r, label) => {
      PD.img(this, r.x + r.w / 2, r.y + r.h / 2, 'btnBig');
      PD.txt(this, r.x + r.w / 2, r.y + r.h / 2, label, 40, '#3a2a10', 0);
    };
    button(L.start.together, PD.text.modeTogether);
    button(L.start.solo, PD.text.modeSolo);

    // iOS：在手指離開螢幕的那一刻解鎖聲音
    const unlock = () => {
      PD.Sound.unlock();
      ['touchend', 'pointerup', 'click'].forEach((n) => window.removeEventListener(n, unlock));
    };
    ['touchend', 'pointerup', 'click'].forEach((n) => window.addEventListener(n, unlock));

    this.input.on('pointerup', (p) => {
      const x = p.x / PD.RES;
      const y = p.y / PD.RES;
      if (PD.hitRect(L.start.together, x, y)) this.go('together');
      else if (PD.hitRect(L.start.solo, x, y)) this.go('solo');
    });
  }

  go(mode) {
    PD.Sound.unlock();
    this.scene.start('Battle', { mode });
  }
};

// 禁止雙指縮放、雙擊放大與拖動畫面
['gesturestart', 'dblclick'].forEach((n) => document.addEventListener(n, (e) => e.preventDefault()));
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

// 直向提示：開始畫面與戰鬥畫面共用
PD.isPortrait = () => window.innerHeight > window.innerWidth;
PD.updateTurnHint = function () {
  const el = document.getElementById('turn');
  el.textContent = PD.text.turnDevice;
  el.style.display = PD.isPortrait() ? 'flex' : 'none';
};
window.addEventListener('resize', PD.updateTurnHint);
PD.updateTurnHint();

(function () {
  const L = PD.config.layout;
  window.__game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    width: Math.round(L.width * PD.RES),
    height: Math.round(L.height * PD.RES),
    backgroundColor: '#16261c',
    // 貼圖用平滑過濾；貼圖已是一比一，不需要多重取樣和縮圖鏈，省下 iPad 的記憶體
    render: { antialias: true, antialiasGL: false, roundPixels: false, powerPreference: 'high-performance' },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: { noAudio: true },
    banner: false,
    scene: [PD.BootScene, PD.StartScene, PD.BattleScene],
  });
})();
