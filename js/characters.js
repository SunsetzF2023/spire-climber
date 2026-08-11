// ============================================================
// Character definitions — each has its own starting HP, starting deck,
// and (via cards.js REWARD_POOLS) its own signature card pool.
// unlockAchievement: null means available from the start; otherwise the
// character is locked until meta.achievements[unlockAchievement] is true.
// ============================================================

const CHARACTERS = {
  warrior: {
    id: 'warrior', name: '战士', icon: '🗡️',
    desc: '朴实无华的近战战士，靠力量成长、格挡换伤害与厚重打击稳步推进。',
    startingHp: 70,
    startingDeck: ['strike', 'strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'heavy_slam'],
    unlockAchievement: null,
  },
  huntress: {
    id: 'huntress', name: '女猎手', icon: '🏹',
    desc: '灵活迅捷的猎手，擅长以毒素叠加、多重打击与抽牌节奏蚕食敌人，越战越猛。',
    startingHp: 62,
    startingDeck: ['dagger_throw', 'dagger_throw', 'dagger_throw', 'dagger_throw', 'dagger_throw', 'footwork', 'footwork', 'footwork', 'footwork', 'venom_strike'],
    unlockAchievement: 'diverse_arsenal',
  },
};

function isCharacterUnlocked(character, metaObj) {
  return !character.unlockAchievement || !!(metaObj && metaObj.achievements && metaObj.achievements[character.unlockAchievement]);
}
