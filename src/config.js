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
    // 第 2、3 關的新敵人（圖用 batch3 專屬貼圖，缺圖才退回已公開貼圖重新上色，見 enemies 的 art／artFrom）
    bruiser: '鐵甲熊兵',
    healer: '補補蛙',
    jumper: '彈跳蜥',
    splitter: '雙胞搗蛋',
    splitling: '小搗蛋',
    // 第 4～6 關的新敵人（同樣用四張已公開貼圖重新上色，再用程式畫配件）
    flyer: '飄飄翼',
    lobber: '丟丟猴',
    phantom: '躲躲影',
    boss: '鐵鎚隊長',
    finalBoss: '鼓鼓隊長', // 第 6 關最終魔王（宇鋒 2026-11-10 核准的頭目圖暫名；原暫名「搗蛋大王」）
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
    waveHintTitle: (lane) => `第 ${lane} 路有${names.enemyTeam}要來了`,
    waveHintMsg: '從右邊來了，看那一條路！',
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
    startersFirst: `要先把${names.trainer}和${names.basicShooter}放出來喔`,
    startersEveryLevel: `每一關都先放「${names.trainer}」和「${names.basicShooter}」`,
    mapTitle: '選一關出發',
    levelLabel: (n) => `第 ${n} 關`,
    levelLocked: '先過前一關才能去',
    levelCleared: '過關了',
    starsBetter: '星星變多了！',
    newFriend: '新朋友',
    newFriendTitle: (name) => `新朋友：${name}！`,
    friendDesc: {
      doubleStriker: '用藤鞭連打兩下，放在前面吧',
      tank: `很耐打，幫大家擋住${names.enemyTeam}`,
      slowShooter: '噴水讓敵人走得慢吞吞',
      burnShooter: '小火苗打中後還會再扣血',
      pierceShooter: '波紋一次打中整條路',
    },
    gotIt: '好耶',
    nextLevel: '下一關',
    backToMap: '回地圖',
    changeMode: '換模式',
    newEnemyTitle: (name) => `新敵人：${name}`,
    enemyDesc: {
      bruiser: '很硬、走得慢，要用前排擋住',
      healer: '會幫旁邊的同伴補血，先打它',
      jumper: '會跳過第一個擋路的朋友',
      splitter: '打倒後會變成兩隻小的',
      flyer: '會飛過前排！要靠會射遠的朋友打它',
      lobber: '會丟球打後面射遠的朋友，先打它',
      phantom: '會突然隱身，亮起來時再打它',
      boss: '又大又硬，還會叫小兵來幫忙',
      finalBoss: '搗蛋團的大隊長！會敲鼓讓大家走快',
    },
    terrainNoPlace: '這裡不能放朋友喔',
    bossComing: '隊長要來了，準備好！',
    rallyHint: '咚咚咚！敵人走快了',
    levelTipTitle: '這一關的場地',
    levelTip: {
      4: '小河裡不能放朋友，敵人過河會變慢',
      5: '燈籠格上的朋友打得快，隱身的敵人也藏不住',
      6: '營地那一排不能放朋友，敵人踩到鼓墊會變快',
    },
    // 新招式第一次能用時的提示（和新敵人提示同一套畫面）
    newSkillTitle: (name) => `新招式：${name}！`,
    skillDesc: {
      trainer: '天上馬上掉下 2 顆能量球',
      basicShooter: '一下子打得好快好快',
      doubleStriker: '藤蔓把前面的敵人纏住',
      tank: '翻個身補血，還把敵人壓回去',
      slowShooter: '大浪把整條路的敵人沖回去',
      burnShooter: '在前面鋪一條火焰地毯',
      pierceShooter: '四條路的敵人一起被打到',
    },
    spotSkill: '點發亮的角色就能放招',
    spotCard: '新卡片在這裡',
    skillWait: '還要等一下才能再用',
    skillReady: '朋友發亮了！點它就能放招',
    // 圖鑑（大地圖右上的按鈕）：句子給 5 歲孩子聽得懂；搗蛋團是調皮，不是壞
    bestiary: '圖鑑',
    bestiaryTitle: '圖鑑',
    bestiaryFriends: '好朋友',
    bestiaryEnemies: names.enemyTeam,
    bestiaryUnknownName: '？？？',
    bestiaryUnknown: '還沒遇到，繼續冒險就會遇到喔！',
    bestiaryTapHint: '點一格可以放大看',
    bestiaryDesc: {
      trainer: `會收集${names.orb}，請好朋友們出來幫忙。`,
      basicShooter: `會射小閃電，幫忙擋住${names.enemyTeam}。`,
      doubleStriker: '用藤鞭啪啪打兩下，站在前面好勇敢。',
      tank: `睡得飽飽又很耐打，幫大家擋住${names.enemyTeam}。`,
      slowShooter: `噴水水，讓${names.enemyTeam}走得慢吞吞。`,
      burnShooter: '尾巴有小火苗，打中會熱熱的。',
      pierceShooter: '亮晶晶的波紋，一次打到整條路。',
      scout: `${names.enemyTeam}的小跟班，最喜歡惡作劇。`,
      tough: '身上有紫色花紋，比較耐打。',
      runner: '跑得好快，急著去跑腿。',
      bruiser: '穿著鐵甲，走得慢慢的，很耐打。',
      healer: '會幫同伴貼貼補血。',
      jumper: '腳上有彈簧，會跳過第一個朋友。',
      splitter: `被打倒時，會變成兩隻${names.splitling}。`,
      flyer: '會在天上飛，要請射遠的朋友幫忙。',
      lobber: '愛丟球玩，會丟向後面的朋友。',
      phantom: '喜歡玩躲貓貓，一下不見、一下出現。',
      armored: '殼硬硬的，走路很慢很慢。',
      boss: `${names.enemyTeam}的隊長，會叫小兵一起來玩。`,
      finalBoss: `${names.enemyTeam}的大隊長，敲鼓咚咚咚！`,
    },
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
    // 點場上角色放招的點擊範圍：以角色為中心的正方形邊長（邏輯像素）。76 在 1024×768 下約 66 點，給 5 歲孩子點；
    // 相鄰兩隻重疊時取比較近的那隻。已選卡片時不用這塊範圍（點空格照樣放角色）
    unitTapSize: 76,
    // 大地圖選關：每一關的圓鈕中心，點擊範圍是圓鈕外的正方形（200×200）
    map: {
      // 蛇行兩排：上排第 1～3 關往右，下排第 4～6 關往左；上下排相距 280，點擊範圍不重疊
      nodes: [{ x: 210, y: 290 }, { x: 590, y: 290 }, { x: 970, y: 290 }, { x: 970, y: 570 }, { x: 590, y: 570 }, { x: 210, y: 570 }],
      nodeHit: 200,
      backBtn: { x: 20, y: 16, w: 170, h: 84 },
      // 圖鑑鈕：右上角，和「換模式」同大小（1024×768 下約 148×73 點），不壓到圓鈕、木牌、小路與旗子
      bestiaryBtn: { x: 990, y: 16, w: 170, h: 84 },
    },
    // 圖鑑頁：上方兩個分頁鈕與「回地圖」鈕（都 ≥ 84 高，1024×768 下約 73 點）；下面是格子（點擊範圍＝整格）
    bestiary: {
      tabs: [{ x: 20, y: 16, w: 220, h: 84 }, { x: 256, y: 16, w: 220, h: 84 }],
      closeBtn: { x: 990, y: 16, w: 170, h: 84 },
      // 好朋友 7 格：4 欄 2 列，每格 260×318；搗蛋團 13 格：5 欄 3 列，每格 208×212（1024×768 下約 180×184 點）
      grids: [
        { x: 40, y: 124, cols: 4, w: 260, h: 318, gap: 20 },
        { x: 42, y: 124, cols: 5, w: 208, h: 212, gap: 14 },
      ],
    },
    start: {
      together: { x: 300, y: 470, w: 260, h: 130 },
      solo: { x: 620, y: 470, w: 260, h: 130 },
    },
  };

  // ===== 我方角色（內部代號不含角色名稱）=====
  // cardArt＝卡片特寫（assets/local-art/card-<代號>.png，512×512、面朝右）要取哪一塊放進卡片的頭像窗（100×82）。
  //   取的範圍都是 320×262（和頭像窗同比例）；臉放在右半邊，左上角留給價格徽章。缺檔時退回原本的小全身圖
  const units = {
    trainer: {
      cardArt: { x: 40, y: 20, w: 320, h: 262 },
      cost: 50, hp: 6, maxCount: 2, genEvery: 10,
      size: { w: 68, h: 102 }, color: 0xf2a93b, light: 0xffe2a8, icon: 'badge',
    },
    basicShooter: {
      cardArt: { x: 170, y: 30, w: 320, h: 262 },
      cost: 75, hp: 6, range: 7, interval: 2, damage: 1, fx: 'lightning',
      size: { w: 66, h: 98 }, color: 0xf5d531, light: 0xfff3b0, icon: 'bolt',
      // 本機限定的待機動畫（assets/local-art/<file>.png）；沒有檔案就用靜態圖
      idleSheet: { file: 'basicShooter-idle', frames: 6, frameMs: 140 },
    },
    doubleStriker: {
      cardArt: { x: 150, y: 70, w: 320, h: 262 },
      cost: 100, hp: 8, range: 2, interval: 2, damage: 2, secondHitDelay: 0.3, cleave: true, melee: true, fx: 'vine', // melee＝打不到飛行敵人
      size: { w: 70, h: 100 }, color: 0x46b868, light: 0xc6f2c8, icon: 'leaf',
    },
    tank: {
      cardArt: { x: 130, y: 50, w: 320, h: 262 },
      cost: 125, hp: 40, thorns: 1,
      size: { w: 82, h: 115 }, color: 0x5a7ea6, light: 0xdbe6f2, icon: 'shield',
    },
    slowShooter: {
      cardArt: { x: 150, y: 20, w: 320, h: 262 }, // 用 v2 特寫
      cost: 125, hp: 6, range: 3, interval: 2, damage: 1, fx: 'water',
      slow: { factor: 0.5, seconds: 3 },
      size: { w: 68, h: 100 }, color: 0x3aa7e8, light: 0xc8ecff, icon: 'drop',
    },
    burnShooter: {
      cardArt: { x: 90, y: 10, w: 320, h: 262 },
      cost: 150, hp: 6, range: 3, interval: 2, damage: 1, fx: 'fire',
      burn: { perSecond: 1, seconds: 3 },
      size: { w: 68, h: 100 }, color: 0xee6a3a, light: 0xffd6b8, icon: 'flame',
    },
    // 穿透波紋：同一條路前方所有敵人各打 1。range 10 表示從任何一欄都能打到出怪點
    pierceShooter: {
      // 卡片用 v2 特寫、場上用 pierceShooter.png（擁有者宇鋒 2026-11-10 要求接上，只限本機，見 CLAUDE.md）。
      // artBox＝只取原圖（200×256）有畫的那一塊（內容在 x 1～140、y 64～240），左邊多留 6 透明邊，尾巴不會被切掉；
      // 缺檔時退回程式畫的造型
      cardArt: { x: 160, y: 60, w: 320, h: 262 },
      artBox: { x: -6, y: 58, w: 152, h: 186 },
      cost: 175, hp: 6, range: 10, interval: 2, damage: 1, pierce: true, fx: 'crystal',
      size: { w: 72, h: 100 }, color: 0x7fb8ea, light: 0xe2f3ff, icon: 'gem',
    },
  };
  // ===== 解鎖表：第幾關新加入哪些朋友（改這裡就好；第 4～6 關做好時不用再動）=====
  const unlockSchedule = {
    1: ['trainer', 'basicShooter'],
    2: ['doubleStriker'],
    3: ['tank'],
    4: ['slowShooter'],
    5: ['burnShooter'],
    6: ['pierceShooter'],
  };
  Object.keys(unlockSchedule).forEach((n) => unlockSchedule[n].forEach((k) => { units[k].unlock = Number(n); }));
  const cardOrder = ['trainer', 'basicShooter', 'doubleStriker', 'tank', 'slowShooter', 'burnShooter', 'pierceShooter'];

  // ===== 主動技能（毛毛設計 docs/active-skills-v1.md；建議值，尚未實測）=====
  // cd＝冷卻秒數；一起守護（5 歲）再乘 modes.together.skillCdMul；bar＝圖示底色（中心→邊緣，docs/skill-icons-v1.md）
  const skills = {
    trainer: { cd: 70, orbs: 2, bar: ['#FFE082', '#F9A825'] },
    basicShooter: { cd: 30, seconds: 5, rate: 3, bar: ['#FFF176', '#FBC02D'] },
    burnShooter: { cd: 45, seconds: 6, cells: 3, burnSeconds: 3, bar: ['#FF8A50', '#E64A19'] },
    slowShooter: { cd: 55, push: 1, damage: 1, slowSeconds: 4, slowFactor: 0.5, bar: ['#81D4FA', '#0277BD'] },
    doubleStriker: { cd: 40, reach: 1.5, rootSeconds: 3, damage: 4, bar: ['#A5D6A7', '#2E7D32'] },
    tank: { cd: 60, heal: 0.5, reach: 1.5, damage: 3, push: 1, stunSeconds: 2, bar: ['#BCAAA4', '#5D4037'] },
    pierceShooter: { cd: 90, damage: 3, chargeSeconds: 0.4, bar: ['#B3E5FC', '#5C6BC0'] },
  };

  // ===== 敵人 =====
  const enemies = {
    scout: { hp: 4, secPerCell: 8, size: { w: 62, h: 94 }, color: 0x9aa3b5, light: 0xe6eaf2, shape: 'robot' },
    tough: { hp: 6, secPerCell: 8, size: { w: 62, h: 94 }, color: 0x8a5cc0, light: 0xe0ccf5, shape: 'stripe' },
    runner: { hp: 6, secPerCell: 5, size: { w: 62, h: 94 }, color: 0xe88fb0, light: 0xfde0ea, shape: 'swift' },
    // batch3 專屬貼圖（毛毛畫、PM 納納博士核准接入，2026-11-10；assets/local-art/，面朝左）：
    //   art.file＝場上圖 <代號>-game.png（腳底錨點：240 寬的在 (120,272)、200 寬的在 (100,240)，飄飄翼 (120,240)；錨點下方 16 像素是透明）
    //   art.anchor＝腳底錨點；art.box＝從場上圖取哪一塊：左右以錨點 x 為中心對稱、下緣正好切在錨點 y（腳踩在路上，不浮空）、
    //   上與左右各留 6 像素透明邊（含整隻不裁切）。場上角色的原點在腳底（0.5, 1），所以錨點會正好落在路面的腳底位置
    //   art.size＝場上的畫面大小（邏輯像素，只是外觀，規則不看）；art.book＝圖鑑放大圖 <代號>.png（864×1152，只有打開圖鑑才載入）
    //   圖上已有肩甲／十字／彈簧／雙胞裝飾，不再加程式配件。缺檔時：厚殼機器人、飄飄翼、丟丟猴、躲躲影退回色塊；
    //   鐵甲熊兵、補補蛙、彈跳蜥、雙胞搗蛋、小搗蛋退回下面的 artFrom 重新上色＋程式配件（artFrom＝借哪張已公開貼圖，recolor＝上色顏色，outline＝描邊色）
    armored: { art: { file: 'armored-game', book: 'armored', anchor: { x: 120, y: 272 }, box: { x: 10, y: 14, w: 220, h: 258 }, size: { w: 92, h: 108 } }, hp: 12, secPerCell: 10, size: { w: 72, h: 108 }, color: 0x6c7484, light: 0xc2c9d6, shape: 'plated' },
    bruiser: { art: { file: 'bruiser-game', book: 'bruiser', anchor: { x: 120, y: 272 }, box: { x: 28, y: 14, w: 184, h: 258 }, size: { w: 81, h: 114 } }, hp: 24, secPerCell: 5.5, size: { w: 80, h: 112 }, color: 0x6f7f92, light: 0xcfd8e3, shape: 'plated', artFrom: 'tank', recolor: 0x8596ab, outline: 0x27313d, accessory: 'pads' },
    healer: { art: { file: 'healer-game', book: 'healer', anchor: { x: 100, y: 240 }, box: { x: 40, y: 14, w: 120, h: 226 }, size: { w: 52, h: 98 } }, hp: 7, secPerCell: 3.25, size: { w: 62, h: 94 }, color: 0xf08bb4, light: 0xffe0ec, shape: 'stripe', artFrom: 'doubleStriker', recolor: 0xff7fb0, outline: 0xb0296a, accessory: 'cross', heal: { amount: 2, every: 3, reach: 2 } },
    jumper: { art: { file: 'jumper-game', book: 'jumper', anchor: { x: 100, y: 240 }, box: { x: 1, y: 55, w: 198, h: 185 }, size: { w: 86, h: 80 } }, hp: 6, secPerCell: 3, size: { w: 72, h: 80 }, bodyBox: { x: 2, y: 0, w: 68, h: 70 }, color: 0x35b5a8, light: 0xc8f5ee, shape: 'swift', artFrom: 'burnShooter', recolor: 0x2fc4b4, outline: 0x0d5a55, accessory: 'spring', hopOver: true },
    splitter: { art: { file: 'splitter-game', book: 'splitter', anchor: { x: 120, y: 272 }, box: { x: 0, y: 118, w: 240, h: 154 }, size: { w: 131, h: 84 } }, hp: 9, secPerCell: 3.25, size: { w: 58, h: 96 }, color: 0xd9544f, light: 0xffd9d0, shape: 'robot', artFrom: 'trainer', recolor: 0xe2453c, outline: 0x7a1414, accessory: 'twin', splitInto: { kind: 'splitling', count: 2 } },
    // 小搗蛋不在 batch3：取 splitter-game.png 右邊那一隻（x 128 以右；錨點取牠自己的腳底 (166, 272)）。
    //   cut＝原圖 x 小於這個值的像素丟掉（左邊那隻的尾巴不會跑進來）。沒有圖鑑大圖（圖鑑把小搗蛋併進雙胞搗蛋）
    splitling: { art: { file: 'splitter-game', anchor: { x: 166, y: 272 }, box: { x: 92, y: 118, w: 148, h: 154 }, cut: 128, size: { w: 62, h: 64 } }, hp: 3, secPerCell: 2.6, size: { w: 40, h: 66 }, color: 0xf0817a, light: 0xffe4df, shape: 'robot', artFrom: 'trainer', recolor: 0xf26a5e, outline: 0x7a1414, noOrb: true },
    // ===== 第 4～6 關（建議值，尚未實測）=====
    // accessory＝程式畫的配件（textures.js），bodyBox＝本體在圖框裡的位置（留空間給配件）；batch3 有圖的敵人只在缺圖退回時才用。
    // 飄飄翼、丟丟猴、躲躲影改用 batch3 自己的圖，不再借朋友圖上色、也不畫翅膀／帽子／眼罩；缺檔時退回色塊
    // flying：不被任何角色擋住，近戰打不到；throwAt：邊走邊丟球打同路前方的遠攻角色；cloak：顯形／隱身輪流（秒）
    flyer: {
      art: { file: 'flyer-game', book: 'flyer', anchor: { x: 120, y: 240 }, box: { x: 6, y: 18, w: 228, h: 222 }, size: { w: 110, h: 107 } },
      hp: 4, secPerCell: 3.4, size: { w: 84, h: 72 }, color: 0x7fa8ff, light: 0xdce8ff, shape: 'swift', flying: true, hover: 34,
    },
    lobber: {
      art: { file: 'lobber-game', book: 'lobber', anchor: { x: 100, y: 240 }, box: { x: 1, y: 24, w: 198, h: 216 }, size: { w: 92, h: 100 } },
      hp: 7, secPerCell: 3.6, size: { w: 62, h: 94 }, color: 0xf2b134, light: 0xfff0c8, shape: 'stripe', throwAt: { every: 4, damage: 2, reach: 5 },
    },
    phantom: {
      art: { file: 'phantom-game', book: 'phantom', anchor: { x: 100, y: 240 }, box: { x: 15, y: 14, w: 170, h: 226 }, size: { w: 75, h: 100 } },
      hp: 7, secPerCell: 3.25, size: { w: 66, h: 100 }, color: 0x7a70d8, light: 0xe4e0ff, shape: 'stripe', cloak: { visible: 3, hidden: 2.5 },
    },
    // boss：大血條、不會被推回；entryPause＝登場先站一下；homeCost＝走進村莊算掉幾次救援；orbDrop＝打倒掉幾顆球
    // art＝專屬貼圖（assets/local-art/<file>.png，宇鋒 2026-11-10 核准公開的鼓鼓隊長 v2，320×384、本來就面朝左、腳底約在 160,368）。
    //   box＝從原圖取哪一塊（左右以腳底 x＝160 為中心，含整隻不裁切），size＝有貼圖時的畫面大小，recolor＝要不要重新上色。
    //   缺檔時退回 artFrom 重新上色＋程式配件（下面原本的 size／bodyBox）
    boss: {
      art: { file: 'boss', box: { x: 14, y: 109, w: 292, h: 265 }, size: { w: 138, h: 125 }, recolor: 0xe08a2a, outline: 0x6a3a06 },
      hp: 80, secPerCell: 9, size: { w: 112, h: 132 }, bodyBox: { x: 12, y: 18, w: 90, h: 114 }, color: 0xd9892b, light: 0xffe2b0, shape: 'plated',
      artFrom: 'tank', recolor: 0xdc8a22, outline: 0x6a3a06, accessory: 'captain', boss: true, entryPause: 0.6,
      contactDamage: 4, homeCost: 2, orbDrop: 3, summon: { kind: 'scout', count: 1, every: 9, maxAlive: 4 }, aura: 0xffb347,
    },
    finalBoss: {
      art: { file: 'boss', box: { x: 14, y: 109, w: 292, h: 265 }, size: { w: 180, h: 163 } },
      hp: 260, secPerCell: 11, size: { w: 140, h: 164 }, bodyBox: { x: 14, y: 30, w: 116, h: 134 }, color: 0xb13fb0, light: 0xf8d2f4, shape: 'plated',
      artFrom: 'tank', recolor: 0xb83fc0, outline: 0x4a0f58, accessory: 'king', boss: true, entryPause: 0.6,
      contactDamage: 5, homeCost: 4, orbDrop: 3, summon: { kind: 'tough', count: 1, every: 11, maxAlive: 4 }, rally: { every: 18, seconds: 3, factor: 1.3 }, aura: 0xd070ff,
    },
  };

  // ===== 地形（第 4～6 關，資料式）=====
  // noPlace：不能放角色；speedMul：地面敵人經過時的走速倍率（飛行敵人不受影響）
  // fireRate：站在這格的角色攻擊間隔倍率；reveal：隱身敵人走到這格藏不住
  const terrainTypes = {
    water: { noPlace: true, speedMul: 0.7 },
    lantern: { fireRate: 0.75, reveal: true },
    camp: { noPlace: true },
    drumPad: { speedMul: 1.25 },
  };

  // ===== 關卡 =====
  // 用「波」來寫：at＝這一波第一隻出現的秒數，gap＝同一波每隻相隔幾秒，kinds＝出場順序。
  // 路線依 1、3、2、4 整關循環，四條路的敵人數最多只差 1 隻（擁有者決定：平均分配）。
  const LANE_ORDER = [1, 3, 2, 4];
  function makeScript(waves) {
    const script = [];
    let count = 0;
    waves.forEach((w, i) => {
      w.kinds.forEach((kind, k) => {
        script.push({ t: w.at + k * w.gap, wave: i + 1, lane: LANE_ORDER[count++ % LANE_ORDER.length], kind });
      });
      // boss：這一波固定走哪條路（不佔平均分配的順序），after＝波開始後幾秒登場
      if (w.boss) script.push({ t: w.at + (w.boss.after || 0), wave: i + 1, lane: w.boss.lane, kind: w.boss.kind });
    });
    return script.sort((a, b) => a.t - b.t); // 規則依時間順序出怪；同時間維持原順序
  }
  const many = (kind, n) => Array(n).fill(kind);
  const loop = (kinds, n) => [].concat(...Array(n).fill(kinds));
  // 第 4 關起共用的敵人數值（和第 3 關同級）
  const LATE_ENEMIES = {
    scout: { secPerCell: 3.25, hp: 5 },
    tough: { secPerCell: 3.25, hp: 8 },
    runner: { secPerCell: 2, hp: 5 },
    armored: { secPerCell: 5, hp: 14 },
  };

  const levels = [
    {
      number: 1,
      openLanes: [1, 2, 3, 4],
      // 主題色票（scenery.js 用程式畫，不產生圖檔）：第 1 關・晴天草原
      theme: {
        grassA: ['#9CC77A', '#80AE64'], grassB: ['#8FBD70', '#76A35C'], rest: ['#8d998c', '#79857a'],
        spawn: ['#5e5680', '#3a3556'], village: ['#d6c698', '#ad9869'], pennants: ['#ff8fb0', '#ffd84a'],
        warm: '255,244,200', warmAlpha: 0.22, flower: 'flower', flowerChance: 0.45,
      },
      requiredToStart: ['trainer', 'basicShooter'],
      tutorial: { trainer: { lane: 1, col: 1 }, basicShooter: { lane: 1, col: 6 } },
      // 各關 tune 只影響該關，理由與試玩結果記在 CLAUDE.md「各關目標與結果」
      tune: {
        skyOrbEvery: 18,
        genEvery: 18,
        killOrbEvery: 3,
        // 2026-11-10 宇鋒要求稍加壓：小兵 5→6 血、終局波每 0.33→0.32 秒一隻（合理玩家終局波要掉一點命，仍是教學關）
        enemies: { scout: { secPerCell: 3.25, hp: 6 } },
      },
      script: makeScript([
        { at: 18, gap: 6, kinds: many('scout', 4) },
        { at: 54, gap: 5, kinds: many('scout', 5) },
        { at: 88, gap: 3.5, kinds: many('scout', 7) },
        { at: 124, gap: 2.5, kinds: many('scout', 10) },
        { at: 162, gap: 0.32, kinds: many('scout', 66) }, // 終局波
      ]),
    },
    {
      number: 2,
      openLanes: [1, 2, 3, 4],
      // 第 2 關・森林小徑：偏藍的深綠草地、小香菇，出怪區旁有小松樹
      theme: {
        grassA: ['#7FB07A', '#649660'], grassB: ['#74A670', '#5A8C58'], rest: ['#86948A', '#74827A'],
        spawn: ['#4E5E86', '#2F3A5E'], village: ['#CDBB8E', '#A28C60'], pennants: ['#9BE07A', '#FFD84A'],
        warm: '220,255,210', warmAlpha: 0.16, flower: 'mushroom', flowerChance: 0.3, decor: 'pine',
      },
      requiredToStart: ['trainer', 'basicShooter'],
      tutorial: { trainer: { lane: 1, col: 1 }, basicShooter: { lane: 1, col: 6 } },
      tune: {
        skyOrbEvery: 16,
        genEvery: 16,
        killOrbEvery: 2,
        enemies: { scout: { secPerCell: 3.25, hp: 5 }, tough: { secPerCell: 3.25, hp: 8 } },
      },
      script: makeScript([
        { at: 16, gap: 6, kinds: many('scout', 4) },
        { at: 52, gap: 5, kinds: ['scout', 'tough', 'scout', 'tough', 'scout'] },
        { at: 88, gap: 3.5, kinds: ['tough', 'scout', 'bruiser', 'scout', 'tough', 'scout', 'bruiser', 'scout'] },
        { at: 124, gap: 2.5, kinds: ['tough', 'healer', 'tough', 'bruiser', 'tough', 'healer', 'tough', 'bruiser', 'tough', 'tough'] },
        { at: 162, gap: 0.45, kinds: loop(['tough', 'bruiser', 'healer', 'tough'], 12) }, // 終局波
      ]),
    },
    {
      number: 3,
      openLanes: [1, 2, 3, 4],
      // 第 3 關・秋日麥田：黃綠色草地、落葉，出怪區旁有小草堆
      theme: {
        grassA: ['#B2C06C', '#93A452'], grassB: ['#A6B662', '#889A4A'], rest: ['#9A9A88', '#848474'],
        spawn: ['#7A4A6E', '#4C2C48'], village: ['#E6C88E', '#C29E62'], pennants: ['#FFB347', '#FF7F7F'],
        warm: '255,220,150', warmAlpha: 0.22, path: '236,214,150', flower: 'leaf', flowerChance: 0.38, decor: 'haystack',
      },
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
          bruiser: { hp: 20 }, // 2026-11-10：24→20，貪婪亂放的玩家輸太多（合理玩家不受影響）
        },
      },
      script: makeScript([
        { at: 16, gap: 6, kinds: ['scout', 'scout', 'tough', 'tough'] },
        { at: 52, gap: 5, kinds: ['runner', 'scout', 'jumper', 'runner', 'jumper'] },
        { at: 88, gap: 3.5, kinds: ['tough', 'splitter', 'bruiser', 'runner', 'jumper', 'splitter', 'healer', 'runner'] },
        { at: 124, gap: 2.5, kinds: loop(['splitter', 'jumper'], 5) },
        // 終局波：分裂的小隻很多，靠藤芽蛙的範圍藤鞭最有效，只放電電鼠擋不住
        { at: 162, gap: 0.45, kinds: loop(['splitter', 'jumper', 'bruiser', 'splitter', 'healer'], 7) },
      ]),
    },
    {
      // 第 4 關・水岸黃昏：第 6 欄是小河，不能放角色、地面敵人走得慢
      number: 4,
      openLanes: [1, 2, 3, 4],
      requiredToStart: ['trainer', 'basicShooter'],
      tutorial: { trainer: { lane: 1, col: 1 }, basicShooter: { lane: 1, col: 5 } },
      terrain: [{ type: 'water', lanes: [1, 2, 3, 4], cols: [6] }],
      // 圖檔背景（scenery.js 的 drawBgArt）：以上方中央為中心放大 1.12 倍，把左下、右下的高灌木推出第 4 路的頭尾格；
      // 草偏冷綠，疊一層極淡的橘色營造黃昏。缺檔時用下面 theme 的程式草地
      bgArt: { file: 'bg-level4', scale: 1.12, ax: 590, ay: 0, tint: '255,150,70', tintAlpha: 0.08 },
      theme: {
        grassA: ['#7CB8A0', '#5F9A86'], grassB: ['#6AAF96', '#4E8F7A'], rest: ['#8AA29A', '#78908A'],
        spawn: ['#3A5F8A', '#243B5C'], village: ['#E2C39A', '#C4A074'], pennants: ['#FFD84A', '#7FD4FF'],
        warm: '180,220,255', warmAlpha: 0.14, path: '170,200,210', pathAlpha: 0.22, flower: 'reed', flowerChance: 0.22, decor: 'ripple',
      },
      tune: { skyOrbEvery: 15, genEvery: 15, killOrbEvery: 2, enemies: LATE_ENEMIES },
      script: makeScript([
        { at: 16, gap: 5, kinds: ['scout', 'tough', 'scout', 'scout'] },
        { at: 48, gap: 4.5, kinds: ['flyer', 'scout', 'flyer', 'tough', 'scout', 'flyer'] },
        { at: 84, gap: 3.5, kinds: ['lobber', 'tough', 'bruiser', 'flyer', 'lobber', 'healer', 'tough', 'flyer'] },
        { at: 120, gap: 2.6, kinds: loop(['bruiser', 'lobber', 'splitter', 'tough'], 3) },
        { at: 158, gap: 3, kinds: loop(['tough', 'flyer', 'healer'], 3), boss: { kind: 'boss', lane: 3 } }, // 隊長波
        // 終局波：小隻多（要範圍藤鞭）、丟丟猴多（只放遠攻會被打掉）
        { at: 206, gap: 0.36, kinds: loop(['splitter', 'lobber', 'splitter', 'bruiser', 'lobber', 'splitter', 'tough', 'flyer'], 6) },
      ]),
    },
    {
      // 第 5 關・夜燈果園：燈籠格讓角色打得快，也讓隱身敵人現形
      number: 5,
      openLanes: [1, 2, 3, 4],
      requiredToStart: ['trainer', 'basicShooter'],
      tutorial: { trainer: { lane: 1, col: 1 }, basicShooter: { lane: 1, col: 6 } },
      terrain: [
        { type: 'lantern', lanes: [1, 3], cols: [4, 8] },
        { type: 'lantern', lanes: [2, 4], cols: [6] },
      ],
      bgArt: { file: 'bg-level5', scale: 1 },
      theme: {
        grassA: ['#4F7358', '#3A5744'], grassB: ['#46684F', '#334D3D'], rest: ['#5A6A60', '#4A5850'],
        spawn: ['#2A1F3D', '#151022'], village: ['#8B7355', '#5E4A36'], pennants: ['#FFB86B', '#C9A0FF'],
        chromeTop: ['#1B2438', '#152033'], chromeBot: ['#1B2438', '#152033'],
        warm: '255,210,140', warmAlpha: 0.16, edgeAlpha: 0.38, flower: 'fruit', flowerChance: 0.3, decor: 'lantern',
      },
      tune: { skyOrbEvery: 13, genEvery: 13, killOrbEvery: 2, enemies: LATE_ENEMIES },
      script: makeScript([
        { at: 16, gap: 5, kinds: ['tough', 'scout', 'phantom', 'scout'] },
        { at: 48, gap: 4, kinds: ['phantom', 'tough', 'phantom', 'flyer', 'armored', 'phantom'] },
        { at: 84, gap: 3.2, kinds: ['armored', 'phantom', 'lobber', 'healer', 'phantom', 'flyer', 'tough', 'armored', 'phantom'] },
        { at: 120, gap: 2.4, kinds: loop(['phantom', 'splitter', 'flyer', 'lobber'], 3) },
        { at: 156, gap: 2.8, kinds: loop(['phantom', 'tough', 'healer', 'flyer'], 3), boss: { kind: 'boss', lane: 2 } }, // 隊長波
        { at: 208, gap: 0.5, kinds: loop(['armored', 'phantom', 'flyer', 'lobber', 'splitter'], 7) }, // 終局波
      ]),
    },
    {
      // 第 6 關・帳篷決戰：第 10 欄是搗蛋團營地，鼓墊讓敵人變快；最後一波是大王
      number: 6,
      openLanes: [1, 2, 3, 4],
      requiredToStart: ['trainer', 'basicShooter'],
      tutorial: { trainer: { lane: 1, col: 1 }, basicShooter: { lane: 1, col: 6 } },
      terrain: [
        { type: 'camp', lanes: [1, 2, 3, 4], cols: [10] },
        { type: 'drumPad', lanes: [1, 3], cols: [8] },
        { type: 'drumPad', lanes: [2, 4], cols: [5] },
      ],
      bgArt: { file: 'bg-level6', scale: 1 },
      theme: {
        grassA: ['#8AAE72', '#6F945C'], grassB: ['#80A469', '#678A55'], rest: ['#8D998C', '#79857A'],
        spawn: ['#6B3F7A', '#3E2450'], spawnMist: 'rgba(255,200,230,0.12)', pennants: ['#FF8E6E', '#FFE082'],
        warm: '255,244,200', warmAlpha: 0.2, flower: 'flower', flowerChance: 0.3, decor: 'tent',
      },
      // 2026-11-10 宇鋒要求：收緊經濟（貪婪玩家不再鋪滿）、合理玩家自己挑戰約 60～80%。
      // 擊倒每 3 隻才掉球（原 2）；隊長 80→60 血、鼓鼓隊長 260→180 血。
      // 一起守護敵人走得慢、整局較長，收入另外拉長（天空與小勇 13 秒、每 4 隻掉球），不然貪婪玩家一樣會鋪滿
      tune: {
        skyOrbEvery: 12, genEvery: 12, killOrbEvery: 3,
        enemies: Object.assign({}, LATE_ENEMIES, { boss: { hp: 60 }, finalBoss: { hp: 180 } }),
        byMode: { together: { skyOrbEvery: 13, genEvery: 13, killOrbEvery: 4 } },
      },
      script: makeScript([
        { at: 16, gap: 4.5, kinds: ['tough', 'flyer', 'scout', 'phantom', 'tough'] },
        { at: 46, gap: 4.2, kinds: ['armored', 'lobber', 'tough', 'flyer', 'splitter', 'phantom'] },
        { at: 84, gap: 4, kinds: ['bruiser', 'tough', 'flyer', 'phantom', 'lobber', 'tough', 'flyer', 'bruiser', 'phantom'] },
        { at: 124, gap: 3.4, kinds: ['tough', 'flyer', 'healer', 'tough', 'flyer', 'tough', 'healer'], boss: { kind: 'boss', lane: 3 } }, // 隊長波
        { at: 168, gap: 2.4, kinds: loop(['splitter', 'phantom', 'flyer', 'lobber'], 3) },
        { at: 202, gap: 1, kinds: loop(['armored', 'flyer', 'phantom', 'lobber'], 5) },
        { at: 240, gap: 2.6, kinds: loop(['tough', 'phantom', 'flyer', 'healer'], 4), boss: { kind: 'finalBoss', lane: 2 } }, // 大王波
      ]),
    },
  ];

  const modes = {
    // 宇鋒 2026-11-08 要求稍難（原本 0.75 倍、5 次），理由與試玩數據見 CLAUDE.md
    // skillCdMul：5 歲模式技能冷卻短 20%（active-skills-v1）；「5 歲模式」對應「一起守護」
    together: { speedMul: 0.75, rescues: 3, autoWaveHint: true, skillCdMul: 0.8, showSkillSeconds: false },
    solo: { speedMul: 1, rescues: 3, autoWaveHint: false, skillCdMul: 1, showSkillSeconds: true },
  };

  // 關卡星星（擁有者 2026-11-10 要求）：看過關時還剩幾次救援（畫面上的盾牌）。
  // 滿的 3 次都在＝3 星、剩 2 次＝2 星、剩 1 次或 0 次＝1 星；過關至少 1 星。
  // 兩種模式目前都是 3 次；若以後某模式次數不同，就照比例換算（剩下的比例 × 3，無條件進位）。
  PD.levelStars = function (left, max) {
    if (!(max > 0)) return 3;
    const n = Math.ceil((3 * Math.max(0, Math.min(left, max))) / max - 1e-9);
    return Math.max(1, Math.min(3, n));
  };

  PD.names = names;
  PD.makeScript = makeScript; // 自動試玩試算不同的波次時也用同一套排路線的規則
  PD.text = text;
  PD.config = {
    layout, units, cardOrder, enemies, levels, modes, skills, terrainTypes,
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
      bossWarnSeconds: 1.2, // 隊長登場前，出怪區先輕輕脈衝
    },
    fx: {
      maxParticles: 200,
      ambientMaxUsed: 110, // 塵土、小火星、水滴這類背景粒子：場上粒子超過這個數就不再新增，把額度留給命中特效
      contactStars: 5,
      hitParticles: 8,
      starParticles: 14, // 打倒時的小星星（原 24，美化提案第 5 項：主星更清楚、周圍不要太密）
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
