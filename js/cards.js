// ============================================================
// Card definitions
// def: { id, name, icon, type: attack|skill|power, cost, target: enemy|all_enemies|self|none,
//        rarity: starter|common|uncommon|rare, cls: neutral|warrior|huntress, exhaust?,
//        vars(upgraded) => {...}, descTemplate(vars) => string, effect(ctx) }
// ctx passed to effect(): { combat, self (player state), target (enemy obj or null), card (instance) }
// cls 'neutral' cards (colorless) are available to every character's reward/shop pools;
// 'warrior'/'huntress' cards only appear in that character's own pools.
// ============================================================

const CARDS = {
  // ---------------- Neutral basics (shared starters) ----------------
  strike: {
    id: 'strike', name: '打击', icon: '⚔️', type: 'attack', cost: 1, target: 'enemy', rarity: 'starter', cls: 'neutral',
    vars(up) { return { dmg: up ? 9 : 6 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害`; },
    effect(ctx) { ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '打击' }); },
  },
  defend: {
    id: 'defend', name: '防御', icon: '🛡️', type: 'skill', cost: 1, target: 'self', rarity: 'starter', cls: 'neutral',
    vars(up) { return { block: up ? 8 : 5 }; },
    descTemplate(v) { return `获得 ${v.block} 点格挡`; },
    effect(ctx) { ctx.combat.gainBlockPlayer(ctx.vars.block); },
  },

  // ---------------- Neutral (colorless) pool ----------------
  bandage_up: {
    id: 'bandage_up', name: '包扎', icon: '🩹', type: 'skill', cost: 0, target: 'none', rarity: 'common', cls: 'neutral', exhaust: true, removeFromDeck: true,
    vars(up) { return { heal: up ? 8 : 5 }; },
    descTemplate(v) { return `回复 ${v.heal} 点生命（移除）`; },
    effect(ctx) { ctx.combat.healPlayer(ctx.vars.heal); },
  },
  purify: {
    id: 'purify', name: '净化', icon: '🌿', type: 'skill', cost: 1, target: 'self', rarity: 'uncommon', cls: 'neutral', exhaust: true,
    vars(up) { return { heal: up ? 6 : 4, cost: up ? 0 : 1 }; },
    upgradedCost: 0,
    descTemplate(v) { return `移除所有负面状态（虚弱、易伤、脆弱、中毒、封印、缠绕、混乱），回复 ${v.heal} 点生命。消耗`; },
    effect(ctx) {
      const s = ctx.combat.player.statuses;
      let removed = 0;
      ['weak', 'vulnerable', 'frail', 'poison', 'cardLock', 'entangle', 'chaos'].forEach(stat => {
        if (s[stat] > 0) { s[stat] = 0; removed++; }
      });
      ctx.combat.entangledUids = [];
      if (ctx.combat.chaosCostMap) ctx.combat.chaosCostMap.clear();
      ctx.combat.log(`🌿 净化：移除了 ${removed} 种负面状态`, 'player');
      ctx.combat.healPlayer(ctx.vars.heal);
    },
  },
  flash_strike: {
    id: 'flash_strike', name: '闪击', icon: '✨', type: 'attack', cost: 1, target: 'enemy', rarity: 'common', cls: 'neutral',
    vars(up) { return { dmg: up ? 9 : 6 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害`; },
    effect(ctx) { ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '闪击' }); },
  },
  iron_arm: {
    id: 'iron_arm', name: '铁臂', icon: '🦾', type: 'skill', cost: 2, target: 'self', rarity: 'uncommon', cls: 'neutral', exhaust: true,
    vars(up) { return { block: up ? 17 : 13 }; },
    descTemplate(v) { return `获得 ${v.block} 点格挡（消耗）`; },
    effect(ctx) { ctx.combat.gainBlockPlayer(ctx.vars.block); },
  },
  swift_focus: {
    id: 'swift_focus', name: '专注', icon: '🎯', type: 'power', cost: 2, target: 'none', rarity: 'uncommon', cls: 'neutral',
    vars(up) { return { dex: up ? 3 : 2 }; },
    upgradedCost: 1,
    descTemplate(v) { return `永久获得 ${v.dex} 点敏捷（本场战斗）`; },
    effect(ctx) { ctx.combat.applyStatusPlayer('dexterity', ctx.vars.dex); },
  },
  apex_form: {
    id: 'apex_form', name: '巅峰形态', icon: '🌟', type: 'power', cost: 3, target: 'none', rarity: 'rare', cls: 'neutral',
    vars(up) { return { str: up ? 3 : 2, dex: up ? 2 : 1 }; },
    upgradedCost: 2,
    descTemplate(v) { return `永久获得 ${v.str} 点力量和 ${v.dex} 点敏捷（本场战斗）`; },
    effect(ctx) { ctx.combat.applyStatusPlayer('strength', ctx.vars.str); ctx.combat.applyStatusPlayer('dexterity', ctx.vars.dex); },
  },

  // ================= 战士（Warrior）=================
  heavy_slam: {
    id: 'heavy_slam', name: '重锤', icon: '🔨', type: 'attack', cost: 2, target: 'enemy', rarity: 'starter', cls: 'warrior',
    vars(up) { return { dmg: up ? 12 : 8, vuln: up ? 3 : 2 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害，施加 ${v.vuln} 层易伤`; },
    effect(ctx) {
      ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '重锤' });
      ctx.combat.applyStatusEnemy(ctx.target.id, 'vulnerable', ctx.vars.vuln);
    },
  },

  // ---------------- Warrior common ----------------
  cleave: {
    id: 'cleave', name: '横扫', icon: '🌀', type: 'attack', cost: 2, target: 'all_enemies', rarity: 'common', cls: 'warrior',
    vars(up) { return { dmg: up ? 12 : 8 }; },
    descTemplate(v) { return `对所有敌人造成 ${v.dmg} 点伤害`; },
    effect(ctx) { ctx.combat.enemies.forEach(e => { if (e.hp > 0) ctx.combat.dealDamageToEnemy(e.id, ctx.vars.dmg, { source: '横扫', isAoE: true }); }); },
  },
  iron_wave: {
    id: 'iron_wave', name: '铁浪', icon: '🌊', type: 'attack', cost: 1, target: 'enemy', rarity: 'common', cls: 'warrior',
    vars(up) { return { amt: up ? 7 : 5 }; },
    descTemplate(v) { return `造成 ${v.amt} 点伤害，获得 ${v.amt} 点格挡`; },
    effect(ctx) {
      ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.amt, { source: '铁浪' });
      ctx.combat.gainBlockPlayer(ctx.vars.amt);
    },
  },
  twin_strike: {
    id: 'twin_strike', name: '连击', icon: '🗡️', type: 'attack', cost: 1, target: 'enemy', rarity: 'common', cls: 'warrior',
    vars(up) { return { dmg: 2, hits: up ? 6 : 3 }; },
    descTemplate(v) { return `造成 ${v.hits} 次 ${v.dmg} 点伤害`; },
    effect(ctx) {
      for (let i = 0; i < ctx.vars.hits; i++) {
        ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '连击' });
      }
    },
  },
  pommel_strike: {
    id: 'pommel_strike', name: '柄击', icon: '🥊', type: 'attack', cost: 1, target: 'enemy', rarity: 'common', cls: 'warrior',
    vars(up) { return { dmg: up ? 12 : 9, draw: up ? 2 : 1 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害，抽 ${v.draw} 张牌`; },
    effect(ctx) {
      ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '柄击' });
      ctx.combat.drawCards(ctx.vars.draw);
    },
  },
  thunderclap: {
    id: 'thunderclap', name: '雷鸣', icon: '⚡', type: 'attack', cost: 1, target: 'all_enemies', rarity: 'common', cls: 'warrior',
    vars(up) { return { dmg: up ? 6 : 4, vuln: 1 }; },
    descTemplate(v) { return `对所有敌人造成 ${v.dmg} 点伤害并施加 ${v.vuln} 层易伤`; },
    effect(ctx) {
      ctx.combat.enemies.forEach(e => {
        if (e.hp <= 0) return;
        ctx.combat.dealDamageToEnemy(e.id, ctx.vars.dmg, { source: '雷鸣', isAoE: true });
        ctx.combat.applyStatusEnemy(e.id, 'vulnerable', ctx.vars.vuln);
      });
    },
  },
  shrug_it_off: {
    id: 'shrug_it_off', name: '一笑置之', icon: '😤', type: 'skill', cost: 1, target: 'self', rarity: 'common', cls: 'warrior',
    vars(up) { return { block: up ? 11 : 8, draw: 1 }; },
    descTemplate(v) { return `获得 ${v.block} 点格挡，抽 1 张牌`; },
    effect(ctx) { ctx.combat.gainBlockPlayer(ctx.vars.block); ctx.combat.drawCards(ctx.vars.draw); },
  },
  anger: {
    id: 'anger', name: '怒火', icon: '😡', type: 'attack', cost: 0, target: 'enemy', rarity: 'common', cls: 'warrior',
    vars(up) { return { dmg: 6, copies: up ? 2 : 1 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害，复制 ${v.copies} 份进弃牌堆`; },
    effect(ctx) {
      ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '怒火' });
      for (let i = 0; i < ctx.vars.copies; i++) {
        ctx.combat.addCardToDiscard('anger', ctx.card.upgraded);
      }
    },
  },
  battle_trance: {
    id: 'battle_trance', name: '战斗狂热', icon: '📖', type: 'skill', cost: 1, target: 'none', rarity: 'common', cls: 'warrior', exhaust: true,
    vars(up) { return { draw: 1, angerThreshold: 2, bonusDraw: 1, bonusEnergy: up ? 1 : 0 }; },
    descTemplate(v) { return `抽 ${v.draw} 张牌。若本场战斗打出过 ${v.angerThreshold} 张以上怒火，额外抽 ${v.bonusDraw} 张牌${v.bonusEnergy > 0 ? `，获得 ${v.bonusEnergy} 点能量` : ''}（消耗）`; },
    effect(ctx) {
      ctx.combat.drawCards(ctx.vars.draw);
      const angerCount = ctx.combat.angerPlayedCount;
      const bonus = Math.floor(angerCount / ctx.vars.angerThreshold);
      if (bonus > 0) {
        ctx.combat.drawCards(bonus * ctx.vars.bonusDraw);
        if (ctx.vars.bonusEnergy > 0) ctx.combat.gainEnergy(bonus * ctx.vars.bonusEnergy);
        ctx.combat.log(`📖 战斗狂热：打出过 ${angerCount} 张怒火，额外抽 ${bonus * ctx.vars.bonusDraw} 张牌${ctx.vars.bonusEnergy > 0 ? `，获得 ${bonus * ctx.vars.bonusEnergy} 点能量` : ''}`, 'player');
      }
    },
  },

  // ---------------- Warrior uncommon ----------------
  uppercut: {
    id: 'uppercut', name: '上勾拳', icon: '🥊', type: 'attack', cost: 2, target: 'enemy', rarity: 'uncommon', cls: 'warrior',
    vars(up) { return { dmg: up ? 17 : 13, weak: up ? 2 : 1, vuln: up ? 2 : 1 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害，施加 ${v.weak} 层虚弱和 ${v.vuln} 层易伤`; },
    effect(ctx) {
      ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '上勾拳' });
      ctx.combat.applyStatusEnemy(ctx.target.id, 'weak', ctx.vars.weak);
      ctx.combat.applyStatusEnemy(ctx.target.id, 'vulnerable', ctx.vars.vuln);
    },
  },
  whirlwind: {
    id: 'whirlwind', name: '旋风斩', icon: '🌪️', type: 'attack', cost: 2, target: 'all_enemies', rarity: 'uncommon', cls: 'warrior',
    vars(up) { return { dmg: up ? 5 : 3, hits: up ? 6 : 4 }; },
    descTemplate(v) { return `对所有敌人造成 ${v.hits} 次 ${v.dmg} 点伤害`; },
    effect(ctx) {
      for (let i = 0; i < ctx.vars.hits; i++) {
        ctx.combat.enemies.forEach(e => { if (e.hp > 0) ctx.combat.dealDamageToEnemy(e.id, ctx.vars.dmg, { source: '旋风斩', isAoE: true }); });
      }
    },
  },
  bloodletting: {
    id: 'bloodletting', name: '放血', icon: '🩸', type: 'skill', cost: 1, target: 'none', rarity: 'uncommon', cls: 'warrior',
    vars(up) { return { hpCost: up ? 2 : 3, energy: up ? 3 : 2 }; },
    upgradedCost: 0,
    descTemplate(v) { return `失去 ${v.hpCost} 点生命，获得 ${v.energy} 点能量`; },
    effect(ctx) { ctx.combat.damagePlayerDirect(ctx.vars.hpCost); ctx.combat.gainEnergy(ctx.vars.energy); },
  },
  second_wind: {
    id: 'second_wind', name: '喘息之机', icon: '🌬️', type: 'skill', cost: 1, target: 'none', rarity: 'uncommon', cls: 'warrior',
    vars(up) { return { blockEach: up ? 7 : 5 }; },
    descTemplate(v) { return `消耗手牌中所有非攻击牌，每张获得 ${v.blockEach} 点格挡`; },
    effect(ctx) {
      const nonAttacks = ctx.combat.hand.filter(c => c.uid !== ctx.card.uid && CARDS[c.defId].type !== 'attack');
      nonAttacks.forEach(c => {
        ctx.combat.exhaustCardByUid(c.uid);
        ctx.combat.gainBlockPlayer(ctx.vars.blockEach);
      });
    },
  },
  inflame: {
    id: 'inflame', name: '战意', icon: '🔥', type: 'power', cost: 2, target: 'none', rarity: 'uncommon', cls: 'warrior',
    vars(up) { return { str: up ? 3 : 2 }; },
    upgradedCost: 1,
    descTemplate(v) { return `永久获得 ${v.str} 点力量（本场战斗）`; },
    effect(ctx) { ctx.combat.applyStatusPlayer('strength', ctx.vars.str); },
  },
  rampage: {
    id: 'rampage', name: '狂暴打击', icon: '🐗', type: 'attack', cost: 1, target: 'enemy', rarity: 'uncommon', cls: 'warrior',
    vars(up) { return { dmg: up ? 9 : 6, growth: up ? 4 : 3 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害，本场战斗每次使用此牌伤害 +${v.growth}`; },
    effect(ctx) {
      const bonus = (ctx.card.rampageBonus || 0);
      ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg + bonus, { source: '狂暴打击' });
      ctx.card.rampageBonus = bonus + ctx.vars.growth;
    },
  },

  // ---------------- Warrior rare ----------------
  reaper: {
    id: 'reaper', name: '收割', icon: '💀', type: 'attack', cost: 2, target: 'all_enemies', rarity: 'rare', cls: 'warrior', exhaust: true,
    vars(up) { return { dmg: up ? 5 : 4 }; },
    descTemplate(v) { return `对所有敌人造成 ${v.dmg} 点伤害，回复等同造成伤害的生命（消耗）`; },
    effect(ctx) {
      let total = 0;
      ctx.combat.enemies.forEach(e => {
        if (e.hp <= 0) return;
        total += ctx.combat.dealDamageToEnemy(e.id, ctx.vars.dmg, { source: '收割', isAoE: true });
      });
      ctx.combat.healPlayer(total);
    },
  },
  immolate: {
    id: 'immolate', name: '献祭之炎', icon: '🔥', type: 'attack', cost: 3, target: 'all_enemies', rarity: 'rare', cls: 'warrior',
    vars(up) { return { dmg: up ? 22 : 16 }; },
    descTemplate(v) { return `对所有敌人造成 ${v.dmg} 点伤害`; },
    effect(ctx) { ctx.combat.enemies.forEach(e => { if (e.hp > 0) ctx.combat.dealDamageToEnemy(e.id, ctx.vars.dmg, { source: '献祭之炎', isAoE: true }); }); },
  },
  offering: {
    id: 'offering', name: '献祭', icon: '🕯️', type: 'skill', cost: 1, target: 'none', rarity: 'rare', cls: 'warrior', exhaust: true,
    vars(up) { return { hpCost: up ? 4 : 6, energy: up ? 3 : 2, draw: up ? 3 : 2 }; },
    upgradedCost: 0,
    descTemplate(v) { return `失去 ${v.hpCost} 点生命，获得 ${v.energy} 点能量，抽 ${v.draw} 张牌（消耗）`; },
    effect(ctx) {
      ctx.combat.damagePlayerDirect(ctx.vars.hpCost);
      ctx.combat.gainEnergy(ctx.vars.energy);
      ctx.combat.drawCards(ctx.vars.draw);
    },
  },
  bludgeon: {
    id: 'bludgeon', name: '重殴', icon: '🔱', type: 'attack', cost: 3, target: 'enemy', rarity: 'rare', cls: 'warrior',
    vars(up) { return { dmg: up ? 36 : 28 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点巨额伤害`; },
    effect(ctx) { ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '重殴' }); },
  },

  // ---------------- Warrior uncommon (power synergy) ----------------
  dark_embrace: {
    id: 'dark_embrace', name: '残烬回响', icon: '🖤', type: 'power', cost: 1, target: 'none', rarity: 'uncommon', cls: 'warrior',
    vars(up) { return { amt: up ? 2 : 1 }; },
    descTemplate(v) { return `永久获得 ${v.amt} 层残烬回响：此后每当你消耗一张牌，抽 ${v.amt} 张牌`; },
    effect(ctx) { ctx.combat.applyStatusPlayer('darkEmbrace', ctx.vars.amt); },
  },
  feel_no_pain: {
    id: 'feel_no_pain', name: '无惧疼痛', icon: '🦴', type: 'power', cost: 1, target: 'none', rarity: 'uncommon', cls: 'warrior',
    vars(up) { return { amt: up ? 5 : 3 }; },
    descTemplate(v) { return `永久获得无惧疼痛：此后每当你消耗一张牌，获得 ${v.amt} 点格挡`; },
    effect(ctx) { ctx.combat.applyStatusPlayer('feelNoPain', ctx.vars.amt); },
  },
  entrench: {
    id: 'entrench', name: '巩固', icon: '📐', type: 'skill', cost: 1, upgradedCost: 0, target: 'self', rarity: 'uncommon', cls: 'warrior',
    vars() { return {}; },
    descTemplate() { return `将你当前的格挡翻倍`; },
    effect(ctx) { ctx.combat.doubleBlockPlayer(); },
  },
  disarm: {
    id: 'disarm', name: '缴械', icon: '🔧', type: 'skill', cost: 1, target: 'enemy', rarity: 'common', cls: 'warrior',
    vars(up) { return { amt: up ? 3 : 2 }; },
    descTemplate(v) { return `使目标永久失去 ${v.amt} 点力量`; },
    effect(ctx) { ctx.combat.applyStatusEnemy(ctx.target.id, 'strength', -ctx.vars.amt); },
  },
  barricade: {
    id: 'barricade', name: '壁垒', icon: '🧱', type: 'power', cost: 2, upgradedCost: 1, target: 'none', rarity: 'rare', cls: 'warrior',
    vars() { return {}; },
    descTemplate() { return `永久获得壁垒：你的格挡不再在回合开始时清除`; },
    effect(ctx) { ctx.combat.applyStatusPlayer('barricade', 1); },
  },
  juggernaut: {
    id: 'juggernaut', name: '势不可当', icon: '🐘', type: 'power', cost: 2, target: 'none', rarity: 'rare', cls: 'warrior',
    vars(up) { return { amt: up ? 9 : 7 }; },
    descTemplate(v) { return `永久获得势不可当：此后每当你获得格挡，对一个随机敌人造成 ${v.amt} 点伤害`; },
    effect(ctx) { ctx.combat.applyStatusPlayer('juggernaut', ctx.vars.amt); },
  },

  // ================= 女猎手（Huntress）=================
  dagger_throw: {
    id: 'dagger_throw', name: '飞刀', icon: '🔪', type: 'attack', cost: 1, target: 'enemy', rarity: 'starter', cls: 'huntress',
    vars(up) { return { dmg: up ? 9 : 6 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害`; },
    effect(ctx) { ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '飞刀' }); },
  },
  footwork: {
    id: 'footwork', name: '脚步', icon: '🦶', type: 'skill', cost: 1, target: 'self', rarity: 'starter', cls: 'huntress',
    vars(up) { return { block: up ? 8 : 5 }; },
    descTemplate(v) { return `获得 ${v.block} 点格挡`; },
    effect(ctx) { ctx.combat.gainBlockPlayer(ctx.vars.block); },
  },
  venom_strike: {
    id: 'venom_strike', name: '毒刃突击', icon: '🗡️', type: 'attack', cost: 2, target: 'enemy', rarity: 'starter', cls: 'huntress',
    vars(up) { return { dmg: up ? 12 : 9, poison: up ? 4 : 3 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害，施加 ${v.poison} 层中毒`; },
    effect(ctx) {
      ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '毒刃突击' });
      ctx.combat.applyStatusEnemy(ctx.target.id, 'poison', ctx.vars.poison);
    },
  },

  // ---------------- Huntress common ----------------
  quick_slash: {
    id: 'quick_slash', name: '速斩', icon: '🔸', type: 'attack', cost: 0, target: 'enemy', rarity: 'common', cls: 'huntress',
    vars(up) { return { dmg: up ? 5 : 3 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害`; },
    effect(ctx) { ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '速斩' }); },
  },
  venom_dart: {
    id: 'venom_dart', name: '淬毒短镖', icon: '🎯', type: 'attack', cost: 1, target: 'enemy', rarity: 'common', cls: 'huntress',
    vars(up) { return { dmg: up ? 3 : 2, poison: up ? 4 : 3 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害，施加 ${v.poison} 层中毒`; },
    effect(ctx) {
      ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '淬毒短镖' });
      ctx.combat.applyStatusEnemy(ctx.target.id, 'poison', ctx.vars.poison);
    },
  },
  evasive_roll: {
    id: 'evasive_roll', name: '翻滚', icon: '🤸', type: 'skill', cost: 1, target: 'self', rarity: 'common', cls: 'huntress',
    vars(up) { return { block: up ? 9 : 6, draw: 1 }; },
    descTemplate(v) { return `获得 ${v.block} 点格挡，抽 ${v.draw} 张牌`; },
    effect(ctx) { ctx.combat.gainBlockPlayer(ctx.vars.block); ctx.combat.drawCards(ctx.vars.draw); },
  },
  blinding_powder: {
    id: 'blinding_powder', name: '迷雾粉尘', icon: '💨', type: 'skill', cost: 1, target: 'enemy', rarity: 'common', cls: 'huntress',
    vars(up) { return { weak: up ? 3 : 2, draw: 1 }; },
    descTemplate(v) { return `使目标获得 ${v.weak} 层虚弱，抽 ${v.draw} 张牌`; },
    effect(ctx) {
      ctx.combat.applyStatusEnemy(ctx.target.id, 'weak', ctx.vars.weak);
      ctx.combat.drawCards(ctx.vars.draw);
    },
  },

  // ---------------- Huntress uncommon ----------------
  deadly_poison: {
    id: 'deadly_poison', name: '致命毒液', icon: '🧪', type: 'skill', cost: 1, target: 'enemy', rarity: 'uncommon', cls: 'huntress',
    vars(up) { return { poison: up ? 9 : 6 }; },
    descTemplate(v) { return `使目标获得 ${v.poison} 层中毒`; },
    effect(ctx) { ctx.combat.applyStatusEnemy(ctx.target.id, 'poison', ctx.vars.poison); },
  },
  ambush: {
    id: 'ambush', name: '伏击', icon: '🌑', type: 'attack', cost: 1, target: 'enemy', rarity: 'uncommon', cls: 'huntress',
    vars(up) { return { dmg: up ? 11 : 8, bonus: up ? 9 : 7 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害；若为本场战斗第一回合，改为造成 ${v.dmg + v.bonus} 点伤害`; },
    effect(ctx) {
      const dmg = ctx.combat.turnCount === 1 ? ctx.vars.dmg + ctx.vars.bonus : ctx.vars.dmg;
      ctx.combat.dealDamageToEnemy(ctx.target.id, dmg, { source: '伏击' });
    },
  },
  nimble_strike: {
    id: 'nimble_strike', name: '轻捷突刺', icon: '🏹', type: 'attack', cost: 1, target: 'enemy', rarity: 'uncommon', cls: 'huntress',
    vars(up) { return { dmg: up ? 9 : 6, draw: 1 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害，抽 ${v.draw} 张牌`; },
    effect(ctx) {
      ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '轻捷突刺' });
      ctx.combat.drawCards(ctx.vars.draw);
    },
  },

  // ---------------- Huntress rare ----------------
  thousand_cuts: {
    id: 'thousand_cuts', name: '万剑归宗', icon: '⚔️', type: 'attack', cost: 2, target: 'all_enemies', rarity: 'rare', cls: 'huntress',
    vars(up) { return { dmg: up ? 4 : 3, hits: 5 }; },
    descTemplate(v) { return `对所有敌人造成 ${v.hits} 次 ${v.dmg} 点伤害`; },
    effect(ctx) {
      for (let i = 0; i < ctx.vars.hits; i++) {
        ctx.combat.enemies.forEach(e => { if (e.hp > 0) ctx.combat.dealDamageToEnemy(e.id, ctx.vars.dmg, { source: '万剑归宗', isAoE: true }); });
      }
    },
  },
  assassinate: {
    id: 'assassinate', name: '致命一击', icon: '🩸', type: 'attack', cost: 2, target: 'enemy', rarity: 'rare', cls: 'huntress',
    vars(up) { return { dmg: up ? 18 : 14 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害；若目标处于中毒状态，额外造成其层数 x2 的伤害并清除其中毒`; },
    effect(ctx) {
      const poisonStacks = ctx.target.statuses.poison || 0;
      let dmg = ctx.vars.dmg;
      if (poisonStacks > 0) {
        dmg += poisonStacks * 2;
        ctx.target.statuses.poison = 0;
      }
      ctx.combat.dealDamageToEnemy(ctx.target.id, dmg, { source: '致命一击' });
    },
  },
  // ---------------- Huntress (draw/poison synergy) ----------------
  acrobatics: {
    id: 'acrobatics', name: '杂技', icon: '🤹', type: 'skill', cost: 1, target: 'none', rarity: 'common', cls: 'huntress',
    vars(up) { return { draw: up ? 4 : 3 }; },
    descTemplate(v) { return `抽 ${v.draw} 张牌，然后弃 1 张牌`; },
    effect(ctx) { ctx.combat.drawCards(ctx.vars.draw); ctx.combat.discardRandomFromHand(1); },
  },
  tools_of_the_trade: {
    id: 'tools_of_the_trade', name: '必备工具', icon: '🧰', type: 'power', cost: 1, upgradedCost: 0, target: 'none', rarity: 'common', cls: 'huntress',
    vars() { return {}; },
    descTemplate() { return `永久获得必备工具：此后每回合开始时，抽 1 张牌并弃 1 张牌`; },
    effect(ctx) { ctx.combat.applyStatusPlayer('toolsOfTrade', 1); },
  },
  noxious_fumes: {
    id: 'noxious_fumes', name: '毒雾', icon: '☠️', type: 'power', cost: 1, target: 'none', rarity: 'uncommon', cls: 'huntress',
    vars(up) { return { amt: up ? 3 : 2 }; },
    descTemplate(v) { return `永久获得毒雾：此后每回合开始时，对所有敌人施加 ${v.amt} 层中毒`; },
    effect(ctx) { ctx.combat.applyStatusPlayer('noxiousFumes', ctx.vars.amt); },
  },
  well_laid_plans: {
    id: 'well_laid_plans', name: '计划妥当', icon: '📋', type: 'power', cost: 1, target: 'none', rarity: 'uncommon', cls: 'huntress',
    vars(up) { return { amt: up ? 3 : 2 }; },
    descTemplate(v) { return `永久获得计划妥当：此后回合结束时保留 ${v.amt} 张手牌，不会被弃置`; },
    effect(ctx) { ctx.combat.applyStatusPlayer('wellLaidPlans', ctx.vars.amt); },
  },
  backstab: {
    id: 'backstab', name: '背刺', icon: '🗡️', type: 'attack', cost: 0, target: 'enemy', rarity: 'rare', cls: 'huntress', exhaust: true,
    vars(up) { return { dmg: up ? 22 : 17 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害（消耗）`; },
    effect(ctx) { ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '背刺' }); },
  },

  // ================= 新增卡牌（扩展机制）==================
  // ---------------- Warrior new ----------------
  body_slam: {
    id: 'body_slam', name: '肉体冲撞', icon: '💪', type: 'attack', cost: 1, target: 'enemy', rarity: 'common', cls: 'warrior',
    vars(up) { return { multiplier: up ? 1.25 : 1.0 }; },
    descTemplate(v) { return `造成等同于你当前格挡${v.multiplier === 1.0 ? '' : ' x' + v.multiplier}的伤害`; },
    effect(ctx) {
      const dmg = Math.floor(ctx.combat.player.block * ctx.vars.multiplier);
      ctx.combat.dealDamageToEnemy(ctx.target.id, dmg, { source: '肉体冲撞', noStrength: true });
    },
  },
  demon_form: {
    id: 'demon_form', name: '恶魔形态', icon: '😈', type: 'power', cost: 3, upgradedCost: 2, target: 'none', rarity: 'rare', cls: 'warrior',
    vars(up) { return { str: up ? 3 : 2 }; },
    descTemplate(v) { return `永久获得恶魔形态：此后每回合开始时，获得 ${v.str} 点力量`; },
    effect(ctx) { ctx.combat.applyStatusPlayer('demonForm', ctx.vars.str); },
  },
  fiend_fire: {
    id: 'fiend_fire', name: '魔焰', icon: '🔥', type: 'attack', cost: 2, target: 'all_enemies', rarity: 'rare', cls: 'warrior', exhaust: true,
    vars(up) { return { dmgPer: up ? 8 : 6 }; },
    descTemplate(v) { return `消耗手牌中所有其他牌，每张对所有敌人造成 ${v.dmgPer} 点伤害（消耗）`; },
    effect(ctx) {
      const others = ctx.combat.hand.filter(c => c.uid !== ctx.card.uid);
      const count = others.length;
      others.forEach(c => ctx.combat.exhaustCardByUid(c.uid));
      const dmg = count * ctx.vars.dmgPer;
      ctx.combat.enemies.forEach(e => { if (e.hp > 0) ctx.combat.dealDamageToEnemy(e.id, dmg, { source: '魔焰', isAoE: true }); });
    },
  },
  spot_weakness: {
    id: 'spot_weakness', name: '洞察弱点', icon: '👁️', type: 'skill', cost: 1, target: 'enemy', rarity: 'uncommon', cls: 'warrior',
    vars(up) { return { str: up ? 4 : 3 }; },
    descTemplate(v) { return `若目标意图攻击，获得 ${v.str} 点力量`; },
    effect(ctx) {
      if (ctx.target.nextMove && ctx.target.nextMove.type === 'attack') {
        ctx.combat.applyStatusPlayer('strength', ctx.vars.str);
        ctx.combat.log('👁️ 洞察到敌人的攻击意图，力量大增！', 'player');
      } else {
        ctx.combat.log('👁️ 敌人没有攻击意图，洞察失败', 'info');
      }
    },
  },
  limit_break: {
    id: 'limit_break', name: '极限突破', icon: '💥', type: 'skill', cost: 1, upgradedCost: 0, target: 'none', rarity: 'rare', cls: 'warrior', exhaust: true,
    vars() { return {}; },
    descTemplate() { return `将你当前的力量翻倍（消耗）`; },
    effect(ctx) {
      const cur = ctx.combat.player.statuses.strength || 0;
      if (cur > 0) {
        ctx.combat.applyStatusPlayer('strength', cur);
        ctx.combat.log(`💥 力量翻倍：${cur} → ${cur * 2}`, 'player');
      } else {
        ctx.combat.log('💥 你没有力量可以翻倍', 'info');
      }
    },
  },
  corruption: {
    id: 'corruption', name: '腐化', icon: '🩸', type: 'power', cost: 3, upgradedCost: 2, target: 'none', rarity: 'rare', cls: 'warrior',
    vars() { return {}; },
    descTemplate() { return `永久获得腐化：此后所有卡牌费用变为 0，但打出后会被消耗`; },
    effect(ctx) { ctx.combat.applyStatusPlayer('corruption', 1); },
  },

  // ---------------- Huntress new ----------------
  catalyst: {
    id: 'catalyst', name: '催化', icon: '⚗️', type: 'skill', cost: 1, target: 'enemy', rarity: 'uncommon', cls: 'huntress', exhaust: true,
    vars(up) { return { multiplier: up ? 4 : 3 }; },
    descTemplate(v) { return `将目标的中毒层数变为 ${v.multiplier} 倍（消耗）`; },
    effect(ctx) {
      const cur = ctx.target.statuses.poison || 0;
      if (cur > 0) {
        ctx.target.statuses.poison = cur * ctx.vars.multiplier;
        ctx.combat.log(`⚗️ 催化生效！${ctx.target.name} 的中毒层数变为 ${ctx.target.statuses.poison}`, 'player');
      } else {
        ctx.combat.log('⚗️ 目标没有中毒，催化无效', 'info');
      }
    },
  },
  nightmare: {
    id: 'nightmare', name: '梦魇', icon: '😴', type: 'skill', cost: 0, target: 'none', rarity: 'rare', cls: 'huntress', exhaust: true,
    vars(up) { return { copies: up ? 3 : 2 }; },
    descTemplate(v) { return `选择手牌中一张牌，复制 ${v.copies} 份加入手牌（消耗）`; },
    effect(ctx) {
      const playable = ctx.combat.hand.filter(c => c.uid !== ctx.card.uid);
      if (playable.length === 0) { ctx.combat.log('😴 没有可复制的卡牌', 'info'); return; }
      const chosen = playable[Math.floor(Math.random() * playable.length)];
      for (let i = 0; i < ctx.vars.copies; i++) {
        ctx.combat.hand.push({ uid: 'cc' + Math.random().toString(36).slice(2), defId: chosen.defId, upgraded: chosen.upgraded });
      }
      ctx.combat.log(`😴 梦魇复制了 ${ctx.vars.copies} 张【${CARDS[chosen.defId].name}】`, 'player');
    },
  },
  adrenaline: {
    id: 'adrenaline', name: '肾上腺素', icon: '⚡', type: 'skill', cost: 0, target: 'none', rarity: 'rare', cls: 'huntress',
    vars(up) { return { energy: up ? 2 : 1, draw: up ? 3 : 2 }; },
    descTemplate(v) { return `获得 ${v.energy} 点能量，抽 ${v.draw} 张牌`; },
    effect(ctx) { ctx.combat.gainEnergy(ctx.vars.energy); ctx.combat.drawCards(ctx.vars.draw); },
  },
  predator: {
    id: 'predator', name: '捕食者', icon: '🦅', type: 'attack', cost: 1, target: 'enemy', rarity: 'uncommon', cls: 'huntress',
    vars(up) { return { dmg: up ? 12 : 10, draw: 1 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害；若击杀目标，下回合多抽 ${v.draw} 张牌`; },
    effect(ctx) {
      const beforeHp = ctx.target.hp;
      ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '捕食者' });
      if (ctx.target.hp <= 0 && beforeHp > 0) {
        ctx.combat.bonusDrawNext = (ctx.combat.bonusDrawNext || 0) + ctx.vars.draw;
        ctx.combat.log('🦅 捕食成功！下回合多抽牌', 'player');
      }
    },
  },

  // ---------------- Neutral new ----------------
  battle_hymn: {
    id: 'battle_hymn', name: '战歌', icon: '🎵', type: 'power', cost: 1, target: 'none', rarity: 'uncommon', cls: 'neutral',
    vars(up) { return { dmg: up ? 4 : 3 }; },
    descTemplate(v) { return `永久获得战歌：此后每回合开始时，对所有敌人造成 ${v.dmg} 点伤害（无法规避）`; },
    effect(ctx) { ctx.combat.applyStatusPlayer('battleHymn', ctx.vars.dmg); },
  },
  panacea: {
    id: 'panacea', name: '万能药', icon: '💊', type: 'skill', cost: 0, target: 'none', rarity: 'uncommon', cls: 'neutral', exhaust: true,
    vars(up) { return { amt: up ? 4 : 3 }; },
    descTemplate(v) { return `消耗手牌中所有状态牌和诅咒牌，每张回复 ${v.amt} 点生命（消耗）`; },
    effect(ctx) {
      const statusCards = ctx.combat.hand.filter(c => c.uid !== ctx.card.uid && ['skill', 'power'].includes(CARDS[c.defId].type) && CARDS[c.defId].rarity === 'starter');
      let healed = 0;
      statusCards.forEach(c => {
        ctx.combat.exhaustCardByUid(c.uid);
        ctx.combat.healPlayer(ctx.vars.amt);
        healed += ctx.vars.amt;
      });
      if (healed === 0) ctx.combat.log('💊 没有可消耗的卡牌', 'info');
    },
  },

  // ---------------- Neutral (batch 2 additions) ----------------
  deflect: {
    id: 'deflect', name: '闪避格挡', icon: '🔰', type: 'skill', cost: 0, target: 'self', rarity: 'common', cls: 'neutral',
    vars(up) { return { block: up ? 7 : 4 }; },
    descTemplate(v) { return `获得 ${v.block} 点格挡`; },
    effect(ctx) { ctx.combat.gainBlockPlayer(ctx.vars.block); },
  },
  bite: {
    id: 'bite', name: '噬咬', icon: '🧛', type: 'attack', cost: 1, target: 'enemy', rarity: 'uncommon', cls: 'neutral',
    vars(up) { return { dmg: up ? 9 : 6, heal: up ? 5 : 3 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害，回复 ${v.heal} 点生命`; },
    effect(ctx) {
      ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '噬咬' });
      ctx.combat.healPlayer(ctx.vars.heal);
    },
  },

  // ---------------- Warrior (batch 2 additions) ----------------
  clothesline: {
    id: 'clothesline', name: '横扫倒地', icon: '🦵', type: 'attack', cost: 2, target: 'enemy', rarity: 'uncommon', cls: 'warrior',
    vars(up) { return { dmg: up ? 16 : 12, weak: up ? 3 : 2 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害，施加 ${v.weak} 层虚弱`; },
    effect(ctx) {
      ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '横扫倒地' });
      ctx.combat.applyStatusEnemy(ctx.target.id, 'weak', ctx.vars.weak);
    },
  },
  sword_boomerang: {
    id: 'sword_boomerang', name: '回旋剑', icon: '🔁', type: 'attack', cost: 1, target: 'none', rarity: 'uncommon', cls: 'warrior',
    vars(up) { return { dmg: up ? 4 : 3, hits: 3 }; },
    descTemplate(v) { return `对随机敌人造成 ${v.hits} 次 ${v.dmg} 点伤害`; },
    effect(ctx) {
      for (let i = 0; i < ctx.vars.hits; i++) {
        const living = ctx.combat.enemies.filter(e => e.hp > 0);
        if (living.length === 0) break;
        const t = living[Math.floor(Math.random() * living.length)];
        ctx.combat.dealDamageToEnemy(t.id, ctx.vars.dmg, { source: '回旋剑' });
      }
    },
  },
  reckless_charge: {
    id: 'reckless_charge', name: '鲁莽冲锋', icon: '🏃', type: 'attack', cost: 0, target: 'enemy', rarity: 'common', cls: 'warrior',
    vars(up) { return { dmg: up ? 15 : 11 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害，然后弃 1 张随机手牌`; },
    effect(ctx) {
      ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '鲁莽冲锋' });
      ctx.combat.discardRandomFromHand(1);
    },
  },

  // ---------------- Huntress (batch 2 additions) ----------------
  caltrops: {
    id: 'caltrops', name: '铁蒺藜', icon: '🌵', type: 'skill', cost: 1, target: 'self', rarity: 'common', cls: 'huntress',
    vars(up) { return { block: up ? 9 : 6, poison: up ? 3 : 2 }; },
    descTemplate(v) { return `获得 ${v.block} 点格挡，对所有敌人施加 ${v.poison} 层中毒`; },
    effect(ctx) {
      ctx.combat.gainBlockPlayer(ctx.vars.block);
      ctx.combat.enemies.forEach(e => { if (e.hp > 0) ctx.combat.applyStatusEnemy(e.id, 'poison', ctx.vars.poison); });
    },
  },
  poison_gas: {
    id: 'poison_gas', name: '毒气弹', icon: '🧨', type: 'skill', cost: 1, target: 'enemy', rarity: 'common', cls: 'huntress',
    vars(up) { return { poison: up ? 5 : 3, weak: up ? 2 : 1 }; },
    descTemplate(v) { return `使目标获得 ${v.poison} 层中毒和 ${v.weak} 层虚弱`; },
    effect(ctx) {
      ctx.combat.applyStatusEnemy(ctx.target.id, 'poison', ctx.vars.poison);
      ctx.combat.applyStatusEnemy(ctx.target.id, 'weak', ctx.vars.weak);
    },
  },
  snipe: {
    id: 'snipe', name: '狙击', icon: '🎯', type: 'attack', cost: 2, target: 'enemy', rarity: 'rare', cls: 'huntress', exhaust: true,
    vars(up) { return { dmg: up ? 26 : 20 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点巨额伤害（消耗）`; },
    effect(ctx) { ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '狙击' }); },
  },

  // ================= 扩展卡牌（第三批）==================
  // ---------------- Warrior new (batch 3) ----------------
  armaments: {
    id: 'armaments', name: '武装', icon: '🛡️', type: 'skill', cost: 1, target: 'self', rarity: 'common', cls: 'warrior',
    vars(up) { return { block: up ? 8 : 5 }; },
    descTemplate(v) { return `获得 ${v.block} 点格挡，随机升级手牌中一张牌`; },
    effect(ctx) {
      ctx.combat.gainBlockPlayer(ctx.vars.block);
      const upgradable = ctx.combat.hand.filter(c => c.uid !== ctx.card.uid && !c.upgraded);
      if (upgradable.length > 0) {
        const target = upgradable[Math.floor(Math.random() * upgradable.length)];
        target.upgraded = true;
        ctx.combat.log(`🛡️ 武装升级了【${CARDS[target.defId].name}】`, 'player');
      } else {
        ctx.combat.log('🛡️ 没有可升级的卡牌', 'info');
      }
    },
  },
  clash: {
    id: 'clash', name: '冲撞', icon: '⚔️', type: 'attack', cost: 0, target: 'enemy', rarity: 'common', cls: 'warrior',
    vars(up) { return { dmg: up ? 17 : 14 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害（仅当手牌全为攻击牌时可打出）`; },
    effect(ctx) { ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '冲撞' }); },
  },
  headbutt: {
    id: 'headbutt', name: '头槌', icon: '🤕', type: 'attack', cost: 1, target: 'enemy', rarity: 'common', cls: 'warrior',
    vars(up) { return { dmg: up ? 12 : 9 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害，将弃牌堆顶一张牌放回抽牌堆顶`; },
    effect(ctx) {
      ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '头槌' });
      if (ctx.combat.discardPile.length > 0) {
        const top = ctx.combat.discardPile.pop();
        ctx.combat.drawPile.push(top);
        ctx.combat.log(`🤕 头槌将【${CARDS[top.defId].name}】放回抽牌堆顶`, 'player');
      }
    },
  },
  heavy_blade: {
    id: 'heavy_blade', name: '重刃', icon: '🗡️', type: 'attack', cost: 2, target: 'enemy', rarity: 'common', cls: 'warrior',
    vars(up) { return { dmg: up ? 14 : 10, strMul: up ? 5 : 3 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害，力量额外加成 x${v.strMul}`; },
    effect(ctx) {
      const str = ctx.combat.player.statuses.strength || 0;
      ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg + str * ctx.vars.strMul, { source: '重刃' });
    },
  },
  perfected_strike: {
    id: 'perfected_strike', name: '完美打击', icon: '💥', type: 'attack', cost: 2, target: 'enemy', rarity: 'common', cls: 'warrior',
    vars(up) { return { base: up ? 12 : 8, perStrike: up ? 4 : 3 }; },
    descTemplate(v) { return `造成 ${v.base} 点伤害，每张牌名含"打击"的牌额外 +${v.perStrike}`; },
    effect(ctx) {
      const strikeCount = ctx.combat.player.deck ? ctx.combat.player.deck.filter(c => CARDS[c.defId] && CARDS[c.defId].name.includes('打击')).length : 0;
      const dmg = ctx.vars.base + strikeCount * ctx.vars.perStrike;
      ctx.combat.dealDamageToEnemy(ctx.target.id, dmg, { source: '完美打击' });
    },
  },

  // ---------------- Huntress new (batch 3) ----------------
  backflip: {
    id: 'backflip', name: '后空翻', icon: '🤸', type: 'skill', cost: 1, target: 'self', rarity: 'common', cls: 'huntress',
    vars(up) { return { block: up ? 8 : 5, draw: 2 }; },
    descTemplate(v) { return `获得 ${v.block} 点格挡，抽 ${v.draw} 张牌`; },
    effect(ctx) { ctx.combat.gainBlockPlayer(ctx.vars.block); ctx.combat.drawCards(ctx.vars.draw); },
  },
  blade_dance: {
    id: 'blade_dance', name: '刀刃之舞', icon: '🗡️', type: 'skill', cost: 1, target: 'enemy', rarity: 'common', cls: 'huntress',
    vars(up) { return { dmg: up ? 6 : 4, hits: 3 }; },
    descTemplate(v) { return `对目标造成 ${v.hits} 次 ${v.dmg} 点伤害`; },
    effect(ctx) {
      for (let i = 0; i < ctx.vars.hits; i++) {
        if (ctx.target.hp > 0) ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '刀刃之舞' });
      }
    },
  },
  dodge_roll: {
    id: 'dodge_roll', name: '闪避翻滚', icon: '🌀', type: 'skill', cost: 1, target: 'self', rarity: 'common', cls: 'huntress',
    vars(up) { return { block: up ? 12 : 9 }; },
    descTemplate(v) { return `获得 ${v.block} 点格挡，下回合再获得 ${v.block} 点格挡`; },
    effect(ctx) {
      ctx.combat.gainBlockPlayer(ctx.vars.block);
      ctx.combat.bonusBlockNext = (ctx.combat.bonusBlockNext || 0) + ctx.vars.block;
      ctx.combat.log(`🌀 下回合开始时额外获得 ${ctx.vars.block} 点格挡`, 'player');
    },
  },
  piercing_wail: {
    id: 'piercing_wail', name: '刺耳哀嚎', icon: '📢', type: 'skill', cost: 1, target: 'all_enemies', rarity: 'uncommon', cls: 'huntress', exhaust: true,
    vars(up) { return { strLoss: up ? 4 : 3 }; },
    descTemplate(v) { return `所有敌人永久失去 ${v.strLoss} 点力量（消耗）`; },
    effect(ctx) {
      ctx.combat.enemies.forEach(e => { if (e.hp > 0) ctx.combat.applyStatusEnemy(e.id, 'strength', -ctx.vars.strLoss); });
    },
  },
  terror: {
    id: 'terror', name: '恐惧', icon: '😱', type: 'skill', cost: 1, target: 'enemy', rarity: 'uncommon', cls: 'huntress', exhaust: true,
    vars(up) { return { vuln: up ? 5 : 3 }; },
    descTemplate(v) { return `使目标获得 ${v.vuln} 层易伤（消耗）`; },
    effect(ctx) { ctx.combat.applyStatusEnemy(ctx.target.id, 'vulnerable', ctx.vars.vuln); },
  },

  // ---------------- 新增负面状态卡牌 ----------------
  intimidating_roar: {
    id: 'intimidating_roar', name: '威吓怒吼', icon: '📢', type: 'skill', cost: 1, target: 'all_enemies', rarity: 'common', cls: 'warrior',
    vars(up) { return { weak: up ? 2 : 1 }; },
    descTemplate(v) { return `对所有敌人施加 ${v.weak} 层虚弱`; },
    effect(ctx) { ctx.combat.enemies.forEach(e => { if (e.hp > 0) ctx.combat.applyStatusEnemy(e.id, 'weak', ctx.vars.weak); }); },
  },
  sunder: {
    id: 'sunder', name: '裂甲', icon: '⛏️', type: 'attack', cost: 1, target: 'enemy', rarity: 'common', cls: 'warrior',
    vars(up) { return { dmg: up ? 8 : 6, vuln: up ? 3 : 2 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害，施加 ${v.vuln} 层易伤`; },
    effect(ctx) {
      ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '裂甲' });
      ctx.combat.applyStatusEnemy(ctx.target.id, 'vulnerable', ctx.vars.vuln);
    },
  },
  weakening_mist: {
    id: 'weakening_mist', name: '虚弱之雾', icon: '🌫️', type: 'skill', cost: 0, target: 'all_enemies', rarity: 'uncommon', cls: 'neutral', exhaust: true,
    vars(up) { return { weak: up ? 3 : 2, vuln: 1 }; },
    descTemplate(v) { return `对所有敌人施加 ${v.weak} 层虚弱和 ${v.vuln} 层易伤（消耗）`; },
    effect(ctx) {
      ctx.combat.enemies.forEach(e => {
        if (e.hp > 0) {
          ctx.combat.applyStatusEnemy(e.id, 'weak', ctx.vars.weak);
          ctx.combat.applyStatusEnemy(e.id, 'vulnerable', ctx.vars.vuln);
        }
      });
    },
  },
  hex: {
    id: 'hex', name: '诅咒术', icon: '🔮', type: 'skill', cost: 1, target: 'enemy', rarity: 'uncommon', cls: 'huntress',
    vars(up) { return { weak: up ? 3 : 2, vuln: up ? 3 : 2 }; },
    descTemplate(v) { return `使目标获得 ${v.weak} 层虚弱和 ${v.vuln} 层易伤`; },
    effect(ctx) {
      ctx.combat.applyStatusEnemy(ctx.target.id, 'weak', ctx.vars.weak);
      ctx.combat.applyStatusEnemy(ctx.target.id, 'vulnerable', ctx.vars.vuln);
    },
  },
  corrosive_spit: {
    id: 'corrosive_spit', name: '腐蚀唾液', icon: '🧪', type: 'attack', cost: 1, target: 'enemy', rarity: 'common', cls: 'huntress',
    vars(up) { return { dmg: up ? 5 : 3, weak: up ? 2 : 1, poison: up ? 3 : 2 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害，施加 ${v.weak} 层虚弱和 ${v.poison} 层中毒`; },
    effect(ctx) {
      ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '腐蚀唾液' });
      ctx.combat.applyStatusEnemy(ctx.target.id, 'weak', ctx.vars.weak);
      ctx.combat.applyStatusEnemy(ctx.target.id, 'poison', ctx.vars.poison);
    },
  },

  // ================= 机器人（Automaton）卡牌 =================
  // ---------------- Starter cards ----------------
  spark: {
    id: 'spark', name: '电火花', icon: '⚡', type: 'attack', cost: 1, target: 'enemy', rarity: 'starter', cls: 'automaton',
    vars(up) { return { dmg: up ? 9 : 6 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害`; },
    effect(ctx) { ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '电火花' }); },
  },
  static_field: {
    id: 'static_field', name: '静电场', icon: '🛡️', type: 'skill', cost: 1, target: 'self', rarity: 'starter', cls: 'automaton',
    vars(up) { return { block: up ? 8 : 5 }; },
    descTemplate(v) { return `获得 ${v.block} 点格挡`; },
    effect(ctx) { ctx.combat.gainBlockPlayer(ctx.vars.block); },
  },
  charge_up: {
    id: 'charge_up', name: '蓄能', icon: '🔋', type: 'skill', cost: 0, target: 'none', rarity: 'starter', cls: 'automaton',
    vars(up) { return { str: up ? 2 : 1 }; },
    descTemplate(v) { return `获得 ${v.str} 层力量`; },
    effect(ctx) { ctx.combat.applyStatusPlayer('strength', ctx.vars.str); },
  },
  thunder_strike: {
    id: 'thunder_strike', name: '雷霆一击', icon: '⛈️', type: 'attack', cost: 2, target: 'enemy', rarity: 'starter', cls: 'automaton',
    vars(up) { return { dmg: up ? 14 : 10 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害`; },
    effect(ctx) { ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '雷霆一击' }); },
  },

  // ---------------- Automaton reward pool ----------------
  chain_lightning: {
    id: 'chain_lightning', name: '连锁闪电', icon: '🔗', type: 'attack', cost: 1, target: 'enemy', rarity: 'common', cls: 'automaton',
    vars(up) { return { dmg: up ? 8 : 6, bounce: up ? 4 : 3 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害，对另一随机敌人造成 ${v.bounce} 点伤害`; },
    effect(ctx) {
      ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '连锁闪电' });
      const living = ctx.combat.enemies.filter(e => e.hp > 0 && e.id !== ctx.target.id);
      if (living.length > 0) {
        const t = living[Math.floor(Math.random() * living.length)];
        ctx.combat.dealDamageToEnemy(t.id, ctx.vars.bounce, { source: '连锁闪电' });
      }
    },
  },
  emp: {
    id: 'emp', name: '电磁脉冲', icon: '💢', type: 'skill', cost: 1, target: 'all_enemies', rarity: 'common', cls: 'automaton',
    vars(up) { return { weak: up ? 2 : 1, vuln: up ? 2 : 1 }; },
    descTemplate(v) { return `对所有敌人施加 ${v.weak} 层虚弱和 ${v.vuln} 层易伤`; },
    effect(ctx) {
      ctx.combat.enemies.forEach(e => {
        if (e.hp > 0) {
          ctx.combat.applyStatusEnemy(e.id, 'weak', ctx.vars.weak);
          ctx.combat.applyStatusEnemy(e.id, 'vulnerable', ctx.vars.vuln);
        }
      });
    },
  },
  overclock: {
    id: 'overclock', name: '超频', icon: '⚙️', type: 'skill', cost: 0, target: 'none', rarity: 'common', cls: 'automaton',
    vars(up) { return { draw: up ? 3 : 2, dmg: up ? 3 : 2 }; },
    descTemplate(v) { return `抽 ${v.draw} 张牌，受到 ${v.dmg} 点伤害`; },
    effect(ctx) {
      ctx.combat.drawCards(ctx.vars.draw);
      ctx.combat.damagePlayerDirect(ctx.vars.dmg);
      ctx.combat.log(`⚙️ 超频：抽 ${ctx.vars.draw} 张牌，受到 ${ctx.vars.dmg} 点伤害`, 'player');
    },
  },
  force_field: {
    id: 'force_field', name: '力场护盾', icon: '🛡️', type: 'skill', cost: 1, target: 'self', rarity: 'uncommon', cls: 'automaton',
    vars(up) { return { block: up ? 14 : 10, str: up ? 2 : 1 }; },
    descTemplate(v) { return `获得 ${v.block} 点格挡，获得 ${v.str} 层力量`; },
    effect(ctx) {
      ctx.combat.gainBlockPlayer(ctx.vars.block);
      ctx.combat.applyStatusPlayer('strength', ctx.vars.str);
    },
  },
  storm_surge: {
    id: 'storm_surge', name: '风暴涌动', icon: '🌩️', type: 'attack', cost: 2, target: 'all_enemies', rarity: 'uncommon', cls: 'automaton',
    vars(up) { return { dmg: up ? 12 : 8, weak: up ? 2 : 1 }; },
    descTemplate(v) { return `对所有敌人造成 ${v.dmg} 点伤害，施加 ${v.weak} 层虚弱`; },
    effect(ctx) {
      ctx.combat.enemies.forEach(e => {
        if (e.hp > 0) {
          ctx.combat.dealDamageToEnemy(e.id, ctx.vars.dmg, { source: '风暴涌动', isAoE: true });
          ctx.combat.applyStatusEnemy(e.id, 'weak', ctx.vars.weak);
        }
      });
    },
  },
  core_overload: {
    id: 'core_overload', name: '核心过载', icon: '☢️', type: 'power', cost: 3, upgradedCost: 2, target: 'none', rarity: 'rare', cls: 'automaton',
    vars(up) { return { str: up ? 3 : 2 }; },
    descTemplate(v) { return `永久获得核心过载：每回合开始时获得 ${v.str} 层力量`; },
    effect(ctx) { ctx.combat.applyStatusPlayer('demonForm', ctx.vars.str); },
  },

  // ================= 状态牌（Status）==================
  wound: {
    id: 'wound', name: '伤口', icon: '🩹', type: 'status', cost: 1, target: 'none', rarity: 'special', cls: 'neutral', exhaust: true,
    vars() { return {}; },
    descTemplate() { return `消耗`; },
    effect() {},
  },
  burn: {
    id: 'burn', name: '灼烧', icon: '🔥', type: 'status', cost: 1, target: 'none', rarity: 'special', cls: 'neutral', exhaust: true,
    vars(up) { return { dmg: up ? 4 : 2 }; },
    descTemplate(v) { return `回合结束时受到 ${v.dmg} 点伤害。消耗`; },
    effect() {},
  },
  dazed: {
    id: 'dazed', name: '迷茫', icon: '🌫️', type: 'status', cost: 0, target: 'none', rarity: 'special', cls: 'neutral',
    vars() { return {}; },
    descTemplate() { return `虚无。不可打出`; },
    effect() {},
  },
  slimed: {
    id: 'slimed', name: '被粘液覆盖', icon: '🟢', type: 'status', cost: 0, target: 'none', rarity: 'special', cls: 'neutral', exhaust: true,
    vars() { return {}; },
    descTemplate() { return `消耗`; },
    effect() {},
  },
  void: {
    id: 'void', name: '虚空', icon: '🕳️', type: 'status', cost: 0, target: 'none', rarity: 'special', cls: 'neutral',
    vars() { return {}; },
    descTemplate() { return `抽到时失去 1 点能量。虚无。不可打出`; },
    effect() {},
  },
  necro_curse: {
    id: 'necro_curse', name: '死灵诅咒', icon: '💀', type: 'status', cost: 0, target: 'none', rarity: 'special', cls: 'neutral',
    vars() { return { dmg: 2 }; },
    descTemplate(v) { return `抽到时受到 ${v.dmg} 点伤害。不可打出`; },
    effect() {},
  },
  gravity: {
    id: 'gravity', name: '重力压制', icon: '🪨', type: 'status', cost: 1, target: 'none', rarity: 'special', cls: 'neutral', exhaust: true,
    vars() { return { dmg: 3 }; },
    descTemplate(v) { return `回合结束时仍在手牌中则受到 ${v.dmg} 点伤害。消耗`; },
    effect() {},
  },
  // playableStatus: mark status cards that can be played (consumed) by the player


  // ================= 诅咒牌（Curse）==================
  clumsy: {
    id: 'clumsy', name: '笨拙', icon: '🤡', type: 'curse', cost: 0, target: 'none', rarity: 'special', cls: 'neutral', exhaust: true,
    vars() { return {}; },
    descTemplate() { return `消耗`; },
    effect() {},
  },
  decay: {
    id: 'decay', name: '腐朽', icon: '🪦', type: 'curse', cost: 1, target: 'none', rarity: 'special', cls: 'neutral', exhaust: true,
    vars() { return { dmg: 2 }; },
    descTemplate(v) { return `回合结束时受到 ${v.dmg} 点伤害。消耗`; },
    effect() {},
  },
  doubt: {
    id: 'doubt', name: '疑虑', icon: '❓', type: 'curse', cost: 0, target: 'none', rarity: 'special', cls: 'neutral',
    vars() { return {}; },
    descTemplate() { return `抽到时获得 1 层脆弱。不可打出`; },
    effect() {},
  },
  injury: {
    id: 'injury', name: '创伤', icon: '💢', type: 'curse', cost: 1, target: 'none', rarity: 'special', cls: 'neutral', exhaust: true,
    vars() { return {}; },
    descTemplate() { return `消耗`; },
    effect() {},
  },
  normality: {
    id: 'normality', name: '平庸', icon: '😐', type: 'curse', cost: 0, target: 'none', rarity: 'special', cls: 'neutral',
    vars() { return {}; },
    descTemplate() { return `抽到时，本回合不能再打出攻击牌。不可打出`; },
    effect() {},
  },
  pain: {
    id: 'pain', name: '痛苦', icon: '🩸', type: 'curse', cost: 0, target: 'none', rarity: 'special', cls: 'neutral',
    vars() { return { dmg: 2 }; },
    descTemplate(v) { return `抽到时失去 ${v.dmg} 点能量。不可打出`; },
    effect() {},
  },
  parasite: {
    id: 'parasite', name: '寄生虫', icon: '🪱', type: 'curse', cost: 0, target: 'none', rarity: 'special', cls: 'neutral',
    vars() { return { dmg: 3 }; },
    descTemplate(v) { return `抽到时受到 ${v.dmg} 点伤害。不可打出`; },
    effect() {},
  },
  regret: {
    id: 'regret', name: '悔恨', icon: '😢', type: 'curse', cost: 0, target: 'none', rarity: 'special', cls: 'neutral',
    vars() { return {}; },
    descTemplate() { return `抽到时失去 1 点最大生命值。不可打出`; },
    effect() {},
  },
  shame: {
    id: 'shame', name: '耻辱', icon: '😳', type: 'curse', cost: 0, target: 'none', rarity: 'special', cls: 'neutral',
    vars() { return {}; },
    descTemplate() { return `抽到时获得 1 层虚弱。不可打出`; },
    effect() {},
  },
  writhe: {
    id: 'writhe', name: '煎熬', icon: '😣', type: 'curse', cost: 1, target: 'none', rarity: 'special', cls: 'neutral', exhaust: true,
    vars() { return {}; },
    descTemplate() { return `消耗`; },
    effect() {},
  },

  // ================= 药剂卡牌（商店特供，消耗特性）==================
  ether_potion: {
    id: 'ether_potion', name: '治疗药水', icon: '🧪', type: 'skill', cost: 0, target: 'self', rarity: 'special', cls: 'neutral', exhaust: true, removeFromDeck: true,
    vars(up) { return { heal: up ? 12 : 8 }; },
    descTemplate(v) { return `回复 ${v.heal} 点生命。移除`; },
    effect(ctx) { ctx.combat.healPlayer(ctx.vars.heal); },
  },
  ether_strength: {
    id: 'ether_strength', name: '力量药剂', icon: '💪', type: 'skill', cost: 0, target: 'self', rarity: 'special', cls: 'neutral', exhaust: true, removeFromDeck: true,
    vars(up) { return { str: up ? 3 : 2 }; },
    descTemplate(v) { return `获得 ${v.str} 层力量。移除`; },
    effect(ctx) { ctx.combat.applyStatusPlayer('strength', ctx.vars.str); },
  },
  ether_block: {
    id: 'ether_block', name: '护盾药剂', icon: '🛡️', type: 'skill', cost: 0, target: 'self', rarity: 'special', cls: 'neutral', exhaust: true, removeFromDeck: true,
    vars(up) { return { block: up ? 18 : 12 }; },
    descTemplate(v) { return `获得 ${v.block} 点格挡。移除`; },
    effect(ctx) { ctx.combat.gainBlockPlayer(ctx.vars.block); },
  },
  ether_bomb: {
    id: 'ether_bomb', name: '炸弹', icon: '💣', type: 'attack', cost: 0, target: 'all_enemies', rarity: 'special', cls: 'neutral', exhaust: true, removeFromDeck: true,
    vars(up) { return { dmg: up ? 12 : 8 }; },
    descTemplate(v) { return `对所有敌人造成 ${v.dmg} 点伤害。移除`; },
    effect(ctx) { ctx.combat.enemies.forEach(e => { if (e.hp > 0) ctx.combat.dealDamageToEnemy(e.id, ctx.vars.dmg, { source: '炸弹', isAoE: true, bypassTaunt: true }); }); },
  },
  ether_draw: {
    id: 'ether_draw', name: '洞察药剂', icon: '🔮', type: 'skill', cost: 0, target: 'self', rarity: 'special', cls: 'neutral', exhaust: true, removeFromDeck: true,
    vars(up) { return { draw: up ? 3 : 2 }; },
    descTemplate(v) { return `抽 ${v.draw} 张牌。移除`; },
    effect(ctx) { ctx.combat.drawCards(ctx.vars.draw); },
  },
  ether_cleanse: {
    id: 'ether_cleanse', name: '净化药剂', icon: '✨', type: 'skill', cost: 0, target: 'self', rarity: 'special', cls: 'neutral', exhaust: true, removeFromDeck: true,
    vars() { return {}; },
    descTemplate() { return `消耗手牌中所有状态牌和诅咒牌。移除`; },
    effect(ctx) {
      const junk = ctx.combat.hand.filter(c => {
        const d = CARDS[c.defId];
        return d && (d.type === 'status' || d.type === 'curse') && c.uid !== ctx.card.uid;
      });
      junk.forEach(c => {
        const idx = ctx.combat.hand.findIndex(h => h.uid === c.uid);
        if (idx !== -1) {
          ctx.combat.hand.splice(idx, 1);
          ctx.combat.exhaustPile.push(c);
          ctx.combat.onCardExhausted();
        }
      });
      ctx.combat.log(`✨ 虚无净化：消耗了 ${junk.length} 张状态/诅咒牌`, 'player');
    },
  },

  // ================= 成就奖励卡牌（Achievement Reward Cards）==================
  // Tied to achievements; only appear in reward/shop/event pools after unlock
  triple_strike: {
    id: 'triple_strike', name: '三连击', icon: '⚡', type: 'attack', cost: 1, target: 'enemy', rarity: 'common', cls: 'neutral',
    vars(up) { return { dmg: up ? 5 : 4 }; },
    descTemplate(v) { return `对目标造成 3 次 ${v.dmg} 点伤害`; },
    effect(ctx) {
      for (let i = 0; i < 3; i++) {
        if (ctx.target && ctx.target.hp > 0) ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '三连击' });
      }
    },
  },
  shield_bash: {
    id: 'shield_bash', name: '盾击', icon: '🛡️', type: 'attack', cost: 1, target: 'enemy', rarity: 'common', cls: 'neutral',
    vars(up) { return { dmg: up ? 10 : 8, block: up ? 6 : 5 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害，额外获得 ${v.block} 点格挡`; },
    effect(ctx) {
      if (ctx.target) ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '盾击' });
      ctx.combat.gainBlockPlayer(ctx.vars.block);
    },
  },
  scavenger: {
    id: 'scavenger', name: '拾荒者', icon: '🎒', type: 'skill', cost: 0, target: 'self', rarity: 'uncommon', cls: 'neutral',
    vars(up) { return { draw: up ? 3 : 2, block: up ? 6 : 5 }; },
    descTemplate(v) { return `抽 ${v.draw} 张牌，获得 ${v.block} 点格挡`; },
    effect(ctx) { ctx.combat.drawCards(ctx.vars.draw); ctx.combat.gainBlockPlayer(ctx.vars.block); },
  },
  power_surge: {
    id: 'power_surge', name: '力量涌动', icon: '💪', type: 'skill', cost: 1, target: 'self', rarity: 'uncommon', cls: 'neutral',
    vars(up) { return { str: up ? 2 : 1, dmg: up ? 8 : 6 }; },
    descTemplate(v) { return `获得 ${v.str} 层力量，对所有敌人造成 ${v.dmg} 点伤害`; },
    effect(ctx) {
      ctx.combat.applyStatusPlayer('strength', ctx.vars.str);
      ctx.combat.enemies.forEach(e => { if (e.hp > 0) ctx.combat.dealDamageToEnemy(e.id, ctx.vars.dmg, { source: '力量涌动', isAoE: true, bypassTaunt: true }); });
    },
  },
  survivor_instinct: {
    id: 'survivor_instinct', name: '求生本能', icon: '🩸', type: 'skill', cost: 1, target: 'self', rarity: 'uncommon', cls: 'neutral',
    vars(up) { return { heal: up ? 8 : 6, block: up ? 8 : 6 }; },
    descTemplate(v) { return `回复 ${v.heal} 点生命，获得 ${v.block} 点格挡`; },
    effect(ctx) { ctx.combat.healPlayer(ctx.vars.heal); ctx.combat.gainBlockPlayer(ctx.vars.block); },
  },
  treasure_map: {
    id: 'treasure_map', name: '藏宝图', icon: '🗺️', type: 'skill', cost: 1, target: 'self', rarity: 'uncommon', cls: 'neutral',
    vars(up) { return { gold: up ? 15 : 10, draw: 1 }; },
    descTemplate(v) { return `获得 ${v.gold} 金币，抽 ${v.draw} 张牌`; },
    effect(ctx) { ctx.combat.run.gold += ctx.vars.gold; ctx.combat.log(`🗺️ 藏宝图：+${ctx.vars.gold} 金币`, 'info'); ctx.combat.drawCards(ctx.vars.draw); },
  },
  monster_hunter: {
    id: 'monster_hunter', name: '猎魔人', icon: '⚔️', type: 'attack', cost: 2, target: 'enemy', rarity: 'rare', cls: 'neutral',
    vars(up) { return { dmg: up ? 14 : 12 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害。若目标生命值低于 50%，额外造成 ${v.dmg} 点伤害`; },
    effect(ctx) {
      if (!ctx.target) return;
      ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '猎魔人' });
      if (ctx.target.hp > 0 && ctx.target.hp < ctx.target.maxHp * 0.5) {
        ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '猎魔人·斩杀' });
      }
    },
  },
  diverse_blade: {
    id: 'diverse_blade', name: '万象之刃', icon: '🌈', type: 'attack', cost: 1, target: 'enemy', rarity: 'uncommon', cls: 'neutral',
    vars(up) { return { dmg: up ? 7 : 5, hits: 2 }; },
    descTemplate(v) { return `对随机 2 名敌人各造成 ${v.dmg} 点伤害`; },
    effect(ctx) {
      const living = ctx.combat.enemies.filter(e => e.hp > 0);
      for (let i = 0; i < 2 && living.length > 0; i++) {
        const target = living[Math.floor(Math.random() * living.length)];
        ctx.combat.dealDamageToEnemy(target.id, ctx.vars.dmg, { source: '万象之刃' });
        const idx = living.indexOf(target);
        if (idx !== -1) living.splice(idx, 1);
      }
    },
  },
  developer_gift: {
    id: 'developer_gift', name: '开发者的馈赠', icon: '🌟', type: 'skill', cost: 3, target: 'self', rarity: 'special', cls: 'neutral', exhaust: true,
    vars(up) { return { cost: up ? 2 : 3 }; },
    upgradedCost: 2,
    descTemplate(v) { return `本回合免疫所有伤害。消耗`; },
    effect(ctx) {
      ctx.combat.damageImmune = true;
      ctx.combat.log(`🌟 开发者的馈赠：本回合免疫所有伤害！`, 'player');
    },
  },
};

const REWARD_POOLS = {
  common: {
    neutral: ['bandage_up', 'flash_strike', 'deflect'],
    warrior: ['cleave', 'iron_wave', 'twin_strike', 'pommel_strike', 'thunderclap', 'shrug_it_off', 'anger', 'battle_trance', 'disarm', 'body_slam', 'reckless_charge', 'armaments', 'clash', 'headbutt', 'heavy_blade', 'perfected_strike', 'intimidating_roar', 'sunder'],
    huntress: ['quick_slash', 'venom_dart', 'evasive_roll', 'blinding_powder', 'acrobatics', 'tools_of_the_trade', 'predator', 'caltrops', 'poison_gas', 'backflip', 'blade_dance', 'dodge_roll', 'corrosive_spit'],
    automaton: ['chain_lightning', 'emp', 'overclock'],
  },
  uncommon: {
    neutral: ['iron_arm', 'swift_focus', 'battle_hymn', 'panacea', 'bite', 'purify', 'weakening_mist'],
    warrior: ['uppercut', 'whirlwind', 'bloodletting', 'second_wind', 'inflame', 'rampage', 'dark_embrace', 'feel_no_pain', 'entrench', 'spot_weakness', 'clothesline', 'sword_boomerang'],
    huntress: ['deadly_poison', 'ambush', 'nimble_strike', 'noxious_fumes', 'well_laid_plans', 'catalyst', 'piercing_wail', 'terror', 'hex'],
    automaton: ['force_field', 'storm_surge'],
  },
  rare: {
    neutral: ['apex_form'],
    warrior: ['reaper', 'immolate', 'offering', 'bludgeon', 'barricade', 'juggernaut', 'demon_form', 'fiend_fire', 'limit_break', 'corruption'],
    huntress: ['thousand_cuts', 'assassinate', 'backstab', 'nightmare', 'adrenaline', 'snipe'],
    automaton: ['core_overload'],
  },
};

const SHOP_ETHEREAL_POOL = ['ether_potion', 'ether_strength', 'ether_block', 'ether_bomb', 'ether_draw', 'ether_cleanse', 'developer_gift'];

const ACHIEVEMENT_CARD_REWARDS = {
  'first_steps': 'triple_strike',
  'elite_hunter': 'power_surge',
  'relic_collector': 'treasure_map',
  'big_spender': 'scavenger',
  'deck_bloat': 'diverse_blade',
  'dimension_walker': 'shield_bash',
  'boss_slayer': 'monster_hunter',
  'survivor': 'survivor_instinct',
  'card_shark': 'triple_strike',
  'treasure_hunter': 'treasure_map',
  'monster_slayer': 'monster_hunter',
  'diverse_arsenal': 'diverse_blade',
  'card_master': 'shield_bash',
  'relic_hoarder': 'power_surge',
  'flawless': 'survivor_instinct',
  'elite_blitz': 'triple_strike',
  'no_money': 'treasure_map',
  'noob': 'triple_strike',
  'noob_plus': 'power_surge',
  'fortress': 'shield_bash',
  'curse_breaker': 'diverse_blade',
  'gold_rush': 'treasure_map',
  'abyss_new_king': 'power_surge',
  'slime_slayer': 'triple_strike',
  'bat_nemesis': 'diverse_blade',
  'true_demon_lord': 'monster_hunter',
  'dog_lover': 'shield_bash',
  'iron_heart': 'shield_bash',
  'i_am_god': 'monster_hunter',
};

function rollCardRarity() {
  const r = Math.random();
  if (r < 0.60) return 'common';
  if (r < 0.90) return 'uncommon';
  return 'rare';
}

function getUnlockedAchievementCardIds(metaObj) {
  if (!metaObj || !metaObj.achievements) return [];
  const ids = [];
  ACHIEVEMENTS.forEach(ach => {
    if (metaObj.achievements[ach.id] && ach.rewardCard && !ids.includes(ach.rewardCard)) {
      ids.push(ach.rewardCard);
    }
  });
  return ids;
}

function pickRandomCardId(characterId = 'warrior', excludeIds = []) {
  const rarity = rollCardRarity();
  const tierPools = REWARD_POOLS[rarity];
  const pool = [...tierPools.neutral, ...(tierPools[characterId] || tierPools.warrior)];
  // Inject unlocked achievement cards matching this rarity
  if (typeof meta !== 'undefined' && meta) {
    getUnlockedAchievementCardIds(meta).forEach(id => {
      const def = CARDS[id];
      if (def && def.rarity === rarity && !pool.includes(id)) pool.push(id);
    });
  }
  const filtered = pool.filter(id => !excludeIds.includes(id));
  const src = filtered.length > 0 ? filtered : pool;
  return src[Math.floor(Math.random() * src.length)];
}

function makeCardInstance(defId, upgraded = false) {
  return { uid: 'c' + (Math.random() * 1e9 | 0) + '_' + Date.now(), defId, upgraded: !!upgraded };
}

function cardVars(cardInstance) {
  return CARDS[cardInstance.defId].vars(cardInstance.upgraded);
}

function cardDesc(cardInstance) {
  const def = CARDS[cardInstance.defId];
  return def.descTemplate(def.vars(cardInstance.upgraded));
}
