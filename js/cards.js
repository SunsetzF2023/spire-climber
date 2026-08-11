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
    id: 'bandage_up', name: '包扎', icon: '🩹', type: 'skill', cost: 0, target: 'none', rarity: 'common', cls: 'neutral', exhaust: true,
    vars(up) { return { heal: up ? 15 : 10 }; },
    descTemplate(v) { return `回复 ${v.heal} 点生命（消耗）`; },
    effect(ctx) { ctx.combat.healPlayer(ctx.vars.heal); },
  },
  flash_strike: {
    id: 'flash_strike', name: '闪击', icon: '✨', type: 'attack', cost: 1, target: 'enemy', rarity: 'common', cls: 'neutral',
    vars(up) { return { dmg: up ? 9 : 6 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害`; },
    effect(ctx) { ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '闪击' }); },
  },
  second_skin: {
    id: 'second_skin', name: '铁壁', icon: '🦾', type: 'skill', cost: 1, target: 'self', rarity: 'uncommon', cls: 'neutral', exhaust: true,
    vars(up) { return { block: up ? 18 : 13 }; },
    descTemplate(v) { return `获得 ${v.block} 点格挡（消耗）`; },
    effect(ctx) { ctx.combat.gainBlockPlayer(ctx.vars.block); },
  },
  swift_focus: {
    id: 'swift_focus', name: '专注', icon: '🎯', type: 'power', cost: 1, target: 'none', rarity: 'uncommon', cls: 'neutral',
    vars(up) { return { dex: up ? 3 : 2 }; },
    descTemplate(v) { return `永久获得 ${v.dex} 点敏捷（本场战斗）`; },
    effect(ctx) { ctx.combat.applyStatusPlayer('dexterity', ctx.vars.dex); },
  },
  apex_form: {
    id: 'apex_form', name: '巅峰形态', icon: '🌟', type: 'power', cost: 2, target: 'none', rarity: 'rare', cls: 'neutral',
    vars(up) { return { amt: up ? 3 : 2 }; },
    descTemplate(v) { return `永久获得 ${v.amt} 点力量和 ${v.amt} 点敏捷（本场战斗）`; },
    effect(ctx) { ctx.combat.applyStatusPlayer('strength', ctx.vars.amt); ctx.combat.applyStatusPlayer('dexterity', ctx.vars.amt); },
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
    id: 'cleave', name: '横扫', icon: '🌀', type: 'attack', cost: 1, target: 'all_enemies', rarity: 'common', cls: 'warrior',
    vars(up) { return { dmg: up ? 11 : 8 }; },
    descTemplate(v) { return `对所有敌人造成 ${v.dmg} 点伤害`; },
    effect(ctx) { ctx.combat.enemies.forEach(e => { if (e.hp > 0) ctx.combat.dealDamageToEnemy(e.id, ctx.vars.dmg, { source: '横扫' }); }); },
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
    vars(up) { return { dmg: up ? 6 : 4 }; },
    descTemplate(v) { return `造成 2 次 ${v.dmg} 点伤害`; },
    effect(ctx) {
      ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '连击' });
      ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '连击' });
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
        ctx.combat.dealDamageToEnemy(e.id, ctx.vars.dmg, { source: '雷鸣' });
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
  true_grit: {
    id: 'true_grit', name: '真气', icon: '💪', type: 'skill', cost: 1, target: 'self', rarity: 'common', cls: 'warrior',
    vars(up) { return { block: up ? 10 : 7 }; },
    descTemplate(v) { return `获得 ${v.block} 点格挡`; },
    effect(ctx) { ctx.combat.gainBlockPlayer(ctx.vars.block); },
  },
  anger: {
    id: 'anger', name: '怒火', icon: '😡', type: 'attack', cost: 0, target: 'enemy', rarity: 'common', cls: 'warrior',
    vars(up) { return { dmg: up ? 8 : 6 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害，本张牌复制一份进弃牌堆`; },
    effect(ctx) {
      ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '怒火' });
      ctx.combat.addCardToDiscard('anger', ctx.card.upgraded);
    },
  },
  battle_trance: {
    id: 'battle_trance', name: '战斗狂热', icon: '📖', type: 'skill', cost: 0, target: 'none', rarity: 'common', cls: 'warrior', exhaust: true,
    vars(up) { return { draw: up ? 4 : 3 }; },
    descTemplate(v) { return `抽 ${v.draw} 张牌（消耗）`; },
    effect(ctx) { ctx.combat.drawCards(ctx.vars.draw); },
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
    vars(up) { return { dmg: up ? 6 : 4, hits: 3 }; },
    descTemplate(v) { return `对所有敌人造成 ${v.hits} 次 ${v.dmg} 点伤害`; },
    effect(ctx) {
      for (let i = 0; i < ctx.vars.hits; i++) {
        ctx.combat.enemies.forEach(e => { if (e.hp > 0) ctx.combat.dealDamageToEnemy(e.id, ctx.vars.dmg, { source: '旋风斩' }); });
      }
    },
  },
  bloodletting: {
    id: 'bloodletting', name: '放血', icon: '🩸', type: 'skill', cost: 0, target: 'none', rarity: 'uncommon', cls: 'warrior',
    vars(up) { return { hpCost: up ? 2 : 3, energy: up ? 3 : 2 }; },
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
    id: 'inflame', name: '战意', icon: '🔥', type: 'power', cost: 1, target: 'none', rarity: 'uncommon', cls: 'warrior',
    vars(up) { return { str: up ? 3 : 2 }; },
    descTemplate(v) { return `永久获得 ${v.str} 点力量（本场战斗）`; },
    effect(ctx) { ctx.combat.applyStatusPlayer('strength', ctx.vars.str); },
  },
  metallicize: {
    id: 'metallicize', name: '金属化', icon: '🔩', type: 'power', cost: 1, target: 'none', rarity: 'uncommon', cls: 'warrior',
    vars(up) { return { block: up ? 4 : 3 }; },
    descTemplate(v) { return `每回合结束时获得 ${v.block} 点格挡`; },
    effect(ctx) { ctx.combat.applyStatusPlayer('metallicize', ctx.vars.block); },
  },
  rampage: {
    id: 'rampage', name: '狂暴打击', icon: '🐗', type: 'attack', cost: 1, target: 'enemy', rarity: 'uncommon', cls: 'warrior',
    vars(up) { return { dmg: up ? 9 : 6, growth: up ? 6 : 4 }; },
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
        total += ctx.combat.dealDamageToEnemy(e.id, ctx.vars.dmg, { source: '收割' });
      });
      ctx.combat.healPlayer(total);
    },
  },
  immolate: {
    id: 'immolate', name: '献祭之炎', icon: '🔥', type: 'attack', cost: 2, target: 'all_enemies', rarity: 'rare', cls: 'warrior',
    vars(up) { return { dmg: up ? 28 : 21 }; },
    descTemplate(v) { return `对所有敌人造成 ${v.dmg} 点伤害`; },
    effect(ctx) { ctx.combat.enemies.forEach(e => { if (e.hp > 0) ctx.combat.dealDamageToEnemy(e.id, ctx.vars.dmg, { source: '献祭之炎' }); }); },
  },
  offering: {
    id: 'offering', name: '献祭', icon: '🕯️', type: 'skill', cost: 0, target: 'none', rarity: 'rare', cls: 'warrior', exhaust: true,
    vars(up) { return { hpCost: up ? 4 : 6, energy: up ? 3 : 2, draw: up ? 5 : 3 }; },
    descTemplate(v) { return `失去 ${v.hpCost} 点生命，获得 ${v.energy} 点能量，抽 ${v.draw} 张牌（消耗）`; },
    effect(ctx) {
      ctx.combat.damagePlayerDirect(ctx.vars.hpCost);
      ctx.combat.gainEnergy(ctx.vars.energy);
      ctx.combat.drawCards(ctx.vars.draw);
    },
  },
  bludgeon: {
    id: 'bludgeon', name: '重殴', icon: '🔱', type: 'attack', cost: 3, target: 'enemy', rarity: 'rare', cls: 'warrior',
    vars(up) { return { dmg: up ? 42 : 32 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点巨额伤害`; },
    effect(ctx) { ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '重殴' }); },
  },

  // ================= 女猎手（Huntress）=================
  dagger_throw: {
    id: 'dagger_throw', name: '飞刀', icon: '🔪', type: 'attack', cost: 1, target: 'enemy', rarity: 'starter', cls: 'huntress',
    vars(up) { return { dmg: up ? 6 : 4, poison: up ? 2 : 1 }; },
    descTemplate(v) { return `造成 ${v.dmg} 点伤害，施加 ${v.poison} 层中毒`; },
    effect(ctx) {
      ctx.combat.dealDamageToEnemy(ctx.target.id, ctx.vars.dmg, { source: '飞刀' });
      ctx.combat.applyStatusEnemy(ctx.target.id, 'poison', ctx.vars.poison);
    },
  },
  footwork: {
    id: 'footwork', name: '脚步', icon: '🦶', type: 'skill', cost: 1, target: 'self', rarity: 'starter', cls: 'huntress',
    vars(up) { return { block: up ? 8 : 5, dex: 1 }; },
    descTemplate(v) { return `获得 ${v.block} 点格挡，永久获得 ${v.dex} 点敏捷（本场战斗）`; },
    effect(ctx) { ctx.combat.gainBlockPlayer(ctx.vars.block); ctx.combat.applyStatusPlayer('dexterity', ctx.vars.dex); },
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
  venomous_fang: {
    id: 'venomous_fang', name: '渗毒獠牙', icon: '🐍', type: 'power', cost: 1, target: 'none', rarity: 'uncommon', cls: 'huntress',
    vars(up) { return { amt: up ? 2 : 1 }; },
    descTemplate(v) { return `永久获得 ${v.amt} 层渗毒：此后你的攻击牌命中造成伤害时，额外施加等量中毒`; },
    effect(ctx) { ctx.combat.applyStatusPlayer('venom', ctx.vars.amt); },
  },

  // ---------------- Huntress rare ----------------
  thousand_cuts: {
    id: 'thousand_cuts', name: '万剑归宗', icon: '⚔️', type: 'attack', cost: 2, target: 'all_enemies', rarity: 'rare', cls: 'huntress',
    vars(up) { return { dmg: up ? 4 : 3, hits: 5 }; },
    descTemplate(v) { return `对所有敌人造成 ${v.hits} 次 ${v.dmg} 点伤害`; },
    effect(ctx) {
      for (let i = 0; i < ctx.vars.hits; i++) {
        ctx.combat.enemies.forEach(e => { if (e.hp > 0) ctx.combat.dealDamageToEnemy(e.id, ctx.vars.dmg, { source: '万剑归宗' }); });
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
};

const REWARD_POOLS = {
  common: {
    neutral: ['bandage_up', 'flash_strike'],
    warrior: ['cleave', 'iron_wave', 'twin_strike', 'pommel_strike', 'thunderclap', 'shrug_it_off', 'true_grit', 'anger', 'battle_trance'],
    huntress: ['quick_slash', 'venom_dart', 'evasive_roll', 'blinding_powder'],
  },
  uncommon: {
    neutral: ['second_skin', 'swift_focus'],
    warrior: ['uppercut', 'whirlwind', 'bloodletting', 'second_wind', 'inflame', 'metallicize', 'rampage'],
    huntress: ['deadly_poison', 'ambush', 'nimble_strike', 'venomous_fang'],
  },
  rare: {
    neutral: ['apex_form'],
    warrior: ['reaper', 'immolate', 'offering', 'bludgeon'],
    huntress: ['thousand_cuts', 'assassinate'],
  },
};

function rollCardRarity() {
  const r = Math.random();
  if (r < 0.60) return 'common';
  if (r < 0.90) return 'uncommon';
  return 'rare';
}

function pickRandomCardId(characterId = 'warrior', excludeIds = []) {
  const rarity = rollCardRarity();
  const tierPools = REWARD_POOLS[rarity];
  const pool = [...tierPools.neutral, ...(tierPools[characterId] || tierPools.warrior)];
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
