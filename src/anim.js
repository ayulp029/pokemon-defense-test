// 我方與敵人的動作（蓄力、出手、後座、受擊、待機呼吸，敵人多一個走路）。
// 只算外觀：不讀寫戰鬥數值，色塊和貼圖都用同一套（動的是 body 這張圖）。
// 每格畫面只改寫固定的物件，不新建東西，也不用 Phaser tween，避免 iPad 上頓一下。
window.PD = window.PD || {};

PD.Anim = (function () {
  // 姿勢都是「和站好時的差值」：sx／sy 伸縮、r 傾斜（正值往前）、x／y 位移（x 正值往前）
  const pose = (sx, sy, r, x, y) => ({ sx, sy, r, x, y });

  const DEFAULT_HURT = { dur: 0.2, kick: -3, jitter: 0, tilt: 0, squash: 0.05 };
  const ENEMY_HURT = { dur: 0.22, kick: -4, jitter: 1.2, tilt: 0.03, squash: 0.06 };

  const styles = {
    // 小勇：不攻擊，產球時蹲一下再開心跳起來
    trainer: {
      idle: { speed: 2.2, amp: 0.025, sway: 0.02 },
      windup: 0.3, charge: pose(0.07, -0.09, -0.03, 0, 0),
      snap: 0.1, dur: 0.46, strike: pose(-0.05, 0.1, -0.05, 0, -16),
      hurt: DEFAULT_HURT,
    },
    // 基本遠攻：短促抖動蓄力，急速前衝，彈回來很快
    basicShooter: {
      idle: { speed: 3.4, amp: 0.028, sway: 0.012 },
      windup: 0.24, charge: pose(0.08, -0.1, -0.1, -3, 0), vib: 1.2,
      snap: 0.05, dur: 0.26, strike: pose(-0.08, 0.1, 0.16, 8, 0),
      recoil: pose(0.03, -0.03, -0.05, -3, 0),
      hurt: DEFAULT_HURT,
    },
    // 雙擊近戰：後拉，往前揮一下，再反手揮第二下（兩下要看得出來）
    doubleStriker: {
      idle: { speed: 2.4, amp: 0.03, sway: 0.02 },
      windup: 0.22, charge: pose(0.05, -0.08, -0.2, -5, 0),
      snap: 0.06, dur: 0.5, strike: pose(0.08, -0.03, 0.24, 14, 0),
      strike2: pose(-0.06, 0.08, -0.12, 18, 0), dur2: 0.38,
      hurt: DEFAULT_HURT,
    },
    // 大睡熊：不攻擊；慢而深的呼吸，被打時穩穩抖一下
    tank: {
      idle: { speed: 1.3, amp: 0.04, sway: 0.008 },
      hurt: { dur: 0.34, kick: -6, jitter: 2.6, tilt: 0.05, squash: 0.1 },
    },
    // 緩速遠攻：後仰吸氣，往前噴，噴完被反作用力往後推
    slowShooter: {
      idle: { speed: 2.0, amp: 0.03, sway: 0.016 },
      windup: 0.36, charge: pose(-0.06, 0.1, -0.16, -4, -2),
      snap: 0.07, dur: 0.44, strike: pose(0.12, -0.1, 0.2, 6, 0),
      recoil: pose(0, 0, -0.1, -10, 0),
      hurt: DEFAULT_HURT,
    },
    // 燃燒遠攻：壓低身體蓄力，整隻往前撲
    burnShooter: {
      idle: { speed: 2.8, amp: 0.026, sway: 0.014 },
      windup: 0.34, charge: pose(0.14, -0.18, 0.08, -6, 0),
      snap: 0.06, dur: 0.38, strike: pose(-0.1, 0.16, 0.22, 14, 0),
      recoil: pose(0.05, -0.05, -0.05, -6, 0),
      hurt: DEFAULT_HURT,
    },

    // 穿透遠攻：飄起來再送出波紋
    pierceShooter: {
      idle: { speed: 2.0, amp: 0.03, sway: 0.02 },
      windup: 0.34, charge: pose(-0.05, 0.08, -0.06, -2, -6),
      snap: 0.08, dur: 0.42, strike: pose(0.1, -0.06, 0.12, 6, 0),
      hurt: DEFAULT_HURT,
    },

    // ===== 敵人：facing -1 代表面朝左，「往前」會自動換成往左 =====
    // walk 的欄位：speed 步伐快慢、hop 跳多高、hopPow 跳的手感（小於 1 彈、大於 1 貼地）、
    // stretch／squash 騰空拉長與落地壓扁、tilt 左右傾、sway 左右位移、twist 身體扭動、lean 前傾、dust 塵土大小
    // 基本敵人：穩定的一步一步走，後仰蓄力再往前撲
    scout: {
      facing: -1, idle: { speed: 2.4, amp: 0.025, sway: 0.01 },
      walk: { speed: 7, hop: 4, hopPow: 1, stretch: 0.02, squash: 0.05, tilt: 0.04, sway: 1, twist: 0, lean: 0, dust: 1 },
      windup: 0.42, charge: pose(0.06, -0.09, -0.22, -8, 0),
      snap: 0.07, dur: 0.44, strike: pose(-0.06, 0.08, 0.26, 16, -3),
      hurt: ENEMY_HURT,
    },
    // 生命較高的敵人：貼地蛇形，身體左右扭動；攻擊時身體伸長
    tough: {
      facing: -1, idle: { speed: 2.0, amp: 0.03, sway: 0.016 },
      walk: { speed: 5, hop: 0.8, hopPow: 1, stretch: 0, squash: 0, tilt: 0.1, sway: 7, twist: 0.05, lean: 0, dust: 0.7 },
      windup: 0.46, charge: pose(0.1, -0.14, -0.24, -9, 0),
      snap: 0.07, dur: 0.46, strike: pose(0.16, -0.1, 0.24, 18, 0),
      hurt: ENEMY_HURT,
    },
    // 走得快的敵人：快步又帶跳躍感，身體前傾；攻擊短促
    runner: {
      facing: -1, idle: { speed: 3.2, amp: 0.028, sway: 0.012 },
      walk: { speed: 13, hop: 9, hopPow: 0.7, stretch: 0.08, squash: 0.12, tilt: 0.04, sway: 0, twist: 0, lean: 0.09, dust: 0.8 },
      windup: 0.3, charge: pose(0.12, -0.15, -0.16, -6, 0),
      snap: 0.05, dur: 0.34, strike: pose(-0.1, 0.12, 0.24, 18, -8),
      hurt: ENEMY_HURT,
    },
    // 高生命敵人：走得又慢又重，左右搖晃，落地時壓一下
    // 鐵甲熊兵：比厚殼機器人更沉，一步一頓
    bruiser: {
      facing: -1, idle: { speed: 1.2, amp: 0.03, sway: 0.006 },
      walk: { speed: 3, hop: 1.5, hopPow: 2, stretch: 0, squash: 0.1, tilt: 0.08, sway: 2.5, twist: 0, lean: 0, dust: 1.6 },
      windup: 0.6, charge: pose(0.06, -0.08, -0.18, -9, 0),
      snap: 0.1, dur: 0.6, strike: pose(-0.04, 0.06, 0.2, 16, 0),
      hurt: { dur: 0.3, kick: -3, jitter: 2, tilt: 0.04, squash: 0.08 },
    },
    // 補補蛙：輕快地小跳
    healer: {
      facing: -1, idle: { speed: 2.6, amp: 0.03, sway: 0.016 },
      walk: { speed: 6, hop: 7, hopPow: 0.8, stretch: 0.06, squash: 0.1, tilt: 0.03, sway: 0, twist: 0, lean: 0, dust: 0.7 },
      windup: 0.4, charge: pose(0.06, -0.1, -0.16, -6, 0),
      snap: 0.07, dur: 0.42, strike: pose(-0.06, 0.08, 0.2, 12, -3),
      hurt: ENEMY_HURT,
    },
    // 彈跳蜥：低身快走
    jumper: {
      facing: -1, idle: { speed: 3, amp: 0.028, sway: 0.012 },
      walk: { speed: 11, hop: 5, hopPow: 0.8, stretch: 0.06, squash: 0.1, tilt: 0.05, sway: 0, twist: 0, lean: 0.07, dust: 0.8 },
      windup: 0.34, charge: pose(0.14, -0.16, -0.14, -6, 0),
      snap: 0.06, dur: 0.38, strike: pose(-0.08, 0.12, 0.22, 16, -5),
      hurt: ENEMY_HURT,
    },
    // 雙胞搗蛋：大步走
    splitter: {
      facing: -1, idle: { speed: 2.4, amp: 0.025, sway: 0.012 },
      walk: { speed: 7, hop: 4, hopPow: 1, stretch: 0.03, squash: 0.06, tilt: 0.05, sway: 1, twist: 0, lean: 0, dust: 1 },
      windup: 0.42, charge: pose(0.06, -0.09, -0.2, -7, 0),
      snap: 0.07, dur: 0.44, strike: pose(-0.06, 0.08, 0.24, 14, -3),
      hurt: ENEMY_HURT,
    },
    // 小搗蛋：跑得碎步
    splitling: {
      facing: -1, idle: { speed: 3.6, amp: 0.03, sway: 0.014 },
      walk: { speed: 14, hop: 5, hopPow: 0.8, stretch: 0.06, squash: 0.1, tilt: 0.05, sway: 0, twist: 0, lean: 0.05, dust: 0.5 },
      windup: 0.3, charge: pose(0.1, -0.14, -0.14, -4, 0),
      snap: 0.05, dur: 0.32, strike: pose(-0.08, 0.1, 0.2, 10, -4),
      hurt: ENEMY_HURT,
    },
    // 飄飄翼：在空中輕輕上下飄，不揚起塵土
    flyer: {
      facing: -1, idle: { speed: 3, amp: 0.04, sway: 0.02 },
      walk: { speed: 6, hop: 6, hopPow: 0.6, stretch: 0.06, squash: 0.04, tilt: 0.06, sway: 2, twist: 0, lean: 0.05, dust: 0 },
      windup: 0.3, charge: pose(0.06, -0.08, -0.12, -4, 0),
      snap: 0.06, dur: 0.36, strike: pose(-0.06, 0.08, 0.18, 10, -3),
      hurt: ENEMY_HURT,
    },
    // 丟丟猴：蹦蹦跳跳
    lobber: {
      facing: -1, idle: { speed: 2.8, amp: 0.03, sway: 0.014 },
      walk: { speed: 8, hop: 6, hopPow: 0.8, stretch: 0.05, squash: 0.09, tilt: 0.05, sway: 0, twist: 0, lean: 0.03, dust: 0.8 },
      windup: 0.4, charge: pose(0.06, -0.1, -0.2, -6, 0),
      snap: 0.07, dur: 0.42, strike: pose(-0.06, 0.08, 0.22, 12, -3),
      hurt: ENEMY_HURT,
    },
    // 躲躲影：輕飄飄地滑步
    phantom: {
      facing: -1, idle: { speed: 1.8, amp: 0.035, sway: 0.02 },
      walk: { speed: 5, hop: 2, hopPow: 1, stretch: 0.03, squash: 0.03, tilt: 0.08, sway: 4, twist: 0.04, lean: 0.02, dust: 0.3 },
      windup: 0.42, charge: pose(0.06, -0.1, -0.2, -7, 0),
      snap: 0.07, dur: 0.44, strike: pose(-0.06, 0.08, 0.22, 14, -3),
      hurt: ENEMY_HURT,
    },
    // 鐵鎚隊長、搗蛋大王：大步重踏
    boss: {
      facing: -1, idle: { speed: 1.1, amp: 0.03, sway: 0.006 },
      walk: { speed: 2.4, hop: 2, hopPow: 2, stretch: 0, squash: 0.1, tilt: 0.06, sway: 2, twist: 0, lean: 0, dust: 2 },
      windup: 0.7, charge: pose(0.06, -0.08, -0.16, -10, 0),
      snap: 0.1, dur: 0.6, strike: pose(-0.04, 0.06, 0.18, 18, 0),
      hurt: { dur: 0.25, kick: -2, jitter: 1.5, tilt: 0.03, squash: 0.06 },
    },
    armored: {
      facing: -1, idle: { speed: 1.4, amp: 0.03, sway: 0.006 },
      walk: { speed: 3.2, hop: 1.5, hopPow: 2, stretch: 0, squash: 0.09, tilt: 0.07, sway: 2, twist: 0, lean: 0, dust: 1.5 },
      windup: 0.55, charge: pose(0.05, -0.08, -0.16, -8, 0),
      snap: 0.1, dur: 0.56, strike: pose(-0.04, 0.06, 0.18, 14, 0),
      hurt: { dur: 0.3, kick: -3, jitter: 2, tilt: 0.04, squash: 0.08 },
    },
  };

  // 放技能時的整段動作：[秒, sx, sy, y]（差值），中間線性補間
  const SKILL_KEYS = {
    trainer: [[0, 0, 0, 0], [0.1, -0.05, 0.1, 0], [0.2, 0, 0, 0]],
    basicShooter: [[0, 0, 0, 0], [0.08, 0.1, -0.1, 0], [0.2, 0, 0, 0]],
    burnShooter: [[0, 0, 0, 0], [0.1, 0.14, -0.12, 0], [0.32, 0, 0, 0]],
    slowShooter: [[0, 0, 0, 0], [0.12, -0.1, -0.1, 0], [0.3, 0.06, 0.06, 0], [0.42, 0, 0, 0]],
    doubleStriker: [[0, 0, 0, 0], [0.14, 0.08, -0.15, 0], [0.3, -0.05, 0.1, -22], [0.46, 0, 0, 0]],
    tank: [[0, 0, 0, 0], [0.25, 0.15, 0.15, -20], [0.38, 0.15, -0.2, 0], [0.62, 0, 0, 0]],
    pierceShooter: [[0, 0, 0, 0], [0.4, 0.04, 0.04, -15], [0.56, 0, 0, 0]],
  };

  // 被擋住時的煞車：身體往前晃一下再站穩
  const BRAKE = { dur: 0.26, tilt: 0.1, squash: 0.08, x: 3 };

  // 下面兩個是共用的輸出物件，呼叫端要馬上讀走
  const out = pose(0, 0, 0, 0, 0);
  const muzzlePoint = { x: 0, y: 0 };

  const copy = (to, from) => {
    to.sx = from.sx; to.sy = from.sy; to.r = from.r; to.x = from.x; to.y = from.y;
  };

  styles.finalBoss = styles.boss;

  return {
    styleOf(kind) { return styles[kind] || styles.basicShooter; },

    // 只在角色池新建 view 時呼叫一次
    newSlots() { return { from: pose(0, 0, 0, 0, 0), cur: pose(0, 0, 0, 0, 0) }; },

    // 開始出手，回傳這一下的姿勢。從目前的姿勢接過去，第二下才會接得順。
    release(v, st, second) {
      copy(v.from, v.cur);
      v.charge = 0;
      v.relT = 0;
      v.relStrike = second && st.strike2 ? st.strike2 : st.strike;
      v.relDur = second && st.dur2 ? st.dur2 : st.dur;
      return v.relStrike;
    },

    hurt(v, st) { v.hurtT = st.hurt.dur; },

    skill(v, kind) { v.skillKeys = SKILL_KEYS[kind] || null; v.skillT = 0; },

    brake(v) { v.stopT = BRAKE.dur; },

    // 彈道的起點：沿用原本的手部位置，再算上出手姿勢的傾斜與位移
    muzzle(v, strike) {
      const fx = v.w * 0.4;
      const fy = -v.h * 0.55;
      const c = Math.cos(strike.r);
      const s = Math.sin(strike.r);
      muzzlePoint.x = v.c.x + strike.x + fx * c - fy * s;
      muzzlePoint.y = v.c.y + strike.y + fx * s + fy * c;
      return muzzlePoint;
    },

    // 算出這一格畫面的姿勢；chargeTarget 是蓄力進度 0～1，speed 是測試用的時間倍率
    compute(v, st, chargeTarget, dt, clock, speed, reduced) {
      const P = out;
      P.sx = 0; P.sy = 0; P.r = 0; P.x = 0; P.y = 0;

      if (v.relT >= 0) {
        v.relT += dt * speed * v.actRate;
        const t = v.relT;
        const S = v.relStrike;
        if (t >= v.relDur) {
          v.relT = -1;
        } else if (t < st.snap) {
          const e = t / st.snap;
          const q = 1 - (1 - e) * (1 - e);
          const F = v.from;
          P.sx = F.sx + (S.sx - F.sx) * q;
          P.sy = F.sy + (S.sy - F.sy) * q;
          P.r = F.r + (S.r - F.r) * q;
          P.x = F.x + (S.x - F.x) * q;
          P.y = F.y + (S.y - F.y) * q;
        } else {
          const e = (t - st.snap) / (v.relDur - st.snap);
          const a = (1 - e) * (1 - e);
          P.sx = S.sx * a; P.sy = S.sy * a; P.r = S.r * a; P.x = S.x * a; P.y = S.y * a;
          if (st.recoil) {
            const R = st.recoil;
            const b = Math.sin(e * Math.PI);
            P.sx += R.sx * b; P.sy += R.sy * b; P.r += R.r * b; P.x += R.x * b; P.y += R.y * b;
          }
        }
      } else if (st.charge) {
        // 蓄力跟著規則時間走；目標突然不見時才慢慢放鬆，不會瞬間彈回
        v.charge = chargeTarget >= v.charge ? chargeTarget : Math.max(chargeTarget, v.charge - dt * 6);
        if (v.charge > 0) {
          const k = v.charge * v.charge * (3 - 2 * v.charge);
          const C = st.charge;
          P.sx = C.sx * k; P.sy = C.sy * k; P.r = C.r * k; P.x = C.x * k; P.y = C.y * k;
          if (st.vib && !reduced) P.x += Math.sin(clock * 80) * st.vib * k;
        }
      }
      copy(v.cur, P);

      if (v.hurtT > 0) {
        v.hurtT -= dt;
        const H = st.hurt;
        const k = Math.max(0, v.hurtT / H.dur);
        P.x += H.kick * k;
        if (!reduced) {
          P.x += Math.sin(clock * 62) * H.jitter * k;
          P.r += Math.sin(clock * 38) * H.tilt * k;
        }
        P.sx += H.squash * k;
        P.sy -= H.squash * k;
      }

      // 待機呼吸：吸氣變高時身體略窄，看起來像真的在呼吸，不是單純放大
      // 用累積的相位而不是時鐘，變慢時動作才會接續放慢，不會跳格
      // 有逐格待機圖的角色，呼吸已經畫在圖裡，這裡就不再疊一次
      if (!v.idleFrames) {
        v.breath += dt * st.idle.speed * v.actRate;
        const t = v.breath + v.seed;
        const breath = Math.sin(t) * st.idle.amp;
        P.sy += breath;
        P.sx -= breath * 0.6;
        P.r += Math.sin(t * 0.5) * st.idle.sway;
      }

      if (st.walk) {
        const W = st.walk;
        v.walkBlend = v.walking ? Math.min(1, v.walkBlend + dt * 8) : Math.max(0, v.walkBlend - dt * 8);
        if (v.walking) {
          v.walkPhase += dt * speed * W.speed * v.walkRate;
          const step = Math.floor(v.walkPhase / Math.PI);
          if (step !== v.walkStep) { v.walkStep = step; v.stepped = true; }
        }
        const b = v.walkBlend;
        if (b > 0) {
          const s = Math.sin(v.walkPhase);
          const lift = Math.abs(s);
          const ground = (1 - lift) * (1 - lift) * (1 - lift);
          const stretch = W.stretch * lift - W.squash * ground;
          P.y -= Math.pow(lift, W.hopPow) * W.hop * b;
          P.sy += stretch * b;
          P.sx += (-stretch * 0.7 + Math.sin(v.walkPhase * 2) * W.twist) * b;
          P.r += (s * W.tilt + W.lean) * b;
          P.x += Math.cos(v.walkPhase) * W.sway * b;
        }
      }
      if (v.skillKeys && v.skillT >= 0) {
        v.skillT += dt;
        const K = v.skillKeys;
        const end = K[K.length - 1][0];
        if (v.skillT >= end) {
          v.skillT = -1;
        } else {
          for (let i = 1; i < K.length; i++) {
            if (v.skillT > K[i][0]) continue;
            const a = K[i - 1];
            const b = K[i];
            const e = (v.skillT - a[0]) / (b[0] - a[0]);
            P.sx += a[1] + (b[1] - a[1]) * e;
            P.sy += a[2] + (b[2] - a[2]) * e;
            P.y += a[3] + (b[3] - a[3]) * e;
            break;
          }
        }
      }
      if (v.stopT > 0) {
        v.stopT -= dt;
        const k = Math.max(0, v.stopT / BRAKE.dur);
        const swing = Math.sin(k * Math.PI);
        P.r += swing * BRAKE.tilt;
        P.x += swing * BRAKE.x;
        P.sx += BRAKE.squash * k;
        P.sy -= BRAKE.squash * k;
      }
      if (st.facing === -1) { P.x = -P.x; P.r = -P.r; }
      return P;
    },
  };
})();
