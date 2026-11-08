// 所有圖都用程式畫一次，合併成一張大圖（減少繪圖切換）。
// 圖以 2 倍密度繪製，放到畫面時用 0.5 倍（PD.TEX_SCALE）。
window.PD = window.PD || {};
PD.TEX_SCALE = 0.5;

(function () {
  const DENSITY = 2;
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

  // 本機貼圖：等比縮進角色大小，腳底對齊下緣、左右置中
  function drawArt(ctx, w, h, img) {
    const s = Math.min(w / img.width, h / img.height);
    const dw = img.width * s;
    const dh = img.height * s;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (w - dw) / 2, h - dh, dw, dh);
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
    add('iconBurn', 20, 20, (c) => { c.strokeStyle = OUTLINE; c.lineWidth = 1.5; c.translate(0, 10); icons.flame(c, 10, 8, '#ff9a3c'); });
    add('iconSlow', 20, 20, (c) => { c.strokeStyle = OUTLINE; c.lineWidth = 1.5; c.translate(0, 10); icons.drop(c, 10, 8, '#6cc7ff'); });
    add('shield', 26, 30, (c) => { c.strokeStyle = OUTLINE; c.lineWidth = 2; c.translate(0, 15); icons.shield(c, 13, 13, '#7fd0ff'); });
    add('shieldUsed', 26, 30, (c) => { c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 2; c.translate(0, 15); icons.shield(c, 13, 13, 'rgba(255,255,255,0.14)'); });

    const btnFrame = (name, w, h, top, bottom) => add(name, w, h, (c) => {
      rr(c, 3, 3, w - 6, h - 6, 18);
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, top); g.addColorStop(1, bottom);
      c.fillStyle = g; c.fill();
      c.lineWidth = 3; c.strokeStyle = OUTLINE; c.stroke();
    });
    btnFrame('btnSquare', 72, 72, '#5a7a9a', '#3c566f');
    btnFrame('btnBig', 260, 130, '#ffcf5a', '#f09a2e');
    btnFrame('btnWide', 300, 92, '#ffcf5a', '#f09a2e');
    btnFrame('card', 136, 120, '#fdf6e0', '#e6d6ae');
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
    frameList(cfg, scene).forEach((f) => {
      const pw = Math.ceil(f.w * DENSITY);
      const ph = Math.ceil(f.h * DENSITY);
      if (x + pw + PAD > ATLAS) { x = PAD; y += rowH + PAD; rowH = 0; }
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

  // 場地背景（靜態，只畫一次）
  PD.buildBackground = function (scene, cfg, level) {
    const L = cfg.layout;
    const G = L.grid;
    const canvas = document.createElement('canvas');
    canvas.width = L.width * DENSITY;
    canvas.height = L.height * DENSITY;
    const c = canvas.getContext('2d');
    c.scale(DENSITY, DENSITY);

    // 底色
    c.fillStyle = '#26382c'; c.fillRect(0, 0, L.width, L.height);

    // 村莊
    const vg = c.createLinearGradient(0, G.y, 0, G.y + G.rows * G.cellH);
    vg.addColorStop(0, '#d9c99a'); vg.addColorStop(1, '#bda873');
    c.fillStyle = vg; c.fillRect(0, G.y, G.x, G.rows * G.cellH);
    L.laneY.forEach((y, i) => {
      const hx = 24, hy = y - 44;
      c.fillStyle = ['#e8896a', '#6aa8e8', '#e8c76a', '#8ac77a'][i];
      poly(c, [[hx - 10, hy + 34], [hx + 34, hy - 4], [hx + 78, hy + 34]]); c.fill();
      c.lineWidth = 3; c.strokeStyle = OUTLINE; c.stroke();
      c.fillStyle = '#f7ecd2'; c.fillRect(hx + 4, hy + 34, 60, 50); c.strokeRect(hx + 4, hy + 34, 60, 50);
      c.fillStyle = '#7a5a3a'; c.fillRect(hx + 26, hy + 56, 16, 28);
    });

    // 出怪區
    const sx = G.x + G.cols * G.cellW;
    c.fillStyle = '#4a4560'; c.fillRect(sx, G.y, L.width - sx, G.rows * G.cellH);

    // 草地（低彩度）
    for (let r = 0; r < G.rows; r++) {
      const open = level.openLanes.indexOf(r + 1) !== -1;
      for (let col = 0; col < G.cols; col++) {
        const even = (r + col) % 2 === 0;
        c.fillStyle = open ? (even ? '#7fa86a' : '#739c60') : (even ? '#7d8a7c' : '#758274');
        c.fillRect(G.x + col * G.cellW, G.y + r * G.cellH, G.cellW, G.cellH);
      }
      if (!open) {
        // 休息路：淡淡的雲紋與鎖路圖示
        const y = G.y + r * G.cellH;
        c.fillStyle = 'rgba(255,255,255,0.12)';
        for (let i = 0; i < 5; i++) {
          const cx = G.x + 90 + i * 195;
          const cy = y + 42 + (i % 2) * 58;
          [[0, 0, 26], [28, 6, 20], [-26, 8, 18]].forEach((p) => {
            c.beginPath(); c.arc(cx + p[0], cy + p[1], p[2], 0, 7); c.fill();
          });
        }
        c.save();
        c.translate(G.x + (G.cols * G.cellW) / 2 - 58, y + G.cellH / 2 - 26);
        c.globalAlpha = 0.55;
        c.strokeStyle = '#fff'; c.lineWidth = 6;
        c.beginPath(); c.arc(22, 20, 12, Math.PI, 0); c.stroke();
        c.fillStyle = '#fff'; rr(c, 5, 20, 34, 28, 6); c.fill();
        c.restore();
        c.fillStyle = 'rgba(255,255,255,0.6)';
        c.font = 'bold 32px "PingFang TC","Noto Sans CJK TC",sans-serif';
        c.textBaseline = 'middle';
        c.fillText(PD.text.rest, G.x + (G.cols * G.cellW) / 2 - 2, y + G.cellH / 2);
      }
    }

    // 上方資訊列與卡片區底
    c.fillStyle = '#2f4436'; c.fillRect(0, 0, L.width, L.topBar.h);
    c.fillStyle = '#2f4436'; c.fillRect(0, G.y + G.rows * G.cellH, L.width, L.height - (G.y + G.rows * G.cellH));

    scene.textures.addCanvas('bg', canvas);
  };
})();
