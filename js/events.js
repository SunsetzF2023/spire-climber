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
            return { text: `获得了 ${gold} 金币！`, cls: 'good' };
          }
          damagePlayerRun(run, 8);
          return { text: '触发了陷阱，损失 8 点生命……', cls: 'bad' };
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
    id: 'wandering_merchant', name: '路边旅商', icon: '🧳',
    desc: '一位旅行商人愿意用你的生命值换取一张强力卡牌。',
    options: [
      {
        label: '🩸 献祭 6 点生命，随机获得一张稀有卡牌',
        effect(run) {
          if (run.player.hp <= 6) return { text: '生命值过低，不敢冒险！', cls: 'bad' };
          damagePlayerRun(run, 6);
          const id = REWARD_POOL_RARE[Math.floor(Math.random() * REWARD_POOL_RARE.length)];
          addCardToDeck(run, id, false);
          return { text: `获得了稀有卡牌：${CARDS[id].name}`, cls: 'good' };
        },
      },
      { label: '🚶 不划算，拒绝', effect() { return { text: '你婉拒了商人的提议。', cls: 'info' }; } },
    ],
  },
];

function pickRandomEvent() {
  return EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)];
}
