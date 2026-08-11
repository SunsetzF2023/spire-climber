// ============================================================
// Enemy definitions — each has its own original AI pattern via
// chooseMove(enemy, combat) => move { name, icon, type, displayValue, hitsCount, execute(combat, enemy) }
// enemy instance: { id, defId, name, icon, hp, maxHp, block, statuses:{}, aiState:{}, nextMove }
// ============================================================

const ENEMIES = {
  slime: {
    id: 'slime', name: '腐蚀软泥怪', icon: '🟢', hpRange: [40, 46], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['atk', 'atk', 'debuff'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'debuff') {
        return {
          name: '腐蚀粘液', icon: '🌀', type: 'debuff', displayValue: 1,
          execute(combat, e) { combat.applyStatusPlayer('weak', 1); combat.log(`${e.name} 喷出腐蚀粘液，你获得 1 层虚弱`, 'enemy'); },
        };
      }
      return {
        name: '撞击', icon: '⚔️', type: 'attack', displayValue: 10,
        execute(combat, e) { combat.dealDamageToPlayer(10, e.id); },
      };
    },
  },
  bat: {
    id: 'bat', name: '尖啸蝙蝠', icon: '🦇', hpRange: [28, 32], rarity: 'normal',
    chooseMove(enemy, combat) {
      if (Math.random() < 0.6) {
        return {
          name: '撕咬', icon: '⚔️', type: 'attack', displayValue: 7,
          execute(combat, e) { combat.dealDamageToPlayer(7, e.id); },
        };
      }
      return {
        name: '尖啸', icon: '💪', type: 'buff', displayValue: 2,
        execute(combat, e) { combat.applyStatusEnemy(e.id, 'strength', 2); combat.log(`${e.name} 发出尖啸，力量 +2`, 'enemy'); },
      };
    },
  },
  rampaging_hound: {
    id: 'rampaging_hound', name: '暴走猎犬', icon: '🐕', hpRange: [46, 50], rarity: 'normal',
    chooseMove(enemy, combat) {
      const dmg = enemy.aiState.biteDmg || 6;
      enemy.aiState.biteDmg = dmg + 3;
      return {
        name: '撕咬升级', icon: '⚔️', type: 'attack', displayValue: dmg,
        execute(combat, e) { combat.dealDamageToPlayer(dmg, e.id); },
      };
    },
  },
  tentacle: {
    id: 'tentacle', name: '腐蚀触手', icon: '🐙', hpRange: [42, 48], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['atk_poison', 'guard'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'guard') {
        return {
          name: '硬化', icon: '🛡️', type: 'defend', displayValue: 12,
          execute(combat, e) { combat.gainBlockEnemy(e.id, 12); },
        };
      }
      return {
        name: '毒液缠绕', icon: '⚔️', type: 'attack', displayValue: 6,
        execute(combat, e) { combat.dealDamageToPlayer(6, e.id); combat.applyStatusPlayer('poison', 2); },
      };
    },
  },
  raider: {
    id: 'raider', name: '掠夺者', icon: '🪓', hpRange: [40, 46], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['atk', 'defend', 'atk'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'defend') {
        return {
          name: '格挡', icon: '🛡️', type: 'defend', displayValue: 9,
          execute(combat, e) { combat.gainBlockEnemy(e.id, 9); },
        };
      }
      return {
        name: '劈砍', icon: '⚔️', type: 'attack', displayValue: 11,
        execute(combat, e) { combat.dealDamageToPlayer(11, e.id); },
      };
    },
  },

  // ---------------- Elites ----------------
  iron_guard: {
    id: 'iron_guard', name: '钢铁卫兵', icon: '🤖', hpRange: [95, 105], rarity: 'elite',
    chooseMove(enemy, combat) {
      const pattern = ['slam', 'fortify'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      const enraged = enemy.hp <= enemy.maxHp * 0.5;
      if (pattern[step] === 'fortify') {
        return {
          name: '铸铁强化', icon: '💪', type: 'buff', displayValue: 15,
          execute(combat, e) {
            combat.gainBlockEnemy(e.id, 15);
            combat.applyStatusEnemy(e.id, 'strength', 2);
            combat.log(`${e.name} 铸铁强化：获得护甲与力量`, 'enemy');
          },
        };
      }
      const dmg = enraged ? 18 : 15;
      return {
        name: enraged ? '狂暴重击' : '重击', icon: '⚔️', type: 'attack', displayValue: dmg,
        execute(combat, e) { combat.dealDamageToPlayer(dmg, e.id); },
      };
    },
  },
  shadow_priest: {
    id: 'shadow_priest', name: '暗影祭司', icon: '🧟', hpRange: [85, 95], rarity: 'elite',
    chooseMove(enemy, combat) {
      const turn = enemy.aiState.turn || 0;
      enemy.aiState.turn = turn + 1;
      if (turn % 3 === 2) {
        return {
          name: '暗影恢复', icon: '💚', type: 'heal', displayValue: 15,
          execute(combat, e) { combat.healEnemy(e.id, 15); combat.log(`${e.name} 吸收暗影能量，回复 15 点生命`, 'enemy'); },
        };
      }
      return {
        name: '诅咒之触', icon: '⚔️', type: 'attack', displayValue: 9,
        execute(combat, e) { combat.dealDamageToPlayer(9, e.id); combat.applyStatusPlayer('vulnerable', 2); },
      };
    },
  },

  // ---------------- Boss ----------------
  abyss_lord: {
    id: 'abyss_lord', name: '深渊领主', icon: '👹', hpRange: [190, 210], rarity: 'boss',
    chooseMove(enemy, combat) {
      const pattern = ['slam', 'shield', 'breath'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      const enraged = enemy.hp <= enemy.maxHp * 0.5;

      if (pattern[step] === 'shield') {
        return {
          name: '护盾力场', icon: '🛡️', type: 'defend', displayValue: 20,
          execute(combat, e) {
            combat.gainBlockEnemy(e.id, 20);
            combat.applyStatusPlayer('weak', 2);
            combat.log(`${e.name} 张开护盾力场，你陷入虚弱`, 'enemy');
          },
        };
      }
      if (pattern[step] === 'breath') {
        return {
          name: '深渊吐息', icon: '⚔️', type: 'attack', displayValue: 12,
          execute(combat, e) { combat.dealDamageToPlayer(12, e.id); combat.applyStatusPlayer('poison', 3); },
        };
      }
      // slam
      if (enraged) {
        return {
          name: '狂暴重击 x2', icon: '⚔️', type: 'attack', displayValue: 20, hitsCount: 2,
          execute(combat, e) { combat.dealDamageToPlayer(20, e.id); combat.dealDamageToPlayer(20, e.id); },
        };
      }
      return {
        name: '重击', icon: '⚔️', type: 'attack', displayValue: 20,
        execute(combat, e) { combat.dealDamageToPlayer(20, e.id); },
      };
    },
  },
};

const NORMAL_ENEMY_IDS = ['slime', 'bat', 'rampaging_hound', 'tentacle', 'raider'];
const ELITE_ENEMY_IDS = ['iron_guard', 'shadow_priest'];
const BOSS_ENEMY_IDS = ['abyss_lord'];

function spawnEnemyGroup(rarity) {
  // Returns an array of enemy defIds for a combat node.
  if (rarity === 'boss') return [pick(BOSS_ENEMY_IDS)];
  if (rarity === 'elite') return [pick(ELITE_ENEMY_IDS)];
  // normal: 1-2 enemies
  const count = Math.random() < 0.45 ? 2 : 1;
  const ids = [];
  for (let i = 0; i < count; i++) ids.push(pick(NORMAL_ENEMY_IDS));
  return ids;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
