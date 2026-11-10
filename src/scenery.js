// 場地背景與大面板：開場時用程式畫一次，之後只是一張靜態圖，戰鬥中沒有額外負擔。
// 這裡的亂數有固定種子，只決定草葉、石頭的位置，每次畫出來都一樣，也不影響戰鬥。
window.PD = window.PD || {};

(function () {
  const { rr, poly, OUTLINE } = PD.draw;

  function makeRand(seed) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function newCanvas(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * PD.RES);
    canvas.height = Math.round(h * PD.RES);
    const c = canvas.getContext('2d');
    c.scale(PD.RES, PD.RES);
    return { canvas, c };
  }

  function vGrad(c, y0, y1, stops) {
    const g = c.createLinearGradient(0, y0, 0, y1);
    stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
    return g;
  }

  function softCircle(c, x, y, r, rgb, alpha) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${alpha})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // ===== 草地 =====
  function drawBlades(c, x, y, w, h, rand, color, count) {
    c.strokeStyle = color;
    c.beginPath();
    for (let i = 0; i < count; i++) {
      const bx = x + 4 + rand() * (w - 8);
      const by = y + 12 + rand() * (h - 16);
      const len = 5 + rand() * 6;
      const lean = (rand() - 0.5) * 7;
      c.moveTo(bx, by);
      c.quadraticCurveTo(bx + lean * 0.3, by - len * 0.6, bx + lean, by - len);
    }
    c.stroke();
  }

  function drawFlower(c, x, y, rand) {
    c.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.75)' : 'rgba(255,226,130,0.8)';
    [[-2.2, 0], [2.2, 0], [0, -2.2], [0, 2.2]].forEach((p) => {
      c.beginPath(); c.arc(x + p[0], y + p[1], 1.9, 0, 7); c.fill();
    });
    c.fillStyle = 'rgba(214,140,50,0.9)';
    c.beginPath(); c.arc(x, y, 1.4, 0, 7); c.fill();
  }

  // 第 4 關的蘆葦、第 5 關的落果（只放在格子角落）
  function drawReed(c, x, y) {
    c.strokeStyle = 'rgba(236,244,236,0.8)'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(x, y + 6); c.lineTo(x + 1, y - 6); c.stroke();
    c.fillStyle = 'rgba(214,190,140,0.9)';
    c.beginPath(); c.ellipse(x + 1, y - 8, 1.8, 3.6, 0, 0, 7); c.fill();
  }

  function drawFruit(c, x, y) {
    c.fillStyle = 'rgba(224,137,106,0.5)';
    c.beginPath(); c.arc(x, y, 3.4, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,230,200,0.4)';
    c.beginPath(); c.arc(x - 1, y - 1.2, 1, 0, 7); c.fill();
  }

  // 第 2 關的小香菇、第 3 關的落葉
  function drawMushroom(c, x, y) {
    c.fillStyle = 'rgba(250,240,220,0.85)'; c.fillRect(x - 1.5, y - 2, 3, 6);
    c.fillStyle = 'rgba(214,92,76,0.85)';
    c.beginPath(); c.arc(x, y - 2, 5, Math.PI, 0); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.beginPath(); c.arc(x - 2, y - 4, 1, 0, 7); c.arc(x + 2, y - 3.5, 0.9, 0, 7); c.fill();
  }

  function drawLeaf(c, x, y, rand) {
    c.save();
    c.translate(x, y); c.rotate(rand() * 6.28);
    c.fillStyle = rand() < 0.5 ? 'rgba(232,140,60,0.75)' : 'rgba(214,92,52,0.7)';
    c.beginPath(); c.ellipse(0, 0, 5, 2.6, 0, 0, 7); c.fill();
    c.strokeStyle = 'rgba(120,60,20,0.5)'; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(-4, 0); c.lineTo(4, 0); c.stroke();
    c.restore();
  }

  function drawCell(c, x, y, w, h, open, even, rand, theme) {
    const colors = theme
      ? (open ? (even ? theme.grassA : theme.grassB) : theme.rest)
      : open
        ? (even ? ['#93bb76', '#7ca663'] : ['#85af6b', '#71995a'])
        : (even ? ['#8d998c', '#79857a'] : ['#828e82', '#707c71']);
    c.fillStyle = vGrad(c, y, y + h, colors);
    c.fillRect(x, y, w, h);

    // 深淺斑塊，讓草地不像純色方塊
    for (let i = 0; i < 3; i++) {
      c.fillStyle = rand() < 0.5 ? 'rgba(255,255,220,0.07)' : 'rgba(30,60,30,0.07)';
      c.beginPath();
      c.ellipse(x + rand() * w, y + rand() * h, 14 + rand() * 18, 8 + rand() * 12, 0, 0, 7);
      c.fill();
    }

    c.lineWidth = 1.4;
    c.lineCap = 'round';
    drawBlades(c, x, y, w, h, rand, 'rgba(46,84,42,0.34)', open ? 16 : 8);
    drawBlades(c, x, y, w, h, rand, 'rgba(226,242,176,0.3)', open ? 11 : 5);

    // 小花只放在格子角落，不搶角色的視線
    if (open && rand() < (theme ? theme.flowerChance : 0.4)) {
      const fx = x + (rand() < 0.5 ? 12 : w - 12);
      const fy = y + (rand() < 0.5 ? 18 : h - 14);
      const kind = theme ? theme.flower : 'flower';
      if (kind === 'reed') drawReed(c, fx, fy);
      else if (kind === 'fruit') drawFruit(c, fx, fy);
      else if (kind === 'mushroom') drawMushroom(c, fx, fy);
      else if (kind === 'leaf') drawLeaf(c, fx, fy, rand);
      else drawFlower(c, fx, fy, rand);
    }

    // 格子邊緣：上左亮、下右暗
    c.fillStyle = 'rgba(255,255,255,0.16)';
    c.fillRect(x, y, w, 1.5);
    c.fillRect(x, y, 1.5, h);
    c.fillStyle = 'rgba(30,60,30,0.17)';
    c.fillRect(x, y + h - 1.5, w, 1.5);
    c.fillRect(x + w - 1.5, y, 1.5, h);
  }

  function drawRestLane(c, G, y) {
    const fieldW = G.cols * G.cellW;
    c.fillStyle = 'rgba(232,238,240,0.14)';
    c.fillRect(G.x, y, fieldW, G.cellH);
    c.fillStyle = 'rgba(255,255,255,0.14)';
    for (let i = 0; i < 5; i++) {
      const cx = G.x + 90 + i * 195;
      const cy = y + 42 + (i % 2) * 58;
      [[0, 0, 26], [28, 6, 20], [-26, 8, 18]].forEach((p) => {
        c.beginPath(); c.arc(cx + p[0], cy + p[1], p[2], 0, 7); c.fill();
      });
    }
    c.save();
    c.translate(G.x + fieldW / 2 - 58, y + G.cellH / 2 - 26);
    c.globalAlpha = 0.6;
    c.strokeStyle = '#fff'; c.lineWidth = 6;
    c.beginPath(); c.arc(22, 20, 12, Math.PI, 0); c.stroke();
    c.fillStyle = '#fff'; rr(c, 5, 20, 34, 28, 6); c.fill();
    c.restore();
    c.fillStyle = 'rgba(255,255,255,0.65)';
    c.font = 'bold 32px "PingFang TC","Noto Sans CJK TC",sans-serif';
    c.textBaseline = 'middle';
    c.fillText(PD.text.rest, G.x + fieldW / 2 - 2, y + G.cellH / 2);
  }

  function drawField(c, cfg, level, rand) {
    const L = cfg.layout;
    const G = L.grid;
    const fieldW = G.cols * G.cellW;
    const fieldH = G.rows * G.cellH;
    const isOpen = (r) => level.openLanes.indexOf(r + 1) !== -1;

    for (let r = 0; r < G.rows; r++) {
      for (let col = 0; col < G.cols; col++) {
        drawCell(c, G.x + col * G.cellW, G.y + r * G.cellH, G.cellW, G.cellH, isOpen(r), (r + col) % 2 === 0, rand, level.theme);
      }
    }

    // 開放的路上，敵人腳下有一條被踩淡的小徑
    L.laneY.forEach((laneY, r) => {
      if (!isOpen(r)) return;
      const foot = laneY + G.cellH / 2 - G.cellH * L.footFromBottom;
      const T = level.theme || {};
      const rgb = T.path || '226,202,146';
      c.fillStyle = vGrad(c, foot - 24, foot + 16, [
        `rgba(${rgb},0)`, `rgba(${rgb},${T.pathAlpha || 0.26})`, `rgba(${rgb},0)`,
      ]);
      c.fillRect(G.x, foot - 24, fieldW, 40);
    });
    drawTerrain(c, cfg, level, rand);

    for (let r = 0; r < G.rows; r++) {
      if (!isOpen(r)) drawRestLane(c, G, G.y + r * G.cellH);
      if (r > 0) {
        const y = G.y + r * G.cellH;
        c.fillStyle = 'rgba(32,58,34,0.3)'; c.fillRect(G.x, y - 1.5, fieldW, 2);
        c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(G.x, y + 0.5, fieldW, 1.5);
      }
    }

    // 左上方來的暖光
    c.save();
    c.beginPath(); c.rect(G.x, G.y, fieldW, fieldH); c.clip();
    const T = level.theme || {};
    softCircle(c, G.x + 220, G.y - 40, 880, T.warm || '255,244,200', T.warmAlpha || 0.2);

    // 靠邊框的內陰影
    const edge = 22;
    const shade = `rgba(20,36,22,${T.edgeAlpha || 0.3})`;
    const clear = 'rgba(20,36,22,0)';
    c.fillStyle = vGrad(c, G.y, G.y + edge, [shade, clear]);
    c.fillRect(G.x, G.y, fieldW, edge);
    c.fillStyle = vGrad(c, G.y + fieldH - edge, G.y + fieldH, [clear, shade]);
    c.fillRect(G.x, G.y + fieldH - edge, fieldW, edge);
    const left = c.createLinearGradient(G.x, 0, G.x + edge, 0);
    left.addColorStop(0, shade); left.addColorStop(1, clear);
    c.fillStyle = left; c.fillRect(G.x, G.y, edge, fieldH);
    const right = c.createLinearGradient(G.x + fieldW - edge, 0, G.x + fieldW, 0);
    right.addColorStop(0, clear); right.addColorStop(1, shade);
    c.fillStyle = right; c.fillRect(G.x + fieldW - edge, G.y, edge, fieldH);
    c.restore();
  }

  // ===== 地形（第 4～6 關）：用形狀標示，不只靠顏色 =====
  function cellBox(L, lane, col) {
    const G = L.grid;
    return { x: G.x + (col - 1) * G.cellW, y: G.y + (lane - 1) * G.cellH, w: G.cellW, h: G.cellH };
  }

  const terrainPainters = {
    // 小河：藍色水面加波紋線
    water(c, b, rand) {
      c.fillStyle = vGrad(c, b.y, b.y + b.h, ['#6cc0e0', '#3f8fbf']);
      c.fillRect(b.x + 4, b.y, b.w - 8, b.h);
      c.fillStyle = 'rgba(40,90,70,0.5)';
      c.fillRect(b.x, b.y, 5, b.h); c.fillRect(b.x + b.w - 5, b.y, 5, b.h);
      c.strokeStyle = 'rgba(232,248,255,0.55)'; c.lineWidth = 2; c.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const yy = b.y + 22 + i * 32 + rand() * 6;
        const xx = b.x + 18 + (i % 2) * 22;
        c.beginPath(); c.moveTo(xx, yy);
        c.quadraticCurveTo(xx + 10, yy - 6, xx + 20, yy); c.quadraticCurveTo(xx + 30, yy + 6, xx + 40, yy);
        c.stroke();
      }
    },
    // 燈籠格：暖光圈加一盞小燈籠
    lantern(c, b) {
      softCircle(c, b.x + b.w / 2, b.y + b.h / 2, 70, '255,214,120', 0.32);
      c.strokeStyle = 'rgba(255,224,150,0.65)'; c.lineWidth = 2.5;
      c.setLineDash([8, 6]); rr(c, b.x + 5, b.y + 5, b.w - 10, b.h - 10, 12); c.stroke(); c.setLineDash([]);
      const px = b.x + b.w - 16;
      const py = b.y + 14;
      c.fillStyle = '#5a4030'; c.fillRect(px - 1.5, py, 3, 26);
      softCircle(c, px, py + 30, 18, '255,220,130', 0.6);
      c.beginPath(); c.ellipse(px, py + 30, 8, 10, 0, 0, 7);
      c.fillStyle = '#ffd27a'; c.fill(); c.lineWidth = 2; c.strokeStyle = OUTLINE; c.stroke();
      c.fillStyle = '#e8705f'; c.fillRect(px - 5, py + 19, 10, 3); c.fillRect(px - 5, py + 39, 10, 3);
    },
    // 搗蛋團營地：條紋布加小三角旗
    camp(c, b) {
      c.save();
      c.beginPath(); c.rect(b.x, b.y, b.w, b.h); c.clip();
      c.fillStyle = 'rgba(142,90,160,0.42)'; c.fillRect(b.x, b.y, b.w, b.h);
      c.fillStyle = 'rgba(255,224,130,0.22)';
      for (let k = -2; k < 6; k++) {
        poly(c, [[b.x + k * 30, b.y + b.h], [b.x + k * 30 + 14, b.y + b.h], [b.x + k * 30 + 14 + 60, b.y], [b.x + k * 30 + 60, b.y]]);
        c.fill();
      }
      c.restore();
      c.strokeStyle = 'rgba(42,24,56,0.7)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(b.x + 10, b.y + 18); c.lineTo(b.x + b.w - 10, b.y + 18); c.stroke();
      [0, 1, 2, 3].forEach((i) => {
        poly(c, [[b.x + 14 + i * 20, b.y + 18], [b.x + 24 + i * 20, b.y + 18], [b.x + 19 + i * 20, b.y + 30]]);
        c.fillStyle = i % 2 ? '#ffe082' : '#ff8e6e'; c.fill();
      });
    },
    // 鼓墊：地上的圓鼓面加箭頭
    drumPad(c, b) {
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h * 0.62;
      c.beginPath(); c.ellipse(cx, cy, 36, 16, 0, 0, 7);
      c.fillStyle = 'rgba(255,142,110,0.6)'; c.fill();
      c.lineWidth = 3; c.strokeStyle = 'rgba(122,40,60,0.75)'; c.stroke();
      c.beginPath(); c.ellipse(cx, cy, 22, 9, 0, 0, 7);
      c.fillStyle = 'rgba(255,240,210,0.7)'; c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round';
      [0, 14].forEach((d) => {
        c.beginPath(); c.moveTo(cx + 6 - d, cy - 36); c.lineTo(cx - 4 - d, cy - 28); c.lineTo(cx + 6 - d, cy - 20); c.stroke();
      });
    },
  };

  function drawTerrain(c, cfg, level, rand) {
    (level.terrain || []).forEach((t) => t.lanes.forEach((lane) => t.cols.forEach((col) => {
      terrainPainters[t.type](c, cellBox(cfg.layout, lane, col), rand);
    })));
  }

  // ===== 村莊 =====
  // 技能架：村莊欄上方一條圓角木板，每顆技能圖示一個淺凹的圓槽。只畫本關已解鎖的數量，
  // 木板跟著變短（第 1 關只有 2 槽），不再留一排空的圓孔看起來像沒做完
  function drawSkillRack(c, L, slots) {
    if (slots <= 0) return;
    const B = L.skillBar;
    const r = B.size / 2;
    const x0 = B.x - r - 10, w = B.size + 20;
    const y0 = B.firstY - r - 6, h = (slots - 1) * B.gap + B.size + 12;
    c.fillStyle = 'rgba(40,28,14,0.28)';
    rr(c, x0 + 3, y0 + 5, w, h, 22); c.fill();
    rr(c, x0, y0, w, h, 22);
    c.fillStyle = hGradRack(c, x0, w);
    c.fill();
    c.lineWidth = 3; c.strokeStyle = OUTLINE; c.stroke();
    // 木紋
    c.save(); rr(c, x0, y0, w, h, 22); c.clip();
    c.strokeStyle = 'rgba(70,44,20,0.22)'; c.lineWidth = 1.5;
    for (let gx = x0 + 14; gx < x0 + w - 6; gx += 17) {
      c.beginPath(); c.moveTo(gx, y0); c.bezierCurveTo(gx + 4, y0 + h * 0.3, gx - 4, y0 + h * 0.7, gx, y0 + h); c.stroke();
    }
    c.fillStyle = 'rgba(255,240,200,0.18)'; c.fillRect(x0, y0, 7, h);
    c.restore();
    for (let i = 0; i < slots; i++) {
      const y = B.firstY + i * B.gap;
      c.beginPath(); c.arc(B.x, y, r + 3, 0, 7);
      c.fillStyle = 'rgba(52,32,14,0.45)'; c.fill();
      c.beginPath(); c.arc(B.x, y + 2, r + 3, 0.15 * Math.PI, 0.85 * Math.PI);
      c.strokeStyle = 'rgba(255,236,190,0.35)'; c.lineWidth = 2; c.stroke();
    }
  }

  function hGradRack(c, x0, w) {
    const g = c.createLinearGradient(x0, 0, x0 + w, 0);
    g.addColorStop(0, '#b98552'); g.addColorStop(0.5, '#a3703f'); g.addColorStop(1, '#8a5a30');
    return g;
  }

  function drawVillage(c, L, rand, theme, slots) {
    const G = L.grid;
    const h = G.rows * G.cellH;
    c.fillStyle = vGrad(c, G.y, G.y + h, (theme && theme.village) || ['#d6c698', '#ad9869']);
    c.fillRect(0, G.y, G.x, h);

    for (let i = 0; i < 70; i++) {
      c.fillStyle = rand() < 0.6 ? 'rgba(96,74,46,0.16)' : 'rgba(255,248,224,0.2)';
      c.beginPath();
      c.ellipse(rand() * G.x, G.y + rand() * h, 3 + rand() * 6, 2 + rand() * 3, 0, 0, 7);
      c.fill();
    }

    // 村莊欄整欄都是技能圖示（7 顆），房子會被圖示蓋住（以前第 1 路紅屋頂露在圖示旁邊很亂），
    // 所以這裡不畫房子，改畫一座木頭「技能架」，圖示放在架上的圓槽裡。房子只留在大地圖上。
    // （第 5 關原本屋旁的小燈籠也拿掉：會疊在木架邊緣、貼著圖示；草地上的燈籠格照舊）
    drawSkillRack(c, L, slots);
  }

  // ===== 出怪區 =====
  function drawPennant(c, x, y, color) {
    c.fillStyle = '#d8d2e8'; c.fillRect(x, y - 30, 3, 42);
    poly(c, [[x + 3, y - 30], [x - 21, y - 21], [x + 3, y - 12]]);
    c.fillStyle = color; c.fill();
    c.lineWidth = 1.5; c.strokeStyle = OUTLINE; c.stroke();
  }

  function drawSpawn(c, cfg, level, rand) {
    const L = cfg.layout;
    const G = L.grid;
    const sx = G.x + G.cols * G.cellW;
    const w = L.width - sx;
    const h = G.rows * G.cellH;

    const T = level.theme || {};
    const g = c.createLinearGradient(sx, 0, L.width, 0);
    g.addColorStop(0, T.spawn ? T.spawn[0] : '#5e5680'); g.addColorStop(1, T.spawn ? T.spawn[1] : '#3a3556');
    c.fillStyle = g;
    c.fillRect(sx, G.y, w, h);

    for (let i = 0; i < 46; i++) {
      c.fillStyle = `rgba(255,255,255,${0.1 + rand() * 0.28})`;
      c.beginPath(); c.arc(sx + rand() * w, G.y + rand() * h, 0.6 + rand() * 1.1, 0, 7); c.fill();
    }
    if (T.spawnMist) {
      c.fillStyle = T.spawnMist;
      for (let i = 0; i < 14; i++) {
        c.beginPath(); c.ellipse(sx + rand() * w, G.y + rand() * h, 12 + rand() * 16, 6 + rand() * 8, 0, 0, 7); c.fill();
      }
    }

    L.laneY.forEach((y, r) => {
      const open = level.openLanes.indexOf(r + 1) !== -1;
      const top = G.y + r * G.cellH;
      if (open) {
        const foot = y + G.cellH / 2 - G.cellH * L.footFromBottom;
        softCircle(c, L.width - 18, y + 10, 92, '196,160,255', 0.42);
        c.fillStyle = vGrad(c, foot - 24, foot + 16, [
          'rgba(210,190,255,0)', 'rgba(210,190,255,0.24)', 'rgba(210,190,255,0)',
        ]);
        c.fillRect(sx, foot - 24, w, 40);
        // 往左的箭頭：告訴孩子敵人往哪走
        c.strokeStyle = 'rgba(255,255,255,0.3)';
        c.lineWidth = 4; c.lineCap = 'round'; c.lineJoin = 'round';
        [0, 16].forEach((d) => {
          const ax = sx + 22 + d;
          c.beginPath(); c.moveTo(ax + 8, y - 11); c.lineTo(ax - 3, y); c.lineTo(ax + 8, y + 11); c.stroke();
        });
      } else {
        c.fillStyle = 'rgba(20,18,38,0.34)';
        c.fillRect(sx, top, w, G.cellH);
      }
      if (r > 0) {
        c.fillStyle = 'rgba(16,14,32,0.32)';
        c.fillRect(sx, top - 1, w, 2);
      }
      const pens = T.pennants || ['#ff8fb0', '#ffd84a'];
      drawPennant(c, L.width - 12, top + 40, r % 2 ? pens[1] : pens[0]);
      const foot = y + G.cellH / 2 - G.cellH * L.footFromBottom;
      if (T.decor === 'ripple') {
        // 出怪區的水面波紋
        c.strokeStyle = 'rgba(168,216,255,0.25)'; c.lineWidth = 2;
        [0, 1, 2].forEach((k) => { c.beginPath(); c.arc(sx + 30 + k * 26, foot + 14, 10 + k * 3, Math.PI, 0); c.stroke(); });
      } else if (T.decor === 'pine' && r % 2 === 1) {
        // 小松樹（矮矮的，不超過旗子）
        const tx = sx + 60;
        const ty = top + G.cellH - 12;
        c.fillStyle = '#5a3a1e'; c.fillRect(tx - 3, ty - 12, 6, 12);
        [[0, 26], [-14, 20], [-26, 14]].forEach(([dy, hw]) => {
          poly(c, [[tx - hw, ty - 10 + dy], [tx, ty - 40 + dy], [tx + hw, ty - 10 + dy]]);
          c.fillStyle = '#3f7a4a'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#1c3a24'; c.stroke();
        });
      } else if (T.decor === 'haystack' && r % 2 === 0) {
        // 圓圓的小草堆
        const tx = sx + 56;
        const ty = top + G.cellH - 14;
        c.beginPath(); c.ellipse(tx, ty - 14, 26, 18, 0, Math.PI, 0); c.lineTo(tx + 26, ty); c.lineTo(tx - 26, ty); c.closePath();
        c.fillStyle = '#e8c766'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#5a4416'; c.stroke();
        c.strokeStyle = 'rgba(140,100,30,0.6)'; c.lineWidth = 1.5;
        [-12, 0, 12].forEach((d) => { c.beginPath(); c.moveTo(tx + d, ty - 26 + Math.abs(d) * 0.4); c.lineTo(tx + d * 1.2, ty - 2); c.stroke(); });
      } else if (T.decor === 'tent' && r % 2 === 0) {
        // 低矮的三角帳篷（高度不超過旗子）
        const tx = sx + 56;
        const ty = top + G.cellH - 14;
        poly(c, [[tx - 30, ty], [tx, ty - 46], [tx + 30, ty]]);
        c.fillStyle = '#8e5aa0'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#2a1838'; c.stroke();
        poly(c, [[tx - 5, ty], [tx, ty - 30], [tx + 5, ty]]);
        c.fillStyle = '#f4d8ff'; c.fill();
      }
    });
  }

  // ===== 邊框與介面底 =====
  function woodBar(c, x, y, w, h, vertical, rand) {
    const g = vertical ? c.createLinearGradient(x, 0, x + w, 0) : c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#ac824f');
    g.addColorStop(0.5, '#865b31');
    g.addColorStop(1, '#5a3a1e');
    c.fillStyle = g;
    c.fillRect(x, y, w, h);
    c.fillStyle = 'rgba(40,24,10,0.45)';
    const length = vertical ? h : w;
    for (let p = 30 + rand() * 60; p < length; p += 70 + rand() * 70) {
      if (vertical) c.fillRect(x, y + p, w, 1.5); else c.fillRect(x + p, y, 1.5, h);
    }
  }

  function inset(c, x, y, w, h, r) {
    rr(c, x, y, w, h, r);
    c.fillStyle = 'rgba(10,22,18,0.5)'; c.fill();
    c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,0.16)'; c.stroke();
  }

  function drawChrome(c, L, rand, theme) {
    const T = theme || {};
    const G = L.grid;
    const fieldBottom = G.y + G.rows * G.cellH;
    const sx = G.x + G.cols * G.cellW;

    c.fillStyle = vGrad(c, 0, L.topBar.h, T.chromeTop || ['#42634f', '#2a4336']);
    c.fillRect(0, 0, L.width, L.topBar.h);
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fillRect(0, 0, L.width, 1.5);

    inset(c, 6, 10, 172, 60, 16);        // 球數
    inset(c, L.hintPlate.x, L.hintPlate.y, L.hintPlate.w, L.hintPlate.h, 16); // 提示句

    c.fillStyle = vGrad(c, fieldBottom, L.height, T.chromeBot || ['#39543f', '#1f3228']);
    c.fillRect(0, fieldBottom, L.width, L.height - fieldBottom);

    // 卡片與按鈕下方的落影
    c.fillStyle = 'rgba(8,16,12,0.34)';
    const C = L.cards;
    for (let i = 0; i < PD.config.cardOrder.length; i++) {
      rr(c, C.x + i * (C.w + C.gap) + 2, C.y + 5, C.w, C.h, 18); c.fill();
    }
    [L.recallBtn, L.cancelBtn].forEach((b) => { rr(c, b.x + 2, b.y + 5, b.w, b.h, 18); c.fill(); });

    woodBar(c, G.x - 8, G.y, 8, fieldBottom - G.y, true, rand);
    woodBar(c, sx, G.y, 8, fieldBottom - G.y, true, rand);
    woodBar(c, 0, L.topBar.h, L.width, G.y - L.topBar.h, false, rand);
    woodBar(c, 0, fieldBottom, L.width, L.cards.y - fieldBottom, false, rand);
  }

  // ===== 圖檔背景（第 4～6 關的 bgArt）=====
  // 整張 1180×820 的圖以 (ax, ay) 為中心放大 scale 倍，再移動 (dx, dy)；上下的介面列、村莊和出怪區照樣蓋在上面，
  // 看得到的只有草地那一塊（x 120～1080、y 88～664）
  function drawBgArt(c, L, img, A) {
    const s = A.scale || 1;
    const x = (A.ax || 0) * (1 - s) + (A.dx || 0);
    const y = (A.ay || 0) * (1 - s) + (A.dy || 0);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(img, x, y, L.width * s, L.height * s);
  }

  // 圖檔背景上的草地：不再畫草色格子，只畫淡淡的格線、路線小徑和地形（地形是規則的一部分，一定要看得到）
  function drawFieldOnArt(c, cfg, level) {
    const L = cfg.layout;
    const G = L.grid;
    const A = level.bgArt;
    const fieldW = G.cols * G.cellW;
    const fieldH = G.rows * G.cellH;
    c.save();
    c.beginPath(); c.rect(G.x, G.y, fieldW, fieldH); c.clip();
    if (A.tint) { c.fillStyle = `rgba(${A.tint},${A.tintAlpha || 0.08})`; c.fillRect(G.x, G.y, fieldW, fieldH); }
    if (A.veil) { c.fillStyle = A.veil; c.fillRect(G.x, G.y, fieldW, fieldH); }
    // 敵人走的小徑（比程式草地更淡）
    const T = level.theme || {};
    const rgb = T.path || '226,202,146';
    L.laneY.forEach((laneY) => {
      const foot = laneY + G.cellH / 2 - G.cellH * L.footFromBottom;
      c.fillStyle = vGrad(c, foot - 22, foot + 14, [`rgba(${rgb},0)`, `rgba(${rgb},${A.pathAlpha || 0.16})`, `rgba(${rgb},0)`]);
      c.fillRect(G.x, foot - 22, fieldW, 36);
    });
    c.restore();
    drawTerrain(c, cfg, level, makeRand(7));
    // 格線：亮線加一條很淡的暗線，在亮處和暗處都看得到；路與路之間稍微明顯一點
    const line = A.gridAlpha || 0.2;
    for (let col = 1; col < G.cols; col++) {
      const x = G.x + col * G.cellW;
      c.fillStyle = `rgba(255,255,255,${line})`; c.fillRect(x - 0.5, G.y, 1, fieldH);
      c.fillStyle = `rgba(16,28,20,${line * 0.6})`; c.fillRect(x + 0.5, G.y, 1, fieldH);
    }
    for (let r = 1; r < G.rows; r++) {
      const y = G.y + r * G.cellH;
      c.fillStyle = `rgba(255,255,255,${line * 1.5})`; c.fillRect(G.x, y - 0.75, fieldW, 1.5);
      c.fillStyle = `rgba(16,28,20,${line})`; c.fillRect(G.x, y + 0.75, fieldW, 1.5);
    }
    // 靠邊框的淡內陰影
    const edge = 18;
    const shade = 'rgba(14,24,18,0.28)';
    const clear = 'rgba(14,24,18,0)';
    c.fillStyle = vGrad(c, G.y, G.y + edge, [shade, clear]); c.fillRect(G.x, G.y, fieldW, edge);
    c.fillStyle = vGrad(c, G.y + fieldH - edge, G.y + fieldH, [clear, shade]); c.fillRect(G.x, G.y + fieldH - edge, fieldW, edge);
  }

  // 這一關有技能插槽的角色（已解鎖、有技能，順序同卡片列）。戰鬥畫面的插槽與木架圓槽都用這張表，數量一定相同
  PD.skillKinds = function (cfg, level) {
    return cfg.cardOrder.filter((k) => cfg.skills[k] && (cfg.debug.unlockAll || cfg.units[k].unlock <= level.number));
  };

  // 場地背景（靜態，只畫一次）
  PD.buildBackground = function (scene, cfg, level, key) {
    const L = cfg.layout;
    const { canvas, c } = newCanvas(L.width, L.height);
    const rand = makeRand(20261108);
    c.fillStyle = '#26382c';
    c.fillRect(0, 0, L.width, L.height);
    // 有圖檔背景（而且檔案在）就用圖，缺檔時照舊用程式畫的草地
    const artKey = 'bgArt_' + level.number;
    const art = level.bgArt && scene.textures.exists(artKey) ? scene.textures.get(artKey).getSourceImage() : null;
    if (art) drawBgArt(c, L, art, level.bgArt);
    drawVillage(c, L, rand, level.theme, PD.skillKinds(cfg, level).length);
    drawSpawn(c, cfg, level, rand);
    if (art) drawFieldOnArt(c, cfg, level); else drawField(c, cfg, level, rand);
    drawChrome(c, L, rand, level.theme);
    scene.textures.addCanvas(key || 'bg', canvas);
  };

  // 戰鬥用的背景：沒有主題的關卡共用開場畫好的 'bg'（2026-11-10 起六關都有主題）；
  // 有主題的關卡另畫一張，只留目前這一關的，換關時先刪掉上一張，iPad 記憶體不會越用越多
  PD.levelBackground = function (scene, cfg, level) {
    if (!level.theme) return 'bg';
    const key = 'bg_level';
    const id = level.number + ':' + PD.skillKinds(cfg, level).length; // 木架圓槽數不同（例如測試開了 unlockAll）也要重畫
    if (PD.bgLevelNumber !== id) {
      if (scene.textures.exists(key)) scene.textures.remove(key);
      PD.buildBackground(scene, cfg, level, key);
      PD.bgLevelNumber = id;
    }
    return key;
  };

  // ===== 大地圖選關的底圖（docs/beautify-top5-v1.md 第 2 項）：夜空、星星、三層遠山、左下的小村莊、右下的搗蛋團帳篷 =====
  // 開場畫一次、之後是靜態圖；亂數有固定種子
  PD.buildMapBackground = function (scene, cfg) {
    const L = cfg.layout;
    const W = L.width;
    const H = L.height;
    const { canvas, c } = newCanvas(W, H);
    const rand = makeRand(20261110);
    c.fillStyle = vGrad(c, 0, H, ['#1B2E44', '#22384A', '#314D3A']);
    c.fillRect(0, 0, W, H);
    // 星星（大小不同，不會閃）
    for (let i = 0; i < 90; i++) {
      const x = rand() * W;
      const y = rand() * H * 0.55;
      c.fillStyle = `rgba(255,250,225,${0.25 + rand() * 0.55})`;
      c.beginPath(); c.arc(x, y, 0.7 + rand() * 1.5, 0, 7); c.fill();
    }
    // 月亮：柔光加一個圓。放在標題右邊、第 3 關木牌上方的空處（以前在 1060,120，會貼著右上角的圖鑑鈕）
    const mx = 850, my = 160; // 圖鑑頁的格子從 y 124 開始，月亮整顆藏在格子後面，不從標題下露出一角
    softCircle(c, mx, my, 120, '255,240,190', 0.22);
    c.fillStyle = '#fff3c4';
    c.beginPath(); c.arc(mx, my, 30, 0, 7); c.fill();
    c.fillStyle = 'rgba(230,214,160,0.55)';
    [[mx - 10, my - 8, 6], [mx + 12, my + 8, 4], [mx - 4, my + 14, 3]].forEach((p) => { c.beginPath(); c.arc(p[0], p[1], p[2], 0, 7); c.fill(); });
    // 三層遠山：由遠到近、由暗到亮
    [['#3A5A4A', 0.5, 150, 7], ['#4E6F58', 0.66, 120, 6], ['#6A8B66', 0.82, 96, 5]].forEach(([color, base, amp, n]) => {
      c.fillStyle = color;
      for (let i = 0; i <= n; i++) {
        const x = (i / n) * W + (rand() - 0.5) * 80;
        c.beginPath(); c.ellipse(x, H * base + amp * 0.6, 150 + rand() * 90, amp + rand() * 40, 0, 0, 7); c.fill();
      }
      c.fillRect(0, H * base + amp * 0.6, W, H);
    });
    // 地面上的小草點
    for (let i = 0; i < 70; i++) {
      c.fillStyle = rand() < 0.5 ? 'rgba(200,230,170,0.16)' : 'rgba(20,40,24,0.16)';
      c.beginPath(); c.ellipse(rand() * W, H * 0.72 + rand() * H * 0.28, 4 + rand() * 8, 2 + rand() * 3, 0, 0, 7); c.fill();
    }
    // 左下的小村莊（旅程的起點），只是剪影，不擋住關卡
    [[52, 786, '#ec9a7c'], [106, 798, '#83b6ea']].forEach(([x, y, roof]) => {
      c.fillStyle = '#e8d8b4'; c.fillRect(x - 20, y - 26, 40, 26);
      poly(c, [[x - 27, y - 24], [x, y - 50], [x + 27, y - 24]]); c.fillStyle = roof; c.fill();
      c.lineWidth = 2; c.strokeStyle = OUTLINE; c.stroke(); c.strokeRect(x - 20, y - 26, 40, 26);
      softCircle(c, x + 8, y - 14, 12, '255,226,140', 0.6);
      c.fillStyle = '#ffe9a0'; c.fillRect(x + 3, y - 19, 10, 10);
    });
    scene.textures.addCanvas('mapBg', canvas);
  };

  // 暫停、勝利、失敗共用的大面板；太大放不進合併大圖，自己一張。
  // 另做一張窄的 panelNarrow（新招式提示用：面板往右讓出左邊技能欄旁的空位給箭頭與「點這裡放招！」）
  PD.buildPanel = function (scene) {
    drawPanel(scene, 'panel', 1040);
    drawPanel(scene, 'panelNarrow', PD.config.layout.panelNarrow.w);
  };

  function drawPanel(scene, key, w) {
    const h = 380;
    const { canvas, c } = newCanvas(w, h);
    rr(c, 4, 4, w - 8, h - 8, 34);
    c.fillStyle = vGrad(c, 0, h, ['#3f6150', '#22382d']);
    c.fill();
    c.save();
    c.clip();
    c.fillStyle = vGrad(c, 0, h * 0.4, ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']);
    c.fillRect(0, 0, w, h * 0.4);
    c.restore();
    rr(c, 13, 13, w - 26, h - 26, 26);
    c.lineWidth = 2; c.strokeStyle = 'rgba(255,233,168,0.5)'; c.stroke();
    rr(c, 4, 4, w - 8, h - 8, 34);
    c.lineWidth = 5; c.strokeStyle = OUTLINE; c.stroke();
    scene.textures.addCanvas(key, canvas);
  }
})();
