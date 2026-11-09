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
    pierceShooter: '水晶龍',
    // 第 2、3 關的新敵人（圖都是四張已公開貼圖重新上色，見 enemies 的 artFrom）
    bruiser: '鐵甲熊兵',
    healer: '補補蛙',
    jumper: '彈跳蜥',
    splitter: '雙胞搗蛋',
    splitling: '小搗蛋',
    // 主動技能
    skill_trainer: '能量大豐收',
    skill_basicShooter: '閃電連發',
    skill_burnShooter: '火焰地毯',
    skill_slowShooter: '大浪沖沖',
    skill_doubleStriker: '藤蔓纏纏',
    skill_tank: '翻身大壓',
    skill_pierceShooter: '水晶彗星',
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
    startersFirst: `先放${names.trainer}和${names.basicShooter}`,
    mapTitle: '選一關出發',
    levelLabel: (n) => `第 ${n} 關`,
    levelLocked: '先過前一關才能去',
    levelCleared: '過關了',
    newFriend: '新朋友',
    nextLevel: '下一關',
    backToMap: '回地圖',
    changeMode: '換模式',
    newEnemyTitle: (name) => `新敵人：${name}`,
    enemyDesc: {
      bruiser: '很硬、走得慢，要用前排擋住',
      healer: '會幫旁邊的同伴補血，先打它',
      jumper: '會跳過第一個擋路的朋友',
      splitter: '打倒後會變成兩隻小的',
    },
    skillTap: (name) => `${name}：再點圓鈕`,
    skillWait: '還要等一下才能再用',
    skillReady: '可以放招了！點朋友，再點圓鈕',
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
    // 七張卡：118×120、間距 6，x 20～882（在 1024×768 的 iPad 上寬約 102 點）
    cards: { x: 20, y: 676, w: 118, h: 120, gap: 6 },
    cancelBtn: { x: 1040, y: 676, w: 120, h: 120 },
    recallBtn: { x: 896, y: 676, w: 136, h: 120 },
    recallGuardSeconds: 0.35, // 防止手抖連點：第一次點角色後，這段時間內的第二下不算
    orbHitSize: 64,
    // 技能圓鈕：78 ÷ 1180 × 1024 ≈ 67.7 點，在小 iPad 上仍大於 64 點
    skillBtn: { size: 78, gapAboveHead: 12, minCenterY: 124, autoCloseSeconds: 3 },
    // 大地圖選關：每一關的圓鈕中心，點擊範圍是圓鈕外的正方形（200×200）
    map: {
      nodes: [{ x: 230, y: 500 }, { x: 590, y: 320 }, { x: 950, y: 500 }],
      nodeHit: 200,
      backBtn: { x: 20, y: 16, w: 170, h: 84 },
    },
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
      cost: 75, hp: 6, unlock: 1, range: 4, interval: 2, damage: 1, fx: 'lightning',
      size: { w: 66, h: 98 }, color: 0xf5d531, light: 0xfff3b0, icon: 'bolt',
      // 本機限定的待機動畫（assets/local-art/<file>.png）；沒有檔案就用靜態圖
      idleSheet: { file: 'basicShooter-idle', frames: 6, frameMs: 140 },
    },
    doubleStriker: {
      cost: 100, hp: 8, unlock: 2, range: 2, interval: 2, damage: 2, secondHitDelay: 0.3, cleave: true, fx: 'vine',
      size: { w: 70, h: 100 }, color: 0x46b868, light: 0xc6f2c8, icon: 'leaf',
    },
    tank: {
      cost: 125, hp: 40, unlock: 3, thorns: 1,
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
    // 穿透波紋：同一條路前方所有敵人各打 1。range 10 表示從任何一欄都能打到出怪點
    pierceShooter: {
      cost: 175, hp: 6, unlock: 6, range: 10, interval: 2, damage: 1, pierce: true, fx: 'crystal',
      size: { w: 68, h: 100 }, color: 0x7fb8ea, light: 0xe2f3ff, icon: 'gem',
    },
  };
  const cardOrder = ['trainer', 'basicShooter', 'doubleStriker', 'tank', 'slowShooter', 'burnShooter', 'pierceShooter'];

  // ===== 主動技能（毛毛設計 docs/active-skills-v1.md；建議值，尚未實測）=====
  // cd＝冷卻秒數；一起守護（5 歲）再乘 modes.together.skillCdMul
  const skills = {
    trainer: { cd: 45, orbs: 2 },
    basicShooter: { cd: 20, seconds: 5, rate: 3 },
    burnShooter: { cd: 30, seconds: 6, cells: 3, burnSeconds: 3 },
    slowShooter: { cd: 35, push: 1, damage: 1, slowSeconds: 4, slowFactor: 0.5 },
    doubleStriker: { cd: 25, reach: 1.5, rootSeconds: 3, damage: 4 },
    tank: { cd: 40, heal: 0.5, reach: 1.5, damage: 3, push: 1, stunSeconds: 2 },
    pierceShooter: { cd: 60, damage: 3, chargeSeconds: 0.4 },
  };

  // ===== 敵人 =====
  const enemies = {
    scout: { hp: 4, secPerCell: 8, size: { w: 62, h: 94 }, color: 0x9aa3b5, light: 0xe6eaf2, shape: 'robot' },
    tough: { hp: 6, secPerCell: 8, size: { w: 62, h: 94 }, color: 0x8a5cc0, light: 0xe0ccf5, shape: 'stripe' },
    runner: { hp: 6, secPerCell: 5, size: { w: 62, h: 94 }, color: 0xe88fb0, light: 0xfde0ea, shape: 'swift' },
    armored: { hp: 12, secPerCell: 10, size: { w: 72, h: 108 }, color: 0x6c7484, light: 0xc2c9d6, shape: 'plated' },
    // artFrom＝用哪張已公開貼圖重新上色（程式即時畫，不產生新圖檔），recolor＝上色的顏色，outline＝描邊色。缺貼圖時退回 shape 色塊
    bruiser: { hp: 24, secPerCell: 5.5, size: { w: 80, h: 112 }, color: 0x6f7f92, light: 0xcfd8e3, shape: 'plated', artFrom: 'tank', recolor: 0x8596ab, outline: 0x27313d },
    healer: { hp: 7, secPerCell: 3.25, size: { w: 62, h: 94 }, color: 0xf08bb4, light: 0xffe0ec, shape: 'stripe', artFrom: 'doubleStriker', recolor: 0xff7fb0, outline: 0xb0296a, heal: { amount: 2, every: 3, reach: 2 } },
    jumper: { hp: 6, secPerCell: 3, size: { w: 72, h: 80 }, color: 0x35b5a8, light: 0xc8f5ee, shape: 'swift', artFrom: 'burnShooter', recolor: 0x2fc4b4, outline: 0x0d5a55, hopOver: true },
    splitter: { hp: 9, secPerCell: 3.25, size: { w: 58, h: 96 }, color: 0xd9544f, light: 0xffd9d0, shape: 'robot', artFrom: 'trainer', recolor: 0xe2453c, outline: 0x7a1414, splitInto: { kind: 'splitling', count: 2 } },
    splitling: { hp: 3, secPerCell: 2.6, size: { w: 40, h: 66 }, color: 0xf0817a, light: 0xffe4df, shape: 'robot', artFrom: 'trainer', recolor: 0xf26a5e, outline: 0x7a1414, noOrb: true },
  };

  // ===== 關卡 =====
  // 用「波」來寫：at＝這一波第一隻出現的秒數，gap＝同一波每隻相隔幾秒，kinds＝出場順序。
  // 路線依 1、3、2、4 整關循環，四條路的敵人數最多只差 1 隻（擁有者決定：平均分配）。
  const LANE_ORDER = [1, 3, 2, 4];
  function makeScript(waves) {
    const script = [];
    waves.forEach((w, i) => {
      w.kinds.forEach((kind, k) => {
        script.push({ t: w.at + k * w.gap, wave: i + 1, lane: LANE_ORDER[script.length % LANE_ORDER.length], kind });
      });
    });
    return script;
  }
  const many = (kind, n) => Array(n).fill(kind);

  const levels = [
    {
      number: 1,
      openLanes: [1, 2, 3, 4],
      requiredToStart: ['trainer', 'basicShooter'],
      tutorial: { trainer: { lane: 1, col: 1 }, basicShooter: { lane: 1, col: 6 } },
      // 各關 tune 只影響該關，理由與試玩結果記在 CLAUDE.md「各關目標與結果」
      tune: {
        skyOrbEvery: 16,
        genEvery: 16,
        killOrbEvery: 2,
        enemies: { scout: { secPerCell: 3.25, hp: 5 } },
      },
      script: makeScript([
        { at: 18, gap: 6, kinds: many('scout', 4) },
        { at: 54, gap: 5, kinds: many('scout', 5) },
        { at: 88, gap: 3.5, kinds: many('scout', 7) },
        { at: 124, gap: 2.5, kinds: many('scout', 10) },
        { at: 162, gap: 0.35, kinds: many('scout', 60) }, // 終局波
      ]),
    },
    {
      number: 2,
      openLanes: [1, 2, 3, 4],
      requiredToStart: ['trainer', 'basicShooter'],
      tutorial: { trainer: { lane: 1, col: 1 }, basicShooter: { lane: 1, col: 6 } },
      tune: {
        skyOrbEvery: 14,
        genEvery: 14,
        killOrbEvery: 2,
        enemies: { scout: { secPerCell: 3.25, hp: 5 }, tough: { secPerCell: 3.25, hp: 8 } },
      },
      script: makeScript([
        { at: 16, gap: 6, kinds: many('scout', 4) },
        { at: 52, gap: 5, kinds: ['scout', 'tough', 'scout', 'tough', 'scout'] },
        { at: 88, gap: 3.5, kinds: ['tough', 'scout', 'bruiser', 'scout', 'tough', 'scout', 'bruiser', 'scout'] },
        { at: 124, gap: 2.5, kinds: ['tough', 'healer', 'tough', 'bruiser', 'tough', 'healer', 'tough', 'bruiser', 'tough', 'tough'] },
        { at: 162, gap: 0.5, kinds: [].concat(...Array(10).fill(['tough', 'bruiser', 'healer', 'tough'])) }, // 終局波
      ]),
    },
    {
      number: 3,
      openLanes: [1, 2, 3, 4],
      requiredToStart: ['trainer', 'basicShooter'],
      tutorial: { trainer: { lane: 1, col: 1 }, basicShooter: { lane: 1, col: 6 } },
      tune: {
        skyOrbEvery: 14,
        genEvery: 14,
        killOrbEvery: 2,
        enemies: {
          scout: { secPerCell: 3.25, hp: 5 },
          tough: { secPerCell: 3.25, hp: 8 },
          runner: { secPerCell: 2, hp: 5 },
        },
      },
      script: makeScript([
        { at: 16, gap: 6, kinds: ['scout', 'scout', 'tough', 'tough'] },
        { at: 52, gap: 5, kinds: ['runner', 'scout', 'jumper', 'runner', 'jumper'] },
        { at: 88, gap: 3.5, kinds: ['tough', 'splitter', 'bruiser', 'runner', 'jumper', 'splitter', 'healer', 'runner'] },
        { at: 124, gap: 2.5, kinds: [].concat(...Array(5).fill(['splitter', 'jumper'])) },
        { at: 162, gap: 0.5, kinds: [].concat(...Array(8).fill(['bruiser', 'splitter', 'jumper', 'healer'])) }, // 終局波
      ]),
    },
  ];

  const modes = {
    // 宇鋒 2026-11-08 要求稍難（原本 0.75 倍、5 次），理由與試玩數據見 CLAUDE.md
    // skillCdMul：5 歲模式技能冷卻短 20%（active-skills-v1）；「5 歲模式」對應「一起守護」
    together: { speedMul: 0.75, rescues: 3, autoWaveHint: true, skillCdMul: 0.8 },
    solo: { speedMul: 1, rescues: 3, autoWaveHint: false, skillCdMul: 1 },
  };

  PD.names = names;
  PD.makeScript = makeScript; // 自動試玩試算不同的波次時也用同一套排路線的規則
  PD.text = text;
  PD.config = {
    layout, units, cardOrder, enemies, levels, modes, skills,
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
      enemyContactDamage: 2,
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
