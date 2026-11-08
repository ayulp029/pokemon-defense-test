// 所有圖都用程式畫一次，合併成一張大圖（減少繪圖切換）。
// 圖的密度等於畫面實際像素（PD.RES），放到畫面時剛好一比一，不會被再縮放一次而變糊。
window.PD = window.PD || {};

// 畫面內部解析度：對齊 iPad 上實際顯示的像素，最多 2 倍。
// 取 0.05 的倍數，1180×820 乘起來才會是整數。用長短邊計算，直向開啟也算得對。
PD.RES = (function () {
  const L = PD.config.layout;
  const long = Math.max(window.innerWidth, window.innerHeight);
  const short = Math.min(window.innerWidth, window.innerHeight);
  const fit = Math.min(long / L.width, short / L.height);
  const res = Math.round((window.devicePixelRatio || 1) * fit * 20) / 20;
  return Math.min(2, Math.max(1, res));
})();
PD.TEX_SCALE = 1 / PD.RES;

(function () {
  const DENSITY = PD.RES;
  const ATLAS = 2048;
  const PAD = 3;
  const OUTLINE = '#1f2a38';
  const hex = (c) => '#' + c.toString(16).padStart(6, '0');

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // 本機貼圖：等比縮進角色大小，腳底對齊下緣、左右置中。
  // 縮超過一半時先分次對半縮，細線才不會出現鋸齒。
  function drawArt(ctx, w, h, img) {
    const s = Math.min(w / img.width, h / img.height);
    const dw = img.width * s;
    const dh = img.height * s;
    let src = img;
    let sw = img.width;
    let sh = img.height;
    while (sw > dw * DENSITY * 2 && sh > dh * DENSITY * 2) {
      const half = document.createElement('canvas');
      half.width = Math.ceil(sw / 2);
      half.height = Math.ceil(sh / 2);
      const hc = half.getContext('2d');
      hc.imageSmoothingEnabled = true;
      hc.imageSmoothingQuality = 'high';
      hc.drawImage(src, 0, 0, half.width, half.height);
      src = half;
      sw = half.width;
      sh = half.height;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, (w - dw) / 2, h - dh, dw, dh);
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
  }

  function star(ctx, cx, cy, R, r) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const d = i % 2 ? r : R;
      pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]);
    }
    poly(ctx, pts);
  }

  function softDot(ctx, s, inner) {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(inner, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }

  const icons = {
    bolt(ctx, c, s, color) {
      poly(ctx, [[c + s * 0.1, -s], [c - s * 0.6, s * 0.15], [c - s * 0.05, s * 0.15],
        [c - s * 0.2, s], [c + s * 0.6, -s * 0.2], [c + s * 0.05, -s * 0.2]]);
      ctx.fillStyle = color; ctx.fill(); ctx.stroke();
    },
    leaf(ctx, c, s, color) {
      ctx.beginPath();
      ctx.moveTo(c, -s);
      ctx.quadraticCurveTo(c + s, 0, c, s);
      ctx.quadraticCurveTo(c - s, 0, c, -s);
      ctx.fillStyle = color; ctx.fill(); ctx.stroke();
    },
    drop(ctx, c, s, color) {
      ctx.beginPath();
      ctx.moveTo(c, -s);
      ctx.bezierCurveTo(c + s * 1.1, s * 0.1, c + s * 0.6, s, c, s);
      ctx.bezierCurveTo(c - s * 0.6, s, c - s * 1.1, s * 0.1, c, -s);
      ctx.fillStyle = color; ctx.fill(); ctx.stroke();
    },
    flame(ctx, c, s, color) {
      ctx.beginPath();
      ctx.moveTo(c, -s);
      ctx.bezierCurveTo(c + s * 0.3, -s * 0.3, c + s, 0, c + s * 0.6, s * 0.8);
      ctx.quadraticCurveTo(c, s * 1.15, c - s * 0.6, s * 0.8);
      ctx.bezierCurveTo(c - s, 0, c - s * 0.2, -s * 0.2, c, -s);
      ctx.fillStyle = color; ctx.fill(); ctx.stroke();
    },
    shield(ctx, c, s, color) {
      poly(ctx, [[c - s * 0.8, -s * 0.8], [c + s * 0.8, -s * 0.8], [c + s * 0.8, s * 0.1], [c, s], [c - s * 0.8, s * 0.1]]);
      ctx.fillStyle = color; ctx.fill(); ctx.stroke();
    },
    badge(ctx, c, s, color) {
      star(ctx, c, 0, s, s * 0.5);
      ctx.fillStyle = color; ctx.fill(); ctx.stroke();
    },
  };

  function eyes(ctx, w, y, r) {
    [-0.17, 0.17].forEach((k) => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(w / 2 + w * k, y, r, r * 1.25, 0, 0, 7); ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = OUTLINE; ctx.stroke();
      ctx.fillStyle = OUTLINE;
      ctx.beginPath(); ctx.ellipse(w / 2 + w * k - r * 0.2, y + r * 0.1, r * 0.55, r * 0.75, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(w / 2 + w * k - r * 0.35, y - r * 0.3, r * 0.22, 0, 7); ctx.fill();
    });
  }

  function smile(ctx, w, y, s) {
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(w / 2, y - s * 0.5, s, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke();
  }

  // 賽璐璐色塊：主色 + 一層暗面 + 淺色肚子 + 小高光 + 深色外框
  function drawBlock(ctx, w, h, def, shapeFn) {
    const m = 3;
    const bw = w - m * 2;
    const bh = h - m * 2;
    ctx.save();
    ctx.translate(m, m);
    shapeFn(ctx, bw, bh);
    ctx.fillStyle = hex(def.color);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(20,30,60,0.22)';
    ctx.fillRect(bw * 0.62, 0, bw, bh);
    ctx.fillRect(0, bh * 0.84, bw, bh);
    ctx.fillStyle = hex(def.light);
    ctx.beginPath(); ctx.ellipse(bw / 2, bh * 0.68, bw * 0.3, bh * 0.2, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.ellipse(bw * 0.25, bh * 0.13, bw * 0.13, bh * 0.05, -0.5, 0, 7); ctx.fill();
    ctx.restore();
    shapeFn(ctx, bw, bh);
    ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.stroke();
    ctx.restore();
    return { bw, bh, m };
  }

  const shapes = {
    round: (ctx, w, h) => rr(ctx, 0, 0, w, h, Math.min(w, h) * 0.34),
    robot: (ctx, w, h) => rr(ctx, 0, h * 0.08, w, h * 0.92, 8),
    stripe: (ctx, w, h) => rr(ctx, 0, 0, w, h, w * 0.46),
    swift: (ctx, w, h) => poly(ctx, [[w * 0.18, 0], [w, 0], [w, h], [0, h], [0, h * 0.2]]),
    plated: (ctx, w, h) => poly(ctx, [[w * 0.2, 0], [w * 0.8, 0], [w, h * 0.2], [w, h], [0, h], [0, h * 0.2]]),
  };

  function drawUnit(ctx, w, h, def) {
    const { m } = drawBlock(ctx, w, h, def, shapes.round);
    eyes(ctx, w, h * 0.27, w * 0.1);
    smile(ctx, w, h * 0.41, w * 0.07);
    ctx.save();
    ctx.translate(0, h * 0.76);
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
    icons[def.icon](ctx, w / 2, w * 0.13, hex(def.color));
    ctx.restore();
    return m;
  }

  function drawEnemy(ctx, w, h, def) {
    drawBlock(ctx, w, h, def, shapes[def.shape]);
    eyes(ctx, w, h * 0.3, w * 0.1);
    smile(ctx, w, h * 0.45, w * 0.07);
    ctx.fillStyle = OUTLINE;
    if (def.shape === 'stripe') {
      ctx.globalAlpha = 0.28;
      for (let i = 0; i < 3; i++) ctx.fillRect(w * 0.14, h * (0.58 + i * 0.1), w * 0.72, h * 0.035);
      ctx.globalAlpha = 1;
    } else if (def.shape === 'swift') {
      ctx.globalAlpha = 0.4;
      for (let i = 0; i < 3; i++) ctx.fillRect(w * 0.55, h * (0.6 + i * 0.09), w * (0.32 - i * 0.07), h * 0.03);
      ctx.globalAlpha = 1;
    } else if (def.shape === 'robot') {
      ctx.fillRect(w * 0.47, 0, w * 0.06, h * 0.1);
      ctx.beginPath(); ctx.arc(w / 2, h * 0.03, w * 0.07, 0, 7); ctx.fill();
    } else if (def.shape === 'plated') {
      ctx.globalAlpha = 0.3;
      ctx.fillRect(w * 0.1, h * 0.6, w * 0.8, h * 0.05);
      ctx.fillRect(w * 0.1, h * 0.78, w * 0.8, h * 0.05);
      ctx.globalAlpha = 1;
    }
  }

  function drawOrb(ctx, s) {
    const c = s / 2;
    const r = s * 0.42;
    const g = ctx.createRadialGradient(c - r * 0.35, c - r * 0.4, r * 0.1, c, c, r);
    g.addColorStop(0, '#fffbe0');
    g.addColorStop(0.45, '#ffd84a');
    g.addColorStop(1, '#f08a1e');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(c, c, r, 0, 7); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#8a4a10'; ctx.stroke();
    ctx.fillStyle = '#ffffff';
    star(ctx, c, c, r * 0.5, r * 0.22); ctx.fill();
  }

  // 按鈕與卡片共用的底：漸層、外框、上方亮面、下方厚度、內側細線
  function drawPanelBase(c, w, h, top, bottom) {
    rr(c, 3, 3, w - 6, h - 6, 18);
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    c.fillStyle = g; c.fill();
    c.save();
    c.clip();
    const gloss = c.createLinearGradient(0, 0, 0, h * 0.45);
    gloss.addColorStop(0, 'rgba(255,255,255,0.38)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gloss; c.fillRect(0, 0, w, h * 0.45);
    c.fillStyle = 'rgba(30,20,10,0.16)'; c.fillRect(0, h - 11, w, 11);
    c.restore();
    rr(c, 7, 7, w - 14, h - 14, 14);
    c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,0.4)'; c.stroke();
    rr(c, 3, 3, w - 6, h - 6, 18);
    c.lineWidth = 3; c.strokeStyle = OUTLINE; c.stroke();
  }

  // 每張圖：名稱、邏輯寬高、畫法
  function frameList(cfg, scene) {
    const list = [];
    const add = (name, w, h, draw) => list.push({ name, w, h, draw });

    add('white', 8, 8, (c) => { c.fillStyle = '#fff'; c.fillRect(-2, -2, 12, 12); });
    add('glow', 96, 96, (c) => softDot(c, 96, 0.35));
    add('spark', 24, 24, (c) => softDot(c, 24, 0.6));
    add('star', 40, 40, (c) => { star(c, 20, 20, 19, 8); c.fillStyle = '#fff'; c.fill(); });
    add('ring', 96, 96, (c) => {
      c.strokeStyle = '#fff'; c.lineWidth = 5; c.beginPath(); c.arc(48, 48, 44, 0, 7); c.stroke();
    });
    add('leafP', 22, 22, (c) => {
      c.strokeStyle = 'rgba(0,0,0,0)'; c.lineWidth = 0;
      icons.leaf(c, 11, 10, '#fff');
    }, 0);
    list[list.length - 1].center = true;
    add('dropP', 20, 26, (c) => { c.strokeStyle = 'rgba(0,0,0,0)'; icons.drop(c, 10, 11, '#fff'); });
    list[list.length - 1].center = true;
    add('confetti', 14, 8, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 14, 8); });
    add('bolt', 72, 26, (c) => {
      const pts = [[0, 14], [18, 6], [26, 18], [44, 6], [52, 18], [72, 12]];
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 9;
      c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth = 3.5; c.stroke();
    });
    add('vine', 100, 14, (c) => {
      c.fillStyle = '#fff'; rr(c, 0, 4, 100, 6, 3); c.fill();
      for (let i = 12; i < 96; i += 18) {
        c.beginPath(); c.ellipse(i, 3, 6, 3, -0.5, 0, 7); c.fill();
      }
    });
    add('cell', 96, 144, (c) => {
      c.fillStyle = 'rgba(255,255,255,0.55)'; rr(c, 5, 5, 86, 134, 14); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 4; rr(c, 5, 5, 86, 134, 14); c.stroke();
    });
    add('range', 96, 60, (c) => {
      c.fillStyle = 'rgba(255,255,255,0.35)'; rr(c, 2, 4, 92, 52, 12); c.fill();
      c.fillStyle = '#fff'; poly(c, [[36, 14], [62, 30], [36, 46]]); c.fill();
    });
    add('foot', 60, 60, (c) => {
      c.fillStyle = '#fff';
      c.beginPath(); c.ellipse(30, 38, 13, 16, 0, 0, 7); c.fill();
      [[12, 18], [24, 10], [37, 10], [49, 18]].forEach((p) => {
        c.beginPath(); c.arc(p[0], p[1], 6, 0, 7); c.fill();
      });
    });
    add('lock', 44, 52, (c) => {
      c.strokeStyle = '#fff'; c.lineWidth = 6;
      c.beginPath(); c.arc(22, 20, 12, Math.PI, 0); c.stroke();
      c.fillStyle = '#fff'; rr(c, 5, 20, 34, 28, 6); c.fill();
    });
    add('orb', 56, 56, (c) => drawOrb(c, 56));
    add('hpBack', 56, 8, (c) => { c.fillStyle = 'rgba(20,30,40,0.75)'; rr(c, 0, 0, 56, 8, 4); c.fill(); });
    add('hpFill', 52, 4, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 52, 4); });
    add('shadow', 96, 28, (c) => {
      c.save();
      c.scale(1, 28 / 96);
      const g = c.createRadialGradient(48, 48, 0, 48, 48, 48);
      g.addColorStop(0, 'rgba(14,26,16,0.5)');
      g.addColorStop(0.65, 'rgba(14,26,16,0.28)');
      g.addColorStop(1, 'rgba(14,26,16,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 96, 96);
      c.restore();
    });
    // 救援次數的底板：寬度依模式的次數而定
    Object.keys(cfg.modes).forEach((m) => {
      const n = cfg.modes[m].rescues;
      const w = n * 30 + 20;
      add('plateRescue_' + n, w, 56, (c) => {
        rr(c, 1.5, 1.5, w - 3, 53, 14);
        c.fillStyle = 'rgba(10,22,18,0.5)'; c.fill();
        c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,0.16)'; c.stroke();
      });
    });
    add('iconBurn', 20, 20, (c) => { c.strokeStyle = OUTLINE; c.lineWidth = 1.5; c.translate(0, 10); icons.flame(c, 10, 8, '#ff9a3c'); });
    add('iconSlow', 20, 20, (c) => { c.strokeStyle = OUTLINE; c.lineWidth = 1.5; c.translate(0, 10); icons.drop(c, 10, 8, '#6cc7ff'); });
    add('shield', 26, 30, (c) => { c.strokeStyle = OUTLINE; c.lineWidth = 2; c.translate(0, 15); icons.shield(c, 13, 13, '#7fd0ff'); });
    add('shieldUsed', 26, 30, (c) => { c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 2; c.translate(0, 15); icons.shield(c, 13, 13, 'rgba(255,255,255,0.14)'); });

    const btnFrame = (name, w, h, top, bottom) => add(name, w, h, (c) => {
      drawPanelBase(c, w, h, top, bottom);
    });
    // 每位角色一張底卡：上方是角色主色的頭像窗，下方是放名字的白色名牌
    Object.keys(cfg.units).forEach((k) => {
      const d = cfg.units[k];
      add('card_' + k, 136, 120, (c) => {
        drawPanelBase(c, 136, 120, '#fdf6e0', '#e6d6ae');
        rr(c, 9, 8, 118, 82, 12);
        const g = c.createLinearGradient(0, 8, 0, 90);
        g.addColorStop(0, hex(d.light)); g.addColorStop(1, hex(d.color));
        c.save(); c.globalAlpha = 0.7; c.fillStyle = g; c.fill(); c.restore();
        c.lineWidth = 1.5; c.strokeStyle = 'rgba(31,42,56,0.35)'; c.stroke();
        rr(c, 9, 91, 118, 23, 8);
        c.fillStyle = 'rgba(255,255,255,0.75)'; c.fill();
      });
    });
    btnFrame('btnSquare', 72, 72, '#5a7a9a', '#3c566f');
    btnFrame('btnBig', 260, 130, '#ffcf5a', '#f09a2e');
    btnFrame('btnWide', 300, 92, '#ffcf5a', '#f09a2e');
    btnFrame('cardLocked', 136, 120, '#8d97a3', '#6a7480');
    btnFrame('cancel', 120, 120, '#f0a0a0', '#d06a6a');
    btnFrame('recall', 136, 120, '#8fd0c8', '#4f9c94');
    add('costBadge', 70, 40, (c) => {
      c.fillStyle = '#fff'; rr(c, 2, 2, 66, 36, 12); c.fill();
      c.lineWidth = 2.5; c.strokeStyle = OUTLINE; c.stroke();
    });
    add('iconRecall', 56, 48, (c) => {
      // 彎回左邊（村莊方向）的箭頭
      c.strokeStyle = '#fff'; c.lineWidth = 8; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(18, 14); c.lineTo(36, 14); c.arc(36, 27, 13, -Math.PI / 2, Math.PI / 2); c.lineTo(22, 40); c.stroke();
      c.beginPath(); c.moveTo(20, 4); c.lineTo(8, 14); c.lineTo(20, 24); c.stroke();
    });
    add('cardGlow', 148, 132, (c) => {
      c.strokeStyle = '#fff'; c.lineWidth = 7; rr(c, 6, 6, 136, 120, 20); c.stroke();
    });

    add('iconPause', 36, 36, (c) => { c.fillStyle = '#fff'; c.fillRect(8, 4, 8, 28); c.fillRect(21, 4, 8, 28); });
    const speaker = (c) => { c.fillStyle = '#fff'; poly(c, [[3, 13], [10, 13], [19, 5], [19, 31], [10, 23], [3, 23]]); c.fill(); };
    add('iconSound', 36, 36, (c) => {
      speaker(c); c.strokeStyle = '#fff'; c.lineWidth = 3;
      c.beginPath(); c.arc(21, 18, 10, -0.8, 0.8); c.stroke();
    });
    add('iconMute', 36, 36, (c) => {
      speaker(c); c.strokeStyle = '#fff'; c.lineWidth = 3.5;
      c.beginPath(); c.moveTo(24, 12); c.lineTo(34, 24); c.moveTo(34, 12); c.lineTo(24, 24); c.stroke();
    });
    add('iconCancel', 48, 48, (c) => {
      c.strokeStyle = '#fff'; c.lineWidth = 9; c.lineCap = 'round';
      c.beginPath(); c.moveTo(10, 10); c.lineTo(38, 38); c.moveTo(38, 10); c.lineTo(10, 38); c.stroke();
    });

    Object.keys(cfg.units).forEach((k) => {
      const d = cfg.units[k];
      const art = scene.textures.exists('art_' + k) ? scene.textures.get('art_' + k).getSourceImage() : null;
      add('unit_' + k, d.size.w, d.size.h, (c) => (
        art ? drawArt(c, d.size.w, d.size.h, art) : drawUnit(c, d.size.w, d.size.h, d)
      ));
      // 卡片頭像另外畫成剛好的大小，不靠遊戲中再縮小
      add('cardPic_' + k, 60, 78, (c) => {
        if (art) { drawArt(c, 60, 78, art); return; }
        const s = Math.min(60 / d.size.w, 78 / d.size.h);
        c.translate((60 - d.size.w * s) / 2, 78 - d.size.h * s);
        c.scale(s, s);
        drawUnit(c, d.size.w, d.size.h, d);
      });
    });
    Object.keys(cfg.enemies).forEach((k) => {
      const d = cfg.enemies[k];
      add('enemy_' + k, d.size.w, d.size.h, (c) => drawEnemy(c, d.size.w, d.size.h, d));
    });
    return list;
  }

  PD.buildAtlas = function (scene, cfg) {
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS;
    canvas.height = ATLAS;
    const ctx = canvas.getContext('2d');
    const frames = [];
    let x = PAD, y = PAD, rowH = 0;
    // 由高排到矮，大圖上的空隙最少
    frameList(cfg, scene).sort((a, b) => b.h - a.h).forEach((f) => {
      const pw = Math.ceil(f.w * DENSITY);
      const ph = Math.ceil(f.h * DENSITY);
      if (x + pw + PAD > ATLAS) { x = PAD; y += rowH + PAD; rowH = 0; }
      if (y + ph + PAD > ATLAS) console.error('貼圖大圖放不下：' + f.name);
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath(); ctx.rect(0, 0, pw, ph); ctx.clip();
      ctx.scale(DENSITY, DENSITY);
      if (f.center) ctx.translate(0, f.h / 2);
      f.draw(ctx);
      ctx.restore();
      frames.push({ name: f.name, x, y, w: pw, h: ph });
      x += pw + PAD;
      rowH = Math.max(rowH, ph);
    });
    const tex = scene.textures.addCanvas('atlas', canvas);
    frames.forEach((f) => tex.add(f.name, 0, f.x, f.y, f.w, f.h));
  };

  PD.draw = { rr, poly, OUTLINE };
})();
