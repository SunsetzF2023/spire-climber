// ============================================================
// Relic definitions — passive effects, don't take card/deck slots.
// Hooks (all optional): onPickup(run), onCombatStart(combat),
// onTurnStart(combat), onTurnEnd(combat), onCardPlayed(combat, cardInstance),
// onDamageTaken(combat, amount, attackerEnemyId), onEnemyKilled(combat, enemy),
// onCardExhausted(combat), onCombatEnd(combat).
// onCardAdded(run, defId, upgraded) is special: it fires OUTSIDE combat
// (reward/shop/event card pickups), so it receives the run object directly
// instead of a CombatEngine instance.
// ============================================================

const RELICS = {
  whetstone: {
    id: 'whetstone', name: '磨刀石', icon: '🪨', rarity: 'common',
    desc: '每场战斗开始时获得 1 层力量',
    onCombatStart(combat) { combat.applyStatusPlayer('strength', 1); },
  },
  hourglass: {
    id: 'hourglass', name: '沙漏', icon: '⏳', rarity: 'common',
    desc: '每场战斗开始时获得 3 点格挡',
    onCombatStart(combat) { combat.gainBlockPlayer(3); },
  },
  hunters_badge: {
    id: 'hunters_badge', name: '猎人徽章', icon: '🏅', rarity: 'common',
    desc: '每击杀一个敌人，回复 5 点生命',
    onEnemyKilled(combat) { combat.healPlayer(5); },
  },
  greedy_badge: {
    id: 'greedy_badge', name: '贪婪徽章', icon: '🪙', rarity: 'common',
    desc: '每击杀一个敌人，获得 2 金币',
    onEnemyKilled(combat) { combat.run.gold += 2; combat.log('🪙 贪婪徽章：+2 金币', 'info'); },
  },
  calm_heart: {
    id: 'calm_heart', name: '冷静之心', icon: '🧘', rarity: 'uncommon',
    desc: '回合结束时，未使用的能量转化为等量格挡',
    onTurnEnd(combat) {
      if (combat.energy > 0) {
        combat.gainBlockPlayer(combat.energy);
        combat.log(`🧘 冷静之心：${combat.energy} 点剩余能量转化为格挡`, 'info');
      }
    },
  },
  thorns: {
    id: 'thorns', name: '荆棘铠甲', icon: '🌵', rarity: 'uncommon',
    desc: '受到攻击伤害时，对攻击者造成 3 点反伤',
    onDamageTaken(combat, amount, attackerId) {
      if (amount > 0 && attackerId) combat.dealDamageToEnemy(attackerId, 3, { source: '荆棘铠甲', noThorns: true });
    },
  },
  eagle_eye: {
    id: 'eagle_eye', name: '鹰眼', icon: '🦅', rarity: 'uncommon',
    desc: '每回合开始时多抽 1 张牌',
    onTurnStart(combat) { combat.drawCards(1); },
  },
  vengeful_heart: {
    id: 'vengeful_heart', name: '复仇之心', icon: '💢', rarity: 'uncommon',
    desc: '受到伤害后，获得 1 层力量',
    onDamageTaken(combat, amount) {
      if (amount > 0) combat.applyStatusPlayer('strength', 1);
    },
  },
  serpent_breath: {
    id: 'serpent_breath', name: '灵蛇之息', icon: '🐍', rarity: 'uncommon',
    desc: '每场战斗中，第一张打出的攻击牌费用为 0',
    onCombatStart(combat) { combat.firstAttackFree = true; },
  },
  turbo_heart: {
    id: 'turbo_heart', name: '涡轮之心', icon: '💠', rarity: 'rare',
    desc: '每回合开始时额外获得 1 点能量',
    onTurnStart(combat) { combat.gainEnergy(1); },
  },
  cracked_shield: {
    id: 'cracked_shield', name: '破损战盾', icon: '🛡️', rarity: 'rare',
    desc: '每回合开始时获得 4 点格挡，但获得时永久损失 1 点最大生命',
    onPickup(run) { run.player.maxHp = Math.max(10, run.player.maxHp - 5); run.player.hp = Math.min(run.player.hp, run.player.maxHp); },
    onTurnStart(combat) { combat.gainBlockPlayer(4); },
  },
  bloodstone: {
    id: 'bloodstone', name: '血石', icon: '🔴', rarity: 'rare',
    desc: '战斗胜利后回复 10 点生命',
    onCombatEnd(combat) { combat.healPlayer(10); },
  },
  marbled_pouch: {
    id: 'marbled_pouch', name: '大理石袋', icon: '🔮', rarity: 'common',
    desc: '每场战斗开始时，对所有敌人施加 1 层易伤',
    onCombatStart(combat) { combat.enemies.forEach(e => { if (e.hp > 0) combat.applyStatusEnemy(e.id, 'vulnerable', 1); }); },
  },
  first_strike_fang: {
    id: 'first_strike_fang', name: '先手獠牙', icon: '🦷', rarity: 'common',
    desc: '每场战斗中第一张打出的攻击牌额外造成 8 点伤害',
    onCombatStart(combat) { combat.firstAttackBonusAmount = 8; },
  },
  ceramic_fish: {
    id: 'ceramic_fish', name: '陶瓷鱼', icon: '🐟', rarity: 'common',
    desc: '每当一张卡牌加入你的卡组，获得 9 金币',
    onCardAdded(run) { run.gold += 9; },
  },
  gremlin_horn: {
    id: 'gremlin_horn', name: '地精号角', icon: '📯', rarity: 'uncommon',
    desc: '每当一个敌人死亡，获得 1 点能量并抽 1 张牌',
    onEnemyKilled(combat) { combat.gainEnergy(1); combat.drawCards(1); },
  },
  centennial_puzzle: {
    id: 'centennial_puzzle', name: '百年谜题', icon: '🧩', rarity: 'uncommon',
    desc: '每场战斗中，第一次受到伤害时抽 3 张牌',
    onCombatStart(combat) { combat.relicFlags.centennialUsed = false; },
    onDamageTaken(combat, amount) {
      if (amount > 0 && !combat.relicFlags.centennialUsed) {
        combat.relicFlags.centennialUsed = true;
        combat.drawCards(3);
        combat.log('🧩 百年谜题：抽了 3 张牌', 'info');
      }
    },
  },
  ashen_charm: {
    id: 'ashen_charm', name: '灰烬护符', icon: '🕯️', rarity: 'rare',
    desc: '每当你消耗一张卡牌，对所有敌人造成 3 点伤害',
    onCardExhausted(combat) {
      combat.enemies.forEach(e => { if (e.hp > 0) combat.dealDamageToEnemy(e.id, 3, { source: '灰烬护符', noStrength: true }); });
    },
  },

  // ---------------- Negative / Event relics ----------------
  mark_of_bloom: {
    id: 'mark_of_bloom', name: '绽放之印', icon: '🌸', rarity: 'event',
    desc: '你无法再回复生命',
    onPickup(run) { run.flags = run.flags || {}; run.flags.noHeal = true; },
  },
  gremlin_visage: {
    id: 'gremlin_visage', name: '哥布林面具', icon: '👹', rarity: 'event',
    desc: '每场战斗开始时获得 1 层虚弱',
    onCombatStart(combat) { combat.applyStatusPlayer('weak', 1); },
  },
  mutagenic_strength: {
    id: 'mutagenic_strength', name: '变异力量', icon: '💉', rarity: 'event',
    desc: '每场战斗开始时获得 3 层力量，第一回合结束时失去 3 层力量',
    onCombatStart(combat) {
      combat.applyStatusPlayer('strength', 3);
      combat.relicFlags.mutagenicActive = true;
    },
    onTurnEnd(combat) {
      if (combat.relicFlags.mutagenicActive) {
        combat.relicFlags.mutagenicActive = false;
        combat.applyStatusPlayer('strength', -3);
        combat.log('💉 变异力量消退：力量 -3', 'enemy');
      }
    },
  },
  cursed_key: {
    id: 'cursed_key', name: '诅咒之钥', icon: '🗝️', rarity: 'event',
    desc: '每场战斗开始时额外获得 1 点能量，但获得时加入一张诅咒牌',
    onPickup(run) {
      const curses = ['clumsy', 'decay', 'doubt', 'injury', 'normality', 'pain', 'parasite', 'regret', 'shame', 'writhe'];
      const curseId = curses[Math.floor(Math.random() * curses.length)];
      addCardToDeck(run, curseId, false);
    },
    onCombatStart(combat) { combat.gainEnergy(1); },
  },
  brimstone: {
    id: 'brimstone', name: '硫磺石', icon: '🪨', rarity: 'event',
    desc: '每回合开始时获得 2 层力量，所有敌人获得 1 层力量',
    onTurnStart(combat) {
      combat.applyStatusPlayer('strength', 2);
      combat.enemies.forEach(e => { if (e.hp > 0) combat.applyStatusEnemy(e.id, 'strength', 1); });
    },
  },
  golden_idol: {
    id: 'golden_idol', name: '黄金偶像', icon: '🗿', rarity: 'event',
    desc: '敌人掉落 25% 更多金币',
    onPickup(run) { run.flags = run.flags || {}; run.flags.goldBonus = (run.flags.goldBonus || 0) + 0.25; },
  },
  red_mask: {
    id: 'red_mask', name: '红色面具', icon: '🎭', rarity: 'event',
    desc: '每场战斗开始时对所有敌人施加 1 层虚弱',
    onCombatStart(combat) { combat.enemies.forEach(e => { if (e.hp > 0) combat.applyStatusEnemy(e.id, 'weak', 1); }); },
  },
};

const RELIC_LIST_COMMON = ['whetstone', 'hourglass', 'hunters_badge', 'greedy_badge', 'marbled_pouch', 'first_strike_fang', 'ceramic_fish'];
const RELIC_LIST_UNCOMMON = ['calm_heart', 'thorns', 'eagle_eye', 'vengeful_heart', 'serpent_breath', 'gremlin_horn', 'centennial_puzzle'];
const RELIC_LIST_RARE = ['turbo_heart', 'cracked_shield', 'bloodstone', 'ashen_charm'];
const RELIC_LIST_EVENT = ['mark_of_bloom', 'gremlin_visage', 'mutagenic_strength', 'cursed_key', 'brimstone', 'golden_idol', 'red_mask'];

function pickRandomRelic(excludeIds = []) {
  const r = Math.random();
  const rarity = r < 0.55 ? 'common' : r < 0.88 ? 'uncommon' : 'rare';
  const pool = rarity === 'rare' ? RELIC_LIST_RARE : rarity === 'uncommon' ? RELIC_LIST_UNCOMMON : RELIC_LIST_COMMON;
  const filtered = pool.filter(id => !excludeIds.includes(id));
  const src = filtered.length > 0 ? filtered : pool;
  return src[Math.floor(Math.random() * src.length)];
}
