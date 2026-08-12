// ============================================================
// CombatEngine — turn-based card battle logic (no rendering here)
// ============================================================

const STATUS_META = {
  strength: { icon: '💪', label: '力量', desc: '每层永久增加你的攻击牌造成的伤害 +1。' },
  dexterity: { icon: '🤸', label: '敏捷', desc: '每层永久增加你获得的格挡 +1。' },
  weak: { icon: '😵', label: '虚弱', desc: '造成的伤害降低 25%。每回合结束时减少 1 层。' },
  vulnerable: { icon: '🎯', label: '易伤', desc: '受到的伤害增加 50%。每回合结束时减少 1 层。' },
  frail: { icon: '🍂', label: '脆弱', desc: '获得的格挡降低 25%。每回合结束时减少 1 层。' },
  poison: { icon: '☠️', label: '中毒', desc: '每回合开始时损失等同于层数的生命值，之后层数 -1。' },
  metallicize: { icon: '🔩', label: '金属化', desc: '每回合结束时自动获得等同于层数的格挡。' },
  venom: { icon: '🐍', label: '渗毒', desc: '你的攻击牌命中造成伤害时，额外对目标施加等同于层数的中毒。' },
  darkEmbrace: { icon: '🖤', label: '暗影拥抱', desc: '每当你消耗一张卡牌，抽取等同于层数的牌。' },
  feelNoPain: { icon: '🦴', label: '无惧疼痛', desc: '每当你消耗一张卡牌，获得等同于层数的格挡。' },
  barricade: { icon: '🧱', label: '壁垒', desc: '你的格挡不再在回合开始时清除。' },
  juggernaut: { icon: '🐘', label: '势不可当', desc: '每当你获得格挡，对一个随机敌人造成等同于层数的伤害。' },
  noxiousFumes: { icon: '☠️', label: '毒雾', desc: '每回合开始时，对所有敌人施加等同于层数的中毒。' },
  wellLaidPlans: { icon: '📋', label: '计划妥当', desc: '回合结束时保留等同于层数的手牌，不会被弃置。' },
  toolsOfTrade: { icon: '🧰', label: '必备工具', desc: '每回合开始时，抽 1 张牌并弃 1 张牌。' },
};

class CombatEngine {
  constructor(run, enemyDefIds, hpScaling = 1) {
    this.run = run; // { player:{hp,maxHp}, gold, relics:[], deck:[cardInstance] }
    this.energyMax = 3;
    this.energy = 0;
    this.turnCount = 0;
    this.finished = false;
    this.winner = null;
    this.log_ = [];
    this.firstAttackFree = false;

    this.player = {
      block: 0,
      statuses: {
        strength: 0, dexterity: 0, weak: 0, vulnerable: 0, frail: 0, poison: 0, metallicize: 0, venom: 0,
        darkEmbrace: 0, feelNoPain: 0, barricade: 0, juggernaut: 0, noxiousFumes: 0, wellLaidPlans: 0, toolsOfTrade: 0,
      },
    };

    this.enemies = enemyDefIds.map((defId, i) => {
      const def = ENEMIES[defId];
      const [min, max] = def.hpRange;
      const hp = Math.round((min + Math.floor(Math.random() * (max - min + 1))) * hpScaling);
      const enemy = {
        id: 'e' + i, defId, name: def.name, icon: def.icon,
        hp, maxHp: hp, block: 0,
        statuses: { strength: 0, weak: 0, vulnerable: 0, poison: 0 },
        aiState: {}, nextMove: null,
      };
      enemy.nextMove = def.chooseMove(enemy, this);
      return enemy;
    });

    this.drawPile = shuffleArray(run.deck.map(c => ({ uid: 'cc' + Math.random().toString(36).slice(2), defId: c.defId, upgraded: c.upgraded })));
    this.hand = [];
    this.discardPile = [];
    this.exhaustPile = [];
  }

  log(text, cls) { this.log_.push({ text, cls: cls || 'info' }); }

  runRelicHook(hookName, ...args) {
    this.run.relics.forEach(relicId => {
      const relic = RELICS[relicId];
      if (relic && typeof relic[hookName] === 'function') relic[hookName](this, ...args);
    });
  }

  start() {
    this.runRelicHook('onCombatStart');
    this.startTurn();
  }

  startTurn() {
    this.turnCount += 1;
    if (!(this.player.statuses.barricade > 0)) this.player.block = 0;
    if (this.player.statuses.poison > 0) {
      this.damagePlayerDirect(this.player.statuses.poison);
      this.log(`☠️ 中毒发作，损失 ${this.player.statuses.poison} 点生命`, 'enemy');
      this.player.statuses.poison -= 1;
    }
    this.energy = this.energyMax;
    this.runRelicHook('onTurnStart');
    if (this.player.statuses.noxiousFumes > 0) {
      this.enemies.forEach(e => { if (e.hp > 0) this.applyStatusEnemy(e.id, 'poison', this.player.statuses.noxiousFumes); });
    }
    this.drawCards(5);
    if (this.player.statuses.toolsOfTrade > 0) {
      for (let i = 0; i < this.player.statuses.toolsOfTrade; i++) {
        this.drawCards(1);
        this.discardRandomFromHand(1);
      }
    }
    this.log(`—— 回合 ${this.turnCount} 开始 ——`, 'info');
  }

  endTurn() {
    if (this.finished) return;
    if (this.player.statuses.metallicize > 0) {
      this.gainBlockPlayer(this.player.statuses.metallicize);
    }
    this.runRelicHook('onTurnEnd');
    this.player.statuses.weak = Math.max(0, this.player.statuses.weak - 1);
    this.player.statuses.vulnerable = Math.max(0, this.player.statuses.vulnerable - 1);
    this.player.statuses.frail = Math.max(0, this.player.statuses.frail - 1);
    // discard hand (retaining cards if Well-Laid-Plans-style power is active)
    const retain = this.player.statuses.wellLaidPlans || 0;
    const kept = retain > 0 ? this.hand.slice(0, retain) : [];
    const toDiscard = retain > 0 ? this.hand.slice(retain) : this.hand;
    this.discardPile.push(...toDiscard);
    this.hand = kept;
    this.enemyTurn();
  }

  enemyTurn() {
    for (const enemy of this.enemies) {
      if (this.finished) return;
      if (enemy.hp <= 0) continue;
      enemy.block = 0;
      if (enemy.statuses.poison > 0) {
        enemy.hp -= enemy.statuses.poison;
        this.log(`☠️ ${enemy.name} 中毒发作，损失 ${enemy.statuses.poison} 点生命`, 'player');
        enemy.statuses.poison -= 1;
        if (enemy.hp <= 0) { enemy.hp = 0; this.log(`💀 ${enemy.name} 被毒死了！`, 'info'); this.runRelicHook('onEnemyKilled', enemy); this.checkVictory(); continue; }
      }
      this.currentActor = 'enemy';
      if (enemy.nextMove) enemy.nextMove.execute(this, enemy);
      if (this.finished) return;
      enemy.statuses.weak = Math.max(0, enemy.statuses.weak - 1);
      enemy.statuses.vulnerable = Math.max(0, enemy.statuses.vulnerable - 1);
      if (enemy.hp > 0) enemy.nextMove = ENEMIES[enemy.defId].chooseMove(enemy, this);
    }
    if (!this.finished) this.startTurn();
  }

  canAfford(cardInstance) {
    const def = CARDS[cardInstance.defId];
    const cost = (this.firstAttackFree && def.type === 'attack') ? 0 : def.cost;
    return this.energy >= cost;
  }

  playCard(cardUid, targetEnemyId) {
    if (this.finished) return { success: false, reason: 'finished' };
    const idx = this.hand.findIndex(c => c.uid === cardUid);
    if (idx === -1) return { success: false, reason: 'not-in-hand' };
    const card = this.hand[idx];
    const def = CARDS[card.defId];
    const isFreeAttack = this.firstAttackFree && def.type === 'attack';
    const cost = isFreeAttack ? 0 : def.cost;
    if (this.energy < cost) return { success: false, reason: 'no-energy' };

    let target = null;
    if (def.target === 'enemy') {
      target = this.enemies.find(e => e.id === targetEnemyId && e.hp > 0);
      if (!target) return { success: false, reason: 'no-target' };
    }

    this.energy -= cost;
    if (isFreeAttack) this.firstAttackFree = false;
    this.currentActor = 'player';

    this.hand.splice(idx, 1);
    const vars = def.vars(card.upgraded);
    def.effect({ combat: this, target, card, vars });
    this.runRelicHook('onCardPlayed', card);

    if (def.exhaust) { this.exhaustPile.push(card); this.onCardExhausted(); }
    else this.discardPile.push(card);

    this.log(`🎴 打出【${def.name}${card.upgraded ? '+' : ''}】`, 'player');
    if (this.run.stats) {
      this.run.stats.cardsPlayed = (this.run.stats.cardsPlayed || 0) + 1;
      this.run.stats.uniqueCardIds = this.run.stats.uniqueCardIds || {};
      this.run.stats.uniqueCardIds[card.defId] = true;
    }
    this.checkVictory();
    return { success: true };
  }

  drawCards(n) {
    for (let i = 0; i < n; i++) {
      if (this.hand.length >= 10) break;
      if (this.drawPile.length === 0) {
        if (this.discardPile.length === 0) break;
        this.drawPile = shuffleArray(this.discardPile);
        this.discardPile = [];
        this.log('🔀 弃牌堆已洗入抽牌堆', 'info');
      }
      this.hand.push(this.drawPile.pop());
    }
  }

  exhaustCardByUid(uid) {
    const idx = this.hand.findIndex(c => c.uid === uid);
    if (idx === -1) return;
    const [card] = this.hand.splice(idx, 1);
    this.exhaustPile.push(card);
    this.onCardExhausted();
  }

  onCardExhausted() {
    if (this.player.statuses.darkEmbrace > 0) this.drawCards(this.player.statuses.darkEmbrace);
    if (this.player.statuses.feelNoPain > 0) this.gainBlockPlayer(this.player.statuses.feelNoPain);
  }

  discardRandomFromHand(n = 1) {
    for (let i = 0; i < n; i++) {
      if (this.hand.length === 0) break;
      const idx = Math.floor(Math.random() * this.hand.length);
      const [card] = this.hand.splice(idx, 1);
      this.discardPile.push(card);
    }
  }

  doubleBlockPlayer() {
    const before = this.player.block;
    this.player.block *= 2;
    this.log(`🛡️ 格挡翻倍：${before} → ${this.player.block}`, 'player');
  }

  addCardToDiscard(defId, upgraded) {
    this.discardPile.push({ uid: 'cc' + Math.random().toString(36).slice(2), defId, upgraded: !!upgraded });
  }

  gainEnergy(n) { this.energy += n; }

  dealDamageToEnemy(enemyId, baseAmount, opts = {}) {
    const enemy = this.enemies.find(e => e.id === enemyId);
    if (!enemy || enemy.hp <= 0) return 0;
    let dmg = baseAmount + (opts.noStrength ? 0 : (this.player.statuses.strength || 0));
    if (!opts.ignoreWeak && this.player.statuses.weak > 0) dmg = Math.floor(dmg * 0.75);
    if (!opts.ignoreVulnerable && enemy.statuses.vulnerable > 0) dmg = Math.floor(dmg * 1.5);
    dmg = Math.max(0, dmg);
    let remaining = dmg;
    if (enemy.block > 0) {
      const absorbed = Math.min(enemy.block, remaining);
      enemy.block -= absorbed;
      remaining -= absorbed;
    }
    enemy.hp -= remaining;
    this.log(`⚔️ ${opts.source || '攻击'} 对 ${enemy.name} 造成 ${dmg} 点伤害${dmg - remaining > 0 ? `（格挡吸收 ${dmg - remaining}）` : ''}`, 'player');
    if (this.currentActor === 'player' && dmg > 0 && this.player.statuses.venom > 0 && enemy.hp > 0) {
      this.applyStatusEnemy(enemyId, 'poison', this.player.statuses.venom);
    }
    if (enemy.hp <= 0) {
      enemy.hp = 0;
      this.log(`💀 ${enemy.name} 被击败了！`, 'info');
      this.runRelicHook('onEnemyKilled', enemy);
      this.checkVictory();
    }
    return remaining;
  }

  dealDamageToPlayer(baseAmount, attackerEnemyId) {
    const attacker = attackerEnemyId ? this.enemies.find(e => e.id === attackerEnemyId) : null;
    let dmg = baseAmount + (attacker ? (attacker.statuses.strength || 0) : 0);
    if (attacker && attacker.statuses.weak > 0) dmg = Math.floor(dmg * 0.75);
    if (this.player.statuses.vulnerable > 0) dmg = Math.floor(dmg * 1.5);
    dmg = Math.max(0, dmg);
    let remaining = dmg;
    if (this.player.block > 0) {
      const absorbed = Math.min(this.player.block, remaining);
      this.player.block -= absorbed;
      remaining -= absorbed;
    }
    this.run.player.hp -= remaining;
    this.log(`💥 ${attacker ? attacker.name : '未知敌人'} 对你造成 ${dmg} 点伤害${dmg - remaining > 0 ? `（格挡吸收 ${dmg - remaining}）` : ''}`, 'enemy');
    this.runRelicHook('onDamageTaken', dmg, attackerEnemyId);
    this.checkPlayerDeath();
    return remaining;
  }

  damagePlayerDirect(amount) {
    this.run.player.hp -= amount;
    this.checkPlayerDeath();
  }

  gainBlockPlayer(amount) {
    const dex = this.player.statuses.dexterity || 0;
    let final = amount + dex;
    if (this.player.statuses.frail > 0) final = Math.floor(final * 0.75);
    final = Math.max(0, final);
    this.player.block += final;
    this.log(`🛡️ 你获得 ${final} 点格挡`, 'player');
    if (final > 0 && this.player.statuses.juggernaut > 0) {
      const living = this.enemies.filter(e => e.hp > 0);
      if (living.length > 0) {
        const target = living[Math.floor(Math.random() * living.length)];
        this.dealDamageToEnemy(target.id, this.player.statuses.juggernaut, { source: '势不可当', noStrength: true });
      }
    }
  }

  gainBlockEnemy(enemyId, amount) {
    const enemy = this.enemies.find(e => e.id === enemyId);
    if (!enemy) return;
    enemy.block += amount;
    this.log(`🛡️ ${enemy.name} 获得 ${amount} 点格挡`, 'enemy');
  }

  healPlayer(amount) {
    if (amount <= 0) return;
    const before = this.run.player.hp;
    this.run.player.hp = Math.min(this.run.player.maxHp, this.run.player.hp + amount);
    if (this.run.player.hp > before) this.log(`💚 你回复了 ${this.run.player.hp - before} 点生命`, 'player');
  }

  healEnemy(enemyId, amount) {
    const enemy = this.enemies.find(e => e.id === enemyId);
    if (!enemy) return;
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + amount);
  }

  applyStatusPlayer(name, amount) {
    if (!amount) return;
    this.player.statuses[name] = (this.player.statuses[name] || 0) + amount;
    const meta = STATUS_META[name];
    if (meta && amount > 0) {
      this.log(`${meta.icon} 你获得了 ${amount} 层【${meta.label}】`, this.currentActor === 'enemy' ? 'enemy' : 'player');
    }
  }

  applyStatusEnemy(enemyId, name, amount) {
    const enemy = this.enemies.find(e => e.id === enemyId);
    if (!enemy || !amount) return;
    enemy.statuses[name] = (enemy.statuses[name] || 0) + amount;
    const meta = STATUS_META[name];
    if (meta && amount > 0) {
      this.log(`${meta.icon} ${enemy.name} 获得了 ${amount} 层【${meta.label}】`, this.currentActor === 'enemy' ? 'enemy' : 'player');
    }
  }

  checkPlayerDeath() {
    if (this.run.player.hp <= 0 && !this.finished) {
      this.run.player.hp = 0;
      this.finished = true;
      this.winner = 'enemy';
      this.log('💀 你倒下了……', 'info');
    }
  }

  checkVictory() {
    if (this.finished) return;
    if (this.enemies.every(e => e.hp <= 0)) {
      this.finished = true;
      this.winner = 'player';
      this.log('🎉 战斗胜利！', 'info');
      this.runRelicHook('onCombatEnd');
    }
  }
}

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
