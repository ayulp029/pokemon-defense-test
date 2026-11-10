// 啟動遊戲、開始畫面。
window.PD = window.PD || {};
PD.settings = { reduceFx: false, speedIndex: 0 };

// 裝置震動（只跟著畫面震動用在重要時刻）：「減少特效」開啟時完全不震。
// iPad 的 Safari 沒有震動功能，呼叫了也只是沒有效果；有支援的手機／平板才會輕震一下
PD.buzz = function (ms) {
  if (PD.settings.reduceFx || !navigator.vibrate) return;
  try { navigator.vibrate(ms); } catch (e) { /* 不支援就算了 */ }
};

PD.setupCamera = function (scene) {
  scene.cameras.main.setOrigin(0, 0).setZoom(PD.RES);
};

PD.BootScene = class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  // 本機貼圖（我方與敵人）：不存在的檔案載入失敗就略過，該角色自動用色塊
  preload() {
    // 用 artFrom 重新上色的敵人、標了 noArt 的（例如厚殼機器人）沒有自己的檔案，不用載入
    const E = PD.config.enemies;
    [...PD.config.cardOrder.filter((k) => !PD.config.units[k].noArt), ...Object.keys(E).filter((k) => !E[k].artFrom && !E[k].noArt)]
      .forEach((k) => this.load.image('art_' + k, 'assets/local-art/' + k + '.png'));
    // 敵人的專屬貼圖（頭目 boss.png）：缺檔時載入失敗就略過，退回重新上色的圖
    const own = new Set(Object.values(PD.config.enemies).filter((d) => d.art).map((d) => d.art.file));
    own.forEach((f) => { if (!this.textures.exists('art_' + f)) this.load.image('art_' + f, 'assets/local-art/' + f + '.png'); });
    // 卡片特寫（card-<代號>.png）與第 4～6 關的圖檔背景（bgArt）：缺檔一樣略過，退回原本的小全身圖／程式畫的草地
    PD.config.cardOrder.filter((k) => PD.config.units[k].cardArt)
      .forEach((k) => this.load.image('cardArt_' + k, 'assets/local-art/card-' + k + '.png'));
    PD.config.levels.filter((lv) => lv.bgArt)
      .forEach((lv) => this.load.image('bgArt_' + lv.number, 'assets/local-art/' + lv.bgArt.file + '.png'));
    // 待機動畫只載入事先確認存在的檔案（見下方 probeIdleSheets）
    Object.keys(PD.idleSheetFound).forEach((k) => {
      this.load.image('idle_' + k, 'assets/local-art/' + PD.config.units[k].idleSheet.file + '.png');
    });
  }

  create() {
    // 有專屬貼圖的敵人：畫面大小換成貼圖的比例（只影響外觀，規則不看大小）
    Object.values(PD.config.enemies).forEach((d) => {
      d.ownArt = !!(d.art && this.textures.exists('art_' + d.art.file));
      if (d.ownArt) d.size = d.art.size;
    });
    PD.buildAtlas(this, PD.config);
    PD.buildBackground(this, PD.config, PD.config.levels[0]);
    PD.buildPanel(this);
    PD.buildMapBackground(this, PD.config);
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
      const bg = PD.img(this, r.x + r.w / 2, r.y + r.h / 2, 'btnBig');
      const t = PD.txt(this, r.x + r.w / 2, r.y + r.h / 2, label, 40, '#3a2a10', 0);
      return { r, bg, t };
    };
    const btns = [button(L.start.together, PD.text.modeTogether), button(L.start.solo, PD.text.modeSolo)];
    // 手指一按下就顯示按下去的樣子；換畫面仍在手指離開時
    this.input.on('pointerdown', (p) => {
      const b = btns.find((o) => PD.hitRect(o.r, p.x / PD.RES, p.y / PD.RES));
      if (b) PD.press(this, b.bg, [b.t]);
    });

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
    PD.Sound.startMusic();
    PD.Sound.play('tap');
    this.scene.start('Map', { mode });
  }
};

// 所有「缺檔就退回」的本機貼圖檔名（不含 .png）：自動測試用來判斷哪些 404 是預期內
PD.optionalArtFiles = function () {
  const C = PD.config;
  return [
    ...C.cardOrder, ...Object.keys(C.enemies),
    ...Object.values(C.enemies).filter((d) => d.art).map((d) => d.art.file),
    ...C.cardOrder.filter((k) => C.units[k].cardArt).map((k) => 'card-' + k),
    ...C.levels.filter((lv) => lv.bgArt).map((lv) => lv.bgArt.file),
    ...Object.values(C.units).filter((d) => d.idleSheet).map((d) => d.idleSheet.file),
  ];
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

// 本機限定的待機圖：先問伺服器有沒有這個檔案，沒有就不載入（公開版沒有這個檔）。
// 網路出問題或太久沒回應也當作沒有，退回靜態貼圖，不擋住遊戲啟動。
PD.idleSheetFound = {};
PD.probeIdleSheets = function () {
  const units = PD.config.units;
  const checks = Object.keys(units).filter((k) => units[k].idleSheet).map((k) => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 2000);
    return fetch('assets/local-art/' + units[k].idleSheet.file + '.png', { method: 'HEAD', cache: 'no-store', signal: abort.signal })
      .then((res) => {
        if (res.ok && (res.headers.get('content-type') || '').startsWith('image/')) PD.idleSheetFound[k] = true;
      })
      .catch(() => {})
      .then(() => clearTimeout(timer));
  });
  return Promise.all(checks);
};

PD.probeIdleSheets().then(function () {
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
    scene: [PD.BootScene, PD.StartScene, PD.MapScene, PD.BattleScene],
  });
});
