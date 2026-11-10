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
    // byMode＝只在某個模式另外覆蓋的項目（例如一起守護敵人走得慢、整局較長，收入間隔另外拉長）
    const tune = this.level.tune || {};
    this.tune = Object.assign({}, tune, (tune.byMode || {})[modeId]);
    this.enemyDefs = {};
    Object.keys(config.enemies).forEach((k) => {
      this.enemyDefs[k] = Object.assign({}, config.enemies[k], (this.tune.enemies || {})[k]);
    });
    this.tps = Math.round(1 / this.rules.tickSeconds);
    // 地形：lane×100＋col 對應地形種類
    this.terrain = {};
    (this.level.terrain || []).forEach((t) => t.lanes.forEach((lane) => t.cols.forEach((col) => {
      this.terrain[lane * 100 + col] = config.terrainTypes[t.type];
    })));
    // 隊長登場前的預告：第幾格時間、哪條路
    this.bossWarnAt = {};
    this.level.script.forEach((ev) => {
      if (this.enemyDefs[ev.kind].boss) this.bossWarnAt[this.ticks(Math.max(0, ev.t - this.rules.bossWarnSeconds))] = ev.lane;
    });
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
      nextSpawn: 0, lastSnapWave: 0, rescues: 0, placeCd: 0, kills: 0,
      waitingHint: false, hintLanes: [], skySeq: 0, units: [], enemies: [], orbs: [], zones: [], introduced: [], rallyEnd: 0, rallyFactor: 1,
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

  terrainAt(lane, col) { return this.terrain[lane * 100 + col] || null; }

  // 敵人腳下的地形（出怪區沒有地形）
  terrainUnder(e) { return this.terrainAt(e.lane, Math.round(e.x)); }

  cellBlocked(lane, col) { const t = this.terrainAt(lane, col); return !!(t && t.noPlace); }

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
    // 開戰前只能放開戰需要的角色，否則球花光又沒有收入，會永遠開不了戰
    if (s.phase === 'prep' && this.level.requiredToStart.indexOf(kind) === -1) return 'startersFirst';
    if (!this.isLaneOpen(lane)) return 'rest';
    if (col < 1 || col > this.cfg.layout.grid.cols) return 'outside';
    if (this.cellBlocked(lane, col)) return 'terrain';
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
      // 一起守護：同一關每條路只在第一次出波時暫停提示一次（之後同一條路不再停）
      const hint = !!this.mode.autoWaveHint && s.hintLanes.indexOf(next.lane) === -1;
      if (hint) s.hintLanes.push(next.lane); // 先記再存檔：重試這一段時不會再停一次
      // 波次第一隻出現「之前」存下完整狀態
      this.snapshot = JSON.stringify(s);
      s.lastSnapWave = next.wave;
      this.events.push({ type: 'wave', wave: next.wave, lane: next.lane, hint });
      if (hint) { s.waitingHint = true; return true; }
    }
    s.tick = now;
    if (this.bossWarnAt[now]) this.events.push({ type: 'bossWarn', lane: this.bossWarnAt[now] });
    this.moveEnemies();
    this.spawnEnemies(now);
    this.unitAttacks(now);
    this.zoneTicks(now);
    this.burnTicks(now);
    this.enemySupport(now);
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
      if (!def.flying) {
        const ground = this.terrainUnder(e);
        if (ground && ground.speedMul) speed *= ground.speedMul;
      }
      if (s.rallyEnd > s.tick) speed *= s.rallyFactor;
      if (e.rootEnd > s.tick || e.stunEnd > s.tick || e.entryEnd > s.tick) speed = 0; // 被綁住、暈眩或登場亮相：原地不動
      const blocker = def.flying ? null : this.findBlocker(e); // 飛行敵人不會被任何角色擋住
      let nx = e.x - speed * dt;
      let blockedId = 0;
      if (blocker && nx <= blocker.col + 0.5 + 1e-9) {
        if (def.hopOver && !e.hopped && speed > 0) {
          // 只跳一次：越過第一個擋路的角色，落在它左邊（最遠到 0.75，不會一跳就進村）
          e.hopped = true;
          const from = e.x;
          nx = Math.max(blocker.col - 0.5, 0.75);
          e.px = nx;
          this.events.push({ type: 'enemyHop', id: e.id, cells: from - nx });
        } else {
          nx = blocker.col + 0.5;
          blockedId = blocker.id;
        }
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
      const e = this.addEnemy(ev.kind, ev.lane, this.rules.spawnX);
      // 第一次出現的新敵人要跳提示（普通敵人不提示）
      if (PD.text.enemyDesc[ev.kind] && s.introduced.indexOf(ev.kind) === -1) {
        s.introduced.push(ev.kind);
        this.events.push({ type: 'enemyNew', id: e.id, kind: ev.kind });
      }
    }
  }

  addEnemy(kind, lane, x) {
    const s = this.state;
    const def = this.enemyDefs[kind];
    const e = {
      id: s.nextId++, kind, lane, x, px: x, hp: def.hp, maxHp: def.hp,
      blockedId: 0, contact: 0, burnNext: -1, burnEnd: -1, slowEnd: 0, slowFactor: 1,
      rootEnd: 0, stunEnd: 0, hopped: false, healNext: def.heal ? s.tick + this.ticks(def.heal.every) : 0,
      entryEnd: def.entryPause ? s.tick + this.ticks(def.entryPause) : 0, summoned: false,
      throwNext: def.throwAt ? s.tick + this.ticks(def.throwAt.every) : 0,
      cloaked: false, cloakOn: false, cloakAt: def.cloak ? s.tick + this.ticks(def.cloak.visible) : 0,
      summonNext: def.summon ? s.tick + this.ticks(def.summon.every) : 0,
      rallyNext: def.rally ? s.tick + this.ticks(def.rally.every) : 0,
    };
    s.enemies.push(e);
    return e;
  }

  inRange(u, def, e) {
    return e.hp > 0 && e.lane === u.lane && !e.cloaked && !(def.melee && this.enemyDefs[e.kind].flying) &&
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
      if (u.cometAt === now) { u.cometAt = 0; this.cometStrike(u); }
      if (!def.range) continue;

      // 雙擊的第二下：只打同一隻，且要還在範圍內
      if (u.secondTick === now) {
        u.secondTick = -1;
        const t2 = this.findEnemy(u.secondTarget);
        if (t2 && this.inRange(u, def, t2)) {
          this.strike(u, def, t2, now);
          if (def.cleave) this.strikeOthers(u, def, t2, now);
        }
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
        if (def.pierce || def.cleave) this.strikeOthers(u, def, target, now);
        u.fireTick = now + this.ticks(this.intervalOf(u, def, now));
        if (def.secondHitDelay) {
          u.secondTick = now + this.ticks(def.secondHitDelay);
          u.secondTarget = target.id;
          u.roundGate = u.fireTick; // 換目標最早要等到下一輪
        }
      }
    }
  }

  // 技能「閃電連發」期間攻擊間隔縮短
  intervalOf(u, def, now) {
    const base = u.frenzyEnd > now ? def.interval / this.cfg.skills[u.kind].rate : def.interval;
    const cell = this.terrainAt(u.lane, u.col);
    return cell && cell.fireRate ? base * cell.fireRate : base;
  }

  // 穿透／橫掃：同一下也打到範圍內的其他敵人
  strikeOthers(u, def, first, now) {
    const list = this.state.enemies;
    for (let i = 0; i < list.length; i++) {
      if (list[i] !== first && this.inRange(u, def, list[i])) this.strike(u, def, list[i], now);
    }
  }

  strike(u, def, e, now) {
    e.hp -= def.damage;
    if (def.slow) {
      e.slowEnd = now + this.ticks(def.slow.seconds);
      e.slowFactor = def.slow.factor;
    }
    if (def.burn) this.applyBurn(e, now, def.burn.seconds);
    this.events.push({ type: 'shot', unitId: u.id, targetId: e.id, fx: def.fx, big: u.frenzyEnd > now });
  }

  // 燃燒只刷新、不疊加
  applyBurn(e, now, seconds) {
    if (e.burnNext < 0) e.burnNext = now + this.tps;
    e.burnEnd = now + this.ticks(seconds);
  }

  // 火焰地毯：站在上面的敵人持續被點燃，傷害走原本的燃燒規則（每秒 1，不疊加）
  zoneTicks(now) {
    const s = this.state;
    for (let z = s.zones.length - 1; z >= 0; z--) {
      const zone = s.zones[z];
      if (now >= zone.end) { s.zones.splice(z, 1); continue; }
      for (let i = 0; i < s.enemies.length; i++) {
        const e = s.enemies[i];
        if (this.enemyDefs[e.kind].flying) continue; // 火帶在地上，燒不到飛的
        if (e.lane === zone.lane && e.x > zone.x0 + 1e-9 && e.x <= zone.x1 + 1e-9) this.applyBurn(e, now, zone.burnSeconds);
      }
    }
  }

  // 治療型敵人：每隔一段時間幫同一條路、附近受傷的同伴補血（暈眩時不補）
  enemySupport(now) {
    const list = this.state.enemies;
    for (let i = 0; i < list.length; i++) this.enemyAbilities(list[i], now);
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const heal = this.enemyDefs[e.kind].heal;
      if (!heal || e.hp <= 0 || e.stunEnd > now || now < e.healNext) continue;
      e.healNext = now + this.ticks(heal.every);
      for (let k = 0; k < list.length; k++) {
        const o = list[k];
        if (o === e || o.lane !== e.lane || o.hp <= 0 || o.hp >= o.maxHp || Math.abs(o.x - e.x) > heal.reach) continue;
        o.hp = Math.min(o.maxHp, o.hp + heal.amount);
        this.events.push({ type: 'enemyHeal', id: o.id });
      }
    }
  }

  // 隱身輪替、丟球、召喚、敲鼓。暈眩中的敵人不做主動行為，但隱身計時照走
  enemyAbilities(e, now) {
    const def = this.enemyDefs[e.kind];
    if (e.hp <= 0) return;
    if (def.cloak) {
      if (now >= e.cloakAt) {
        e.cloakOn = !e.cloakOn;
        e.cloakAt = now + this.ticks(e.cloakOn ? def.cloak.hidden : def.cloak.visible);
      }
      const ground = this.terrainUnder(e);
      e.cloaked = e.cloakOn && !(ground && ground.reveal);
    }
    if (e.stunEnd > now) return;
    if (def.throwAt && now >= e.throwNext) {
      const u = this.throwTarget(e, def.throwAt.reach);
      if (u) {
        e.throwNext = now + this.ticks(def.throwAt.every);
        u.hp -= def.throwAt.damage;
        this.events.push({ type: 'enemyThrow', id: e.id, unitId: u.id });
      }
    }
    if (def.summon && now >= e.summonNext) {
      e.summonNext = now + this.ticks(def.summon.every);
      const alive = this.state.enemies.filter((o) => o.summoned).length;
      const n = Math.min(def.summon.count, Math.max(0, def.summon.maxAlive - alive));
      for (let k = 0; k < n; k++) {
        const m = this.addEnemy(def.summon.kind, e.lane, Math.min(this.rules.spawnX, e.x + 0.6 + k * 0.45));
        m.summoned = true;
      }
      if (n) this.events.push({ type: 'enemySummon', id: e.id });
    }
    if (def.rally && now >= e.rallyNext) {
      e.rallyNext = now + this.ticks(def.rally.every);
      this.state.rallyEnd = now + this.ticks(def.rally.seconds);
      this.state.rallyFactor = def.rally.factor;
      this.events.push({ type: 'enemyRally', id: e.id });
    }
  }

  // 同路、前方 reach 格內最近的遠攻角色（近戰與不攻擊的角色不算）
  throwTarget(e, reach) {
    let best = null;
    const list = this.state.units;
    for (let i = 0; i < list.length; i++) {
      const u = list[i];
      const def = this.cfg.units[u.kind];
      if (u.lane !== e.lane || !def.range || def.melee || u.hp <= 0) continue;
      if (u.col >= e.x || e.x - u.col > reach + 1e-9) continue;
      if (!best || u.col > best.col) best = u;
    }
    return best;
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
      const def = this.enemyDefs[e.kind];
      // 分裂：小的只往右邊冒，不會直接跑到擋路角色的左邊
      if (def.splitInto) {
        for (let k = 0; k < def.splitInto.count; k++) {
          this.addEnemy(def.splitInto.kind, e.lane, Math.min(this.rules.spawnX, e.x + k * 0.45));
        }
        this.events.push({ type: 'enemySplit', lane: e.lane, x: e.x });
      }
      if (def.noOrb || e.summoned) continue; // 被召喚的小兵不掉球，避免靠隊長刷球
      if (def.orbDrop) {
        for (let k = 0; k < def.orbDrop; k++) this.addOrb(Math.max(1, Math.min(10, e.x - k * 0.6)), e.lane, 'enemy');
        continue;
      }
      // killOrbEvery：每擊倒幾隻才掉一顆（固定節奏、不用隨機），避免打得越多錢越多
      s.kills++;
      if (s.kills % (this.tune.killOrbEvery || 1) === 0) this.addOrb(e.x, e.lane, 'enemy');
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
      if (!e.blockedId || e.stunEnd > s.tick) continue; // 暈眩時不攻擊
      const u = this.findUnit(e.blockedId);
      if (!u) { e.blockedId = 0; e.contact = 0; continue; }
      e.contact++;
      if (e.contact >= every) {
        e.contact = 0;
        u.hp -= this.enemyDefs[e.kind].contactDamage || this.rules.enemyContactDamage;
        this.events.push({ type: 'unitHit', id: u.id });
        const thorns = this.cfg.units[u.kind].thorns;
        if (thorns) { e.hp -= thorns; this.events.push({ type: 'thorns', id: e.id }); }
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
      s.rescues += this.enemyDefs[e.kind].homeCost || 1;
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
      // 技能掉的球落地就自動收進，不用點
      if (o.age >= (o.source === 'skill' ? fall : auto)) this.collectOrb(i);
    }
  }

  collectOrb(index) {
    const s = this.state;
    const o = s.orbs[index];
    s.orbs.splice(index, 1);
    s.balls = Math.min(this.rules.maxBalls, s.balls + this.rules.orbValue);
    this.events.push({ type: 'orbCollected', id: o.id, source: o.source });
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
      } else if (cmd.type === 'skill') {
        this.castSkill(cmd.id);
      }
    }
    this.commands.length = 0;
  }

  // ===== 主動技能 =====
  skillTicks(kind) { return this.ticks(this.cfg.skills[kind].cd * this.mode.skillCdMul); }

  // 回傳不能施放的原因；可以放則回傳 null
  skillProblem(u) {
    const s = this.state;
    if (!this.cfg.skills[u.kind]) return 'none';
    if (s.phase !== 'battle' || s.waitingHint) return 'phase';
    return s.tick < (u.skillAt || 0) ? 'cooldown' : null;
  }

  // 剩餘冷卻比例 0～1（給角色身上的倒數圓環用）；每隻角色自己一個冷卻，存在 u.skillAt（可以再放的那一格時間）
  skillLeft(u) {
    if (!this.cfg.skills[u.kind]) return 0;
    return Math.max(0, Math.min(1, ((u.skillAt || 0) - this.state.tick) / this.skillTicks(u.kind)));
  }

  castSkill(id) {
    const u = this.findUnit(id);
    if (!u || this.skillProblem(u)) return;
    const now = this.state.tick;
    const sk = this.cfg.skills[u.kind];
    u.skillAt = now + this.skillTicks(u.kind);
    const ev = { type: 'skill', id: u.id, kind: u.kind, lane: u.lane, col: u.col, hits: [] };
    this['skill_' + u.kind](u, sk, now, ev);
    this.events.push(ev);
  }

  // 指定目標的招式打不到隱身敵人；groundOnly＝近身招，打不到飛行敵人
  enemiesNear(lanes, x0, x1, groundOnly) {
    return this.state.enemies.filter((e) => e.hp > 0 && !e.cloaked && !(groundOnly && this.enemyDefs[e.kind].flying) &&
      lanes.indexOf(e.lane) !== -1 && e.x > x0 + 1e-9 && e.x <= x1 + 1e-9);
  }

  // 往出怪點推回，不會推出出怪點
  pushBack(e, cells) {
    if (this.enemyDefs[e.kind].boss) return; // 隊長太重，推不動
    const to = Math.min(this.rules.spawnX, e.x + cells);
    const moved = to - e.x;
    e.x = to; e.px = to; e.blockedId = 0; e.contact = 0;
    if (moved > 0) this.events.push({ type: 'enemyPushed', id: e.id, cells: moved });
  }

  skill_trainer(u, sk) {
    for (let i = 0; i < sk.orbs; i++) this.addOrb(Math.max(0.7, u.col + (i - 1) * 0.6), u.lane, 'skill');
  }

  skill_basicShooter(u, sk, now) {
    u.frenzyEnd = now + this.ticks(sk.seconds);
    const def = this.cfg.units[u.kind];
    u.fireTick = Math.min(u.fireTick, now + this.ticks(def.interval / sk.rate)); // 正在等下一發時也馬上加速
  }

  skill_burnShooter(u, sk, now) {
    this.state.zones.push({
      id: this.state.nextId++, lane: u.lane, x0: u.col + 0.5, x1: Math.min(u.col + 0.5 + sk.cells, 10.5),
      start: now, end: now + this.ticks(sk.seconds), burnSeconds: sk.burnSeconds,
    });
  }

  skill_slowShooter(u, sk, now, ev) {
    this.enemiesNear([u.lane], u.col, this.rules.spawnX).forEach((e) => {
      e.hp -= sk.damage;
      e.slowEnd = now + this.ticks(sk.slowSeconds);
      e.slowFactor = sk.slowFactor;
      this.pushBack(e, sk.push);
      ev.hits.push(e.id);
    });
  }

  skill_doubleStriker(u, sk, now, ev) {
    this.enemiesNear([u.lane - 1, u.lane, u.lane + 1], u.col, u.col + sk.reach, true).forEach((e) => {
      e.hp -= sk.damage;
      e.rootEnd = now + this.ticks(sk.rootSeconds);
      ev.hits.push(e.id);
    });
  }

  skill_tank(u, sk, now, ev) {
    u.hp = Math.min(u.maxHp, u.hp + Math.round(u.maxHp * sk.heal));
    this.enemiesNear([u.lane], u.col, u.col + sk.reach, true).forEach((e) => {
      e.hp -= sk.damage;
      e.stunEnd = now + this.ticks(sk.stunSeconds);
      this.pushBack(e, sk.push);
      ev.hits.push(e.id);
    });
  }

  // 水晶彗星：先蓄力，時間到才真的打（見 unitAttacks）
  skill_pierceShooter(u, sk, now) { u.cometAt = now + this.ticks(sk.chargeSeconds); }

  cometStrike(u) {
    const sk = this.cfg.skills[u.kind];
    const ev = { type: 'comet', hits: [] };
    this.state.enemies.forEach((e) => {
      if (e.hp <= 0) return;
      e.hp -= sk.damage;
      ev.hits.push(e.id);
    });
    this.events.push(ev);
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
      frenzyEnd: 0, cometAt: 0,
      // 每隻角色自己的技能冷卻：剛放下的都從半冷卻開始（請回再放下是新角色，也是半冷卻）
      skillAt: this.cfg.skills[cmd.kind] ? s.tick + Math.round(this.skillTicks(cmd.kind) / 2) : 0,
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
