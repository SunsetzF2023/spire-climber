// ============================================================
// Meta-progression — persisted across runs via localStorage.
// Tracks lifetime stats, achievements, and a "collection log" of
// which cards/relics/enemies the player has ever encountered.
// This is purely cosmetic/informational: it never gates what
// appears in a run's reward pools.
// ============================================================

const META_STORAGE_KEY = 'spireClimberMeta_v1';

const ACHIEVEMENTS = [
  { id: 'first_steps', name: '初次出征', icon: '👣', desc: '完成你的第一局游戏（无论胜负）', check: (s) => true },
  { id: 'elite_hunter', name: '精英猎手', icon: '💀', desc: '本局中击败至少一名精英怪', check: (s) => s.elitesDefeated >= 1 },
  { id: 'relic_collector', name: '遗物收藏家', icon: '💎', desc: '本局结束时持有 5 件及以上遗物', check: (s) => s.relicsHeld >= 5 },
  { id: 'big_spender', name: '挥金如土', icon: '💰', desc: '本局累计获得 150 枚以上金币', check: (s) => s.goldEarned >= 150 },
  { id: 'deck_bloat', name: '卡组膨胀', icon: '🃏', desc: '本局卡组膨胀到 20 张以上', check: (s) => s.deckSize >= 20 },
  { id: 'dimension_walker', name: '维度行者', icon: '🌌', desc: '击败一个维度的Boss，穿越到下一维度', check: (s) => s.actsCleared >= 1 },
  { id: 'boss_slayer', name: '登顶者', icon: '👑', desc: '击败所有维度的Boss，成功登顶', check: (s) => s.won },
  { id: 'survivor', name: '九死一生', icon: '🩸', desc: '以 10 点及以下生命值获得胜利', check: (s) => s.won && s.finalHp <= 10 },
  { id: 'card_shark', name: '出牌大师', icon: '🎴', desc: '本局中累计打出 80 张以上卡牌', check: (s) => s.cardsPlayed >= 80 },
  { id: 'treasure_hunter', name: '寻宝人', icon: '🗝️', desc: '本局中发现过宝藏节点', check: (s) => s.treasureFound },
  { id: 'monster_slayer', name: '屠夫', icon: '⚔️', desc: '本局中累计击败 15 只以上敌人', check: (s) => s.enemiesDefeated >= 15 },
  { id: 'diverse_arsenal', name: '身法如风', icon: '🏹', desc: '本局中打出过 15 种及以上不同的卡牌 —— 解锁新角色·女猎手', check: (s) => s.uniqueCardsUsed >= 15 },
  { id: 'card_master', name: '精简大师', icon: '🎴', desc: '卡组规模不超过 15 张的情况下获胜 —— 解锁出征前的额外初始卡牌选择', check: (s) => s.won && s.deckSize <= 15 },
  { id: 'relic_hoarder', name: '遗物猎人', icon: '💎', desc: '本局结束时持有 7 件及以上遗物 —— 解锁出征前的额外初始遗物选择', check: (s) => s.relicsHeld >= 7 },
];

function defaultMeta() {
  return {
    totalRuns: 0,
    wins: 0,
    bestFloorReached: 0,
    highScore: 0,
    totalGoldEarned: 0,
    totalEnemiesDefeated: 0,
    achievements: {},
    discoveredCards: [],
    discoveredRelics: [],
    discoveredEnemies: [],
  };
}

function loadMeta() {
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    if (!raw) return defaultMeta();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultMeta(), parsed);
  } catch (e) {
    return defaultMeta();
  }
}

function saveMeta(meta) {
  try { localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta)); } catch (e) { /* storage unavailable, ignore */ }
  if (typeof onMetaSaved === 'function') onMetaSaved(meta);
}

function markDiscovered(meta, listName, id) {
  if (!meta[listName].includes(id)) {
    meta[listName].push(id);
    return true; // newly discovered
  }
  return false;
}

function computeScore(stats) {
  return stats.floorReached * 100
    + (stats.actsCleared || 0) * 2000
    + stats.goldEarned
    + stats.enemiesDefeated * 15
    + stats.elitesDefeated * 40
    + (stats.won ? 5000 : 0);
}

// Applies a finished run's stats to the persistent meta object (mutates + saves it),
// returning the list of achievement defs that were newly unlocked this run.
function applyRunToMeta(meta, stats) {
  meta.totalRuns += 1;
  if (stats.won) meta.wins += 1;
  meta.bestFloorReached = Math.max(meta.bestFloorReached, stats.floorReached);
  meta.totalGoldEarned += stats.goldEarned;
  meta.totalEnemiesDefeated += stats.enemiesDefeated;
  const score = computeScore(stats);
  meta.highScore = Math.max(meta.highScore, score);

  const newlyUnlocked = [];
  ACHIEVEMENTS.forEach(ach => {
    if (!meta.achievements[ach.id] && ach.check(stats)) {
      meta.achievements[ach.id] = true;
      newlyUnlocked.push(ach);
    }
  });

  saveMeta(meta);
  return { score, newlyUnlocked };
}
