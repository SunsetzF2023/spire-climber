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
    id: 'slime', name: '腐蚀软泥怪', icon: '🟢', hpRange: [32, 38], rarity: 'normal',
    splitInto: 'slime_medium', splitCount: 2,
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
        name: '撞击', icon: '⚔️', type: 'attack', displayValue: 8,
        execute(combat, e) { combat.dealDamageToPlayer(8, e.id); },
      };
    },
  },
  slime_medium: {
    id: 'slime_medium', name: '腐蚀软泥怪（中）', icon: '🟩', hpRange: [16, 20], rarity: 'normal',
    splitInto: 'slime_small', splitCount: 2,
    chooseMove(enemy, combat) {
      if (enemy.aiState.confused) {
        enemy.aiState.confused = false;
        return idleMove('困惑', '❓', '刚分裂出来，还没缓过神，呆立原地');
      }
      return {
        name: '撞击', icon: '⚔️', type: 'attack', displayValue: 4,
        execute(combat, e) { combat.dealDamageToPlayer(4, e.id); },
      };
    },
  },
  slime_small: {
    id: 'slime_small', name: '腐蚀软泥怪（小）', icon: '🟢', hpRange: [8, 10], rarity: 'normal',
    chooseMove(enemy, combat) {
      if (enemy.aiState.confused) {
        enemy.aiState.confused = false;
        return idleMove('困惑', '❓', '刚分裂出来，还没缓过神，呆立原地');
      }
      return {
        name: '撞击', icon: '⚔️', type: 'attack', displayValue: 2,
        execute(combat, e) { combat.dealDamageToPlayer(2, e.id); },
      };
    },
  },
  bat: {
    id: 'bat', name: '尖啸蝙蝠', icon: '🦇', hpRange: [24, 28], rarity: 'normal',
    chooseMove(enemy, combat) {
      if (Math.random() < 0.6) {
        return {
          name: '撕咬', icon: '⚔️', type: 'attack', displayValue: 6,
          execute(combat, e) { combat.dealDamageToPlayer(6, e.id); },
        };
      }
      return {
        name: '尖啸', icon: '💪', type: 'buff', displayValue: 2,
        execute(combat, e) { combat.applyStatusEnemy(e.id, 'strength', 2); combat.log(`${e.name} 发出尖啸，力量 +2`, 'enemy'); },
      };
    },
  },
  rampaging_hound: {
    id: 'rampaging_hound', name: '暴走猎犬', icon: '🐕', hpRange: [38, 44], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['atk', 'atk', 'atk', 'rest'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'rest') {
        return idleMove('喘息', '💤', '连续撕咬后精疲力竭，喘了口气');
      }
      const dmg = enemy.aiState.biteDmg || 5;
      enemy.aiState.biteDmg = Math.min(dmg + 3, 12);
      return {
        name: '撕咬升级', icon: '⚔️', type: 'attack', displayValue: dmg,
        execute(combat, e) { combat.dealDamageToPlayer(dmg, e.id); },
      };
    },
  },
  tentacle: {
    id: 'tentacle', name: '腐蚀触手', icon: '🐙', hpRange: [36, 42], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['atk_vuln', 'guard'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'guard') {
        return {
          name: '硬化', icon: '🛡️', type: 'defend', displayValue: 10,
          execute(combat, e) { combat.gainBlockEnemy(e.id, 10); },
        };
      }
      return {
        name: '缠绕撕裂', icon: '⚔️', type: 'attack', displayValue: 8, statusPreview: [{ name: 'vulnerable', amount: 1 }],
        execute(combat, e) { combat.dealDamageToPlayer(8, e.id); combat.applyStatusPlayer('vulnerable', 1); },
      };
    },
  },
  raider: {
    id: 'raider', name: '掠夺者', icon: '🪓', hpRange: [34, 40], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['atk', 'defend', 'atk'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'defend') {
        return {
          name: '格挡', icon: '🛡️', type: 'defend', displayValue: 8,
          execute(combat, e) { combat.gainBlockEnemy(e.id, 8); },
        };
      }
      return {
        name: '劈砍', icon: '⚔️', type: 'attack', displayValue: 9,
        execute(combat, e) { combat.dealDamageToPlayer(9, e.id); },
      };
    },
  },
  skeleton_guard: {
    id: 'skeleton_guard', name: '骸骨卫兵', icon: '💀', hpRange: [34, 40], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['atk', 'defend'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'defend') {
        return {
          name: '骨盾', icon: '🛡️', type: 'defend', displayValue: 8,
          execute(combat, e) { combat.gainBlockEnemy(e.id, 8); },
        };
      }
      return {
        name: '骸骨挥砍', icon: '⚔️', type: 'attack', displayValue: 9,
        execute(combat, e) { combat.dealDamageToPlayer(9, e.id); },
      };
    },
  },
  hornet_swarm: {
    id: 'hornet_swarm', name: '蜂群', icon: '🐝', hpRange: [24, 28], rarity: 'normal',
    chooseMove(enemy, combat) {
      if (Math.random() < 0.15) {
        return idleMove('盘旋', '🌀', '收拢队形，绕着你盘旋');
      }
      return {
        name: '双重刺击', icon: '⚔️', type: 'attack', displayValue: 4, hitsCount: 2,
        execute(combat, e) { combat.dealDamageToPlayer(4, e.id); if (e.hp > 0) combat.dealDamageToPlayer(4, e.id); },
      };
    },
  },
  gargoyle: {
    id: 'gargoyle', name: '石像鬼', icon: '🪨', hpRange: [44, 50], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['charge', 'charge', 'unleash'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'charge') {
        return {
          name: '蓄力', icon: '🛡️', type: 'defend', displayValue: 10,
          execute(combat, e) { combat.gainBlockEnemy(e.id, 10); combat.log(`${e.name} 石化蓄力`, 'enemy'); },
        };
      }
      return {
        name: '碎石猛击', icon: '⚔️', type: 'attack', displayValue: 18,
        execute(combat, e) { combat.dealDamageToPlayer(18, e.id); },
      };
    },
  },
  shadow_assassin: {
    id: 'shadow_assassin', name: '暗影刺客', icon: '🗡️', hpRange: [24, 28], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['ambush', 'atk', 'atk'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'ambush') {
        return {
          name: '伏击', icon: '⚔️', type: 'attack', displayValue: 13,
          execute(combat, e) { combat.dealDamageToPlayer(13, e.id); },
        };
      }
      return {
        name: '突刺', icon: '⚔️', type: 'attack', displayValue: 7,
        execute(combat, e) { combat.dealDamageToPlayer(7, e.id); },
      };
    },
  },

  // ---------------- New Act 1 enemies (StS-inspired) ----------------
  jaw_worm: {
    id: 'jaw_worm', name: '颚虫', icon: '🪱', hpRange: [40, 46], rarity: 'normal',
    chooseMove(enemy, combat) {
      const r = Math.random();
      if (r < 0.25) {
        return {
          name: '咆哮', icon: '💪', type: 'buff', displayValue: 3,
          execute(combat, e) { combat.applyStatusEnemy(e.id, 'strength', 3); combat.gainBlockEnemy(e.id, 6); combat.log(`${e.name} 咆哮：力量 +3，格挡 +6`, 'enemy'); },
        };
      }
      if (r < 0.55) {
        return {
          name: '啃咬', icon: '⚔️', type: 'attack', displayValue: 11,
          execute(combat, e) { combat.dealDamageToPlayer(11, e.id); },
        };
      }
      return {
        name: '撕扯', icon: '⚔️', type: 'attack', displayValue: 7, hitsCount: 2,
        execute(combat, e) { combat.dealDamageToPlayer(7, e.id); if (e.hp > 0) combat.dealDamageToPlayer(7, e.id); },
      };
    },
  },
  fungi_beast: {
    id: 'fungi_beast', name: '真菌兽', icon: '🍄', hpRange: [22, 28], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['atk', 'grow', 'spore', 'atk'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'grow') {
        return {
          name: '菌丝生长', icon: '🛡️', type: 'defend', displayValue: 6, statusPreview: [{ name: 'strength', amount: 2 }],
          execute(combat, e) { combat.gainBlockEnemy(e.id, 6); combat.applyStatusEnemy(e.id, 'strength', 2); combat.log(`${e.name} 菌丝生长：格挡 +6，力量 +2`, 'enemy'); },
        };
      }
      if (pattern[step] === 'spore') {
        return {
          name: '孢子云', icon: '🍄', type: 'debuff', displayValue: null,
          execute(combat, e) { combat.shuffleStatusIntoDrawPile('slimed', 2); combat.log(`🍄 ${e.name} 释放孢子云，2 张粘液牌洗入抽牌堆！`, 'enemy'); },
        };
      }
      return {
        name: '孢子喷吐', icon: '⚔️', type: 'attack', displayValue: 6,
        execute(combat, e) { combat.dealDamageToPlayer(6, e.id); },
      };
    },
  },
  gremlin_nob: {
    id: 'gremlin_nob', name: '哥布林首领', icon: '👺', hpRange: [50, 56], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['rage', 'atk', 'atk', 'atk'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'rage') {
        return {
          name: '狂怒', icon: '💪', type: 'buff', displayValue: 4,
          execute(combat, e) { combat.applyStatusEnemy(e.id, 'strength', 4); combat.log(`${e.name} 进入狂怒：力量 +4`, 'enemy'); },
        };
      }
      const dmg = 10 + (enemy.statuses.strength || 0);
      return {
        name: '重棍', icon: '⚔️', type: 'attack', displayValue: dmg,
        execute(combat, e) { combat.dealDamageToPlayer(dmg, e.id); },
      };
    },
  },

  // ---------------- New Act 2 enemies (StS-inspired) ----------------
  chosen: {
    id: 'chosen', name: '被选者', icon: '🀄', hpRange: [60, 68], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['poke', 'drain', 'debilitate', 'zap'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'drain') {
        return {
          name: '汲取', icon: '💪', type: 'buff', displayValue: 3, statusPreview: [{ name: 'weak', amount: 2 }],
          execute(combat, e) { combat.applyStatusPlayer('weak', 2); combat.applyStatusEnemy(e.id, 'strength', 3); combat.log(`${e.name} 汲取你的力量！`, 'enemy'); },
        };
      }
      if (pattern[step] === 'debilitate') {
        return {
          name: '削弱', icon: '⚔️', type: 'attack', displayValue: 10, statusPreview: [{ name: 'vulnerable', amount: 2 }],
          execute(combat, e) { combat.dealDamageToPlayer(10, e.id); combat.applyStatusPlayer('vulnerable', 2); },
        };
      }
      if (pattern[step] === 'zap') {
        return {
          name: '电击', icon: '⚔️', type: 'attack', displayValue: 18,
          execute(combat, e) { combat.dealDamageToPlayer(18, e.id); combat.shuffleStatusIntoDrawPile('burn', 1); combat.log(`🔥 ${e.name} 的电击灼烧了你！1 张灼烧牌洗入抽牌堆`, 'enemy'); },
        };
      }
      return {
        name: '戳刺', icon: '⚔️', type: 'attack', displayValue: 5, hitsCount: 2,
        execute(combat, e) { combat.dealDamageToPlayer(5, e.id); if (e.hp > 0) combat.dealDamageToPlayer(5, e.id); },
      };
    },
  },
  spheric_guardian: {
    id: 'spheric_guardian', name: '球形守护者', icon: '🔮', hpRange: [48, 54], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['slam', 'guard', 'slam', 'slam'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'guard') {
        return {
          name: '力场护盾', icon: '🛡️', type: 'defend', displayValue: 20,
          execute(combat, e) { combat.gainBlockEnemy(e.id, 20); combat.log(`${e.name} 展开力场护盾`, 'enemy'); },
        };
      }
      return {
        name: '冲撞', icon: '⚔️', type: 'attack', displayValue: 12,
        execute(combat, e) { combat.dealDamageToPlayer(12, e.id); },
      };
    },
  },
  snake_plant: {
    id: 'snake_plant', name: '蛇花', icon: '🐍', hpRange: [52, 60], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['chomp', 'atk', 'chomp'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'chomp') {
        return {
          name: '撕咬', icon: '⚔️', type: 'attack', displayValue: 7, hitsCount: 3,
          execute(combat, e) { combat.dealDamageToPlayer(7, e.id); if (e.hp > 0) combat.dealDamageToPlayer(7, e.id); if (e.hp > 0) combat.dealDamageToPlayer(7, e.id); },
        };
      }
      return {
        name: '缠绕', icon: '⚔️', type: 'attack', displayValue: 15,
        execute(combat, e) { combat.dealDamageToPlayer(15, e.id); },
      };
    },
  },

  // ---------------- Dimension 2 enemies (special mechanics) ----------------
  card_reactor: {
    id: 'card_reactor', name: '符文反应堆', icon: '⚙️', hpRange: [50, 60], rarity: 'normal',
    onCardPlayed(enemy, combat, card) {
      enemy.aiState.cardsPlayed = (enemy.aiState.cardsPlayed || 0) + 1;
      if (enemy.aiState.cardsPlayed >= 2) {
        enemy.aiState.cardsPlayed = 0;
        combat.applyStatusEnemy(enemy.id, 'strength', 1);
        combat.log(`⚙️ ${enemy.name} 吸收符文能量，力量 +1`, 'enemy');
      }
    },
    chooseMove(enemy, combat) {
      const pattern = ['atk', 'charge', 'atk'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'charge') {
        return {
          name: '充能', icon: '🔋', type: 'buff', displayValue: 12,
          execute(combat, e) { combat.gainBlockEnemy(e.id, 12); combat.applyStatusEnemy(e.id, 'strength', 2); combat.log(`${e.name} 蓄能充能！`, 'enemy'); },
        };
      }
      const dmg = 10 + (enemy.statuses.strength || 0);
      return {
        name: '符文轰击', icon: '⚔️', type: 'attack', displayValue: dmg,
        execute(combat, e) { combat.dealDamageToPlayer(dmg, e.id); },
      };
    },
  },
  necro_minion: {
    id: 'necro_minion', name: '亡灵随从', icon: '💀', hpRange: [12, 16], rarity: 'normal',
    chooseMove(enemy, combat) {
      return {
        name: '撕咬', icon: '⚔️', type: 'attack', displayValue: 5,
        execute(combat, e) { combat.dealDamageToPlayer(5, e.id); },
      };
    },
  },
  necromancer: {
    id: 'necromancer', name: '死灵法师', icon: '🧙', hpRange: [55, 65], rarity: 'normal',
    chooseMove(enemy, combat) {
      if (!enemy.aiState.initialized) {
        enemy.aiState.initialized = true;
        enemy.protected = true;
      }
      const pattern = ['summon', 'atk', 'atk', 'summon'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'summon') {
        const livingMinions = (enemy.aiState.summonedMinionIds || []).filter(id => {
          const m = combat.enemies.find(e => e.id === id);
          return m && m.hp > 0;
        });
        if (livingMinions.length < 2) {
          return {
            name: '召唤亡灵', icon: '🧟', type: 'summon', displayValue: null,
            execute(combat, e) { combat.summonEnemy(e, 'necro_minion', { registerToSummoner: true }); },
          };
        }
        return {
          name: '死亡射线', icon: '⚔️', type: 'attack', displayValue: 12, statusPreview: [{ name: 'weak', amount: 1 }],
          execute(combat, e) { combat.dealDamageToPlayer(12, e.id); combat.applyStatusPlayer('weak', 1); },
        };
      }
      return {
        name: '灵魂汲取', icon: '⚔️', type: 'attack', displayValue: 10,
        execute(combat, e) {
          const dealt = combat.dealDamageToPlayer(10, e.id);
          if (dealt > 0) { combat.healEnemy(e.id, Math.floor(dealt / 2)); combat.log(`${e.name} 汲取了 ${Math.floor(dealt / 2)} 点生命`, 'enemy'); }
        },
      };
    },
  },
  silence_warden: {
    id: 'silence_warden', name: '沉默守望者', icon: '🔇', hpRange: [48, 56], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['silence', 'atk', 'atk'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'silence') {
        return {
          name: '封印术', icon: '🔒', type: 'debuff', displayValue: null, statusPreview: [{ name: 'cardLock', amount: 1 }],
          execute(combat, e) { combat.applyStatusPlayer('cardLock', 1); combat.log(`🔇 ${e.name} 施放封印术！你下回合无法打出卡牌！`, 'enemy'); },
        };
      }
      return {
        name: '静默之刃', icon: '⚔️', type: 'attack', displayValue: 14,
        execute(combat, e) { combat.dealDamageToPlayer(14, e.id); },
      };
    },
  },
  mirror_sprite: {
    id: 'mirror_sprite', name: '镜影精灵', icon: '🪞', hpRange: [40, 48], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['atk', 'reflect', 'atk'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'reflect') {
        return {
          name: '镜面反射', icon: '🪞', type: 'defend', displayValue: 8,
          execute(combat, e) {
            combat.gainBlockEnemy(e.id, 8);
            e.aiState.reflecting = true;
            combat.log(`${e.name} 张开镜面，本回合受到攻击将反射伤害！`, 'enemy');
          },
        };
      }
      return {
        name: '碎片风暴', icon: '⚔️', type: 'attack', displayValue: 8, hitsCount: 2,
        execute(combat, e) { combat.dealDamageToPlayer(8, e.id); if (e.hp > 0) combat.dealDamageToPlayer(8, e.id); },
      };
    },
    onCardPlayed(enemy, combat, card) {
      if (enemy.aiState.reflecting && CARDS[card.defId].type === 'attack') {
        enemy.aiState.reflecting = false;
        combat.damagePlayerDirect(4);
        combat.log(`🪞 ${enemy.name} 反射了 4 点伤害！`, 'enemy');
      }
    },
  },
  rust_sentinel: {
    id: 'rust_sentinel', name: '锈蚀哨兵', icon: '🤖', hpRange: [58, 68], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['guard', 'corrode', 'slam'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'guard') {
        return {
          name: '锈蚀护甲', icon: '🛡️', type: 'defend', displayValue: 16,
          execute(combat, e) { combat.gainBlockEnemy(e.id, 16); combat.log(`${e.name} 锈蚀护甲激活`, 'enemy'); },
        };
      }
      if (pattern[step] === 'corrode') {
        return {
          name: '腐蚀喷吐', icon: '⚔️', type: 'attack', displayValue: 8, statusPreview: [{ name: 'frail', amount: 2 }, { name: 'weak', amount: 1 }],
          execute(combat, e) { combat.dealDamageToPlayer(8, e.id); combat.applyStatusPlayer('frail', 2); combat.applyStatusPlayer('weak', 1); combat.shuffleStatusIntoDrawPile('dazed', 1); combat.log(`🌫️ ${e.name} 的腐蚀让你迷茫！1 张迷茫牌洗入抽牌堆`, 'enemy'); },
        };
      }
      return {
        name: '铁拳重击', icon: '⚔️', type: 'attack', displayValue: 20,
        execute(combat, e) { combat.dealDamageToPlayer(20, e.id); },
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
        name: '毒瘴重击', icon: '⚔️', type: 'attack', displayValue: 16, statusPreview: [{ name: 'frail', amount: 2 }],
        execute(combat, e) { combat.dealDamageToPlayer(16, e.id); combat.applyStatusPlayer('frail', 2); },
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
          name: '深渊吐息', icon: '⚔️', type: 'attack', displayValue: 13, statusPreview: [{ name: 'vulnerable', amount: 2 }],
          execute(combat, e) { combat.dealDamageToPlayer(13, e.id); combat.applyStatusPlayer('vulnerable', 2); },
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
          name: '现实撕裂', icon: '⚔️', type: 'attack', displayValue: 20, statusPreview: [{ name: 'weak', amount: 2 }, { name: 'vulnerable', amount: 2 }],
          execute(combat, e) { combat.dealDamageToPlayer(20, e.id); combat.applyStatusPlayer('weak', 2); combat.applyStatusPlayer('vulnerable', 2); },
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

const NORMAL_ENEMY_IDS = ['slime', 'bat', 'rampaging_hound', 'tentacle', 'raider', 'skeleton_guard', 'hornet_swarm', 'gargoyle', 'shadow_assassin', 'jaw_worm', 'fungi_beast', 'gremlin_nob'];

const ACT2_ENEMY_IDS = ['card_reactor', 'necromancer', 'silence_warden', 'mirror_sprite', 'rust_sentinel', 'chosen', 'spheric_guardian', 'snake_plant', 'gargoyle', 'shadow_assassin'];

// ============================================================
// Acts ("dimensions") — the run is a sequence of acts, each with its
// own boss, elite roster, and an HP scaling multiplier applied to all
// enemies (normal/elite/boss) spawned within that act.
// ============================================================
const ACT_DEFS = [
  { name: '第一维度：坠落回廊', bossId: 'abyss_lord', eliteIds: ['iron_guard', 'shadow_priest'], scaling: 1.0, dmgScaling: 1.0, doubleSpawnChance: 0.30, enemyPool: NORMAL_ENEMY_IDS },
  { name: '第二维度：锈蚀熔炉', bossId: 'iron_colossus', eliteIds: ['iron_guard', 'shadow_priest', 'plague_bearer'], scaling: 1.35, dmgScaling: 1.2, doubleSpawnChance: 0.45, enemyPool: ACT2_ENEMY_IDS },
  { name: '第三维度：虚空深渊', bossId: 'void_progenitor', eliteIds: ['shadow_priest', 'plague_bearer', 'void_reaver'], scaling: 1.7, dmgScaling: 1.4, doubleSpawnChance: 0.55, enemyPool: ACT2_ENEMY_IDS },
];

function spawnEnemyGroup(rarity, act = 1) {
  const actDef = ACT_DEFS[act - 1] || ACT_DEFS[ACT_DEFS.length - 1];
  // Returns an array of enemy defIds for a combat node.
  if (rarity === 'boss') return [actDef.bossId];
  if (rarity === 'elite') return [pick(actDef.eliteIds)];
  // normal: 1-2 enemies
  const count = Math.random() < (actDef.doubleSpawnChance ?? 0.45) ? 2 : 1;
  const ids = [];
  for (let i = 0; i < count; i++) ids.push(pick(actDef.enemyPool || NORMAL_ENEMY_IDS));
  return ids;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
