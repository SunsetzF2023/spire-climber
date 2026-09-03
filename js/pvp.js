// ============================================================
// PVP Combat — async card battles between players' final decks.
//
// PvpCombatEngine is a self-contained turn-based card battle
// simulator that reuses CARDS definitions but treats BOTH sides
// as "fighters" (no enemy AI definitions needed). The defender
// is controlled by a simple greedy AI that plays cards in a
// reasonable priority order.
// ============================================================

// ─── Cloud functions (Supabase) ───

async function pvpUploadDeck(record) {
  if (!cloudSyncEnabled || !cloudUser) return;
  try {
    let playerName;
    if (cloudUser.is_anonymous) {
      playerName = `游客#${cloudUser.id.substring(0, 6)}`;
    } else {
      playerName = (cloudUser.user_metadata && (cloudUser.user_metadata.user_name || cloudUser.user_metadata.full_name)) || '匿名玩家';
    }
    const { error } = await supabaseClient
      .from('pvp_decks')
      .upsert({
        user_id: cloudUser.id,
        player_name: playerName,
        character_id: record.characterId,
        character_name: record.characterName,
        character_icon: record.characterIcon,
        max_hp: record.maxHp,
        deck_ids: record.deckIds,
        relic_ids: record.relicIds,
      }, { onConflict: 'user_id' });
    if (error) console.error('[pvp] upload deck failed:', error.message);
  } catch (e) {
    console.error('[pvp] upload deck error:', e);
  }
}

async function pvpLoadRoster(excludeUserId) {
  const { data, error } = await supabaseClient
    .from('pvp_decks')
    .select('*')
    .neq('user_id', excludeUserId)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) { console.error('[pvp] load roster failed:', error.message); return []; }
  return data || [];
}

async function pvpLoadMyDeck(userId) {
  const { data, error } = await supabaseClient
    .from('pvp_decks')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) { console.error('[pvp] load my deck failed:', error.message); return null; }
  return data;
}

async function pvpUploadBattleLog(attackerName, defenderName, winnerName, log) {
  const { error } = await supabaseClient
    .from('pvp_battle_logs')
    .insert({
      attacker_id: cloudUser ? cloudUser.id : null,
      attacker_name: attackerName,
      defender_name: defenderName,
      winner_name: winnerName,
      log: log,
    });
  if (error) console.error('[pvp] upload battle log failed:', error.message);
}

// ─── PVP Combat Engine ───

class PvpCombatEngine {
  /**
   * @param {object} attacker - { name, maxHp, deckIds, relicIds }
   * @param {object} defender - { name, maxHp, deckIds, relicIds }
   */
  constructor(attacker, defender) {
    this.attackerName = attacker.name;
    this.defenderName = defender.name;
    this.log_ = [];
    this.finished = false;
    this.winner = null;
    this.turnCount = 0;
    this.MAX_TURNS = 30;

    // Build fighters from deck data
    this.fighterA = this._buildFighter(attacker, 'A');
    this.fighterB = this._buildFighter(defender, 'B');

    // A is the human player (goes first), B is AI-controlled
    this.activeFighter = this.fighterA;
    this.inactiveFighter = this.fighterB;
  }

  _buildFighter(deckData, side) {
    const deck = (deckData.deckIds || []).map(id => {
      const upgraded = id.endsWith('+');
      const defId = upgraded ? id.slice(0, -1) : id;
      return { uid: 'pvp' + side + Math.random().toString(36).slice(2), defId, upgraded };
    });
    return {
      side,
      name: deckData.name,
      hp: deckData.maxHp || 80,
      maxHp: deckData.maxHp || 80,
      block: 0,
      energy: 0,
      energyMax: 3,
      drawPile: this._shuffle(deck),
      hand: [],
      discardPile: [],
      exhaustPile: [],
      statuses: {
        strength: 0, dexterity: 0, weak: 0, vulnerable: 0, frail: 0,
        poison: 0, metallicize: 0, venom: 0, barricade: 0,
      },
      relicIds: deckData.relicIds || [],
    };
  }

  _shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  log(text, cls) { this.log_.push({ text, cls: cls || 'info' }); }

  start() {
    this.log(`⚔️ ${this.fighterA.name} vs ${this.fighterB.name} — PVP 对决开始！`, 'info');
    this._startTurn(this.fighterA, this.fighterB);
  }

  _startTurn(fighter, opponent) {
    this.turnCount++;
    if (this.turnCount > this.MAX_TURNS) {
      this._endByTimeout();
      return;
    }
    this.activeFighter = fighter;
    this.inactiveFighter = opponent;

    // Block reset (unless barricade)
    if (!(fighter.statuses.barricade > 0)) fighter.block = 0;

    // Poison tick
    if (fighter.statuses.poison > 0) {
      fighter.hp -= fighter.statuses.poison;
      this.log(`☠️ ${fighter.name} 中毒发作，损失 ${fighter.statuses.poison} 点生命`, 'enemy');
      fighter.statuses.poison -= 1;
      if (this._checkDeath(fighter, opponent)) return;
    }

    // Energy
    fighter.energy = fighter.energyMax;

    // Draw 5
    this._drawCards(fighter, 5);

    // If this is fighter B (AI), auto-play
    if (fighter.side === 'B') {
      this._aiPlayTurn(fighter, opponent);
    }
    // If fighter A (human), wait for UI input — but for async sim, we also auto-play
    if (fighter.side === 'A') {
      this._aiPlayTurn(fighter, opponent);
    }
  }

  _drawCards(fighter, n) {
    for (let i = 0; i < n; i++) {
      if (fighter.hand.length >= 10) break;
      if (fighter.drawPile.length === 0) {
        if (fighter.discardPile.length === 0) break;
        fighter.drawPile = this._shuffle(fighter.discardPile);
        fighter.discardPile = [];
        this.log(`🔀 ${fighter.name} 的弃牌堆洗入抽牌堆`, 'info');
      }
      const card = fighter.drawPile.pop();
      fighter.hand.push(card);
    }
  }

  _getCardCost(fighter, card) {
    const def = CARDS[card.defId];
    if (!def) return 99;
    let cost = def.cost;
    if (card.upgraded && def.upgradedCost !== undefined) cost = def.upgradedCost;
    return cost;
  }

  _playCard(fighter, opponent, card) {
    const def = CARDS[card.defId];
    if (!def) return false;
    const cost = this._getCardCost(fighter, card);
    if (fighter.energy < cost) return false;

    fighter.energy -= cost;
    const idx = fighter.hand.indexOf(card);
    if (idx !== -1) fighter.hand.splice(idx, 1);

    const vars = def.vars(card.upgraded);

    // Build a context that maps to the card's effect expectations.
    // Cards call ctx.combat.dealDamageToEnemy / gainBlockPlayer / etc.
    // We create a shim that redirects to our PVP logic.
    const ctx = {
      combat: this._createCombatShim(fighter, opponent),
      target: opponent, // the "enemy" is the opponent
      card,
      vars,
    };

    // Only play cards that make sense in PVP (skip cards that reference
    // multiple enemies, summon mechanics, etc. — they'll just fizzle)
    try {
      def.effect(ctx);
    } catch (e) {
      // Card effect may reference enemy-array functions not in our shim;
      // just skip silently.
    }

    this.log(`🎴 ${fighter.name} 打出【${def.name}${card.upgraded ? '+' : ''}】`, fighter.side === 'A' ? 'player' : 'enemy');

    // Move to discard/exhaust
    if (def.exhaust || def.type === 'power') {
      fighter.exhaustPile.push(card);
    } else {
      fighter.discardPile.push(card);
    }

    if (this._checkDeath(opponent, fighter)) return true;
    return true;
  }

  /**
   * Create a shim object that mimics enough of CombatEngine for card effects to work.
   * Card effects call things like:
   *   ctx.combat.dealDamageToEnemy(targetId, dmg, opts)
   *   ctx.combat.gainBlockPlayer(amount)
   *   ctx.combat.applyStatusPlayer(name, amount)
   *   ctx.combat.applyStatusEnemy(enemyId, name, amount)
   *   ctx.combat.healPlayer(amount)
   *   ctx.combat.damagePlayerDirect(amount)
   *   ctx.combat.log(text, cls)
   *   ctx.combat.player.statuses (the attacker's statuses)
   *   ctx.combat.enemies (array — we provide [opponent])
   */
  _createCombatShim(fighter, opponent) {
    const self = this;
    const shim = {
      player: {
        statuses: fighter.statuses,
        block: fighter.block,
      },
      enemies: [{
        id: 'opp',
        hp: opponent.hp,
        maxHp: opponent.maxHp,
        block: opponent.block,
        statuses: opponent.statuses,
        name: opponent.name,
      }],
      finished: false,
      currentActor: fighter.side === 'A' ? 'player' : 'enemy',
      log(text, cls) { self.log(text, cls); },

      dealDamageToEnemy(enemyId, baseAmount, opts = {}) {
        const target = shim.enemies.find(e => e.id === enemyId);
        if (!target || target.hp <= 0) return 0;
        let dmg = baseAmount + (opts.noStrength ? 0 : (fighter.statuses.strength || 0));
        if (!opts.ignoreWeak && fighter.statuses.weak > 0) dmg = Math.floor(dmg * 0.75);
        if (!opts.ignoreVulnerable && target.statuses.vulnerable > 0) dmg = Math.floor(dmg * 1.5);
        dmg = Math.max(0, dmg);
        let remaining = dmg;
        if (target.block > 0) {
          const absorbed = Math.min(target.block, remaining);
          target.block -= absorbed;
          remaining -= absorbed;
        }
        target.hp -= remaining;
        opponent.hp = target.hp;
        opponent.block = target.block;
        self.log(`⚔️ ${fighter.name} 对 ${opponent.name} 造成 ${dmg} 点伤害${dmg - remaining > 0 ? `（格挡吸收 ${dmg - remaining}）` : ''}`, fighter.side === 'A' ? 'player' : 'enemy');
        // Venom
        if (dmg > 0 && fighter.statuses.venom > 0 && target.hp > 0) {
          target.statuses.poison += fighter.statuses.venom;
          opponent.statuses.poison = target.statuses.poison;
        }
        return remaining;
      },

      gainBlockPlayer(amount) {
        const dex = fighter.statuses.dexterity || 0;
        let final = amount + dex;
        if (fighter.statuses.frail > 0) final = Math.floor(final * 0.75);
        final = Math.max(0, final);
        fighter.block += final;
        shim.player.block = fighter.block;
        self.log(`🛡️ ${fighter.name} 获得 ${final} 点格挡`, fighter.side === 'A' ? 'player' : 'enemy');
      },

      damagePlayerDirect(amount) {
        fighter.hp -= amount;
        if (self._checkDeath(fighter, opponent)) return;
      },

      healPlayer(amount) {
        fighter.hp = Math.min(fighter.maxHp, fighter.hp + amount);
        self.log(`💚 ${fighter.name} 回复 ${amount} 点生命`, 'info');
      },

      applyStatusPlayer(name, amount) {
        if (fighter.statuses[name] !== undefined) {
          fighter.statuses[name] += amount;
        }
      },

      applyStatusEnemy(enemyId, name, amount, opts = {}) {
        const target = shim.enemies.find(e => e.id === enemyId);
        if (!target) return;
        if (target.statuses[name] !== undefined) {
          target.statuses[name] += amount;
          opponent.statuses[name] = target.statuses[name];
        }
      },

      drawCards(n) { self._drawCards(fighter, n); },

      discardRandomFromHand(n) {
        for (let i = 0; i < n && fighter.hand.length > 0; i++) {
          const idx = Math.floor(Math.random() * fighter.hand.length);
          const c = fighter.hand.splice(idx, 1)[0];
          fighter.discardPile.push(c);
        }
      },

      getCardCost(card) { return self._getCardCost(fighter, card); },

      checkVictory() {},

      runRelicHook() {},

      onCardExhausted() {},

      // Stub for cards that check these
      angerPlayedCount: 0,
      damageEvents: [],
      turnDamageDealt: 0,
      turnBlockGained: 0,
    };
    return shim;
  }

  /**
   * Simple AI: play cards in priority order until out of energy or no playable cards.
   * Priority: Power cards > Attack cards (if can kill) > Block cards > Attack cards > Skills
   */
  _aiPlayTurn(fighter, opponent) {
    let played = true;
    while (played && !this.finished) {
      played = false;
      const playable = fighter.hand.filter(c => {
        const def = CARDS[c.defId];
        if (!def) return false;
        if (def.type === 'status' || def.type === 'curse') return false;
        return fighter.energy >= this._getCardCost(fighter, c);
      });
      if (playable.length === 0) break;

      // Sort: power > attack > skill, then by cost descending (play expensive first)
      const typePriority = { power: 0, attack: 1, skill: 2 };
      playable.sort((a, b) => {
        const da = CARDS[a.defId], db = CARDS[b.defId];
        const pa = typePriority[da.type] || 3;
        const pb = typePriority[db.type] || 3;
        if (pa !== pb) return pa - pb;
        return this._getCardCost(fighter, b) - this._getCardCost(fighter, a);
      });

      const card = playable[0];
      this._playCard(fighter, opponent, card);
      played = true;
    }

    // End turn
    this._endTurn(fighter, opponent);
  }

  _endTurn(fighter, opponent) {
    if (this.finished) return;

    // Metallicize
    if (fighter.statuses.metallicize > 0) {
      this._createCombatShim(fighter, opponent).gainBlockPlayer(fighter.statuses.metallicize);
    }

    // Decrement statuses
    fighter.statuses.weak = Math.max(0, fighter.statuses.weak - 1);
    fighter.statuses.vulnerable = Math.max(0, fighter.statuses.vulnerable - 1);
    fighter.statuses.frail = Math.max(0, fighter.statuses.frail - 1);

    // Discard hand
    fighter.discardPile.push(...fighter.hand);
    fighter.hand = [];

    if (this.finished) return;

    // Switch turns
    this._startTurn(opponent, fighter);
  }

  _checkDeath(fighter, killer) {
    if (this.finished) return true;
    if (fighter.hp <= 0) {
      fighter.hp = 0;
      this.finished = true;
      this.winner = killer.side === 'A' ? 'attacker' : 'defender';
      this.winnerName = killer.name;
      this.log(`💀 ${fighter.name} 倒下了！${killer.name} 获胜！`, 'info');
      return true;
    }
    return false;
  }

  _endByTimeout() {
    this.finished = true;
    // Higher HP wins; tie goes to attacker
    if (this.fighterA.hp >= this.fighterB.hp) {
      this.winner = 'attacker';
      this.winnerName = this.fighterA.name;
    } else {
      this.winner = 'defender';
      this.winnerName = this.fighterB.name;
    }
    this.log(`⏰ 回合上限！${this.winnerName} 以剩余生命优势获胜！`, 'info');
  }

  /** Run the full battle automatically and return the result. */
  simulate() {
    this.start();
    return {
      winner: this.winner,
      winnerName: this.winnerName,
      log: this.log_,
      turns: this.turnCount,
    };
  }
}
