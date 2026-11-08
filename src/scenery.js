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

  function drawCell(c, x, y, w, h, open, even, rand) {
    const colors = open
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
    if (open && rand() < 0.4) {
      const fx = x + (rand() < 0.5 ? 12 : w - 12);
      const fy = y + (rand() < 0.5 ? 18 : h - 14);
      drawFlower(c, fx, fy, rand);
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
        drawCell(c, G.x + col * G.cellW, G.y + r * G.cellH, G.cellW, G.cellH, isOpen(r), (r + col) % 2 === 0, rand);
      }
    }

    // 開放的路上，敵人腳下有一條被踩淡的小徑
    L.laneY.forEach((laneY, r) => {
      if (!isOpen(r)) return;
      const foot = laneY + G.cellH / 2 - G.cellH * L.footFromBottom;
      c.fillStyle = vGrad(c, foot - 24, foot + 16, [
        'rgba(226,202,146,0)', 'rgba(226,202,146,0.26)', 'rgba(226,202,146,0)',
      ]);
      c.fillRect(G.x, foot - 24, fieldW, 40);
    });

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
    softCircle(c, G.x + 220, G.y - 40, 880, '255,244,200', 0.2);

    // 靠邊框的內陰影
    const edge = 22;
    const shade = 'rgba(20,36,22,0.3)';
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

  // ===== 村莊 =====
  function drawHouse(c, cx, by, roofLight, roofDark) {
    c.fillStyle = 'rgba(40,30,16,0.26)';
    c.beginPath(); c.ellipse(cx, by + 1, 44, 8, 0, 0, 7); c.fill();

    // 煙囪
    c.lineWidth = 2.5; c.strokeStyle = OUTLINE;
    c.fillStyle = '#b5705a';
    c.fillRect(cx + 14, by - 84, 12, 26); c.strokeRect(cx + 14, by - 84, 12, 26);

    // 牆
    c.fillStyle = vGrad(c, by - 48, by, ['#fbf1da', '#e4d2ac']);
    c.fillRect(cx - 32, by - 48, 64, 48);
    c.fillStyle = 'rgba(90,64,36,0.16)';
    c.fillRect(cx + 14, by - 48, 18, 48);
    c.strokeRect(cx - 32, by - 48, 64, 48);

    // 門
    c.beginPath();
    c.moveTo(cx - 19, by); c.lineTo(cx - 19, by - 22);
    c.arc(cx - 10, by - 22, 9, Math.PI, 0);
    c.lineTo(cx - 1, by); c.closePath();
    c.fillStyle = vGrad(c, by - 31, by, ['#94683f', '#6f4b2b']);
    c.fill(); c.lineWidth = 2; c.stroke();
    c.fillStyle = '#ffd84a';
    c.beginPath(); c.arc(cx - 5, by - 13, 1.6, 0, 7); c.fill();

    // 亮著燈的窗
    softCircle(c, cx + 16, by - 25, 20, '255,226,140', 0.4);
    c.fillStyle = vGrad(c, by - 36, by - 16, ['#fff0b0', '#f6c765']);
    c.fillRect(cx + 7, by - 35, 18, 18);
    c.lineWidth = 2; c.strokeRect(cx + 7, by - 35, 18, 18);
    c.beginPath(); c.moveTo(cx + 16, by - 35); c.lineTo(cx + 16, by - 17);
    c.moveTo(cx + 7, by - 26); c.lineTo(cx + 25, by - 26); c.stroke();

    // 屋頂與瓦片
    const roof = [[cx - 42, by - 44], [cx, by - 88], [cx + 42, by - 44]];
    poly(c, roof);
    c.fillStyle = vGrad(c, by - 88, by - 44, [roofLight, roofDark]);
    c.fill();
    c.save();
    c.clip();
    c.strokeStyle = 'rgba(40,30,20,0.2)'; c.lineWidth = 1.5;
    c.beginPath();
    for (let y = by - 78; y < by - 44; y += 9) { c.moveTo(cx - 44, y); c.lineTo(cx + 44, y); }
    c.stroke();
    c.fillStyle = 'rgba(30,20,20,0.14)';
    poly(c, [[cx, by - 88], [cx + 44, by - 44], [cx, by - 44]]); c.fill();
    c.restore();
    poly(c, roof);
    c.lineWidth = 2.5; c.strokeStyle = OUTLINE; c.stroke();
  }

  function drawBush(c, x, y) {
    [[-9, 1, 8], [8, 2, 7], [0, -3, 10]].forEach((p) => {
      c.beginPath(); c.arc(x + p[0], y + p[1], p[2], 0, 7);
      c.fillStyle = '#5f9455'; c.fill();
    });
    c.fillStyle = 'rgba(214,240,170,0.5)';
    c.beginPath(); c.arc(x - 3, y - 7, 4, 0, 7); c.fill();
  }

  function drawVillage(c, L, rand) {
    const G = L.grid;
    const h = G.rows * G.cellH;
    c.fillStyle = vGrad(c, G.y, G.y + h, ['#d6c698', '#ad9869']);
    c.fillRect(0, G.y, G.x, h);

    for (let i = 0; i < 70; i++) {
      c.fillStyle = rand() < 0.6 ? 'rgba(96,74,46,0.16)' : 'rgba(255,248,224,0.2)';
      c.beginPath();
      c.ellipse(rand() * G.x, G.y + rand() * h, 3 + rand() * 6, 2 + rand() * 3, 0, 0, 7);
      c.fill();
    }

    const roofs = [['#ec9a7c', '#c9674a'], ['#83b6ea', '#4f84c0'], ['#efd37e', '#cda24a'], ['#9bd08a', '#65a158']];
    L.laneY.forEach((y, i) => {
      const by = y + 56;
      drawHouse(c, 60, by, roofs[i][0], roofs[i][1]);
      drawBush(c, 14, by + 2);
    });
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

    const g = c.createLinearGradient(sx, 0, L.width, 0);
    g.addColorStop(0, '#5e5680'); g.addColorStop(1, '#3a3556');
    c.fillStyle = g;
    c.fillRect(sx, G.y, w, h);

    for (let i = 0; i < 46; i++) {
      c.fillStyle = `rgba(255,255,255,${0.1 + rand() * 0.28})`;
      c.beginPath(); c.arc(sx + rand() * w, G.y + rand() * h, 0.6 + rand() * 1.1, 0, 7); c.fill();
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
      drawPennant(c, L.width - 12, top + 40, r % 2 ? '#ffd84a' : '#ff8fb0');
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

  function drawChrome(c, L, rand) {
    const G = L.grid;
    const fieldBottom = G.y + G.rows * G.cellH;
    const sx = G.x + G.cols * G.cellW;

    c.fillStyle = vGrad(c, 0, L.topBar.h, ['#42634f', '#2a4336']);
    c.fillRect(0, 0, L.width, L.topBar.h);
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fillRect(0, 0, L.width, 1.5);

    inset(c, 6, 10, 172, 60, 16);        // 球數
    inset(c, 367, 12, 625, 56, 16);      // 提示句

    c.fillStyle = vGrad(c, fieldBottom, L.height, ['#39543f', '#1f3228']);
    c.fillRect(0, fieldBottom, L.width, L.height - fieldBottom);

    // 卡片與按鈕下方的落影
    c.fillStyle = 'rgba(8,16,12,0.34)';
    const C = L.cards;
    for (let i = 0; i < 6; i++) {
      rr(c, C.x + i * (C.w + C.gap) + 2, C.y + 5, C.w, C.h, 18); c.fill();
    }
    [L.recallBtn, L.cancelBtn].forEach((b) => { rr(c, b.x + 2, b.y + 5, b.w, b.h, 18); c.fill(); });

    woodBar(c, G.x - 8, G.y, 8, fieldBottom - G.y, true, rand);
    woodBar(c, sx, G.y, 8, fieldBottom - G.y, true, rand);
    woodBar(c, 0, L.topBar.h, L.width, G.y - L.topBar.h, false, rand);
    woodBar(c, 0, fieldBottom, L.width, L.cards.y - fieldBottom, false, rand);
  }

  // 場地背景（靜態，只畫一次）
  PD.buildBackground = function (scene, cfg, level) {
    const L = cfg.layout;
    const { canvas, c } = newCanvas(L.width, L.height);
    const rand = makeRand(20261108);
    c.fillStyle = '#26382c';
    c.fillRect(0, 0, L.width, L.height);
    drawVillage(c, L, rand);
    drawSpawn(c, cfg, level, rand);
    drawField(c, cfg, level, rand);
    drawChrome(c, L, rand);
    scene.textures.addCanvas('bg', canvas);
  };

  // 暫停、勝利、失敗共用的大面板；太大放不進合併大圖，自己一張
  PD.buildPanel = function (scene) {
    const w = 1040;
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
    scene.textures.addCanvas('panel', canvas);
  };
})();
