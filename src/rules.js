// 戰鬥規則：只算數字，不碰畫面，也不用隨機數。
// 時間以固定的「格」（tick）計算，順序依 plan-v2 第 4.2 節。
window.PD = window.PD || {};

PD.BattleSim = class BattleSim {
  constructor(config, levelIndex, modeId) {
    this.cfg = config;
    this.rules = config.rules;
    this.level = config.levels[levelIndex];
    this.mode = config.modes[modeId];
    // 關卡專屬的數值調整（沒寫的項目沿用共通設定），不改動共通的角色與敵人表
    this.tune = this.level.tune || {};
    this.enemyDefs = {};
    Object.keys(config.enemies).forEach((k) => {
      this.enemyDefs[k] = Object.assign({}, config.enemies[k], (this.tune.enemies || {})[k]);
    });
    this.tps = Math.round(1 / this.rules.tickSeconds);
    this.events = [];
    this.commands = [];
    this.snapshot = null;
    this.state = this.freshState();
  }

  ticks(seconds) { return Math.round(seconds * this.tps); }

  genSeconds(def) { return this.tune.genEvery || def.genEvery; }

  freshState() {
    return {
      phase: 'prep', tick: 0, balls: this.tune.startBalls || this.rules.startBalls, nextId: 1,
      nextSpawn: 0, lastSnapWave: 0, rescues: 0, placeCd: 0,
      waitingHint: false, skySeq: 0, units: [], enemies: [], orbs: [],
    };
  }

  restart() {
    this.state = this.freshState();
    this.snapshot = null;
    this.commands.length = 0;
    this.events.push({ type: 'restored' });
  }

  retryWave() {
    if (!this.snapshot) { this.restart(); return; }
    this.state = JSON.parse(this.snapshot);
    this.commands.length = 0;
    this.events.push({ type: 'restored' });
  }

  command(cmd) { this.commands.push(cmd); }

  isUnlocked(kind) {
    return this.cfg.debug.unlockAll || this.cfg.units[kind].unlock <= this.level.number;
  }

  isLaneOpen(lane) { return this.level.openLanes.indexOf(lane) !== -1; }

  unitAt(lane, col) {
    const list = this.state.units;
    for (let i = 0; i < list.length; i++) {
      if (list[i].lane === lane && list[i].col === col) return list[i];
    }
    return null;
  }

  countUnits(kind) {
    let n = 0;
    const list = this.state.units;
    for (let i = 0; i < list.length; i++) if (list[i].kind === kind) n++;
    return n;
  }

  // 回傳放不下的原因；可以放則回傳 null
  placeProblem(kind, lane, col) {
    const s = this.state;
    const def = this.cfg.units[kind];
    if (s.phase !== 'prep' && s.phase !== 'battle') return 'phase';
    if (!this.isUnlocked(kind)) return 'locked';
    if (!this.isLaneOpen(lane)) return 'rest';
    if (col < 1 || col > this.cfg.layout.grid.cols) return 'outside';
    if (this.unitAt(lane, col)) return 'occupied';
    if (s.placeCd > 0) return 'cooldown';
    if (s.balls < def.cost) return 'orbs';
    if (def.maxCount && this.countUnits(kind) >= def.maxCount) return 'limit';
    return null;
  }

  // ===== 推進一格時間 =====
  step() {
    const s = this.state;
    if (s.phase === 'battle' && !s.waitingHint && this.runBattleTick()) return;
    this.applyCommands();
    if (s.placeCd > 0) s.placeCd--;
  }

  // 回傳 true 表示本格停在波次提示，不再往下做
  runBattleTick() {
    const s = this.state;
    const now = s.tick + 1;
    const next = this.level.script[s.nextSpawn];
    if (next && this.ticks(next.t) === now && next.wave > s.lastSnapWave) {
      // 波次第一隻出現「之前」存下完整狀態
      this.snapshot = JSON.stringify(s);
      s.lastSnapWave = next.wave;
      this.events.push({ type: 'wave', wave: next.wave, lane: next.lane });
      if (this.mode.autoWaveHint) { s.waitingHint = true; return true; }
    }
    s.tick = now;
    this.moveEnemies();
    this.spawnEnemies(now);
    this.unitAttacks(now);
    this.burnTicks(now);
    this.removeDefeated();
    this.retarget(now);
    this.enemyContact();
    this.enemyVillage();
    this.economy(now);
    this.checkWin();
    return false;
  }

  moveEnemies() {
    const s = this.state;
    const dt = this.rules.tickSeconds;
    for (let i = 0; i < s.enemies.length; i++) {
      const e = s.enemies[i];
      e.px = e.x;
      const def = this.enemyDefs[e.kind];
      let speed = (1 / def.secPerCell) * this.mode.speedMul;
      if (e.slowEnd > s.tick) speed *= e.slowFactor;
      const blocker = this.findBlocker(e);
      let nx = e.x - speed * dt;
      let blockedId = 0;
      if (blocker && nx <= blocker.col + 0.5 + 1e-9) {
        nx = blocker.col + 0.5;
        blockedId = blocker.id;
      }
      if (blockedId !== e.blockedId) { e.blockedId = blockedId; e.contact = 0; }
      e.x = nx;
    }
  }

  // 同路、敵人前方第一個角色才能擋
  findBlocker(e) {
    let best = null;
    const list = this.state.units;
    for (let i = 0; i < list.length; i++) {
      const u = list[i];
      if (u.lane !== e.lane || u.col + 0.5 > e.x + 1e-9) continue;
      if (!best || u.col > best.col) best = u;
    }
    return best;
  }

  spawnEnemies(now) {
    const s = this.state;
    const script = this.level.script;
    while (s.nextSpawn < script.length && this.ticks(script[s.nextSpawn].t) === now) {
      const ev = script[s.nextSpawn++];
      const def = this.enemyDefs[ev.kind];
      s.enemies.push({
        id: s.nextId++, kind: ev.kind, lane: ev.lane,
        x: this.rules.spawnX, px: this.rules.spawnX, hp: def.hp, maxHp: def.hp,
        blockedId: 0, contact: 0, burnNext: -1, burnEnd: -1, slowEnd: 0, slowFactor: 1,
      });
    }
  }

  inRange(u, def, e) {
    return e.hp > 0 && e.lane === u.lane &&
      e.x > u.col + 1e-9 && e.x <= u.col + def.range + 1e-9;
  }

  findEnemy(id) {
    const list = this.state.enemies;
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  // 同路範圍內 x 最小者，平手取編號小的（陣列本來就依出場順序）
  pickTarget(u, def) {
    let best = null;
    const list = this.state.enemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (this.inRange(u, def, e) && (!best || e.x < best.x - 1e-9)) best = e;
    }
    return best;
  }

  tryLock(u, def, now) {
    if (now < u.roundGate) return;
    const t = this.pickTarget(u, def);
    if (t) {
      u.targetId = t.id;
      u.fireTick = now + this.ticks(this.rules.lockWait);
    }
  }

  unitAttacks(now) {
    const list = this.state.units;
    for (let i = 0; i < list.length; i++) {
      const u = list[i];
      const def = this.cfg.units[u.kind];
      if (!def.range) continue;

      // 雙擊的第二下：只打同一隻，且要還在範圍內
      if (u.secondTick === now) {
        u.secondTick = -1;
        const t2 = this.findEnemy(u.secondTarget);
        if (t2 && this.inRange(u, def, t2)) this.strike(u, def, t2, now);
      }

      let target = u.targetId ? this.findEnemy(u.targetId) : null;
      if (target && !this.inRange(u, def, target)) target = null;
      if (!target) {
        u.targetId = 0;
        this.tryLock(u, def, now);
        continue;
      }
      if (now >= u.fireTick) {
        this.strike(u, def, target, now);
        u.fireTick = now + this.ticks(def.interval);
        if (def.secondHitDelay) {
          u.secondTick = now + this.ticks(def.secondHitDelay);
          u.secondTarget = target.id;
          u.roundGate = u.fireTick; // 換目標最早要等到下一輪
        }
      }
    }
  }

  strike(u, def, e, now) {
    e.hp -= def.damage;
    if (def.slow) {
      e.slowEnd = now + this.ticks(def.slow.seconds);
      e.slowFactor = def.slow.factor;
    }
    if (def.burn) {
      if (e.burnNext < 0) e.burnNext = now + this.tps;
      e.burnEnd = now + this.ticks(def.burn.seconds);
    }
    this.events.push({ type: 'shot', unitId: u.id, targetId: e.id, fx: def.fx });
  }

  burnTicks(now) {
    const list = this.state.enemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.hp <= 0 || e.burnNext < 0 || now < e.burnNext) continue;
      e.hp -= 1;
      e.burnNext += this.tps;
      if (e.burnNext > e.burnEnd) { e.burnNext = -1; e.burnEnd = -1; }
      this.events.push({ type: 'burn', targetId: e.id });
    }
  }

  removeDefeated() {
    const s = this.state;
    for (let i = s.enemies.length - 1; i >= 0; i--) {
      const e = s.enemies[i];
      if (e.hp > 0) continue;
      s.enemies.splice(i, 1);
      this.events.push({ type: 'enemyDown', id: e.id, kind: e.kind });
      this.addOrb(e.x, e.lane, 'enemy');
    }
  }

  retarget(now) {
    const list = this.state.units;
    for (let i = 0; i < list.length; i++) {
      const u = list[i];
      const def = this.cfg.units[u.kind];
      if (!def.range) continue;
      if (u.targetId && !this.findEnemy(u.targetId)) u.targetId = 0;
      if (!u.targetId) this.tryLock(u, def, now);
    }
  }

  findUnit(id) {
    const list = this.state.units;
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  enemyContact() {
    const s = this.state;
    const every = this.ticks(this.rules.enemyContactEvery);
    for (let i = 0; i < s.enemies.length; i++) {
      const e = s.enemies[i];
      if (!e.blockedId) continue;
      const u = this.findUnit(e.blockedId);
      if (!u) { e.blockedId = 0; e.contact = 0; continue; }
      e.contact++;
      if (e.contact >= every) {
        e.contact = 0;
        u.hp -= this.rules.enemyContactDamage;
        this.events.push({ type: 'unitHit', id: u.id });
      }
    }
    for (let i = s.units.length - 1; i >= 0; i--) {
      if (s.units[i].hp <= 0) {
        this.events.push({ type: 'unitGone', id: s.units[i].id });
        s.units.splice(i, 1);
      }
    }
  }

  enemyVillage() {
    const s = this.state;
    for (let i = s.enemies.length - 1; i >= 0; i--) {
      const e = s.enemies[i];
      if (e.x > this.rules.villageX + 1e-9) continue;
      s.enemies.splice(i, 1);
      s.rescues++;
      this.events.push({ type: 'enemyHome', id: e.id });
      if (s.rescues > this.mode.rescues) {
        s.phase = 'failed';
        this.events.push({ type: 'failed' });
        return;
      }
    }
  }

  addOrb(x, lane, source) {
    const s = this.state;
    // age 從 -1 起算：同一格稍後加 1 變成 0，才會剛好 6 秒自動入帳
    const orb = { id: s.nextId++, x, lane, age: -1, source };
    s.orbs.push(orb);
    this.events.push({ type: 'orbSpawn', id: orb.id });
  }

  economy(now) {
    const s = this.state;
    if (s.phase !== 'battle') return;
    const sky = this.ticks(this.tune.skyOrbEvery || this.rules.skyOrbEvery);
    if (now % sky === 0) {
      // 落點用固定順序，不用隨機
      const open = this.level.openLanes;
      const lane = open[s.skySeq % open.length];
      const col = 2 + (s.skySeq * 3) % 8;
      s.skySeq++;
      this.addOrb(col, lane, 'sky');
    }
    for (let i = 0; i < s.units.length; i++) {
      const u = s.units[i];
      const def = this.cfg.units[u.kind];
      if (def.genEvery && now >= u.genNext) {
        u.genNext += this.ticks(this.genSeconds(def));
        this.addOrb(u.col, u.lane, 'trainer');
      }
    }
    const fall = this.ticks(this.rules.orbFallSeconds);
    const auto = fall + this.ticks(this.rules.orbAutoCollectAfter);
    for (let i = s.orbs.length - 1; i >= 0; i--) {
      const o = s.orbs[i];
      o.age++;
      if (o.age >= auto) this.collectOrb(i);
    }
  }

  collectOrb(index) {
    const s = this.state;
    const o = s.orbs[index];
    s.orbs.splice(index, 1);
    s.balls = Math.min(this.rules.maxBalls, s.balls + this.rules.orbValue);
    this.events.push({ type: 'orbCollected', id: o.id });
  }

  checkWin() {
    const s = this.state;
    if (s.phase === 'battle' && s.nextSpawn >= this.level.script.length && s.enemies.length === 0) {
      s.phase = 'won';
      this.events.push({ type: 'won' });
    }
  }

  applyCommands() {
    const s = this.state;
    for (let c = 0; c < this.commands.length; c++) {
      const cmd = this.commands[c];
      if (cmd.type === 'continue') {
        s.waitingHint = false;
      } else if (cmd.type === 'collect') {
        const fall = this.ticks(this.rules.orbFallSeconds);
        for (let i = 0; i < s.orbs.length; i++) {
          if (s.orbs[i].id === cmd.id && s.orbs[i].age >= fall) { this.collectOrb(i); break; }
        }
      } else if (cmd.type === 'place') {
        this.place(cmd);
      } else if (cmd.type === 'recall') {
        this.recall(cmd);
      }
    }
    this.commands.length = 0;
  }

  // 請回角色：退還原價（plan-v2 第八節），不論剩多少生命，也不觸發放置防連點
  recall(cmd) {
    const s = this.state;
    if (s.phase !== 'prep' && s.phase !== 'battle') return;
    const i = s.units.findIndex((u) => u.id === cmd.id);
    if (i < 0) return;
    const u = s.units[i];
    const refund = this.cfg.units[u.kind].cost;
    s.balls = Math.min(this.rules.maxBalls, s.balls + refund);
    s.units.splice(i, 1);
    this.events.push({ type: 'unitRecalled', id: u.id, kind: u.kind, refund });
  }

  place(cmd) {
    const s = this.state;
    const problem = this.placeProblem(cmd.kind, cmd.lane, cmd.col);
    if (problem) {
      this.events.push({ type: 'placeFail', reason: problem });
      return;
    }
    const def = this.cfg.units[cmd.kind];
    s.balls -= def.cost;
    s.placeCd = this.ticks(this.rules.placeCooldown);
    const unit = {
      id: s.nextId++, kind: cmd.kind, lane: cmd.lane, col: cmd.col, hp: def.hp, maxHp: def.hp,
      targetId: 0, fireTick: 0, secondTick: -1, secondTarget: 0, roundGate: 0,
      genNext: def.genEvery ? s.tick + this.ticks(this.genSeconds(def)) : 0,
    };
    s.units.push(unit);
    this.events.push({ type: 'placed', id: unit.id, kind: cmd.kind });
    if (s.phase === 'prep' && this.level.requiredToStart.every((k) => this.countUnits(k) > 0)) {
      s.phase = 'battle';
      this.events.push({ type: 'battleStart' });
    }
  }
};
