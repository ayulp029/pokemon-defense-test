// 所有名稱與數值都集中在這裡。數值都是「建議值，尚未實測」。
window.PD = window.PD || {};

(function () {
  const params = new URLSearchParams(location.search);
  const fast = params.get('fast') === '1';

  // ===== 單一名稱表：改名只要改這裡 =====
  const names = {
    game: '小勇的村莊守護戰',
    orb: '能量球',
    enemyTeam: '搗蛋團',
    trainer: '小勇',
    basicShooter: '電電鼠',
    doubleStriker: '藤芽蛙',
    tank: '大睡熊',
    slowShooter: '噴水龜',
    burnShooter: '火尾蜥',
    scout: '搗蛋團小兵',
    tough: '紫紋蛇',
    runner: '跑腿貓',
    armored: '厚殼機器人',
  };

  // ===== 畫面上的句子（名稱一律從名稱表取得）=====
  const text = {
    modeTogether: '一起守護',
    modeSolo: '自己挑戰',
    tapToStart: '點一下開始',
    teamComing: `${names.enemyTeam}要來了，一起守護村莊！`,
    pickTrainer: `先點「${names.trainer}」卡片`,
    pickShooter: `再點「${names.basicShooter}」卡片`,
    tapGlowCell: '點亮亮的格子放下去',
    autoCollect: '球會自己收好。',
    inRangeHint: '走進亮亮格子就會招呼。',
    pickCardFirst: '先點下面的卡片',
    restLane: '這條路今天休息',
    needMoreOrbs: `再收一些${names.orb}就可以了`,
    lockedCard: (n) => `第 ${n} 關才會遇到`,
    trainerLimit: `${names.trainer}最多 2 位`,
    occupied: '這裡已經有朋友了',
    rescued: '送回去了，村莊沒事！',
    waveHintTitle: (lane) => `第 ${lane} 路有朋友要來了`,
    rest: '休息',
    pauseTitle: '暫停一下',
    resume: '繼續',
    reduceFxOn: '減少特效：開',
    reduceFxOff: '減少特效：關',
    restart: '從頭再玩',
    winTitle: '村莊平安了！',
    winMsg: `${names.enemyTeam}開開心心回家了`,
    playAgain: '再玩一次',
    failTitle: '休息一下',
    failMsg: '要再試這一段嗎？',
    retryWave: '再試這一段',
    cancel: '取消',
    recall: '請回',
    recallPick: '點要回家休息的朋友',
    recallAgainLabel: '再點一次',
    recallConfirm: (name, cost) => `再點一次，請${name}回家（退 ${cost} 球）`,
    recallDone: (name) => `${name}回家休息了，球還給你`,
    recallNone: '場上還沒有朋友',
    turnDevice: '請把 iPad 轉成橫向',
    speedLabel: (n) => `${n}×`,
  };

  // ===== 版面（基準畫面 1180×820）=====
  const layout = {
    width: 1180,
    height: 820,
    grid: { x: 120, y: 88, cols: 10, rows: 4, cellW: 96, cellH: 144 },
    // 畫面 x ＝ originX ＋ cellW × 規則 x
    originX: 72,
    laneY: [160, 304, 448, 592],
    footFromBottom: 0.12,
    topBar: { h: 80 },
    orbCounter: { x: 40, y: 40 },
    rescue: { x: 214, y: 40 },
    hint: { x: 625, y: 40 },
    hintPlate: { x: 340, y: 12, w: 570, h: 56 }, // 右端 910，留 8 的間距給速度鈕
    // 78 ÷ 1180 × 1024 ≈ 67.7 點：在 1024×768 的 iPad 上仍大於 64 點；三顆一樣大、間距 10
    speedBtn: { x: 918, y: 1, w: 78, h: 78 },
    muteBtn: { x: 1006, y: 1, w: 78, h: 78 },
    pauseBtn: { x: 1094, y: 1, w: 78, h: 78 },
    cards: { x: 20, y: 676, w: 136, h: 120, gap: 10 },
    cancelBtn: { x: 1040, y: 676, w: 120, h: 120 },
    recallBtn: { x: 896, y: 676, w: 136, h: 120 },
    recallGuardSeconds: 0.35, // 防止手抖連點：第一次點角色後，這段時間內的第二下不算
    orbHitSize: 64,
    start: {
      together: { x: 300, y: 470, w: 260, h: 130 },
      solo: { x: 620, y: 470, w: 260, h: 130 },
    },
  };

  // ===== 我方角色（內部代號不含角色名稱）=====
  const units = {
    trainer: {
      cost: 50, hp: 6, unlock: 1, maxCount: 2, genEvery: 10,
      size: { w: 68, h: 102 }, color: 0xf2a93b, light: 0xffe2a8, icon: 'badge',
    },
    basicShooter: {
      cost: 75, hp: 6, unlock: 1, range: 3, interval: 2, damage: 1, fx: 'lightning',
      size: { w: 66, h: 98 }, color: 0xf5d531, light: 0xfff3b0, icon: 'bolt',
      // 本機限定的待機動畫（assets/local-art/<file>.png）；沒有檔案就用靜態圖
      idleSheet: { file: 'basicShooter-idle', frames: 6, frameMs: 140 },
    },
    doubleStriker: {
      cost: 100, hp: 14, unlock: 2, range: 1, interval: 2, damage: 2, secondHitDelay: 0.3, fx: 'vine',
      size: { w: 70, h: 100 }, color: 0x46b868, light: 0xc6f2c8, icon: 'leaf',
    },
    tank: {
      cost: 125, hp: 30, unlock: 3,
      size: { w: 82, h: 115 }, color: 0x5a7ea6, light: 0xdbe6f2, icon: 'shield',
    },
    slowShooter: {
      cost: 125, hp: 6, unlock: 4, range: 3, interval: 2, damage: 1, fx: 'water',
      slow: { factor: 0.5, seconds: 3 },
      size: { w: 68, h: 100 }, color: 0x3aa7e8, light: 0xc8ecff, icon: 'drop',
    },
    burnShooter: {
      cost: 150, hp: 6, unlock: 5, range: 3, interval: 2, damage: 1, fx: 'fire',
      burn: { perSecond: 1, seconds: 3 },
      size: { w: 68, h: 100 }, color: 0xee6a3a, light: 0xffd6b8, icon: 'flame',
    },
  };
  const cardOrder = ['trainer', 'basicShooter', 'doubleStriker', 'tank', 'slowShooter', 'burnShooter'];

  // ===== 敵人 =====
  const enemies = {
    scout: { hp: 4, secPerCell: 8, size: { w: 62, h: 94 }, color: 0x9aa3b5, light: 0xe6eaf2, shape: 'robot' },
    tough: { hp: 6, secPerCell: 8, size: { w: 62, h: 94 }, color: 0x8a5cc0, light: 0xe0ccf5, shape: 'stripe' },
    runner: { hp: 6, secPerCell: 5, size: { w: 62, h: 94 }, color: 0xe88fb0, light: 0xfde0ea, shape: 'swift' },
    armored: { hp: 12, secPerCell: 10, size: { w: 72, h: 108 }, color: 0x6c7484, light: 0xc2c9d6, shape: 'plated' },
  };

  // ===== 關卡（逐隻出怪照 plan-v2 附錄）=====
  // 例外（擁有者決定）：第 4、5 關敵人也要平均分配到當關開放的路線，
  // 不照附錄的路線（各路相差最多 1 隻：第 4 關 3／3／2／2、第 5 關 4／4／4／3 的組合）。
  const levels = [
    {
      number: 1,
      openLanes: [1, 2, 3, 4],
      requiredToStart: ['trainer', 'basicShooter'],
      tutorial: { trainer: { lane: 1, col: 1 }, basicShooter: { lane: 1, col: 6 } },
      // 只影響這一關的調整，理由記在 CLAUDE.md「第 1 關平衡」
      tune: {
        skyOrbEvery: 14,
        genEvery: 12,
        // 走速以小兵 9 → 6.5 秒為準，其他敵人照同樣比例（約 0.72 倍）
        enemies: {
          scout: { secPerCell: 6.5, hp: 8 },
          tough: { secPerCell: 5.8 },
          runner: { secPerCell: 3.6 },
          armored: { secPerCell: 7.2 },
        },
      },
      script: [
        { t: 10, wave: 1, lane: 1, kind: 'scout' },
        { t: 13, wave: 1, lane: 3, kind: 'scout' },
        { t: 16, wave: 1, lane: 2, kind: 'scout' },
        { t: 19, wave: 1, lane: 4, kind: 'scout' },
        { t: 22, wave: 2, lane: 1, kind: 'scout' },
        { t: 25, wave: 2, lane: 3, kind: 'scout' },
        { t: 28, wave: 2, lane: 2, kind: 'scout' },
        { t: 31, wave: 2, lane: 4, kind: 'scout' },
      ],
    },
  ];

  const modes = {
    // 宇鋒 2026-11-08 要求稍難（原本 0.75 倍、5 次），理由與試玩數據見 CLAUDE.md
    together: { speedMul: 0.75, rescues: 3, autoWaveHint: true },
    solo: { speedMul: 1, rescues: 3, autoWaveHint: false },
  };

  PD.names = names;
  PD.text = text;
  PD.config = {
    layout, units, cardOrder, enemies, levels, modes,
    speedSteps: [1, 2, 3], // 速度鈕循環的倍率
    rules: {
      tickSeconds: 0.05,
      spawnX: 11, villageX: 0.5,
      startBalls: fast ? 1500 : 200,
      maxBalls: 9999,
      orbValue: 25,
      skyOrbEvery: 10,
      orbFallSeconds: 1,
      orbAutoCollectAfter: 5,
      placeCooldown: 0.4,
      lockWait: 0.5,
      enemyContactEvery: 2,
      enemyContactDamage: 1,
    },
    fx: {
      maxParticles: 200,
      ambientMaxUsed: 110, // 塵土、小火星、水滴這類背景粒子：場上粒子超過這個數就不再新增，把額度留給命中特效
      contactStars: 5,
      hitParticles: 8,
      starParticles: 24,
      projectileSeconds: 0.14,
      shakeMs: 140,
      shakeIntensity: 0.004,
      shakeMinGapMs: 1000,
    },
    // 只給自動測試／開發用
    debug: {
      fast,
      dev: params.get('dev') === '1',
      timeScale: fast ? 3 : 1,
      unlockAll: fast,
    },
  };

  document.title = names.game;
})();
