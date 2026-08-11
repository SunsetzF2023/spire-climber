// ============================================================
// Enemy definitions — each has its own original AI pattern via
// chooseMove(enemy, combat) => move { name, icon, type, displayValue, hitsCount, execute(combat, enemy) }
// enemy instance: { id, defId, name, icon, hp, maxHp, block, statuses:{}, aiState:{}, nextMove }
// ============================================================

function idleMove(name, icon, flavor) {
  return {
    name, icon, type: 'idle', displayValue: null,
    execute(combat, e) { combat.log(`${icon} ${e.name} ${flavor}`, 'enemy'); },
  };
}

const ENEMIES = {
  slime: {
    id: 'slime', name: '腐蚀软泥怪', icon: '🟢', hpRange: [40, 46], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['atk', 'atk', 'debuff'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'debuff') {
        return {
          name: '腐蚀粘液', icon: '🌀', type: 'debuff', displayValue: 1, statusPreview: [{ name: 'weak', amount: 1 }],
          execute(combat, e) { combat.log(`${e.name} 喷出腐蚀粘液！`, 'enemy'); combat.applyStatusPlayer('weak', 1); },
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
      const pattern = ['atk', 'atk', 'atk', 'rest'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'rest') {
        return idleMove('喘息', '💤', '连续撕咬后精疲力竭，喘了口气');
      }
      const dmg = enemy.aiState.biteDmg || 6;
      enemy.aiState.biteDmg = Math.min(dmg + 3, 15);
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
        name: '毒液缠绕', icon: '⚔️', type: 'attack', displayValue: 6, statusPreview: [{ name: 'poison', amount: 2 }],
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
        name: '诅咒之触', icon: '⚔️', type: 'attack', displayValue: 9, statusPreview: [{ name: 'vulnerable', amount: 2 }],
        execute(combat, e) { combat.dealDamageToPlayer(9, e.id); combat.applyStatusPlayer('vulnerable', 2); },
      };
    },
  },

  plague_bearer: {
    id: 'plague_bearer', name: '瘟疫使者', icon: '🧌', hpRange: [110, 120], rarity: 'elite',
    chooseMove(enemy, combat) {
      const pattern = ['toxic_slam', 'regenerate'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'regenerate') {
        return {
          name: '腐化再生', icon: '💚', type: 'heal', displayValue: 20,
          execute(combat, e) {
            combat.healEnemy(e.id, 20);
            combat.gainBlockEnemy(e.id, 10);
            combat.log(`${e.name} 吸收瘴气，回复生命并获得护甲`, 'enemy');
          },
        };
      }
      return {
        name: '毒瘴重击', icon: '⚔️', type: 'attack', displayValue: 14, statusPreview: [{ name: 'poison', amount: 3 }],
        execute(combat, e) { combat.dealDamageToPlayer(14, e.id); combat.applyStatusPlayer('poison', 3); },
      };
    },
  },
  void_reaver: {
    id: 'void_reaver', name: '虚空掠夺者', icon: '👽', hpRange: [130, 145], rarity: 'elite',
    chooseMove(enemy, combat) {
      const pattern = ['rend', 'drain', 'meditate'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'meditate') {
        return idleMove('虚空冥想', '🌀', '陷入虚空冥想，暂时按兵不动');
      }
      if (pattern[step] === 'drain') {
        return {
          name: '生命汲取', icon: '⚔️', type: 'attack', displayValue: 10,
          execute(combat, e) {
            const dealt = combat.dealDamageToPlayer(10, e.id);
            combat.healEnemy(e.id, Math.floor(dealt / 2));
          },
        };
      }
      return {
        name: '虚空撕裂', icon: '⚔️', type: 'attack', displayValue: 18, statusPreview: [{ name: 'vulnerable', amount: 2 }],
        execute(combat, e) { combat.dealDamageToPlayer(18, e.id); combat.applyStatusPlayer('vulnerable', 2); },
      };
    },
  },

  // ---------------- Bosses ----------------
  abyss_lord: {
    id: 'abyss_lord', name: '深渊领主', icon: '👹', hpRange: [190, 210], rarity: 'boss',
    chooseMove(enemy, combat) {
      const pattern = ['slam', 'shield', 'breath'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      const enraged = enemy.hp <= enemy.maxHp * 0.5;

      if (pattern[step] === 'shield') {
        return {
          name: '护盾力场', icon: '🛡️', type: 'defend', displayValue: 20, statusPreview: [{ name: 'weak', amount: 2 }],
          execute(combat, e) {
            combat.log(`${e.name} 张开护盾力场！`, 'enemy');
            combat.gainBlockEnemy(e.id, 20);
            combat.applyStatusPlayer('weak', 2);
          },
        };
      }
      if (pattern[step] === 'breath') {
        return {
          name: '深渊吐息', icon: '⚔️', type: 'attack', displayValue: 12, statusPreview: [{ name: 'poison', amount: 3 }],
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
  iron_colossus: {
    id: 'iron_colossus', name: '钢铁巨像', icon: '🗿', hpRange: [240, 260], rarity: 'boss',
    chooseMove(enemy, combat) {
      const pattern = ['crush', 'overload', 'stomp'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      const enraged = enemy.hp <= enemy.maxHp * 0.5;

      if (pattern[step] === 'overload') {
        return {
          name: '超载充能', icon: '💪', type: 'buff', displayValue: 25,
          execute(combat, e) {
            combat.gainBlockEnemy(e.id, 25);
            combat.applyStatusEnemy(e.id, 'strength', 3);
            combat.log(`${e.name} 超载充能：获得护甲与力量`, 'enemy');
          },
        };
      }
      if (pattern[step] === 'stomp') {
        return {
          name: '重压践踏', icon: '⚔️', type: 'attack', displayValue: 14, statusPreview: [{ name: 'frail', amount: 2 }],
          execute(combat, e) { combat.dealDamageToPlayer(14, e.id); combat.applyStatusPlayer('frail', 2); },
        };
      }
      const dmg = enraged ? 32 : 24;
      return {
        name: enraged ? '狂暴碾压' : '碾压', icon: '⚔️', type: 'attack', displayValue: dmg,
        execute(combat, e) { combat.dealDamageToPlayer(dmg, e.id); },
      };
    },
  },
  void_progenitor: {
    id: 'void_progenitor', name: '虚空造物主', icon: '🪐', hpRange: [300, 330], rarity: 'boss',
    chooseMove(enemy, combat) {
      const pattern = ['annihilate', 'corrupt', 'reality_tear'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      const enraged = enemy.hp <= enemy.maxHp * 0.5;

      if (pattern[step] === 'corrupt') {
        return {
          name: '虚空侵蚀', icon: '🛡️', type: 'defend', displayValue: 20, statusPreview: [{ name: 'weak', amount: 2 }, { name: 'vulnerable', amount: 2 }],
          execute(combat, e) {
            combat.log(`${e.name} 释放虚空侵蚀！`, 'enemy');
            combat.gainBlockEnemy(e.id, 20);
            combat.applyStatusPlayer('weak', 2);
            combat.applyStatusPlayer('vulnerable', 2);
          },
        };
      }
      if (pattern[step] === 'reality_tear') {
        return {
          name: '现实撕裂', icon: '⚔️', type: 'attack', displayValue: 18, statusPreview: [{ name: 'poison', amount: 4 }],
          execute(combat, e) { combat.dealDamageToPlayer(18, e.id); combat.applyStatusPlayer('poison', 4); },
        };
      }
      // annihilate
      if (enraged) {
        return {
          name: '湮灭 x2', icon: '⚔️', type: 'attack', displayValue: 26, hitsCount: 2,
          execute(combat, e) { combat.dealDamageToPlayer(26, e.id); combat.dealDamageToPlayer(26, e.id); },
        };
      }
      return {
        name: '湮灭打击', icon: '⚔️', type: 'attack', displayValue: 26,
        execute(combat, e) { combat.dealDamageToPlayer(26, e.id); },
      };
    },
  },
};

const NORMAL_ENEMY_IDS = ['slime', 'bat', 'rampaging_hound', 'tentacle', 'raider'];

// ============================================================
// Acts ("dimensions") — the run is a sequence of acts, each with its
// own boss, elite roster, and an HP scaling multiplier applied to all
// enemies (normal/elite/boss) spawned within that act.
// ============================================================
const ACT_DEFS = [
  { name: '第一维度：坠落回廊', bossId: 'abyss_lord', eliteIds: ['iron_guard', 'shadow_priest'], scaling: 1.0 },
  { name: '第二维度：锈蚀熔炉', bossId: 'iron_colossus', eliteIds: ['iron_guard', 'shadow_priest', 'plague_bearer'], scaling: 1.35 },
  { name: '第三维度：虚空深渊', bossId: 'void_progenitor', eliteIds: ['shadow_priest', 'plague_bearer', 'void_reaver'], scaling: 1.7 },
];

function spawnEnemyGroup(rarity, act = 1) {
  const actDef = ACT_DEFS[act - 1] || ACT_DEFS[ACT_DEFS.length - 1];
  // Returns an array of enemy defIds for a combat node.
  if (rarity === 'boss') return [actDef.bossId];
  if (rarity === 'elite') return [pick(actDef.eliteIds)];
  // normal: 1-2 enemies
  const count = Math.random() < 0.45 ? 2 : 1;
  const ids = [];
  for (let i = 0; i < count; i++) ids.push(pick(NORMAL_ENEMY_IDS));
  return ids;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
