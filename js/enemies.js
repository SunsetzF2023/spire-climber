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
      const pattern = ['atk', 'grow', 'entangle', 'atk'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'entangle') {
        return {
          name: '寄生藤蔓', icon: '🌿', type: 'debuff', displayValue: 1, statusPreview: [{ name: 'entangle', amount: 1 }],
          execute(combat, e) { combat.applyStatusPlayer('entangle', 1); combat.log(`🌿 ${e.name} 释放寄生藤蔓！1 张手牌将被封印！`, 'enemy'); },
        };
      }
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
      const pattern = ['chomp', 'entangle', 'atk', 'chomp'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'entangle') {
        return {
          name: '蛇藤缠绕', icon: '🌿', type: 'debuff', displayValue: 2, statusPreview: [{ name: 'entangle', amount: 2 }],
          execute(combat, e) { combat.applyStatusPlayer('entangle', 2); combat.log(`🌿 ${e.name} 释放蛇藤缠绕！2 张手牌将被封印！`, 'enemy'); },
        };
      }
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
      const pattern = ['silence', 'chaos', 'atk', 'atk'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'chaos') {
        return {
          name: '混乱领域', icon: '🌀', type: 'debuff', displayValue: null, statusPreview: [{ name: 'chaos', amount: 1 }],
          execute(combat, e) { combat.applyStatusPlayer('chaos', 1); combat.log(`🌀 ${e.name} 展开混乱领域！你的卡牌费用被打乱！`, 'enemy'); },
        };
      }
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
      const lastDmg = enemy.aiState.lastPlayerDamage || 0;
      const lastBlock = enemy.aiState.lastPlayerBlock || 0;
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % 2;
      if (step === 0) {
        return {
          name: '镜面护盾', icon: '🪞', type: 'defend', displayValue: lastDmg > 0 ? lastDmg : null,
          execute(combat, e) {
            if (lastDmg > 0) {
              combat.gainBlockEnemy(e.id, lastDmg);
              combat.log(`🪞 ${e.name} 镜像了你上回合的 ${lastDmg} 点伤害，获得等量格挡！`, 'enemy');
            } else {
              combat.gainBlockEnemy(e.id, 6);
              combat.log(`🪞 ${e.name} 凝聚镜面，获得 6 点格挡`, 'enemy');
            }
          },
        };
      }
      return {
        name: '镜面反击', icon: '⚔️', type: 'attack', displayValue: lastBlock > 0 ? lastBlock : 6,
        execute(combat, e) {
          if (lastBlock > 0) {
            combat.dealDamageToPlayer(lastBlock, e.id);
            combat.log(`🪞 ${e.name} 镜像了你上回合的 ${lastBlock} 点格挡，造成等量伤害！`, 'enemy');
          } else {
            combat.dealDamageToPlayer(6, e.id);
            combat.log(`🪞 ${e.name} 发射碎片，造成 6 点伤害`, 'enemy');
          }
        },
      };
    },
    onTurnEnd(enemy, combat) {
      enemy.aiState.lastPlayerDamage = combat.turnDamageDealt;
      enemy.aiState.lastPlayerBlock = combat.turnBlockGained;
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

  // ---------------- Adventurer enemies (from dying_adventurer event) ----------------
  adventurer_guardian: {
    id: 'adventurer_guardian', name: '冒险者·守护', icon: '🛡️', hpRange: [45, 55], rarity: 'normal',
    onSpawn(enemy) { enemy.taunt = true; },
    chooseMove(enemy, combat) {
      const pattern = ['guard', 'guard', 'burst', 'guard'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'guard') {
        return {
          name: '蓄力防御', icon: '🛡️', type: 'defend', displayValue: 18,
          execute(combat, e) {
            combat.gainBlockEnemy(e.id, 18);
            combat.applyStatusEnemy(e.id, 'strength', 2);
            combat.log(`🛡️ ${e.name} 蓄力防御：格挡 +18，力量 +2`, 'enemy');
          },
        };
      }
      const dmg = 16 + (enemy.statuses.strength || 0) * 2;
      return {
        name: '爆发重击', icon: '⚔️', type: 'attack', displayValue: dmg,
        execute(combat, e) { combat.dealDamageToPlayer(dmg, e.id); combat.log(`💥 ${e.name} 蓄力完毕，爆发重击！`, 'enemy'); },
      };
    },
  },
  adventurer_thief: {
    id: 'adventurer_thief', name: '冒险者·盗贼', icon: '🥷', hpRange: [30, 38], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['steal', 'stab', 'flee'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'steal') {
        return {
          name: '偷窃', icon: '🥷', type: 'debuff', displayValue: null,
          execute(combat, e) {
            const stolen = 10 + Math.floor(Math.random() * 10);
            combat.run.gold = Math.max(0, combat.run.gold - stolen);
            combat.log(`🥷 ${e.name} 偷走了你 ${stolen} 金币！`, 'enemy');
          },
        };
      }
      if (pattern[step] === 'flee') {
        return {
          name: '逃跑', icon: '🏃', type: 'idle', displayValue: null,
          execute(combat, e) {
            e.hp = 0;
            combat.log(`🏃 ${e.name} 逃跑了！`, 'info');
            combat.handleEnemyDeath(e);
          },
        };
      }
      const dmg = 8 + (enemy.statuses.strength || 0);
      return {
        name: '匕首刺击', icon: '⚔️', type: 'attack', displayValue: dmg, hitsCount: 2,
        execute(combat, e) { combat.dealDamageToPlayer(dmg, e.id); if (e.hp > 0) combat.dealDamageToPlayer(dmg, e.id); },
      };
    },
  },
  adventurer_fragile: {
    id: 'adventurer_fragile', name: '冒险者·虚弱', icon: '🤕', hpRange: [15, 22], rarity: 'normal',
    chooseMove(enemy, combat) {
      const dmg = 6 + (enemy.statuses.strength || 0);
      return {
        name: '虚弱反击', icon: '⚔️', type: 'attack', displayValue: dmg,
        execute(combat, e) { combat.dealDamageToPlayer(dmg, e.id); },
      };
    },
  },
  adventurer_disguised: {
    id: 'adventurer_disguised', name: '冒险者·伪装', icon: '🎭', hpRange: [40, 50], rarity: 'normal',
    onSpawn(enemy) {
      const pool = ['slime', 'bat', 'rampaging_hound', 'skeleton_guard', 'jaw_worm', 'gremlin_nob'];
      const realId = pool[Math.floor(Math.random() * pool.length)];
      enemy.aiState.disguiseAs = realId;
      enemy.aiState.revealed = false;
    },
    chooseMove(enemy, combat) {
      if (!enemy.aiState.revealed) {
        enemy.aiState.revealed = true;
        const realDef = ENEMIES[enemy.aiState.disguiseAs];
        return {
          name: '撕下伪装', icon: '🎭', type: 'buff', displayValue: null,
          execute(combat, e) {
            e.name = realDef.name;
            e.icon = realDef.icon;
            e.defId = enemy.aiState.disguiseAs;
            combat.applyStatusEnemy(e.id, 'strength', 2);
            combat.log(`🎭 ${e.name} 撕下伪装，露出了真面目：${realDef.name}！`, 'enemy');
          },
        };
      }
      const realDef = ENEMIES[enemy.aiState.disguiseAs];
      enemy.name = realDef.name;
      enemy.icon = realDef.icon;
      return realDef.chooseMove(enemy, combat);
    },
  },

  // ---------------- Summoner & Taunt enemies ----------------
  cultist_summoner: {
    id: 'cultist_summoner', name: '邪教召唤师', icon: '🧙', hpRange: [48, 56], rarity: 'elite',
    chooseMove(enemy, combat) {
      const pattern = ['summon', 'atk', 'atk', 'ritual'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'summon') {
        return {
          name: '召唤随从', icon: '🧟', type: 'summon', displayValue: null,
          execute(combat, e) {
            const minionCount = combat.enemies.filter(en => en.hp > 0 && en.defId === 'cultist_minion').length;
            if (minionCount < 2) {
              combat.summonEnemy(e, 'cultist_minion', { registerToSummoner: true });
            } else {
              combat.log(`🧙 ${e.name} 试图召唤，但随从已满！`, 'enemy');
            }
          },
        };
      }
      if (pattern[step] === 'ritual') {
        return {
          name: '仪式', icon: '💪', type: 'buff', displayValue: 3,
          execute(combat, e) { combat.applyStatusEnemy(e.id, 'strength', 3); combat.log(`🧙 ${e.name} 举行仪式：力量 +3`, 'enemy'); },
        };
      }
      const dmg = 8 + (enemy.statuses.strength || 0);
      return {
        name: '暗影箭', icon: '⚔️', type: 'attack', displayValue: dmg,
        execute(combat, e) { combat.dealDamageToPlayer(dmg, e.id); },
      };
    },
  },
  cultist_minion: {
    id: 'cultist_minion', name: '邪教随从', icon: '🧟', hpRange: [12, 18], rarity: 'normal',
    chooseMove(enemy, combat) {
      const dmg = 6 + (enemy.statuses.strength || 0);
      return {
        name: '撕咬', icon: '⚔️', type: 'attack', displayValue: dmg,
        execute(combat, e) { combat.dealDamageToPlayer(dmg, e.id); },
      };
    },
  },
  stone_guardian: {
    id: 'stone_guardian', name: '石像守护者', icon: '🗿', hpRange: [55, 65], rarity: 'normal',
    onSpawn(enemy) { enemy.taunt = true; },
    chooseMove(enemy, combat) {
      const pattern = ['guard', 'slam', 'guard', 'slam'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'guard') {
        return {
          name: '石化防御', icon: '🛡️', type: 'defend', displayValue: 15,
          execute(combat, e) { combat.gainBlockEnemy(e.id, 15); combat.log(`🗿 ${e.name} 石化防御`, 'enemy'); },
        };
      }
      return {
        name: '巨石碾压', icon: '⚔️', type: 'attack', displayValue: 14,
        execute(combat, e) { combat.dealDamageToPlayer(14, e.id); },
      };
    },
  },
  shieldbearer: {
    id: 'shieldbearer', name: '持盾卫士', icon: '🛡️', hpRange: [40, 48], rarity: 'normal',
    onSpawn(enemy) { enemy.taunt = true; },
    chooseMove(enemy, combat) {
      const pattern = ['defend', 'atk', 'defend'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'defend') {
        return {
          name: '举盾', icon: '🛡️', type: 'defend', displayValue: 12,
          execute(combat, e) { combat.gainBlockEnemy(e.id, 12); },
        };
      }
      return {
        name: '盾击', icon: '⚔️', type: 'attack', displayValue: 8,
        execute(combat, e) { combat.dealDamageToPlayer(8, e.id); },
      };
    },
  },

  // ---------------- Elites ----------------
  iron_guard: {
    id: 'iron_guard', name: '钢铁卫兵', icon: '🤖', hpRange: [95, 105], rarity: 'elite',
    // 尖刺护甲机制：铸铁强化后获得的护甲带有反伤尖刺，只要护甲未被打穿，
    // 每次直接攻击它都会反弹固定伤害；护甲耗尽后尖刺自动失效。
    chooseMove(enemy, combat) {
      const pattern = ['slam', 'fortify'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      const enraged = enemy.hp <= enemy.maxHp * 0.5;
      if (pattern[step] === 'fortify') {
        return {
          name: '铸铁强化', icon: '�', type: 'buff', displayValue: 15, statusPreview: [{ name: 'strength', amount: 2 }],
          execute(combat, e) {
            combat.gainBlockEnemy(e.id, 15);
            combat.applyStatusEnemy(e.id, 'strength', 2);
            e.thorns = 6;
            combat.log(`🔩 ${e.name} 铸铁强化：获得护甲与力量，护甲带有尖刺（未破甲前攻击它会反弹 6 点伤害）`, 'enemy');
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
    // 能量虹吸机制：暗影诅咒不仅会往抽牌堆里塞诅咒牌，还会立即抽走你本回合的能量
    // 转化为自身力量，是即时的资源掠夺，而非单纯延迟生效的诅咒牌。
    chooseMove(enemy, combat) {
      const turn = enemy.aiState.turn || 0;
      enemy.aiState.turn = turn + 1;
      if (turn % 4 === 3) {
        return {
          name: '暗影缠绕', icon: '🌿', type: 'debuff', displayValue: 2, statusPreview: [{ name: 'entangle', amount: 2 }],
          execute(combat, e) { combat.applyStatusPlayer('entangle', 2); combat.log(`🌿 ${e.name} 释放暗影缠绕！2 张手牌将被封印！`, 'enemy'); },
        };
      }
      if (turn % 4 === 2) {
        return {
          name: '暗影恢复', icon: '💚', type: 'heal', displayValue: 15,
          execute(combat, e) { combat.healEnemy(e.id, 15); combat.log(`${e.name} 吸收暗影能量，回复 15 点生命`, 'enemy'); },
        };
      }
      if (turn % 4 === 1) {
        return {
          name: '能量虹吸', icon: '🌀', type: 'debuff', displayValue: null, statusPreview: [{ name: 'strength', amount: 1 }],
          execute(combat, e) {
            combat.shuffleStatusIntoDrawPile('necro_curse', 1);
            combat.nextTurnEnergyPenalty = (combat.nextTurnEnergyPenalty || 0) + 1;
            combat.applyStatusEnemy(e.id, 'strength', 1);
            combat.log(`🌀 ${e.name} 虹吸你的能量！你下回合起始能量 -1，同时 1 张死灵诅咒洗入抽牌堆`, 'enemy');
          },
        };
      }
      return {
        name: '诅咒之触', icon: '⚔️', type: 'attack', displayValue: 9,
        execute(combat, e) { combat.dealDamageToPlayer(9, e.id); },
      };
    },
  },

  plague_bearer: {
    id: 'plague_bearer', name: '瘟疫使者', icon: '🧌', hpRange: [110, 120], rarity: 'elite',
    // 瘟疫虹吸机制：毒瘴重击会直接给玩家叠中毒层数，而"腐化再生"回复的生命值
    // 与玩家当前的中毒层数成正比——中毒堆得越高，它就吸得越多，逼玩家尽快解决战斗或清除中毒。
    chooseMove(enemy, combat) {
      const pattern = ['toxic_slam', 'regenerate', 'plague'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'regenerate') {
        return {
          name: '瘟疫虹吸', icon: '💚', type: 'heal', displayValue: null,
          execute(combat, e) {
            const poisonStacks = combat.player.statuses.poison || 0;
            const heal = 12 + poisonStacks * 3;
            combat.healEnemy(e.id, heal);
            combat.gainBlockEnemy(e.id, 10);
            combat.log(`🦠 ${e.name} 从你身上的 ${poisonStacks} 层中毒中虹吸瘴气，回复 ${heal} 点生命并获得护甲`, 'enemy');
          },
        };
      }
      if (pattern[step] === 'plague') {
        return {
          name: '瘟疫散播', icon: '🦠', type: 'debuff', displayValue: null,
          execute(combat, e) {
            combat.shuffleStatusIntoDrawPile('gravity', 1);
            combat.log(`🦠 ${e.name} 散播瘟疫！1 张重力压制洗入抽牌堆`, 'enemy');
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
      const pattern = ['rend', 'drain', 'meditate', 'void_curse'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'meditate') {
        return idleMove('虚空冥想', '🌀', '陷入虚空冥想，暂时按兵不动');
      }
      if (pattern[step] === 'void_curse') {
        return {
          name: '虚空灌注', icon: '🕳️', type: 'debuff', displayValue: null,
          execute(combat, e) {
            combat.shuffleStatusIntoDrawPile('void', 2);
            combat.log(`🕳️ ${e.name} 注入虚空能量！2 张虚空洗入抽牌堆`, 'enemy');
          },
        };
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
        name: '虚空撕裂', icon: '⚔️', type: 'attack', displayValue: 18,
        execute(combat, e) { combat.dealDamageToPlayer(18, e.id); },
      };
    },
  },

  // ---------------- Special Elite: Karen (from adventurer event) ----------------
  karen: {
    id: 'karen', name: '冒险者前辈 Karen', icon: '😤', hpRange: [250, 250], rarity: 'elite',
    onSpawn(enemy) {
      enemy.persistentBlock = true;
      enemy.poisonImmune = true;
      enemy.aiState.turnCount = 0;
      enemy.aiState.enraged = false;
      enemy.aiState.enrageTurns = 0;
    },
    chooseMove(enemy, combat) {
      enemy.aiState.turnCount = (enemy.aiState.turnCount || 0) + 1;
      const turn = enemy.aiState.turnCount;

      if (enemy.aiState.enraged) {
        enemy.aiState.enrageTurns += 1;
        if (enemy.aiState.enrageTurns >= 3) {
          const explosionDmg = enemy.hp;
          return {
            name: '🔥 引爆', icon: '💥', type: 'attack', displayValue: explosionDmg,
            execute(combat, e) {
              combat.dealDamageToPlayer(explosionDmg, e.id);
              e.hp = 0;
              combat.log(`💥 ${e.name} 引爆！造成 ${explosionDmg} 点伤害后自毁！`, 'enemy');
              combat.handleEnemyDeath(e);
            },
          };
        }
        const remain = 3 - enemy.aiState.enrageTurns;
        return {
          name: `🔥 引燃倒计时（${remain} 回合）`, icon: '⏳', type: 'idle', displayValue: null,
          execute(combat, e) {
            combat.log(`🔥 ${e.name} 正在引燃！${remain} 回合后爆炸！`, 'enemy');
          },
        };
      }

      if (enemy.hp < 100 && !enemy.aiState.enraged) {
        enemy.aiState.enraged = true;
        enemy.aiState.enrageTurns = 0;
        return {
          name: '🔥 引燃', icon: '🔥', type: 'buff', displayValue: null,
          execute(combat, e) {
            combat.log(`🔥 ${e.name} 生命值低于 100，进入引燃状态！3 回合后将爆炸造成其生命值的伤害！`, 'enemy');
          },
        };
      }

      if (turn === 1) {
        return {
          name: '思考中', icon: '🤔', type: 'idle', displayValue: null,
          execute(combat, e) { combat.log(`🤔 ${e.name} 正在观察你的动作……`, 'enemy'); },
        };
      }

      const cycleTurn = turn - 1;
      const phase = cycleTurn % 3;

      if (phase === 1) {
        const block = 12 + Math.floor(Math.random() * 9);
        return {
          name: '蓄力护盾', icon: '🛡️', type: 'defend', displayValue: block,
          execute(combat, e) { combat.gainBlockEnemy(e.id, block); combat.log(`🛡️ ${e.name} 获得 ${block} 点护盾（不随回合消失）`, 'enemy'); },
        };
      }
      if (phase === 2) {
        return {
          name: '盾击反击', icon: '⚔️', type: 'attack', displayValue: 20,
          execute(combat, e) { combat.gainBlockEnemy(e.id, 12); combat.dealDamageToPlayer(20, e.id); combat.log(`⚔️ ${e.name} 获得 12 护盾并造成 20 点伤害！`, 'enemy'); },
        };
      }
      return {
        name: '休息', icon: '😴', type: 'idle', displayValue: null,
        execute(combat, e) { combat.log(`😴 ${e.name} 正在休息……`, 'enemy'); },
      };
    },
  },

  // ---------------- Bosses ----------------
  // 深渊之眼：深渊领主召唤的护盾核心，存活时领主获得 50% 减伤。
  // 血量很低，是留给玩家的明确"先手目标"。
  abyss_eye: {
    id: 'abyss_eye', name: '深渊之眼', icon: '👁️', hpRange: [22, 26], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['gaze', 'weaken', 'pierce'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'weaken') {
        return {
          name: '虚弱凝视', icon: '👁️', type: 'debuff', displayValue: null, statusPreview: [{ name: 'weak', amount: 1 }],
          execute(combat, e) { combat.applyStatusPlayer('weak', 1); combat.log(`👁️ ${e.name} 的虚弱凝视使你变得虚弱`, 'enemy'); },
        };
      }
      if (pattern[step] === 'pierce') {
        return {
          name: '虚空穿刺', icon: '⚔️', type: 'attack', displayValue: 5,
          execute(combat, e) { combat.dealDamageToPlayer(5, e.id); },
        };
      }
      return {
        name: '凝视', icon: '👁️', type: 'debuff', displayValue: null, statusPreview: [{ name: 'vulnerable', amount: 1 }],
        execute(combat, e) { combat.applyStatusPlayer('vulnerable', 1); combat.log(`👁️ ${e.name} 凝视着你，你更容易受到伤害了`, 'enemy'); },
      };
    },
  },
  abyss_lord: {
    id: 'abyss_lord', name: '深渊领主', icon: '👹', hpRange: [190, 210], rarity: 'boss',
    onCombatStart(enemy, combat) {
      const deckSize = combat.drawPile.length + combat.hand.length + combat.discardPile.length;
      const burnCount = Math.floor(deckSize / 2);
      combat.shuffleStatusIntoDrawPile('burn', burnCount);
      combat.log(`👹 深渊领主：我的怒火将吞噬你！${burnCount} 张灼烧牌洗入你的抽牌堆！`, 'enemy');
      enemy.aiState.introShown = true;
    },
    onTurnEnd(enemy, combat) {
      const turnCount = combat.turnCount || 0;
      if (turnCount % 2 === 0) {
        combat.shuffleStatusIntoDrawPile('burn', 1);
        combat.log(`🔥 深渊领主的怒火持续燃烧，1 张灼烧牌洗入抽牌堆`, 'enemy');
      }
    },
    // 护盾之眼机制：领主会召唤一只深渊之眼为自己提供 50% 减伤，
    // 减伤在眼被击杀前持续生效——必须优先解决眼才能正常输出。
    chooseMove(enemy, combat) {
      const pattern = ['slam', 'summon_eye', 'breath', 'rest'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      const enraged = enemy.hp <= enemy.maxHp * 0.5;

      if (pattern[step] === 'summon_eye') {
        const eyeAlive = (enemy.aiState.summonedMinionIds || []).some(id => {
          const m = combat.enemies.find(en => en.id === id);
          return m && m.hp > 0;
        });
        if (eyeAlive) {
          const dmg = 6 + (enemy.statuses.strength || 0);
          return {
            name: '深渊吐息', icon: '⚔️', type: 'attack', displayValue: dmg,
            execute(combat, e) { combat.dealDamageToPlayer(dmg, e.id); },
          };
        }
        return {
          name: '唤醒深渊之眼', icon: '�️', type: 'summon', displayValue: null,
          execute(combat, e) {
            combat.summonEnemy(e, 'abyss_eye', { registerToSummoner: true });
            e.dmgReduction = 0.5;
            combat.log(`👁️ ${e.name} 唤醒了深渊之眼！只要眼还活着，领主就会减免 50% 伤害——先解决眼！`, 'enemy');
          },
        };
      }
      if (pattern[step] === 'breath') {
        return {
          name: '深渊吐息', icon: '⚔️', type: 'attack', displayValue: 5,
          execute(combat, e) { combat.dealDamageToPlayer(5, e.id); },
        };
      }
      if (pattern[step] === 'rest') {
        return {
          name: '蓄力', icon: '😴', type: 'idle', displayValue: null,
          execute(combat, e) {
            combat.log(`😴 ${e.name} 正在蓄力。`, 'enemy');
          },
        };
      }
      // slam
      if (enraged) {
        return {
          name: '狂暴重击 x2', icon: '⚔️', type: 'attack', displayValue: 10, hitsCount: 2,
          execute(combat, e) { combat.dealDamageToPlayer(10, e.id); combat.dealDamageToPlayer(10, e.id); },
        };
      }
      return {
        name: '重击', icon: '⚔️', type: 'attack', displayValue: 8,
        execute(combat, e) { combat.dealDamageToPlayer(8, e.id); },
      };
    },
  },
  iron_colossus: {
    id: 'iron_colossus', name: '钢铁巨像', icon: '🗿', hpRange: [240, 260], rarity: 'boss',
    // 过热机制：每次攻击或超载充能都会累积热量，热量达到 3 点后被迫
    // "过热宕机"一回合并暴露 2 层易伤——这是留给玩家的固定爆发窗口，
    // 不再依赖单纯的血量阈值狂暴。
    chooseMove(enemy, combat) {
      enemy.aiState.heat = enemy.aiState.heat || 0;
      const enraged = enemy.hp <= enemy.maxHp * 0.5;

      if (enemy.aiState.heat >= 3) {
        enemy.aiState.heat = 0;
        return {
          name: '过热宕机', icon: '🥵', type: 'idle', displayValue: null, statusPreview: [{ name: 'vulnerable', amount: 2 }],
          execute(combat, e) {
            combat.applyStatusEnemy(e.id, 'vulnerable', 2);
            combat.log(`🥵 ${e.name} 过热宕机，机甲外壳暴露弱点！`, 'enemy');
          },
        };
      }

      const pattern = ['overload', 'crush', 'crush'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;

      if (pattern[step] === 'overload') {
        return {
          name: '超载充能', icon: '�', type: 'buff', displayValue: 25,
          execute(combat, e) {
            combat.gainBlockEnemy(e.id, 25);
            combat.applyStatusEnemy(e.id, 'strength', 3);
            e.aiState.heat += 1;
            combat.log(`${e.name} 超载充能：获得护甲与力量（热量 ${e.aiState.heat}/3）`, 'enemy');
          },
        };
      }
      const dmg = enraged ? 26 : 18;
      return {
        name: enraged ? '狂暴碾压' : '碾压', icon: '⚔️', type: 'attack', displayValue: dmg,
        execute(combat, e) {
          combat.dealDamageToPlayer(dmg, e.id);
          e.aiState.heat += 1;
          combat.log(`🔥 ${e.name} 热量：${e.aiState.heat}/3`, 'enemy');
        },
      };
    },
  },
  void_progenitor: {
    id: 'void_progenitor', name: '虚空造物主', icon: '🪐', hpRange: [300, 330], rarity: 'boss',
    // 现实回响机制（血量 > 50% 时）：它会"回响"你上一回合打出的最后一张牌的类型——
    // 你打攻击牌，它就双重反击；你打防御/技能牌，它就掠夺你的格挡；你打能力牌，
    // 它会用一记现实撕裂重击你。逼玩家不能一味重复同一种打法。
    // 血量 <= 50% 时放弃回响，进入纯粹的湮灭猛攻终盘阶段。
    chooseMove(enemy, combat) {
      const enraged = enemy.hp <= enemy.maxHp * 0.5;

      if (enraged) {
        const pattern = ['annihilate', 'annihilate', 'rest'];
        const step = enemy.aiState.enragedCycle || 0;
        enemy.aiState.enragedCycle = (step + 1) % pattern.length;
        if (pattern[step] === 'rest') {
          return {
            name: '虚空凝视', icon: '�', type: 'idle', displayValue: null,
            execute(combat, e) {
              combat.log(`😴 ${e.name} 凝视虚空，往你的牌组塞了一张虚空！`, 'enemy');
              combat.shuffleStatusIntoDrawPile('void', 1);
            },
          };
        }
        return {
          name: '湮灭 x2', icon: '⚔️', type: 'attack', displayValue: 26, hitsCount: 2,
          execute(combat, e) { combat.dealDamageToPlayer(26, e.id); combat.dealDamageToPlayer(26, e.id); },
        };
      }

      const lastType = combat.lastPlayerCardType;
      if (lastType === 'attack') {
        return {
          name: '回响打击', icon: '🪞', type: 'attack', displayValue: 13, hitsCount: 2,
          execute(combat, e) {
            combat.log(`🪞 ${e.name} 回响了你的攻击性！`, 'enemy');
            combat.dealDamageToPlayer(13, e.id);
            if (e.hp > 0) combat.dealDamageToPlayer(13, e.id);
          },
        };
      }
      if (lastType === 'skill') {
        return {
          name: '虚空掠夺', icon: '�️', type: 'debuff', displayValue: null,
          execute(combat, e) {
            const stolen = combat.stealPlayerBlock(12);
            combat.gainBlockEnemy(e.id, stolen);
            combat.log(`🕳️ ${e.name} 掠夺了你 ${stolen} 点格挡，转化为自己的护甲！`, 'enemy');
          },
        };
      }
      if (lastType === 'power') {
        return {
          name: '现实撕裂', icon: '⚔️', type: 'attack', displayValue: 24,
          execute(combat, e) { combat.log(`${e.name} 撕裂现实，回应你的能力牌！`, 'enemy'); combat.dealDamageToPlayer(24, e.id); },
        };
      }
      return {
        name: '虚空凝视', icon: '😴', type: 'idle', displayValue: null,
        execute(combat, e) {
          combat.log(`😴 ${e.name} 凝视虚空，往你的牌组塞了一张虚空！`, 'enemy');
          combat.shuffleStatusIntoDrawPile('void', 1);
        },
      };
    },
  },

  // ================ SUPPORT ENEMIES (synergy) ================
  shaman: {
    id: 'shaman', name: '萨满祭司', icon: '🪄', hpRange: [22, 28], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['buff', 'atk', 'buff', 'atk'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'buff') {
        return {
          name: '力量图腾', icon: '🪄', type: 'buff', displayValue: null,
          execute(combat, e) {
            const allies = combat.enemies.filter(a => a.hp > 0 && a.id !== e.id);
            if (allies.length > 0) {
              allies.forEach(a => combat.applyStatusEnemy(a.id, 'strength', 1));
              combat.log(`🪄 ${e.name} 施放力量图腾，所有队友获得 1 点力量！`, 'enemy');
            } else {
              combat.applyStatusEnemy(e.id, 'strength', 2);
              combat.log(`🪄 ${e.name} 没有队友，为自己获得 2 点力量！`, 'enemy');
            }
          },
        };
      }
      return {
        name: '灵能冲击', icon: '⚡', type: 'attack', displayValue: 6,
        execute(combat, e) { combat.dealDamageToPlayer(6, e.id); },
      };
    },
  },
  healer: {
    id: 'healer', name: '暗影医者', icon: '➕', hpRange: [18, 24], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['heal', 'atk', 'shield', 'heal'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'heal') {
        return {
          name: '治疗术', icon: '➕', type: 'buff', displayValue: null,
          execute(combat, e) {
            const wounded = combat.enemies.filter(a => a.hp > 0 && a.hp < a.maxHp && a.id !== e.id);
            if (wounded.length > 0) {
              const target = wounded.reduce((best, a) => (a.maxHp - a.hp) > (best.maxHp - best.hp) ? a : best, wounded[0]);
              const amt = 6;
              combat.healEnemy(target.id, amt);
              combat.log(`➕ ${e.name} 为 ${target.name} 恢复 ${amt} 点生命！`, 'enemy');
            } else {
              const amt = 4;
              combat.healEnemy(e.id, amt);
              combat.log(`➕ ${e.name} 为自己恢复 ${amt} 点生命`, 'enemy');
            }
          },
        };
      }
      if (pattern[step] === 'shield') {
        return {
          name: '护盾祝福', icon: '🛡️', type: 'buff', displayValue: null,
          execute(combat, e) {
            const allies = combat.enemies.filter(a => a.hp > 0 && a.id !== e.id);
            if (allies.length > 0) {
              allies.forEach(a => combat.gainBlockEnemy(a.id, 5));
              combat.log(`🛡️ ${e.name} 为所有队友施加 5 点格挡！`, 'enemy');
            } else {
              combat.gainBlockEnemy(e.id, 8);
              combat.log(`🛡️ ${e.name} 为自己获得 8 点格挡`, 'enemy');
            }
          },
        };
      }
      return {
        name: '暗影飞刃', icon: '🔪', type: 'attack', displayValue: 5,
        execute(combat, e) { combat.dealDamageToPlayer(5, e.id); },
      };
    },
  },
  bulwark: {
    id: 'bulwark', name: '巨盾守卫', icon: '🛡️', hpRange: [40, 50], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['guard', 'taunt', 'atk', 'guard'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'guard') {
        return {
          name: '坚壁防御', icon: '🛡️', type: 'skill', displayValue: null,
          execute(combat, e) {
            combat.gainBlockEnemy(e.id, 12);
            const allies = combat.enemies.filter(a => a.hp > 0 && a.id !== e.id);
            if (allies.length > 0) {
              allies.forEach(a => combat.gainBlockEnemy(a.id, 4));
              combat.log(`🛡️ ${e.name} 举起巨盾，自身获得 12 格挡，队友各获得 4 格挡！`, 'enemy');
            } else {
              combat.log(`🛡️ ${e.name} 举起巨盾，获得 12 点格挡！`, 'enemy');
            }
          },
        };
      }
      if (pattern[step] === 'taunt') {
        return {
          name: '嘲讽怒吼', icon: '📢', type: 'skill', displayValue: null,
          execute(combat, e) {
            e.taunt = 2;
            combat.gainBlockEnemy(e.id, 6);
            combat.log(`📢 ${e.name} 发出嘲讽怒吼！接下来 2 回合你的攻击会优先命中它！`, 'enemy');
          },
        };
      }
      return {
        name: '盾击', icon: '⚔️', type: 'attack', displayValue: 7,
        execute(combat, e) { combat.dealDamageToPlayer(7, e.id); },
      };
    },
  },
  war_drummer: {
    id: 'war_drummer', name: '战鼓手', icon: '🥁', hpRange: [20, 26], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['drum', 'drum', 'atk'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'drum') {
        return {
          name: '战鼓激励', icon: '🥁', type: 'buff', displayValue: null,
          execute(combat, e) {
            const allies = combat.enemies.filter(a => a.hp > 0 && a.id !== e.id);
            const amt = 2;
            if (allies.length > 0) {
              allies.forEach(a => combat.applyStatusEnemy(a.id, 'strength', amt));
              combat.log(`🥁 ${e.name} 擂响战鼓，所有队友获得 ${amt} 点力量！`, 'enemy');
            } else {
              combat.applyStatusEnemy(e.id, 'strength', amt);
              combat.log(`🥁 ${e.name} 擂响战鼓，自身获得 ${amt} 点力量！`, 'enemy');
            }
          },
        };
      }
      return {
        name: '鼓槌猛击', icon: '⚔️', type: 'attack', displayValue: 5,
        execute(combat, e) { combat.dealDamageToPlayer(5, e.id); },
      };
    },
  },
  vine_tender: {
    id: 'vine_tender', name: '藤蔓操控者', icon: '🌿', hpRange: [28, 36], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['entangle', 'atk', 'entangle', 'atk'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'entangle') {
        return {
          name: '缠绕藤蔓', icon: '🌿', type: 'debuff', displayValue: 2, statusPreview: [{ name: 'entangle', amount: 2 }],
          execute(combat, e) {
            combat.applyStatusPlayer('entangle', 2);
            combat.log(`🌿 ${e.name} 释放缠绕藤蔓！2 张手牌将被封印！`, 'enemy');
          },
        };
      }
      return {
        name: '藤蔓鞭击', icon: '⚔️', type: 'attack', displayValue: 7,
        execute(combat, e) { combat.dealDamageToPlayer(7, e.id); },
      };
    },
  },
  chaos_wizard: {
    id: 'chaos_wizard', name: '混沌术士', icon: '🌀', hpRange: [30, 38], rarity: 'normal',
    chooseMove(enemy, combat) {
      const pattern = ['chaos', 'atk', 'atk', 'chaos'];
      const step = enemy.aiState.cycle || 0;
      enemy.aiState.cycle = (step + 1) % pattern.length;
      if (pattern[step] === 'chaos') {
        return {
          name: '混乱咒术', icon: '🌀', type: 'debuff', displayValue: null, statusPreview: [{ name: 'chaos', amount: 1 }],
          execute(combat, e) {
            combat.applyStatusPlayer('chaos', 1);
            combat.log(`🌀 ${e.name} 施放混乱咒术！你的卡牌费用被打乱！`, 'enemy');
          },
        };
      }
      return {
        name: '混沌箭', icon: '⚔️', type: 'attack', displayValue: 8,
        execute(combat, e) { combat.dealDamageToPlayer(8, e.id); },
      };
    },
  },
};
const ACT1_EARLY_IDS = ['slime', 'bat', 'rampaging_hound', 'tentacle', 'hornet_swarm', 'fungi_beast', 'shieldbearer', 'raider', 'skeleton_guard'];
// Act 1 late pool (floors 10+): higher damage / HP
const ACT1_LATE_IDS = ['slime', 'bat', 'rampaging_hound', 'tentacle', 'hornet_swarm', 'fungi_beast', 'shieldbearer', 'raider', 'skeleton_guard', 'gargoyle', 'shadow_assassin', 'jaw_worm', 'gremlin_nob', 'vine_tender'];

const ACT2_ENEMY_IDS = ['card_reactor', 'necromancer', 'silence_warden', 'mirror_sprite', 'rust_sentinel', 'chosen', 'spheric_guardian', 'snake_plant', 'gargoyle', 'shadow_assassin', 'stone_guardian', 'vine_tender', 'chaos_wizard'];

// ============================================================
// Predefined encounter groups with enemy synergy.
// Each group is a fixed composition designed to create tactical
// decisions: kill the support first, or burst the damage dealer?
// ============================================================
const ENCOUNTER_GROUPS = [
  // 3-enemy synergy groups
  ['shaman', 'raider', 'skeleton_guard'],     // buffer + 2 fighters
  ['healer', 'bat', 'hornet_swarm'],          // healer keeps glass cannons alive
  ['war_drummer', 'rampaging_hound', 'tentacle'], // drummer buffs 2 attackers
  ['bulwark', 'fungi_beast', 'fungi_beast'],   // tank protects 2 spore spammers
  ['shaman', 'war_drummer', 'gargoyle'],       // double buffer + bruiser
  ['healer', 'bulwark', 'jaw_worm'],           // healer + tank + damage
  ['shaman', 'healer', 'raider'],              // double support + fighter
  // 4-enemy swarm groups
  ['war_drummer', 'bat', 'bat', 'skeleton_guard'], // drummer + swarm
  ['shaman', 'raider', 'raider', 'shieldbearer'],  // buffer + 2 fighters + tank
  ['healer', 'hornet_swarm', 'hornet_swarm', 'tentacle'], // healer + double swarm
  // Act 2 flavored groups
  ['shaman', 'mirror_sprite', 'rust_sentinel'],
  ['mirror_sprite', 'jaw_worm', 'gargoyle'],
  ['healer', 'stone_guardian', 'snake_plant'],
  ['war_drummer', 'chosen', 'spheric_guardian'],
  ['bulwark', 'necromancer', 'silence_warden'],
  ['mirror_sprite', 'war_drummer', 'shadow_assassin', 'raider'],
];

// ============================================================
// Acts ("dimensions") — the run is a sequence of acts, each with its
// own boss, elite roster, and an HP scaling multiplier applied to all
// enemies (normal/elite/boss) spawned within that act.
// ============================================================
const ACT_DEFS = [
  { name: '第一维度：坠落回廊', bossId: 'abyss_lord', eliteIds: ['iron_guard', 'shadow_priest', 'cultist_summoner'], scaling: 1.0, dmgScaling: 1.0, doubleSpawnChance: 0.30, enemyPool: ACT1_EARLY_IDS, lateEnemyPool: ACT1_LATE_IDS, lateFloorThreshold: 10 },
  { name: '第二维度：锈蚀熔炉', bossId: 'iron_colossus', eliteIds: ['iron_guard', 'shadow_priest', 'plague_bearer'], scaling: 1.15, dmgScaling: 1.1, doubleSpawnChance: 0.35, enemyPool: ACT2_ENEMY_IDS },
  { name: '第三维度：虚空深渊', bossId: 'void_progenitor', eliteIds: ['shadow_priest', 'plague_bearer', 'void_reaver'], scaling: 1.35, dmgScaling: 1.2, doubleSpawnChance: 0.45, enemyPool: ACT2_ENEMY_IDS },
];

function spawnEnemyGroup(rarity, act = 1, floor = 0) {
  const actDef = ACT_DEFS[act - 1] || ACT_DEFS[ACT_DEFS.length - 1];
  if (rarity === 'boss') return [actDef.bossId];
  if (rarity === 'elite') {
    // Elite: 70% chance for a predefined synergy group (3-4 enemies), 30% single elite
    if (Math.random() < 0.70) {
      return pick(ENCOUNTER_GROUPS).slice();
    }
    return [pick(actDef.eliteIds)];
  }
  // normal: 1-2 enemies only, no synergy groups
  const pool = (actDef.lateEnemyPool && floor >= (actDef.lateFloorThreshold || 10))
    ? actDef.lateEnemyPool
    : (actDef.enemyPool || ACT1_EARLY_IDS);
  const count = Math.random() < (actDef.doubleSpawnChance ?? 0.45) ? 2 : 1;
  const ids = [];
  for (let i = 0; i < count; i++) ids.push(pick(pool));
  return ids;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
