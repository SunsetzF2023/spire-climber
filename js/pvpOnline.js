// ============================================================
// Online PVP — real-time card battles via Supabase Realtime.
//
// Flow:
//   1. Host creates room (selects deck from history) → gets room code
//   2. Guest enters room code → joins room
//   3. Both players connect to a Supabase Realtime channel
//   4. Host runs authoritative game logic, broadcasts state after each action
//   5. Guest sends actions (play_card / end_turn) via channel
//   6. Host processes, broadcasts new state
//   7. Game ends when one fighter's HP reaches 0
// ============================================================

// ─── Room management (Supabase table) ───

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function pvpGetPlayerName() {
  if (!cloudUser) return '匿名玩家';
  if (cloudUser.is_anonymous) return `游客#${cloudUser.id.substring(0, 6)}`;
  return (cloudUser.user_metadata && (cloudUser.user_metadata.user_name || cloudUser.user_metadata.full_name)) || '匿名玩家';
}

function pvpGetUserId() {
  return cloudUser ? cloudUser.id : 'anon-' + Date.now();
}

async function pvpCreateRoom(deckData) {
  const roomCode = generateRoomCode();
  const { error } = await supabaseClient
    .from('pvp_rooms')
    .insert({
      room_code: roomCode,
      host_id: pvpGetUserId(),
      host_name: pvpGetPlayerName(),
      host_deck: deckData,
      status: 'waiting',
    });
  if (error) { console.error('[pvp-online] create room:', error.message); return null; }
  return roomCode;
}

async function pvpJoinRoom(roomCode, deckData) {
  const { data, error } = await supabaseClient
    .from('pvp_rooms')
    .select('*')
    .eq('room_code', roomCode.toUpperCase())
    .maybeSingle();
  if (error || !data) { console.error('[pvp-online] join room:', error ? error.message : 'room not found'); return null; }
  if (data.status !== 'waiting') return { error: '房间已满或已结束' };
  if (data.host_id === pvpGetUserId()) return { error: '不能加入自己的房间' };

  const { error: updateError } = await supabaseClient
    .from('pvp_rooms')
    .update({
      guest_id: pvpGetUserId(),
      guest_name: pvpGetPlayerName(),
      guest_deck: deckData,
      status: 'battling',
    })
    .eq('room_code', roomCode.toUpperCase())
    .eq('status', 'waiting'); // optimistic: only update if still waiting

  if (updateError) { console.error('[pvp-online] join update:', updateError.message); return null; }
  return data;
}

async function pvpLeaveRoom(roomCode) {
  const userId = pvpGetUserId();
  const { data } = await supabaseClient
    .from('pvp_rooms')
    .select('host_id, status')
    .eq('room_code', roomCode)
    .maybeSingle();
  if (!data) return;
  if (data.host_id === userId) {
    // Host leaves → delete room
    await supabaseClient.from('pvp_rooms').delete().eq('room_code', roomCode);
  } else {
    // Guest leaves → set status to finished
    await supabaseClient.from('pvp_rooms').update({ status: 'finished' }).eq('room_code', roomCode);
  }
}

async function pvpFinishRoom(roomCode, winnerName) {
  await supabaseClient
    .from('pvp_rooms')
    .update({ status: 'finished', winner: winnerName })
    .eq('room_code', roomCode);
}

// ─── Online PVP Battle Engine (host-authoritative) ───

class OnlinePvpEngine {
  /**
   * @param {object} hostDeck - { name, maxHp, deckIds, relicIds }
   * @param {object} guestDeck - { name, maxHp, deckIds, relicIds }
   * @param {boolean} isHost - whether this client is the host
   */
  constructor(hostDeck, guestDeck, isHost) {
    this.isHost = isHost;
    this.hostDeck = hostDeck;
    this.guestDeck = guestDeck;
    this.log_ = [];
    this.finished = false;
    this.winner = null;
    this.winnerName = null;
    this.turnCount = 0;
    this.MAX_TURNS = 50;

    // Build fighters
    this.host = this._buildFighter(hostDeck, 'host');
    this.guest = this._buildFighter(guestDeck, 'guest');

    // Host goes first
    this.activeSide = 'host';
    this.host.energy = 3;
    this._drawCards(this.host, 5);
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

  get activeFighter() { return this.activeSide === 'host' ? this.host : this.guest; }
  get inactiveFighter() { return this.activeSide === 'host' ? this.guest : this.host; }

  log(text, cls) { this.log_.push({ text, cls: cls || 'info' }); }

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

  /**
   * Play a card. Called by host when host plays, or when guest sends action.
   * @param {string} side - 'host' or 'guest'
   * @param {string} cardUid - uid of the card in hand
   */
  playCard(side, cardUid) {
    if (this.finished) return { success: false, reason: 'finished' };
    if (this.activeSide !== side) return { success: false, reason: 'not-your-turn' };

    const fighter = side === 'host' ? this.host : this.guest;
    const opponent = side === 'host' ? this.guest : this.host;

    const idx = fighter.hand.findIndex(c => c.uid === cardUid);
    if (idx === -1) return { success: false, reason: 'not-in-hand' };

    const card = fighter.hand[idx];
    const def = CARDS[card.defId];
    if (!def) return { success: false, reason: 'unknown-card' };
    if (def.type === 'status' || def.type === 'curse') return { success: false, reason: 'unplayable' };

    const cost = this._getCardCost(fighter, card);
    if (fighter.energy < cost) return { success: false, reason: 'no-energy' };

    fighter.energy -= cost;
    fighter.hand.splice(idx, 1);

    const vars = def.vars(card.upgraded);
    const ctx = {
      combat: this._createCombatShim(fighter, opponent),
      target: { id: 'opp', hp: opponent.hp, maxHp: opponent.maxHp, block: opponent.block, statuses: opponent.statuses, name: opponent.name },
      card,
      vars,
    };

    try { def.effect(ctx); } catch (e) { /* card references unsupported mechanic, skip */ }

    this.log(`🎴 ${fighter.name} 打出【${def.name}${card.upgraded ? '+' : ''}】`, side === 'host' ? 'host' : 'guest');

    if (def.exhaust || def.type === 'power') {
      fighter.exhaustPile.push(card);
    } else {
      fighter.discardPile.push(card);
    }

    this._checkDeath();
    return { success: true };
  }

  endTurn(side) {
    if (this.finished) return { success: false };
    if (this.activeSide !== side) return { success: false, reason: 'not-your-turn' };

    const fighter = this.activeFighter;
    const opponent = this.inactiveFighter;

    // Metallicize
    if (fighter.statuses.metallicize > 0) {
      fighter.block += fighter.statuses.metallicize;
      this.log(`🔩 ${fighter.name} 金属化：获得 ${fighter.statuses.metallicize} 格挡`, 'info');
    }

    // Decrement statuses
    fighter.statuses.weak = Math.max(0, fighter.statuses.weak - 1);
    fighter.statuses.vulnerable = Math.max(0, fighter.statuses.vulnerable - 1);
    fighter.statuses.frail = Math.max(0, fighter.statuses.frail - 1);

    // Discard hand
    fighter.discardPile.push(...fighter.hand);
    fighter.hand = [];

    this.log(`⏭️ ${fighter.name} 结束回合`, 'info');
    if (this.finished) return { success: true };

    // Start opponent's turn
    this._startTurn(opponent, fighter);
    return { success: true };
  }

  _startTurn(fighter, opponent) {
    this.turnCount++;
    if (this.turnCount > this.MAX_TURNS) {
      this._endByTimeout();
      return;
    }
    this.activeSide = fighter.side;

    // Block reset
    if (!(fighter.statuses.barricade > 0)) fighter.block = 0;

    // Poison tick
    if (fighter.statuses.poison > 0) {
      fighter.hp -= fighter.statuses.poison;
      this.log(`☠️ ${fighter.name} 中毒发作，损失 ${fighter.statuses.poison} 点生命`, 'enemy');
      fighter.statuses.poison -= 1;
      if (this._checkDeath()) return;
    }

    // Energy
    fighter.energy = fighter.energyMax;

    // Draw 5
    this._drawCards(fighter, 5);

    this.log(`▶️ ${fighter.name} 的回合开始`, 'info');
  }

  _checkDeath() {
    if (this.finished) return true;
    if (this.host.hp <= 0) {
      this.host.hp = 0;
      this.finished = true;
      this.winner = 'guest';
      this.winnerName = this.guest.name;
      this.log(`💀 ${this.host.name} 倒下了！${this.guest.name} 获胜！`, 'info');
      return true;
    }
    if (this.guest.hp <= 0) {
      this.guest.hp = 0;
      this.finished = true;
      this.winner = 'host';
      this.winnerName = this.host.name;
      this.log(`💀 ${this.guest.name} 倒下了！${this.host.name} 获胜！`, 'info');
      return true;
    }
    return false;
  }

  _endByTimeout() {
    this.finished = true;
    if (this.host.hp >= this.guest.hp) {
      this.winner = 'host';
      this.winnerName = this.host.name;
    } else {
      this.winner = 'guest';
      this.winnerName = this.guest.name;
    }
    this.log(`⏰ 回合上限！${this.winnerName} 以剩余生命优势获胜！`, 'info');
  }

  /**
   * Create a shim that mimics CombatEngine for card effects.
   * Maps player → fighter, enemies → [opponent]
   */
  _createCombatShim(fighter, opponent) {
    const self = this;
    return {
      player: { statuses: fighter.statuses, block: fighter.block },
      enemies: [{
        id: 'opp',
        hp: opponent.hp,
        maxHp: opponent.maxHp,
        block: opponent.block,
        statuses: opponent.statuses,
        name: opponent.name,
      }],
      finished: false,
      currentActor: fighter.side === 'host' ? 'player' : 'enemy',
      turnCount: self.turnCount,
      hand: fighter.hand,
      drawPile: fighter.drawPile,
      discardPile: fighter.discardPile,
      exhaustPile: fighter.exhaustPile,
      angerPlayedCount: 0,
      damageImmune: false,
      entangledUids: [],
      chaosCostMap: null,
      bonusDrawNext: 0,
      bonusBlockNext: 0,
      run: { relics: [] },
      log(text, cls) { self.log(text, cls); },

      dealDamageToEnemy(enemyId, baseAmount, opts = {}) {
        const target = self._createCombatShim(fighter, opponent).enemies[0];
        let dmg = baseAmount + (opts.noStrength ? 0 : (fighter.statuses.strength || 0));
        if (!opts.ignoreWeak && fighter.statuses.weak > 0) dmg = Math.floor(dmg * 0.75);
        if (!opts.ignoreVulnerable && opponent.statuses.vulnerable > 0) dmg = Math.floor(dmg * 1.5);
        dmg = Math.max(0, dmg);
        let remaining = dmg;
        if (opponent.block > 0) {
          const absorbed = Math.min(opponent.block, remaining);
          opponent.block -= absorbed;
          remaining -= absorbed;
        }
        opponent.hp -= remaining;
        self.log(`⚔️ ${fighter.name} 对 ${opponent.name} 造成 ${dmg} 点伤害${dmg - remaining > 0 ? `（格挡吸收 ${dmg - remaining}）` : ''}`, fighter.side === 'host' ? 'host' : 'guest');
        if (dmg > 0 && fighter.statuses.venom > 0 && opponent.hp > 0) {
          opponent.statuses.poison += fighter.statuses.venom;
        }
        return remaining;
      },

      gainBlockPlayer(amount) {
        const dex = fighter.statuses.dexterity || 0;
        let final = amount + dex;
        if (fighter.statuses.frail > 0) final = Math.floor(final * 0.75);
        final = Math.max(0, final);
        fighter.block += final;
        self.log(`🛡️ ${fighter.name} 获得 ${final} 点格挡`, fighter.side === 'host' ? 'host' : 'guest');
      },

      doubleBlockPlayer() {
        fighter.block *= 2;
        self.log(`💪 ${fighter.name} 格挡翻倍！`, 'info');
      },

      damagePlayerDirect(amount) {
        fighter.hp -= amount;
        self._checkDeath();
      },

      healPlayer(amount) {
        fighter.hp = Math.min(fighter.maxHp, fighter.hp + amount);
        self.log(`💚 ${fighter.name} 回复 ${amount} 点生命`, 'info');
      },

      applyStatusPlayer(name, amount) {
        if (fighter.statuses[name] !== undefined) fighter.statuses[name] += amount;
      },

      applyStatusEnemy(enemyId, name, amount, opts = {}) {
        if (opponent.statuses[name] !== undefined) opponent.statuses[name] += amount;
      },

      drawCards(n) { self._drawCards(fighter, n); },

      gainEnergy(n) { fighter.energy += n; },

      discardRandomFromHand(n = 1) {
        for (let i = 0; i < n && fighter.hand.length > 0; i++) {
          const idx2 = Math.floor(Math.random() * fighter.hand.length);
          const c = fighter.hand.splice(idx2, 1)[0];
          fighter.discardPile.push(c);
        }
      },

      addCardToDiscard(defId, upgraded) {
        fighter.discardPile.push({ uid: 'pvpadd' + Math.random().toString(36).slice(2), defId, upgraded });
      },

      exhaustCardByUid(uid) {
        const idx2 = fighter.hand.findIndex(c => c.uid === uid);
        if (idx2 === -1) return;
        const [card] = fighter.hand.splice(idx2, 1);
        fighter.exhaustPile.push(card);
        if (fighter.statuses.darkEmbrace > 0) self._drawCards(fighter, fighter.statuses.darkEmbrace);
        if (fighter.statuses.feelNoPain > 0) {
          fighter.block += fighter.statuses.feelNoPain;
        }
      },

      onCardExhausted() {
        if (fighter.statuses.darkEmbrace > 0) self._drawCards(fighter, fighter.statuses.darkEmbrace);
        if (fighter.statuses.feelNoPain > 0) fighter.block += fighter.statuses.feelNoPain;
      },

      getCardCost(card) { return self._getCardCost(fighter, card); },
      checkVictory() {},
      runRelicHook() {},
    };
  }

  /**
   * Serialize game state for a specific viewer.
   * Hides opponent's hand contents (only shows count).
   * @param {string} viewerSide - 'host' or 'guest'
   */
  serializeForView(viewerSide) {
    const serializeFighter = (f, isOwn) => ({
      name: f.name,
      hp: f.hp,
      maxHp: f.maxHp,
      block: f.block,
      energy: f.energy,
      energyMax: f.energyMax,
      statuses: { ...f.statuses },
      hand: isOwn ? f.hand.map(c => ({ uid: c.uid, defId: c.defId, upgraded: c.upgraded })) : f.hand.length,
      handCount: f.hand.length,
      drawCount: f.drawPile.length,
      discardCount: f.discardPile.length,
      exhaustCount: f.exhaustPile.length,
    });

    return {
      turnCount: this.turnCount,
      activeSide: this.activeSide,
      finished: this.finished,
      winner: this.winner,
      winnerName: this.winnerName,
      host: serializeFighter(this.host, viewerSide === 'host'),
      guest: serializeFighter(this.guest, viewerSide === 'guest'),
      log: this.log_.slice(-20), // last 20 log entries
    };
  }
}

// ─── Real-time room controller ───

class PvpRoomController {
  constructor() {
    this.engine = null;
    this.channel = null;
    this.roomCode = null;
    this.isHost = false;
    this.mySide = null;
    this.onStateUpdate = null; // callback(state)
    this.onLogUpdate = null;   // callback(logEntries)
    this.onOpponentJoined = null;
    this.onOpponentLeft = null;
    this.onGameEnd = null;
    this._lastLogLen = 0;
  }

  /**
   * Host: start hosting a room and wait for guest.
   */
  async hostRoom(roomCode, hostDeck, guestDeck) {
    this.roomCode = roomCode;
    this.isHost = true;
    this.mySide = 'host';

    // Create engine (will start when guest joins)
    this.engine = new OnlinePvpEngine(hostDeck, guestDeck, true);

    // Subscribe to realtime channel
    this.channel = supabaseClient.channel('pvp-' + roomCode, {
      config: { broadcast: { self: false } },
    });

    this.channel.on('broadcast', { event: 'action' }, ({ payload }) => {
      this._handleAction(payload);
    });

    this.channel.on('broadcast', { event: 'join' }, ({ payload }) => {
      if (this.onOpponentJoined) this.onOpponentJoined(payload);
    });

    this.channel.on('broadcast', { event: 'leave' }, () => {
      if (this.onOpponentLeft) this.onOpponentLeft();
    });

    await this.channel.subscribe();
  }

  /**
   * Guest: join a room and connect to the host's channel.
   */
  async joinRoom(roomCode, hostDeck, guestDeck) {
    this.roomCode = roomCode;
    this.isHost = false;
    this.mySide = 'guest';

    // Guest doesn't run the engine — host is authoritative
    // But we need deck info for rendering
    this.hostDeckData = hostDeck;
    this.guestDeckData = guestDeck;

    this.channel = supabaseClient.channel('pvp-' + roomCode, {
      config: { broadcast: { self: false } },
    });

    this.channel.on('broadcast', { event: 'state' }, ({ payload }) => {
      if (this.onStateUpdate) this.onStateUpdate(payload);
    });

    this.channel.on('broadcast', { event: 'leave' }, () => {
      if (this.onOpponentLeft) this.onOpponentLeft();
    });

    await this.channel.subscribe();

    // Notify host that we joined
    this.channel.send({
      type: 'broadcast',
      event: 'join',
      payload: { name: pvpGetPlayerName() },
    });
  }

  /**
   * Send an action (play_card or end_turn) to the host.
   * Only guests use this — host processes locally.
   */
  sendAction(action) {
    if (this.isHost) return; // host processes locally
    if (!this.channel) return;
    this.channel.send({
      type: 'broadcast',
      event: 'action',
      payload: action,
    });
  }

  /**
   * Host: process incoming action from guest, then broadcast state.
   */
  _handleAction(payload) {
    if (!this.isHost || !this.engine) return;
    if (payload.type === 'play_card') {
      this.engine.playCard('guest', payload.cardUid);
    } else if (payload.type === 'end_turn') {
      this.engine.endTurn('guest');
    }
    this._broadcastState();
  }

  /**
   * Host: play a card locally and broadcast state.
   */
  hostPlayCard(cardUid) {
    if (!this.isHost || !this.engine) return;
    this.engine.playCard('host', cardUid);
    this._broadcastState();
  }

  /**
   * Host: end turn locally and broadcast state.
   */
  hostEndTurn() {
    if (!this.isHost || !this.engine) return;
    this.engine.endTurn('host');
    this._broadcastState();
  }

  /**
   * Host: broadcast current game state to guest.
   */
  _broadcastState() {
    if (!this.isHost || !this.channel) return;
    const state = this.engine.serializeForView('guest');
    this.channel.send({
      type: 'broadcast',
      event: 'state',
      payload: state,
    });
    // Also update host's own UI
    if (this.onStateUpdate) {
      this.onStateUpdate(this.engine.serializeForView('host'));
    }
    if (this.engine.finished && this.onGameEnd) {
      this.onGameEnd(this.engine.winnerName);
    }
  }

  /**
   * Host: start the game (called after guest joins).
   */
  startGame() {
    if (!this.isHost || !this.engine) return;
    this.engine._startTurn(this.engine.host, this.engine.guest);
    this._broadcastState();
  }

  /**
   * Get current state for this client's view.
   */
  getMyState() {
    if (!this.engine) return null;
    return this.engine.serializeForView(this.mySide);
  }

  /**
   * Leave the room and clean up.
   */
  async leave() {
    if (this.channel) {
      this.channel.send({ type: 'broadcast', event: 'leave', payload: {} });
      await supabaseClient.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.roomCode) {
      await pvpLeaveRoom(this.roomCode);
    }
    this.engine = null;
    this.roomCode = null;
  }
}
