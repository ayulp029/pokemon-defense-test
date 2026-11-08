// 我方角色的動作（蓄力、出手、後座、受擊、待機呼吸）。
// 只算外觀：不讀寫戰鬥數值，色塊和貼圖都用同一套（動的是 body 這張圖）。
// 每格畫面只改寫固定的物件，不新建東西，也不用 Phaser tween，避免 iPad 上頓一下。
window.PD = window.PD || {};

PD.Anim = (function () {
  // 姿勢都是「和站好時的差值」：sx／sy 伸縮、r 傾斜（正值往前）、x／y 位移（x 正值往前）
  const pose = (sx, sy, r, x, y) => ({ sx, sy, r, x, y });

  const DEFAULT_HURT = { dur: 0.2, kick: -3, jitter: 0, tilt: 0, squash: 0.05 };

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
  };

  // 下面兩個是共用的輸出物件，呼叫端要馬上讀走
  const out = pose(0, 0, 0, 0, 0);
  const muzzlePoint = { x: 0, y: 0 };

  const copy = (to, from) => {
    to.sx = from.sx; to.sy = from.sy; to.r = from.r; to.x = from.x; to.y = from.y;
  };

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
        v.relT += dt * speed;
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
      const t = clock * st.idle.speed + v.seed;
      const breath = Math.sin(t) * st.idle.amp;
      P.sy += breath;
      P.sx -= breath * 0.6;
      P.r += Math.sin(t * 0.5) * st.idle.sway;
      return P;
    },
  };
})();
