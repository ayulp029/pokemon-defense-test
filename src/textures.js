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

  // 依角色的 artBox 只取來源圖的一塊（可超出原圖，多的地方是透明邊距）
  function cropArt(img, box) {
    if (!box) return img;
    const cv = document.createElement('canvas');
    cv.width = box.w;
    cv.height = box.h;
    cv.getContext('2d').drawImage(img, -box.x, -box.y);
    return cv;
  }

  // 用已公開的貼圖做出新敵人：整張換色、加上一圈描邊、左右翻轉成面朝左（keepFacing＝原圖已面朝左，不翻）。
  // 全程用瀏覽器合成模式（iPad Safari 不支援 canvas 的 filter），不產生圖檔。
  function drawRecolored(ctx, w, h, art, def, keepFacing) {
    const make = () => {
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(w * DENSITY);
      cv.height = Math.ceil(h * DENSITY);
      const c = cv.getContext('2d');
      c.scale(DENSITY, DENSITY);
      return { cv, c };
    };
    const M = 3; // 留給描邊的邊距
    const paint = (c) => { c.save(); c.translate(M, M); drawArt(c, w - M * 2, h - M * 2, art); c.restore(); };
    const body = make();
    paint(body.c);
    body.c.globalCompositeOperation = 'color';
    body.c.fillStyle = hex(def.recolor);
    body.c.fillRect(0, 0, w, h);
    body.c.globalCompositeOperation = 'destination-in';
    paint(body.c);
    const edge = make();
    paint(edge.c);
    edge.c.globalCompositeOperation = 'source-in';
    edge.c.fillStyle = hex(def.outline);
    edge.c.fillRect(0, 0, w, h);
    ctx.save();
    if (!keepFacing) { ctx.translate(w, 0); ctx.scale(-1, 1); }
    for (let a = 0; a < 8; a++) {
      ctx.drawImage(edge.cv, Math.cos(a * Math.PI / 4) * 2, Math.sin(a * Math.PI / 4) * 2, w, h);
    }
    ctx.drawImage(body.cv, 0, 0, w, h);
    ctx.restore();
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
    gem(ctx, c, s, color) {
      poly(ctx, [[c, -s], [c + s * 0.85, -s * 0.45], [c + s * 0.85, s * 0.45], [c, s], [c - s * 0.85, s * 0.45], [c - s * 0.85, -s * 0.45]]);
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

  // ===== 新敵人的程式配件（不產生圖檔）。back＝畫在本體後面，front＝畫在前面；面朝左 =====
  const accessories = {
    // 補補蛙：頭頂淡粉紅十字（醫藥記號）
    cross: {
      front(c, w, h) {
        const x = w * 0.5;
        const y = h * 0.11;
        const a = w * 0.14;
        const b = w * 0.055;
        poly(c, [[x - b, y - a], [x + b, y - a], [x + b, y - b], [x + a, y - b], [x + a, y + b], [x + b, y + b],
          [x + b, y + a], [x - b, y + a], [x - b, y + b], [x - a, y + b], [x - a, y - b], [x - b, y - b]]);
        c.fillStyle = '#FFE0EC'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#B0296A'; c.stroke();
      },
    },
    // 彈跳蜥：腳底兩個薄荷色彈簧
    spring: {
      front(c, w, h) {
        [w * 0.36, w * 0.62].forEach((x) => {
          c.lineWidth = 2; c.strokeStyle = OUTLINE;
          for (let i = 0; i < 3; i++) {
            c.beginPath(); c.ellipse(x, h - 4 - i * 3.2, w * 0.075, 2.2, 0, 0, 7);
            c.fillStyle = '#C8F5EE'; c.fill(); c.stroke();
          }
        });
      },
    },
    // 雙胞搗蛋：肩上兩顆圓點，暗示會分成兩隻
    twin: {
      front(c, w, h) {
        [[w * 0.18, '#fff4f0'], [w * 0.82, '#ffd0c4']].forEach(([x, col]) => {
          c.beginPath(); c.arc(x, h * 0.36, w * 0.13, 0, 7);
          c.fillStyle = col; c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#7a1414'; c.stroke();
          c.fillStyle = '#e2453c';
          c.beginPath(); c.arc(x, h * 0.36, w * 0.05, 0, 7); c.fill();
        });
      },
    },
    // 鐵甲熊兵、厚殼機器人：半透明的寬肩甲帶
    pads: {
      front(c, w, h) {
        c.save();
        c.globalAlpha = 0.55;
        [[w * 0.06, -0.2], [w * 0.68, 0.2]].forEach(([x, tilt]) => {
          c.save(); c.translate(x + w * 0.13, h * 0.62); c.rotate(tilt);
          rr(c, -w * 0.15, -h * 0.05, w * 0.3, h * 0.1, 5);
          c.fillStyle = '#C2C9D6'; c.fill(); c.lineWidth = 2; c.strokeStyle = OUTLINE; c.stroke();
          c.restore();
        });
        c.restore();
      },
    },
    wings: {
      back(c, w, h) {
        [[w * 0.6, -0.55], [w * 0.42, 0.45]].forEach(([x, tilt], i) => {
          c.save();
          c.translate(x, h * 0.66);
          c.rotate(tilt);
          c.beginPath();
          c.moveTo(0, 0);
          c.quadraticCurveTo(-w * 0.06, -h * 0.62, w * 0.22 * (i ? -1 : 1), -h * 0.5);
          c.quadraticCurveTo(w * 0.18 * (i ? -1 : 1), -h * 0.14, 0, 0);
          c.fillStyle = i ? '#cfe2ff' : '#eef5ff';
          c.fill();
          c.lineWidth = 2.5; c.strokeStyle = OUTLINE; c.stroke();
          c.strokeStyle = 'rgba(80,120,200,0.55)'; c.lineWidth = 1.5;
          c.beginPath(); c.moveTo(0, 0); c.lineTo(w * 0.13 * (i ? -1 : 1), -h * 0.42); c.stroke();
          c.restore();
        });
      },
    },
    hat: {
      back(c, w, h) {
        // 背後一顆要丟的軟軟球
        c.beginPath(); c.arc(w * 0.82, h * 0.52, w * 0.13, 0, 7);
        c.fillStyle = '#ffe36b'; c.fill(); c.lineWidth = 2; c.strokeStyle = OUTLINE; c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.7)';
        c.beginPath(); c.arc(w * 0.78, h * 0.49, w * 0.04, 0, 7); c.fill();
      },
      front(c, w, h) {
        // 歪歪的小帽子加絨球
        c.save();
        c.translate(w * 0.46, h * 0.4);
        c.rotate(-0.25);
        poly(c, [[-w * 0.26, 0], [w * 0.22, -h * 0.02], [w * 0.02, -h * 0.2]]);
        c.fillStyle = '#e84a5f'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUTLINE; c.stroke();
        c.fillStyle = '#fff4d6';
        rr(c, -w * 0.29, -h * 0.025, w * 0.54, h * 0.05, 4); c.fill(); c.stroke();
        c.beginPath(); c.arc(w * 0.02, -h * 0.2, w * 0.07, 0, 7); c.fill(); c.stroke();
        c.restore();
      },
    },
    mask: {
      back(c, w, h) {
        // 小斗篷
        poly(c, [[w * 0.25, h * 0.3], [w * 0.75, h * 0.3], [w * 0.95, h * 0.95], [w * 0.05, h * 0.95]]);
        c.fillStyle = '#3b3380'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUTLINE; c.stroke();
      },
      front(c, w, h) {
        // 眼罩（兩個圓洞），像玩躲貓貓
        const y = h * 0.2;
        c.beginPath();
        c.ellipse(w * 0.5, y, w * 0.34, h * 0.055, 0, 0, 7);
        c.fillStyle = '#2a2470'; c.fill(); c.lineWidth = 2; c.strokeStyle = OUTLINE; c.stroke();
        c.fillStyle = '#ffffff';
        [0.37, 0.61].forEach((k) => { c.beginPath(); c.ellipse(w * k, y, w * 0.065, h * 0.03, 0, 0, 7); c.fill(); });
        c.fillStyle = 'rgba(200,190,255,0.9)';
        c.beginPath(); c.ellipse(w * 0.8, y - h * 0.03, w * 0.08, h * 0.02, 0.4, 0, 7); c.fill();
      },
    },
    captain: {
      back(c, w, h) { cape(c, w, h, '#c0392b', '#e8705f'); },
      front(c, w, h) { crown(c, w * 0.42, h * 0.27, w * 0.3, '#b0bec5', false); badge(c, w * 0.5, h * 0.62, w * 0.09, '#ffd84a'); },
    },
    king: {
      back(c, w, h) { cape(c, w, h, '#5a1f78', '#a45ad0'); },
      front(c, w, h) { crown(c, w * 0.42, h * 0.3, w * 0.36, '#ffd84a', true); badge(c, w * 0.5, h * 0.62, w * 0.1, '#ff8ec8'); },
    },
  };

  function cape(c, w, h, dark, light) {
    // 只在身體後面露出一點：上窄下寬、下擺有波浪
    c.beginPath();
    c.moveTo(w * 0.36, h * 0.3); c.lineTo(w * 0.64, h * 0.3);
    c.lineTo(w * 0.86, h * 0.86);
    c.quadraticCurveTo(w * 0.75, h * 0.8, w * 0.64, h * 0.86);
    c.quadraticCurveTo(w * 0.5, h * 0.8, w * 0.36, h * 0.86);
    c.quadraticCurveTo(w * 0.25, h * 0.8, w * 0.14, h * 0.86);
    c.closePath();
    const g = c.createLinearGradient(0, h * 0.2, 0, h);
    g.addColorStop(0, light); g.addColorStop(1, dark);
    c.fillStyle = g; c.fill(); c.lineWidth = 3; c.strokeStyle = OUTLINE; c.stroke();
  }

  // 皇冠（king）或頭盔上的尖角（captain）
  function crown(c, cx, by, w, color, jewels) {
    const pts = [[cx - w / 2, by], [cx - w / 2, by - w * 0.32], [cx - w / 4, by - w * 0.14], [cx, by - w * 0.42],
      [cx + w / 4, by - w * 0.14], [cx + w / 2, by - w * 0.32], [cx + w / 2, by]];
    poly(c, pts);
    c.fillStyle = color; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUTLINE; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.fillRect(cx - w / 2 + 3, by - w * 0.08, w - 6, w * 0.04);
    if (!jewels) return;
    [[-w / 4, '#ff6b9a'], [0, '#7fd4ff'], [w / 4, '#7ee081']].forEach(([dx, col]) => {
      c.beginPath(); c.arc(cx + dx, by - w * 0.08, w * 0.05, 0, 7);
      c.fillStyle = col; c.fill(); c.lineWidth = 1.5; c.stroke();
    });
  }

  // 搗蛋團的歪菱形隊徽
  function badge(c, cx, cy, r, color) {
    poly(c, [[cx, cy - r], [cx + r * 0.85, cy - r * 0.1], [cx + r * 0.1, cy + r], [cx - r * 0.85, cy + r * 0.1]]);
    c.fillStyle = color; c.fill(); c.lineWidth = 2; c.strokeStyle = OUTLINE; c.stroke();
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

  // 技能圖示的圓底：徑向漸層＋4 白邊＋2 深色外框（dim＝冷卻中再疊一層暗色）
  function drawSkillBase(c, s, c0, c1, border, dim) {
    const m = s / 2;
    const g = c.createRadialGradient(m, m, 2, m, m, 30);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    c.fillStyle = g;
    c.beginPath(); c.arc(m, m, 31, 0, 7); c.fill();
    if (dim) { c.fillStyle = 'rgba(0,0,0,0.45)'; c.fill(); }
    c.lineWidth = 4; c.strokeStyle = border;
    c.beginPath(); c.arc(m, m, 32, 0, 7); c.stroke();
    c.lineWidth = 2; c.strokeStyle = '#263238';
    c.beginPath(); c.arc(m, m, 35, 0, 7); c.stroke();
  }

  // 顏色暗一階（按下去的按鈕）
  function shade(h) {
    const n = parseInt(h.slice(1), 16);
    return 'rgb(' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * 0.84)).join(',') + ')';
  }

  // 把顏色往灰色拉（冷卻中的底色）
  function desaturate(h) {
    const n = parseInt(h.slice(1), 16);
    const rgb = [n >> 16, (n >> 8) & 255, n & 255];
    const gray = rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11;
    return 'rgb(' + rgb.map((v) => Math.round(v + (gray - v) * 0.7)).join(',') + ')';
  }

  // 七個技能圖案（44×44，白色粗圖形＋2 深色描邊）。小勇是星星徽章（擁有者要求：不可像精靈球，所以不畫圓球）
  const skillArt = {
    trainer(c) {
      [-34, 0, 34].forEach((deg) => {
        const a = (deg - 90) * Math.PI / 180;
        const line = () => { c.beginPath(); c.moveTo(22 + Math.cos(a) * 16, 27 + Math.sin(a) * 16); c.lineTo(22 + Math.cos(a) * 24, 27 + Math.sin(a) * 24); c.stroke(); };
        c.lineWidth = 6; c.strokeStyle = OUTLINE; line();
        c.lineWidth = 3; c.strokeStyle = '#fff'; line();
      });
      c.lineWidth = 2; c.strokeStyle = OUTLINE;
      star(c, 22, 27, 15, 7); c.fillStyle = '#fff'; c.fill(); c.stroke();
      star(c, 22, 27, 7, 3); c.fillStyle = '#F9A825'; c.fill();
    },
    basicShooter(c) {
      poly(c, [[27, 2], [9, 25], [20, 25], [15, 42], [35, 17], [24, 17], [31, 2]]);
      c.fillStyle = '#fff'; c.fill(); c.stroke();
    },
    burnShooter(c) {
      c.save(); c.translate(0, 23); icons.flame(c, 22, 20, '#fff'); c.restore();
      c.save(); c.translate(0, 31); c.lineWidth = 1.5; icons.flame(c, 22, 10, '#FFE082'); c.restore();
    },
    slowShooter(c) {
      c.beginPath();
      c.moveTo(4, 37);
      c.bezierCurveTo(6, 20, 18, 8, 30, 9);
      c.bezierCurveTo(38, 10, 43, 17, 39, 24);
      c.bezierCurveTo(36, 18, 31, 16, 27, 19);
      c.bezierCurveTo(22, 23, 23, 31, 29, 33);
      c.bezierCurveTo(33, 35, 38, 35, 41, 35);
      c.lineTo(41, 41); c.lineTo(4, 41); c.closePath();
      c.fillStyle = '#fff'; c.fill(); c.stroke();
      [[8, 15, 3.5], [15, 6, 2.5]].forEach((b) => { c.beginPath(); c.arc(b[0], b[1], b[2], 0, 7); c.fill(); c.stroke(); });
    },
    doubleStriker(c) {
      const vine = () => { c.beginPath(); c.moveTo(29, 5); c.bezierCurveTo(5, 11, 39, 27, 15, 39); c.stroke(); };
      c.lineWidth = 10; c.strokeStyle = OUTLINE; vine();
      c.lineWidth = 7; c.strokeStyle = '#fff'; vine();
      c.lineWidth = 2; c.strokeStyle = OUTLINE; c.fillStyle = '#fff';
      [[35, 24, -0.6], [9, 19, 0.6]].forEach((l) => { c.beginPath(); c.ellipse(l[0], l[1], 7.5, 4.5, l[2], 0, 7); c.fill(); c.stroke(); });
    },
    tank(c) {
      c.fillStyle = '#fff';
      c.beginPath(); c.ellipse(22, 25, 11.5, 9.5, 0, 0, 7); c.fill(); c.stroke();
      [[9, 15], [17, 9], [27, 9], [35, 15]].forEach((p) => { c.beginPath(); c.arc(p[0], p[1], 4.5, 0, 7); c.fill(); c.stroke(); });
      [[12, 38, 18, 41], [32, 38, 26, 41]].forEach((l) => {
        c.lineWidth = 6; c.strokeStyle = OUTLINE; c.beginPath(); c.moveTo(l[0], l[1]); c.lineTo(l[2], l[3]); c.stroke();
        c.lineWidth = 3; c.strokeStyle = '#fff'; c.stroke();
      });
    },
    pierceShooter(c) {
      poly(c, [[19, 3], [7, 22], [19, 41]]); c.fillStyle = '#fff'; c.fill();
      poly(c, [[19, 3], [31, 22], [19, 41]]); c.fillStyle = '#B3E5FC'; c.fill();
      poly(c, [[19, 3], [31, 22], [19, 41], [7, 22]]); c.stroke();
      c.beginPath(); c.moveTo(19, 3); c.lineTo(19, 41); c.stroke();
      poly(c, [[37, 3], [38.8, 8.2], [44, 10], [38.8, 11.8], [37, 17], [35.2, 11.8], [30, 10], [35.2, 8.2]]);
      c.fillStyle = '#fff'; c.lineWidth = 1.5; c.fill(); c.stroke();
    },
  };

  // 按鈕與卡片共用的底：漸層、外框、上方亮面、下方厚度、內側細線
  // down＝按下去的樣子：整塊往下 4、顏色暗一階、底部厚度變薄（docs/beautify-top5-v1.md 第 1 項）
  function drawPanelBase(c, w, h, top, bottom, down) {
    if (down) { c.translate(0, 4); h -= 4; }
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
    c.fillStyle = 'rgba(30,20,10,0.16)'; c.fillRect(0, h - (down ? 5 : 11), w, down ? 5 : 11);
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
    add('hexP', 20, 20, (c) => {
      c.fillStyle = '#fff';
      poly(c, [0, 1, 2, 3, 4, 5].map((i) => [10 + Math.cos(i * Math.PI / 3) * 9, 10 + Math.sin(i * Math.PI / 3) * 9]));
      c.fill();
    });
    add('zee', 28, 32, (c) => {
      c.strokeStyle = '#fff'; c.lineWidth = 5; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(5, 6); c.lineTo(23, 6); c.lineTo(5, 26); c.lineTo(23, 26); c.stroke();
    });
    add('plus', 24, 24, (c) => { c.fillStyle = '#fff'; c.fillRect(9, 3, 6, 18); c.fillRect(3, 9, 18, 6); });
    // 常駐技能圖示（docs/skill-icons-v1.md）：亮底、暗底、鎖住底，加上一張白色圖案
    const BAR = cfg.layout.skillBar.size;
    const BF = BAR + 4;
    Object.keys(cfg.skills).forEach((k) => {
      const [c0, c1] = cfg.skills[k].bar;
      add('skillBase_' + k, BF, BF, (c) => drawSkillBase(c, BF, c0, c1, '#ffffff', false));
      add('skillDim_' + k, BF, BF, (c) => drawSkillBase(c, BF, desaturate(c0), desaturate(c1), '#a4acb5', true));
      add('skillArt_' + k, 44, 44, (c) => { c.strokeStyle = OUTLINE; c.lineWidth = 2; c.lineJoin = 'round'; c.lineCap = 'round'; skillArt[k](c); });
    });
    add('skillLocked', BF, BF, (c) => drawSkillBase(c, BF, '#9aa5b0', '#5f6a75', '#c9ced6', false));
    add('iconBurn', 20, 20, (c) => { c.strokeStyle = OUTLINE; c.lineWidth = 1.5; c.translate(0, 10); icons.flame(c, 10, 8, '#ff9a3c'); });
    add('iconSlow', 20, 20, (c) => { c.strokeStyle = OUTLINE; c.lineWidth = 1.5; c.translate(0, 10); icons.drop(c, 10, 8, '#6cc7ff'); });
    add('shield', 26, 30, (c) => { c.strokeStyle = OUTLINE; c.lineWidth = 2; c.translate(0, 15); icons.shield(c, 13, 13, '#7fd0ff'); });
    add('shieldUsed', 26, 30, (c) => { c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 2; c.translate(0, 15); icons.shield(c, 13, 13, 'rgba(255,255,255,0.14)'); });

    // 每顆按鈕都有一般與按下兩張（name、name + 'Down'），按下的顏色暗一階
    const btnFrame = (name, w, h, top, bottom, downTop, downBottom) => {
      add(name, w, h, (c) => drawPanelBase(c, w, h, top, bottom));
      add(name + 'Down', w, h, (c) => drawPanelBase(c, w, h, downTop || shade(top), downBottom || shade(bottom), true));
    };
    // 每位角色一張底卡：上方是角色主色的頭像窗，下方是放名字的白色名牌
    Object.keys(cfg.units).forEach((k) => {
      const d = cfg.units[k];
      const CW = cfg.layout.cards.w;
      add('card_' + k, CW, 120, (c) => {
        drawPanelBase(c, CW, 120, '#fdf6e0', '#e6d6ae');
        rr(c, 9, 8, CW - 18, 82, 12);
        const g = c.createLinearGradient(0, 8, 0, 90);
        g.addColorStop(0, hex(d.light)); g.addColorStop(1, hex(d.color));
        c.save(); c.globalAlpha = 0.7; c.fillStyle = g; c.fill(); c.restore();
        c.lineWidth = 1.5; c.strokeStyle = 'rgba(31,42,56,0.35)'; c.stroke();
        rr(c, 9, 91, CW - 18, 23, 8);
        c.fillStyle = 'rgba(255,255,255,0.75)'; c.fill();
      });
    });
    btnFrame('btnSquare', cfg.layout.muteBtn.w, cfg.layout.muteBtn.h, '#5a7a9a', '#3c566f');
    btnFrame('btnBig', 260, 130, '#ffcf5a', '#f09a2e', '#e0a63a', '#c97a20');
    btnFrame('btnWide', 300, 92, '#ffcf5a', '#f09a2e', '#e0a63a', '#c97a20');
    btnFrame('cardLocked', cfg.layout.cards.w, 120, '#8d97a3', '#6a7480');
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
    // 卡片可買時的亮邊、買不起時蓋在名牌上的灰底（都是白色，遊戲中再上色）
    add('cardEdge', cfg.layout.cards.w, 120, (c) => {
      c.strokeStyle = '#fff'; c.lineWidth = 5; rr(c, 3.5, 3.5, cfg.layout.cards.w - 7, 113, 18); c.stroke();
    });
    add('cardPlate', cfg.layout.cards.w - 18, 23, (c) => { c.fillStyle = '#fff'; rr(c, 0, 0, cfg.layout.cards.w - 18, 23, 8); c.fill(); });
    add('cardGlow', 148, 132, (c) => {
      c.strokeStyle = '#fff'; c.lineWidth = 7; rr(c, 6, 6, 136, 120, 20); c.stroke();
    });

    add('iconPause', 36, 36, (c) => { c.fillStyle = '#fff'; c.fillRect(8, 4, 8, 28); c.fillRect(21, 4, 8, 28); });
    const speaker = (c) => { c.fillStyle = '#fff'; poly(c, [[3, 13], [10, 13], [19, 5], [19, 31], [10, 23], [3, 23]]); c.fill(); };
    add('iconSound', 36, 36, (c) => {
      speaker(c); c.strokeStyle = '#fff'; c.lineWidth = 3;
      c.beginPath(); c.arc(21, 18, 10, -0.8, 0.8); c.stroke();
    });
    add('iconSoundLow', 36, 36, (c) => {
      speaker(c); c.strokeStyle = '#fff'; c.lineWidth = 3;
      c.beginPath(); c.arc(19, 18, 6, -0.8, 0.8); c.stroke();
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
      const art = scene.textures.exists('art_' + k) ? cropArt(scene.textures.get('art_' + k).getSourceImage(), d.artBox) : null;
      add('unit_' + k, d.size.w, d.size.h, (c) => (
        art ? drawArt(c, d.size.w, d.size.h, art) : drawUnit(c, d.size.w, d.size.h, d)
      ));
      // 本機待機動畫：每一格都畫進大圖，播放時只換格，不用額外的繪圖切換
      if (d.idleSheet && scene.textures.exists('idle_' + k)) {
        const sheet = scene.textures.get('idle_' + k).getSourceImage();
        const n = d.idleSheet.frames;
        const fw = Math.floor(sheet.width / n);
        for (let i = 0; i < n; i++) {
          add('unit_' + k + '_idle' + i, d.size.w, d.size.h, (c) => {
            const one = document.createElement('canvas');
            one.width = fw;
            one.height = sheet.height;
            one.getContext('2d').drawImage(sheet, i * fw, 0, fw, sheet.height, 0, 0, fw, sheet.height);
            drawArt(c, d.size.w, d.size.h, one);
          });
        }
      }
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
      // 頭目的專屬貼圖：整隻取進來（box 已含整隻），腳底對齊下緣；圖上已有帽子、斗篷和鼓，不再加程式配件
      if (d.ownArt) {
        const own = cropArt(scene.textures.get('art_' + d.art.file).getSourceImage(), d.art.box);
        add('enemy_' + k, d.size.w, d.size.h, (c) => {
          if (d.art.recolor) drawRecolored(c, d.size.w, d.size.h, own, d.art, true);
          else drawArt(c, d.size.w, d.size.h, own);
        });
        return;
      }
      const key = 'art_' + (d.artFrom || k);
      const art = scene.textures.exists(key) ? scene.textures.get(key).getSourceImage() : null;
      add('enemy_' + k, d.size.w, d.size.h, (c) => {
        const acc = accessories[d.accessory];
        const box = d.bodyBox || { x: 0, y: 0, w: d.size.w, h: d.size.h };
        if (acc && acc.back) acc.back(c, d.size.w, d.size.h);
        c.save();
        c.translate(box.x, box.y);
        if (!art) drawEnemy(c, box.w, box.h, d);
        else if (d.artFrom) drawRecolored(c, box.w, box.h, art, d);
        else drawArt(c, box.w, box.h, art);
        c.restore();
        if (acc && acc.front) acc.front(c, d.size.w, d.size.h);
      });
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
