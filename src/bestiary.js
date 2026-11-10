// 圖鑑：記錄孩子「遇到過」哪些好朋友與搗蛋團，在大地圖右上的「圖鑑」鈕打開。兩種模式共用同一本。
// 存在 localStorage 的 pd.bestiary.v1（和過關進度 pd.progress.v1 分開），內容例如
//   {"v":1,"friends":["trainer","basicShooter"],"enemies":["scout"]}
// 讀不到、內容損毀或代號不認得，一律當作沒遇到（空圖鑑），不影響過關進度；存不進去就只記在這次開啟的記憶體裡。
// 遇到的定義：
//   好朋友＝進入某一關的戰鬥時，這位角色的卡片在那一關已經解鎖（照 unlockSchedule，不看 debug.unlockAll）
//   搗蛋團＝這隻敵人真的出現在場上（畫面生出它的那一刻記錄）；小搗蛋併在雙胞搗蛋裡，不另列
window.PD = window.PD || {};

PD.Bestiary = (function () {
  const KEY = 'pd.bestiary.v1';
  let memory = null;
  const known = new Set(); // 這次開啟已確認記過的，避免每生一隻敵人都去讀寫 localStorage

  function clean(list, allowed) {
    if (!Array.isArray(list)) return [];
    return list.filter((k, i) => typeof k === 'string' && allowed.indexOf(k) >= 0 && list.indexOf(k) === i);
  }

  function read() {
    if (memory) return memory;
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* 損毀：當作空圖鑑 */ }
    if (!d || typeof d !== 'object' || Array.isArray(d) || d.v !== 1) d = {};
    return { v: 1, friends: clean(d.friends, PD.config.cardOrder), enemies: clean(d.enemies, Object.keys(PD.config.enemies)) };
  }

  function write(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      memory = null;
    } catch (e) {
      memory = data;
    }
  }

  function add(field, kinds) {
    const fresh = kinds.filter((k) => !known.has(field + ':' + k));
    if (!fresh.length) return;
    const data = read();
    const added = fresh.filter((k) => data[field].indexOf(k) < 0);
    fresh.forEach((k) => known.add(field + ':' + k));
    if (!added.length) return;
    data[field] = data[field].concat(added);
    write(data);
  }

  // 圖鑑要列的搗蛋團：關卡腳本裡真的會出現的敵人，依第一次登場的順序；小搗蛋併進雙胞搗蛋
  function enemyList() {
    const seen = [];
    PD.config.levels.forEach((lv) => lv.script.forEach((e) => {
      const k = e.kind === 'splitling' ? 'splitter' : e.kind;
      if (seen.indexOf(k) < 0) seen.push(k);
    }));
    return seen;
  }

  return {
    KEY,
    read,
    enemyList,
    has: (field, kind) => read()[field].indexOf(kind) >= 0,
    // 進入某一關戰鬥：這一關已解鎖的好朋友都算遇到
    enterLevel(number) {
      add('friends', PD.config.cardOrder.filter((k) => PD.config.units[k].unlock <= number));
    },
    seeEnemy(kind) {
      add('enemies', [kind === 'splitling' ? 'splitter' : kind]);
    },
    // 測試用：localStorage 被外部改掉後重新讀
    forget() { known.clear(); memory = null; },
  };
})();

// 說明句換行：先在「，」「、」後面切成小段，再一段一段排進每行（每行最多 max 個字），
// 不會把「喜歡」「遇到」這種詞從中間切開；單一小段本身就太長時，才交給文字框照寬度換行
PD.lineBreak = (s, max) => {
  const parts = s.match(/[^，、]+[，、]?/g) || [];
  const lines = [];
  parts.forEach((p) => {
    const i = lines.length - 1;
    if (i >= 0 && lines[i].length + p.length <= max) lines[i] += p;
    else lines.push(p);
  });
  return lines.join('\n');
};

PD.BestiaryScene = class BestiaryScene extends Phaser.Scene {
  constructor() { super('Bestiary'); }

  init(data) {
    this.modeId = data.mode || 'solo';
    this.page = data.page || 0;
  }

  create() {
    PD.setupCamera(this);
    const L = PD.config.layout;
    const B = L.bestiary;
    this.add.image(0, 0, 'mapBg').setOrigin(0).setScale(PD.TEX_SCALE);
    this.add.image(L.width / 2, L.height / 2, 'atlas', 'white')
      .setDisplaySize(L.width + 40, L.height + 40).setTint(0x101a24).setAlpha(0.45);
    PD.txt(this, 733, 46, PD.text.bestiaryTitle, 50, '#ffe9a8', 7);
    this.tapHint = PD.txt(this, 733, 92, PD.text.bestiaryTapHint, 22, '#dfe8f2', 3);

    const button = (r, label) => {
      const bg = PD.img(this, r.x + r.w / 2, r.y + r.h / 2, 'btnWide').setDisplaySize(r.w, r.h);
      const t = PD.txt(this, r.x + r.w / 2, r.y + r.h / 2, label, 32, '#3a2a10', 0);
      return { r, bg, t };
    };
    this.tabs = [button(B.tabs[0], PD.text.bestiaryFriends), button(B.tabs[1], PD.text.bestiaryEnemies)];
    this.close = button(B.closeBtn, PD.text.backToMap);

    this.pages = [
      PD.config.cardOrder.map((k) => ({ kind: k, field: 'friends', frame: 'unit_' + k })),
      PD.Bestiary.enemyList().map((k) => ({ kind: k, field: 'enemies', frame: 'enemy_' + k })),
    ];
    this.layers = this.pages.map((list, i) => this.buildPage(list, B.grids[i]));
    this.buildDetail();
    this.showPage(this.page);
    this.input.on('pointerdown', (p) => this.onTap(p.x / PD.RES, p.y / PD.RES));
  }

  // 把圖縮放到放得進 maxW×maxH（只縮小或放大到剛好，不變形）
  fit(img, maxW, maxH) {
    const s = Math.min(maxW / img.frame.realWidth, maxH / img.frame.realHeight);
    return img.setScale(s);
  }

  buildPage(list, G) {
    const c = this.add.container(0, 0);
    const big = G.h > 260;
    const picH = big ? 190 : 106; // 小格的圖稍矮，兩行說明才不會超出格子底
    list.forEach((e, i) => {
      const x = G.x + (i % G.cols) * (G.w + G.gap);
      const y = G.y + Math.floor(i / G.cols) * (G.h + G.gap);
      const seen = PD.Bestiary.has(e.field, e.kind);
      e.rect = { x, y, w: G.w, h: G.h };
      e.seen = seen;
      const g = this.add.graphics();
      g.fillStyle(0x0f1a24, 0.35).fillRoundedRect(x + 3, y + 5, G.w, G.h, 18);
      g.fillStyle(0x1f2a38, 1).fillRoundedRect(x, y, G.w, G.h, 18);
      g.fillStyle(seen ? 0xa77a45 : 0x4a5566, 1).fillRoundedRect(x + 4, y + 4, G.w - 8, G.h - 8, 15);
      g.fillStyle(seen ? 0xfff4dc : 0x2b3442, 1).fillRoundedRect(x + 12, y + 12, G.w - 24, picH, 12);
      c.add(g);
      const pic = this.fit(this.add.image(x + G.w / 2, y + 12 + picH / 2, 'atlas', e.frame), G.w - 40, picH - 16);
      c.add(pic);
      if (!seen) {
        pic.setTintFill(0x141c26); // 同一張圖的深色剪影（不透明，邊緣不透出原色），不劇透顏色
        c.add(PD.txt(this, x + G.w / 2, y + 12 + picH / 2, '？', big ? 76 : 54, '#ffe9a8', 6));
      }
      const nameY = y + 12 + picH + (big ? 30 : 24);
      c.add(PD.txt(this, x + G.w / 2, nameY, seen ? PD.names[e.kind] : PD.text.bestiaryUnknownName, big ? 32 : 26, seen ? '#fff4dc' : '#c3ccd8', 4));
      if (seen) {
        const desc = PD.txt(this, x + G.w / 2, nameY + (big ? 30 : 21), PD.lineBreak(PD.text.bestiaryDesc[e.kind] || '', 10), big ? 22 : 17, '#fff4dc', 3)
          .setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(G.w - 24, true);
        c.add(desc);
      }
    });
    return c;
  }

  // 點一格放大看：大圖＋名稱＋句子，點任何地方關掉
  buildDetail() {
    const L = PD.config.layout;
    const c = this.add.container(0, 0).setDepth(100).setVisible(false);
    const dim = this.add.image(L.width / 2, L.height / 2, 'atlas', 'white').setDisplaySize(L.width + 40, L.height + 40).setTint(0x101a24).setAlpha(0.6);
    const g = this.add.graphics();
    g.fillStyle(0x1f2a38, 1).fillRoundedRect(190, 170, 800, 480, 28);
    g.fillStyle(0xa77a45, 1).fillRoundedRect(196, 176, 788, 468, 24);
    g.fillStyle(0xfff4dc, 1).fillRoundedRect(220, 200, 300, 420, 20);
    this.dPic = this.add.image(370, 410, 'atlas', 'white');
    this.dQ = PD.txt(this, 370, 410, '？', 110, '#ffe9a8', 8);
    this.dName = PD.txt(this, 750, 290, '', 46, '#fff4dc', 6);
    this.dDesc = PD.txt(this, 750, 350, '', 32, '#fff4dc', 4).setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(400, true);
    c.add([dim, g, this.dPic, this.dQ, this.dName, this.dDesc]);
    this.detail = c;
  }

  showDetail(e) {
    // 放大圖用高解析來源（卡片 512／敵人原圖，見 textures.js 的 PD.bestiaryPic），不放大場上小圖；沒遇到的也用同一張做剪影
    const pic = PD.bestiaryPic(this, e.field, e.kind, 270, 390);
    this.dPic.setTexture(pic.key, pic.frame).clearTint().setAlpha(1);
    this.detailTex = pic.key;
    this.fit(this.dPic, 270, 390);
    if (!e.seen) this.dPic.setTintFill(0x141c26);
    this.dQ.setVisible(!e.seen);
    this.dName.setText(e.seen ? PD.names[e.kind] : PD.text.bestiaryUnknownName);
    this.dDesc.setText(PD.lineBreak(e.seen ? PD.text.bestiaryDesc[e.kind] || '' : PD.text.bestiaryUnknown, 12));
    this.detail.setVisible(true);
    this.detailKind = e.kind;
  }

  showPage(i) {
    this.page = i;
    this.layers.forEach((c, k) => c.setVisible(k === i));
    // 目前這一頁的分頁鈕全亮，另一顆變暗
    this.tabs.forEach((t, k) => { t.bg.setAlpha(k === i ? 1 : 0.5); t.t.setAlpha(k === i ? 1 : 0.6); });
  }

  onTap(x, y) {
    if (this.detail.visible) {
      PD.Sound.play('tap');
      this.detail.setVisible(false);
      this.detailKind = null;
      return;
    }
    if (PD.hitRect(this.close.r, x, y)) {
      PD.Sound.play('tap');
      PD.press(this, this.close.bg, [this.close.t]);
      this.time.delayedCall(90, () => this.scene.start('Map', { mode: this.modeId }));
      return;
    }
    const tab = this.tabs.findIndex((t) => PD.hitRect(t.r, x, y));
    if (tab >= 0) {
      PD.Sound.play('tap');
      PD.press(this, this.tabs[tab].bg, [this.tabs[tab].t]);
      this.showPage(tab);
      return;
    }
    const e = this.pages[this.page].find((o) => PD.hitRect(o.rect, x, y));
    if (e) { PD.Sound.play('tap'); this.showDetail(e); }
  }
};
