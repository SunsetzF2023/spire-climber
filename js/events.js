// ============================================================
// Random non-combat events — triggered on "?" map nodes.
// effect(run, cardUid?) mutates run state and returns { text, cls }.
// Options with selectCard:true let the player pick a card from their deck
// first (rendered by game.js), then call effect(run, chosenCardUid).
// Relies on helper functions defined in game.js: addRelicToRun,
// healPlayerRun, damagePlayerRun, removeRandomCardFromDeck,
// upgradeRandomCardInDeck, addCardToDeck.
// ============================================================

const EVENT_POOL = [
  {
    id: 'altar', name: '神秘祭坛', icon: '🗿',
    desc: '一座散发微光的祭坛前摆着一件遗物，似乎需要用生命献祭才能获得。',
    options: [
      {
        label: '🩸 献祭 10 点生命，获得一件遗物',
        disabled(run) { return run.player.hp <= 10; },
        effect(run) {
          if (run.player.hp <= 10) return { text: '生命值过低，不敢冒险！', cls: 'bad' };
          damagePlayerRun(run, 10);
          const relic = addRelicToRun(run, pickRandomRelic(run.relics));
          return { text: `获得了遗物：${RELICS[relic].icon} ${RELICS[relic].name}`, cls: 'good' };
        },
      },
      { label: '🚶 不敢冒险，离开', effect() { return { text: '你选择尊重未知的力量，转身离开。', cls: 'info' }; } },
    ],
  },
  {
    id: 'treasure_chest', name: '荒野宝箱', icon: '📦',
    desc: '路边有一个略显可疑的宝箱。',
    options: [
      {
        label: '🔓 打开（大概率获得金币，小概率触发陷阱）',
        effect(run) {
          if (Math.random() < 0.75) {
            const gold = 20 + Math.floor(Math.random() * 20);
            run.gold += gold;
            run.stats.goldEarned += gold;
            return { text: `获得了 ${gold} 金币！`, cls: 'good' };
          }
          damagePlayerRun(run, 8);
          const curses = ['clumsy', 'decay', 'doubt', 'injury', 'pain', 'shame', 'writhe'];
          const curseId = curses[Math.floor(Math.random() * curses.length)];
          addCardToDeck(run, curseId, false);
          return { text: `触发了陷阱，损失 8 点生命，且一张诅咒牌【${CARDS[curseId].name}】混入了卡组……`, cls: 'bad' };
        },
      },
      { label: '🚶 太可疑了，不开', effect() { return { text: '安全第一，你没有打开宝箱。', cls: 'info' }; } },
    ],
  },
  {
    id: 'storyteller', name: '流浪说书人', icon: '📜',
    desc: '一位说书人愿意用一个故事，换取你放下一张不需要的卡牌的记忆。',
    options: [
      {
        label: '📖 听故事，选择一张卡牌免费移除',
        selectCard: true,
        canPick(run) { return run.deck.length > 5; },
        pickHint: '选择一张要移除的卡牌：',
        blockedText: '你的卡组已经很精简了，说书人摇了摇头。',
        effect(run, cardUid) {
          const idx = run.deck.findIndex(c => c.uid === cardUid);
          if (idx === -1) return { text: '没有找到这张卡牌。', cls: 'bad' };
          const [removed] = run.deck.splice(idx, 1);
          return { text: `移除了：${CARDS[removed.defId].name}`, cls: 'good' };
        },
      },
      { label: '🚶 没有时间听故事', effect() { return { text: '你匆匆离开了。', cls: 'info' }; } },
    ],
  },
  {
    id: 'blacksmith_event', name: '流浪铁匠', icon: '⚒️',
    desc: '一位流浪铁匠愿意免费为你打磨一张卡牌。',
    options: [
      {
        label: '🔨 免费打磨一张随机卡牌（永久强化）',
        effect(run) {
          const upgraded = upgradeRandomCardInDeck(run);
          return upgraded
            ? { text: `${CARDS[upgraded.defId].name} 被强化了！`, cls: 'good' }
            : { text: '卡组里没有可以强化的卡牌了。', cls: 'bad' };
        },
      },
      { label: '🚶 谢绝好意', effect() { return { text: '你继续赶路。', cls: 'info' }; } },
    ],
  },
  {
    id: 'wishing_well', name: '许愿井', icon: '⭐',
    desc: '一口古老的许愿井，投入金币似乎能带来好运。',
    options: [
      {
        label: '💰 投入 20 金币许愿（50% 获得遗物，50% 一无所获）',
        disabled(run) { return run.gold < 20; },
        effect(run) {
          if (run.gold < 20) return { text: '金币不足！', cls: 'bad' };
          run.gold -= 20;
          if (Math.random() < 0.5) {
            const relic = addRelicToRun(run, pickRandomRelic(run.relics));
            return { text: `许愿成功！获得遗物：${RELICS[relic].icon} ${RELICS[relic].name}`, cls: 'good' };
          }
          return { text: '井水泛起涟漪，但什么都没发生……', cls: 'bad' };
        },
      },
      { label: '🚶 不迷信', effect() { return { text: '你选择相信自己的实力。', cls: 'info' }; } },
    ],
  },
  {
    id: 'golden_shrine', name: '金色神龛', icon: '🛕',
    desc: '一座镶金的古老神龛，散发着诱人的光泽。',
    options: [
      {
        label: '🙏 祈祷（获得少量金币，无风险）',
        effect(run) {
          const gold = 25 + Math.floor(Math.random() * 15);
          run.gold += gold;
          run.stats.goldEarned += gold;
          return { text: `神龛回应了你的祈祷，获得 ${gold} 金币。`, cls: 'good' };
        },
      },
      {
        label: '🔨 打碎神龛（获得更多金币，但损失生命）',
        effect(run) {
          const gold = 60 + Math.floor(Math.random() * 30);
          run.gold += gold;
          run.stats.goldEarned += gold;
          damagePlayerRun(run, 8);
          return { text: `神龛崩裂，涌出 ${gold} 金币，但反噬之力让你损失 8 点生命。`, cls: 'info' };
        },
      },
      { label: '🚶 不敢亵渎神明，离开', effect() { return { text: '你恭敬地退开了。', cls: 'info' }; } },
    ],
  },
  {
    id: 'duplicator', name: '复制神龛', icon: '✨',
    desc: '一座能够复制卡牌的古老神龛，静静等待着你的选择。',
    options: [
      {
        label: '📑 选择一张卡牌，复制一份加入卡组',
        selectCard: true,
        pickHint: '选择要复制的卡牌：',
        effect(run, cardUid) {
          const card = run.deck.find(c => c.uid === cardUid);
          if (!card) return { text: '没有找到这张卡牌。', cls: 'bad' };
          addCardToDeck(run, card.defId, card.upgraded);
          return { text: `复制了一份：${CARDS[card.defId].name}${card.upgraded ? '+' : ''}`, cls: 'good' };
        },
      },
      { label: '🚶 不需要复制品，离开', effect() { return { text: '你选择保持卡组的纯粹。', cls: 'info' }; } },
    ],
  },
  {
    id: 'we_meet_again', name: '故人重逢', icon: '🤝',
    desc: '一个眼熟的旅人凑了过来，提议用金币换取一件遗物。',
    options: [
      {
        label: '💰 支付 75 金币，获得一件遗物',
        disabled(run) { return run.gold < 75; },
        effect(run) {
          if (run.gold < 75) return { text: '金币不足！', cls: 'bad' };
          run.gold -= 75;
          const relic = addRelicToRun(run, pickRandomRelic(run.relics));
          return { text: `获得了遗物：${RELICS[relic].icon} ${RELICS[relic].name}`, cls: 'good' };
        },
      },
      { label: '🚶 谢绝交易，离开', effect() { return { text: '你婉言谢绝，转身离开。', cls: 'info' }; } },
    ],
  },
  {
    id: 'dead_adventurer', name: '遇难的冒险者', icon: '💀',
    desc: '路边倒着一具冒险者的遗体，身上似乎还带着一些遗物。',
    options: [
      {
        label: '🔍 搜刮遗体（大概率获得金币和遗物，小概率被埋伏）',
        effect(run) {
          if (Math.random() < 0.65) {
            const gold = 40 + Math.floor(Math.random() * 30);
            run.gold += gold;
            run.stats.goldEarned += gold;
            const relic = addRelicToRun(run, pickRandomRelic(run.relics));
            return { text: `搜到了 ${gold} 金币，以及遗物：${RELICS[relic].icon} ${RELICS[relic].name}`, cls: 'good' };
          }
          damagePlayerRun(run, 12);
          return { text: '遗体是伏击的诱饵！你损失了 12 点生命……', cls: 'bad' };
        },
      },
      { label: '🚶 不打扰逝者，离开', effect() { return { text: '你默哀片刻，继续赶路。', cls: 'info' }; } },
    ],
  },
  {
    id: 'wheel_of_change', name: '命运之轮', icon: '🎡',
    desc: '一座奇异的转轮矗立在路中央，似乎在邀请你转动它，赌上一把运气。',
    options: [
      {
        label: '🎡 转动命运之轮',
        effect(run) {
          const roll = Math.random();
          if (roll < 0.25) {
            const gold = 50 + Math.floor(Math.random() * 30);
            run.gold += gold;
            run.stats.goldEarned += gold;
            return { text: `幸运！获得 ${gold} 金币。`, cls: 'good' };
          }
          if (roll < 0.45) {
            const relic = addRelicToRun(run, pickRandomRelic(run.relics));
            return { text: `大奖！获得遗物：${RELICS[relic].icon} ${RELICS[relic].name}`, cls: 'good' };
          }
          if (roll < 0.65) {
            const amount = Math.round(run.player.maxHp * 0.2);
            healPlayerRun(run, amount);
            return { text: `回复了 ${amount} 点生命。`, cls: 'good' };
          }
          if (roll < 0.85) {
            damagePlayerRun(run, 10);
            return { text: '转轮反噬，损失了 10 点生命……', cls: 'bad' };
          }
          return { text: '转轮静止不动，什么都没发生。', cls: 'info' };
        },
      },
      { label: '🚶 不想赌运气，离开', effect() { return { text: '你选择相信自己的实力，而非运气。', cls: 'info' }; } },
    ],
  },
  {
    id: 'wandering_merchant', name: '路边旅商', icon: '🧳',
    desc: '一位旅行商人愿意用你的生命值换取一张强力卡牌。',
    options: [
      {
        label: '🩸 献祭 6 点生命，随机获得一张稀有卡牌',
        disabled(run) { return run.player.hp <= 6; },
        effect(run) {
          if (run.player.hp <= 6) return { text: '生命值过低，不敢冒险！', cls: 'bad' };
          damagePlayerRun(run, 6);
          const rarePool = [...REWARD_POOLS.rare.neutral, ...(REWARD_POOLS.rare[run.characterId] || REWARD_POOLS.rare.warrior)];
          const id = rarePool[Math.floor(Math.random() * rarePool.length)];
          addCardToDeck(run, id, false);
          return { text: `获得了稀有卡牌：${CARDS[id].name}`, cls: 'good' };
        },
      },
      { label: '🚶 不划算，拒绝', effect() { return { text: '你婉拒了商人的提议。', cls: 'info' }; } },
    ],
  },
  {
    id: 'cursed_tome', name: '诅咒之书', icon: '📕',
    desc: '一本散发着不祥气息的古书静静躺在路边，翻开它似乎能获得力量，但代价不菲。',
    options: [
      {
        label: '📖 翻开古书（获得一件负面遗物 + 大量金币）',
        effect(run) {
          const eventRelics = ['mark_of_bloom', 'gremlin_visage', 'mutagenic_strength', 'cursed_key', 'brimstone'];
          const available = eventRelics.filter(id => !run.relics.includes(id));
          if (available.length === 0) return { text: '你已经拥有所有诅咒之书的力量了。', cls: 'info' };
          const relicId = available[Math.floor(Math.random() * available.length)];
          addRelicToRun(run, relicId);
          const gold = 50 + Math.floor(Math.random() * 30);
          run.gold += gold;
          run.stats.goldEarned += gold;
          return { text: `翻开古书！获得 ${gold} 金币，但被诅咒了：${RELICS[relicId].icon} ${RELICS[relicId].name} — ${RELICS[relicId].desc}`, cls: 'info' };
        },
      },
      {
        label: '🩸 接受诅咒，获得一张随机诅咒牌和 80 金币',
        effect(run) {
          const curses = ['clumsy', 'decay', 'doubt', 'injury', 'normality', 'pain', 'parasite', 'regret', 'shame', 'writhe'];
          const curseId = curses[Math.floor(Math.random() * curses.length)];
          addCardToDeck(run, curseId, false);
          const gold = 80;
          run.gold += gold;
          run.stats.goldEarned += gold;
          return { text: `获得 ${gold} 金币，但一张诅咒牌【${CARDS[curseId].name}】混入了你的卡组！`, cls: 'info' };
        },
      },
      { label: '🚶 不碰诅咒之物', effect() { return { text: '你明智地远离了那本书。', cls: 'info' }; } },
    ],
  },
  {
    id: 'face_trader', name: '面容交易者', icon: '🎭',
    desc: '一个诡异的人贩子收集着各种面孔，他愿意和你做一笔交易。',
    options: [
      {
        label: '🎭 随机获得一张面孔（可能是好是坏）',
        effect(run) {
          const faces = ['red_mask', 'gremlin_visage', 'golden_idol', 'mutagenic_strength'];
          const available = faces.filter(id => !run.relics.includes(id));
          if (available.length === 0) return { text: '你的面容已经够多了。', cls: 'info' };
          const relicId = available[Math.floor(Math.random() * available.length)];
          addRelicToRun(run, relicId);
          return { text: `获得了：${RELICS[relicId].icon} ${RELICS[relicId].name} — ${RELICS[relicId].desc}`, cls: 'info' };
        },
      },
      { label: '🚶 不需要新面孔', effect() { return { text: '你对自己的脸很满意。', cls: 'info' }; } },
    ],
  },
  {
    id: 'blood_ritual', name: '血祭仪式', icon: '🩸',
    desc: '一个古老的血祭法阵仍在运作。献祭生命可以永久强化一张卡牌，但代价是更多的鲜血。',
    options: [
      {
        label: '🩸 献祭 15 点生命，强化一张随机卡牌',
        disabled(run) { return run.player.hp <= 15; },
        effect(run) {
          if (run.player.hp <= 15) return { text: '生命值不足以献祭！', cls: 'bad' };
          damagePlayerRun(run, 15);
          const upgraded = upgradeRandomCardInDeck(run);
          return upgraded
            ? { text: `血祭成功！${CARDS[upgraded.defId].name} 被永久强化了。`, cls: 'good' }
            : { text: '血祭完成，但卡组中没有可强化的卡牌了。', cls: 'info' };
        },
      },
      { label: '🚶 远离血祭', effect() { return { text: '你不想与黑暗力量打交道。', cls: 'info' }; } },
    ],
  },
  {
    id: 'ancient_fountain', name: '古老喷泉', icon: '⛲',
    desc: '一座被遗忘的喷泉，泉水泛着奇异的光芒。饮用泉水可能治愈也可能伤害你。',
    options: [
      {
        label: '🥤 饮用泉水（60% 回复 20% 生命，40% 损失 10% 生命）',
        effect(run) {
          if (Math.random() < 0.6) {
            const amount = Math.round(run.player.maxHp * 0.2);
            healPlayerRun(run, amount);
            return { text: `泉水清凉甘甜，回复了 ${amount} 点生命。`, cls: 'good' };
          }
          const dmg = Math.round(run.player.maxHp * 0.1);
          damagePlayerRun(run, dmg);
          return { text: `泉水竟然有毒！损失了 ${dmg} 点生命。`, cls: 'bad' };
        },
      },
      {
        label: '💰 投入 30 金币净化泉水（必定回复 25% 生命）',
        disabled(run) { return run.gold < 30; },
        effect(run) {
          if (run.gold < 30) return { text: '金币不足！', cls: 'bad' };
          run.gold -= 30;
          const amount = Math.round(run.player.maxHp * 0.25);
          healPlayerRun(run, amount);
          return { text: `净化后的泉水效果显著，回复了 ${amount} 点生命。`, cls: 'good' };
        },
      },
      { label: '🚶 不喝陌生水', effect() { return { text: '你选择继续赶路。', cls: 'info' }; } },
    ],
  },
  {
    id: 'dark_blade', name: '暗黑之刃', icon: '🗡️',
    desc: '一把散发着黑暗气息的匕首插在石头上。拔出它可能获得强大的力量，但也会受到诅咒。',
    options: [
      {
        label: '🗡️ 拔出暗黑之刃（获得一张强力攻击牌，但损失 12 点生命）',
        disabled(run) { return run.player.hp <= 12; },
        effect(run) {
          if (run.player.hp <= 12) return { text: '生命值过低，不敢尝试！', cls: 'bad' };
          damagePlayerRun(run, 12);
          addCardToDeck(run, 'bludgeon', false);
          return { text: `你拔出了暗黑之刃！获得卡牌：${CARDS.bludgeon.name}（13点伤害，1费），但损失了 12 点生命。`, cls: 'info' };
        },
      },
      { label: '🚶 不碰暗黑之物', effect() { return { text: '你明智地离开了。', cls: 'info' }; } },
    ],
  },
  {
    id: 'mysterious_potion', name: '神秘药水', icon: '🧪',
    desc: '路边有一个冒着彩色气泡的药水瓶，标签已经模糊不清。',
    options: [
      {
        label: '🧪 喝下药水（随机效果：回血/获得能量遗物/获得诅咒牌）',
        effect(run) {
          const roll = Math.random();
          if (roll < 0.35) {
            const heal = 15 + Math.floor(Math.random() * 10);
            healPlayerRun(run, heal);
            return { text: `药水是治疗药剂！回复了 ${heal} 点生命。`, cls: 'good' };
          }
          if (roll < 0.65) {
            const gold = 30 + Math.floor(Math.random() * 20);
            run.gold += gold;
            run.stats.goldEarned += gold;
            return { text: `药水让你浑身充满力量！获得 ${gold} 金币。`, cls: 'good' };
          }
          if (roll < 0.85) {
            const etherealPool = ['ether_potion', 'ether_strength', 'ether_block', 'ether_bomb', 'ether_draw', 'ether_cleanse'];
            const id = etherealPool[Math.floor(Math.random() * etherealPool.length)];
            addCardToDeck(run, id, false);
            return { text: `药水化为一瓶虚无药剂！获得：${CARDS[id].name}`, cls: 'good' };
          }
          const curses = ['clumsy', 'decay', 'doubt', 'injury', 'pain', 'shame', 'writhe'];
          const curseId = curses[Math.floor(Math.random() * curses.length)];
          addCardToDeck(run, curseId, false);
          return { text: `药水是毒药！一张诅咒牌【${CARDS[curseId].name}】混入了你的卡组。`, cls: 'bad' };
        },
      },
      { label: '💰 卖掉药水（获得 25 金币）',
        effect(run) {
          run.gold += 25;
          run.stats.goldEarned += 25;
          return { text: '你把药水卖给了路过的商人，获得 25 金币。', cls: 'good' };
        },
      },
      { label: '🚶 不喝来路不明的药水', effect() { return { text: '你把药水留在了原地。', cls: 'info' }; } },
    ],
  },
  {
    id: 'sacrifice_altar', name: '献祭神殿', icon: '⛩️',
    desc: '一座古老的神殿，这里可以献祭卡牌来换取其他资源。',
    options: [
      {
        label: '📑 献祭一张卡牌，获得 50 金币',
        selectCard: true,
        canPick(run) { return run.deck.length > 5; },
        pickHint: '选择一张要献祭的卡牌：',
        blockedText: '你的卡组太精简了，不能再献祭。',
        effect(run, cardUid) {
          const idx = run.deck.findIndex(c => c.uid === cardUid);
          if (idx === -1) return { text: '没有找到这张卡牌。', cls: 'bad' };
          const [removed] = run.deck.splice(idx, 1);
          run.gold += 50;
          run.stats.goldEarned += 50;
          return { text: `献祭了 ${CARDS[removed.defId].name}，获得 50 金币。`, cls: 'good' };
        },
      },
      {
        label: '📑 献祭一张卡牌，回复 15 点生命',
        selectCard: true,
        canPick(run) { return run.deck.length > 5; },
        pickHint: '选择一张要献祭的卡牌：',
        blockedText: '你的卡组太精简了，不能再献祭。',
        effect(run, cardUid) {
          const idx = run.deck.findIndex(c => c.uid === cardUid);
          if (idx === -1) return { text: '没有找到这张卡牌。', cls: 'bad' };
          const [removed] = run.deck.splice(idx, 1);
          healPlayerRun(run, 15);
          return { text: `献祭了 ${CARDS[removed.defId].name}，回复 15 点生命。`, cls: 'good' };
        },
      },
      { label: '🚶 不愿献祭', effect() { return { text: '你离开了神殿。', cls: 'info' }; } },
    ],
  },
];

function pickRandomEvent() {
  return EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)];
}
