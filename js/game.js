// ============================================================
// Game state machine — screens, run state, map navigation, shop/rest/event UI,
// and combat rendering (delegates logic to CombatEngine).
// ============================================================

const STARTING_HP = 70;

// Art asset system: tries to load an image from assets/, falls back to emoji on error.
// Usage: $2 -> <img> or emoji string
function artIcon(folder, id, fallbackEmoji) {
  return fallbackEmoji;
}
// For textContent contexts (collection grid) — returns emoji only (can't use img in textContent)
// For HTML contexts — returns img tag with fallback
function artIconHtml(folder, id, fallbackEmoji) {
  return fallbackEmoji;
}
const STARTING_GOLD = 99;
const ACT_FLOOR_COUNT = 16; // travel floors per act, before the guaranteed pre-boss rest + boss floor
const RUN_STORAGE_KEY = 'spireClimberRun_v1';

let run = null;
let combat = null;
let selectedCardUid = null;
let currentShop = null;
let meta = null;

// ---------------- Mid-run save/resume ----------------
function saveRunState() {
  if (!run) return;
  try { localStorage.setItem(RUN_STORAGE_KEY, JSON.stringify(run)); } catch (e) { /* storage unavailable, ignore */ }
}
function loadRunState() {
  try {
    const raw = localStorage.getItem(RUN_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}
function clearRunState() {
  try { localStorage.removeItem(RUN_STORAGE_KEY); } catch (e) { /* ignore */ }
}
function checkResumeAvailable() {
  if (!el.resumeRunBtn) return;
  el.resumeRunBtn.classList.toggle('hidden', !loadRunState());
}
function resumeRun() {
  const saved = loadRunState();
  if (!saved) return;
  run = saved;
  showScreen('mapScreen');
  renderHud();
  renderMap();
  renderDeck();
}
function abandonRun() {
  if (!run) return;
  if (!confirm('确定要结束本局冒险吗？当前进度将视为本局结束（不计入通关）。')) return;
  finishRun(false, '你主动结束了本局冒险。');
}

const el = {};
function cacheEls() {
  [
    'menuScreen', 'startRunBtn', 'resumeRunBtn', 'openProfileBtn', 'abandonRunBtn',
    'characterScreen', 'characterList', 'characterBackBtn',
    'mapScreen', 'mapContainer', 'mapActName', 'deckList', 'deckCount',
    'eventScreen', 'eventIcon', 'eventName', 'eventDesc', 'eventOptions', 'eventCardSelect', 'eventResult', 'eventContinueBtn',
    'restScreen', 'restHealBtn', 'restUpgradeBtn', 'restLiftBtn', 'restUpgradeList',
    'restUpgradePreview', 'restPreviewBefore', 'restPreviewAfter', 'restConfirmUpgradeBtn', 'restCancelUpgradeBtn',
    'shopScreen', 'shopCards', 'shopEthereal', 'shopRelics', 'shopRemoveBtn', 'removeCost', 'shopLeaveBtn',
    'rewardScreen', 'rewardTitle', 'rewardGold', 'rewardCards', 'rewardSkipBtn',
    'combatScreen', 'enemyRow', 'drawCount', 'discardCount', 'playerHpFill', 'playerHpText', 'playerBlockBadge', 'playerStatusRow',
    'energyBadge', 'handRow', 'endTurnBtn', 'combatLog',
    'endScreen', 'endTitle', 'endDesc', 'endStatsGrid', 'endNewAchievements', 'endAchievementList', 'endRestartBtn', 'endProfileBtn',
    'profileScreen', 'profileStatsGrid', 'profileAchievements', 'profileCards', 'profileRelics', 'profileEnemies',
    'profileCardProgress', 'profileRelicProgress', 'profileEnemyProgress', 'profileBackBtn',
    'historyScreen', 'historyList', 'historyBackBtn',
    'leaderboardScreen', 'leaderboardList', 'leaderboardBackBtn', 'cloudSyncStatus2',
    'openHistoryBtn', 'openLeaderboardBtn',
    'hudHp', 'hudGold', 'hudFloor', 'hudRelics', 'tooltip',
    'infoModal', 'infoModalContent', 'infoModalClose',
    'pileModal', 'pileModalClose', 'pileModalTitle', 'pileModalGrid',
    'zoomControls', 'zoomInBtn', 'zoomOutBtn', 'zoomResetBtn', 'zoomLevel',
    'cloudSyncStatus', 'cloudLoginBtn', 'cloudLogoutBtn',
  ].forEach(id => { el[id] = document.getElementById(id); });
  el.pileModalClose.addEventListener('click', hidePileModal);
  el.pileModal.addEventListener('click', (e) => { if (e.target === el.pileModal) hidePileModal(); });
}

// ---------------- Tooltip (hover) + info modal (click) ----------------
let tooltipTouchTimer = null;
function positionTooltip(e) {
  const x = (e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX) + 14;
  const y = (e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY) + 14;
  // Keep tooltip on screen
  const tw = el.tooltip.offsetWidth || 200;
  const th = el.tooltip.offsetHeight || 60;
  const maxX = window.innerWidth - tw - 10;
  const maxY = window.innerHeight - th - 10;
  el.tooltip.style.left = Math.min(x, maxX) + 'px';
  el.tooltip.style.top = Math.min(y, maxY) + 'px';
}
function attachTooltip(elm, html) {
  elm.addEventListener('mouseenter', (e) => { el.tooltip.innerHTML = html; el.tooltip.style.display = 'block'; positionTooltip(e); });
  elm.addEventListener('mousemove', positionTooltip);
  elm.addEventListener('mouseleave', () => { el.tooltip.style.display = 'none'; });
  // Mobile: tap to show, auto-hide after 3s
  elm.addEventListener('touchstart', (e) => {
    e.preventDefault();
    el.tooltip.innerHTML = html;
    el.tooltip.style.display = 'block';
    positionTooltip(e);
    if (tooltipTouchTimer) clearTimeout(tooltipTouchTimer);
    tooltipTouchTimer = setTimeout(() => { el.tooltip.style.display = 'none'; }, 3000);
  }, { passive: false });
}
// Global touch to dismiss tooltip
document.addEventListener('touchstart', (e) => {
  if (el.tooltip.style.display === 'block' && !e.target.closest('.status-badge') && !e.target.closest('.intent') && !e.target.closest('.hud-relics span') && !e.target.closest('.intent-preview')) {
    el.tooltip.style.display = 'none';
    if (tooltipTouchTimer) clearTimeout(tooltipTouchTimer);
  }
}, { passive: true });

function showInfoModal(html) {
  el.infoModalContent.innerHTML = html;
  el.infoModal.classList.remove('hidden');
}
function hideInfoModal() { el.infoModal.classList.add('hidden'); }

function relicInfoHtml(relicId) {
  const r = RELICS[relicId];
  return `<div class="modal-icon">${r.icon}</div><div class="modal-name">${r.name}</div><div class="modal-meta">遗物 · ${r.rarity}</div><div class="modal-desc">${r.desc}</div>`;
}
function cardInfoHtml(defId, upgraded) {
  const def = CARDS[defId];
  const typeLabel = { attack: '攻击', skill: '技能', power: '能力' }[def.type];
  const cost = (upgraded && def.upgradedCost !== undefined) ? def.upgradedCost : def.cost;
  const vars = def.vars(upgraded);
  const hasUpgrade = JSON.stringify(def.vars(false)) !== JSON.stringify(def.vars(true)) || def.upgradedCost !== undefined;
  const badge = upgraded ? '<span class="upgrade-badge">+1</span>' : '';
  const toggleBtn = hasUpgrade
    ? `<button id="cardInfoToggle" class="btn btn-ghost" style="margin-top:12px">${upgraded ? '查看基础形态' : '查看升级形态'}</button>`
    : '<p class="hint" style="margin-top:12px">此卡牌无升级变化</p>';
  return `<div class="modal-icon">${def.icon}${badge}</div><div class="modal-name">${def.name}</div><div class="modal-meta">${typeLabel} · 费用 ${cost} · ${def.rarity}</div><div class="modal-desc">${def.descTemplate(vars)}</div>${toggleBtn}`;
}
function showCardInfoModal(defId) {
  let upgraded = false;
  const render = () => {
    el.infoModalContent.innerHTML = cardInfoHtml(defId, upgraded);
    const toggle = document.getElementById('cardInfoToggle');
    if (toggle) toggle.addEventListener('click', () => { upgraded = !upgraded; render(); });
  };
  render();
  el.infoModal.classList.remove('hidden');
}
function enemyInfoHtml(defId) {
  const def = ENEMIES[defId];
  const rarityLabel = { normal: '普通敌人', elite: '精英敌人', boss: 'Boss' }[def.rarity];
  return `<div class="modal-icon">${def.icon}</div><div class="modal-name">${def.name}</div><div class="modal-meta">${rarityLabel} · 生命 ${def.hpRange[0]}-${def.hpRange[1]}</div>`;
}
function unknownInfoHtml(label) {
  return `<div class="modal-icon">❔</div><div class="modal-name">???</div><div class="modal-desc">尚未发现这个${label}</div>`;
}
function achievementInfoHtml(ach, unlocked) {
  return `<div class="modal-icon">${unlocked ? ach.icon : '🔒'}</div><div class="modal-name">${unlocked ? ach.name : '???'}</div><div class="modal-meta">${unlocked ? '已解锁' : '尚未解锁'}</div><div class="modal-desc">${unlocked ? ach.desc : '达成条件后解锁'}</div>`;
}

function discover(listName, id) {
  if (markDiscovered(meta, listName, id)) saveMeta(meta);
}

// ---------------- Run helpers (used by events.js too) ----------------
function addRelicToRun(run, relicId) {
  const relic = RELICS[relicId];
  if (relic.onPickup) relic.onPickup(run);
  run.relics.push(relicId);
  discover('discoveredRelics', relicId);
  return relicId;
}
function healPlayerRun(run, amount) { if (run.flags && run.flags.noHeal) return; run.player.hp = Math.min(run.player.maxHp, run.player.hp + amount); }
function damagePlayerRun(run, amount) { run.player.hp = Math.max(0, run.player.hp - amount); }
function removeRandomCardFromDeck(run) {
  if (run.deck.length === 0) return null;
  const idx = Math.floor(Math.random() * run.deck.length);
  return run.deck.splice(idx, 1)[0];
}
function upgradeRandomCardInDeck(run) {
  const candidates = run.deck.filter(c => !c.upgraded && !['status', 'curse'].includes((CARDS[c.defId] || {}).type));
  if (candidates.length === 0) return null;
  const card = candidates[Math.floor(Math.random() * candidates.length)];
  card.upgraded = true;
  return card;
}
function getUpgradableCards(run) {
  return run.deck.filter(c => !c.upgraded && !['status', 'curse'].includes((CARDS[c.defId] || {}).type));
}
function upgradeCardByUid(run, uid) {
  const card = run.deck.find(c => c.uid === uid);
  if (!card || card.upgraded) return null;
  card.upgraded = true;
  return card;
}
function addCardToDeck(run, defId, upgraded) {
  run.deck.push(makeCardInstance(defId, upgraded));
  discover('discoveredCards', defId);
  run.relics.forEach(relicId => {
    const relic = RELICS[relicId];
    if (relic && typeof relic.onCardAdded === 'function') relic.onCardAdded(run, defId, upgraded);
  });
}

// ---------------- Screen switching ----------------
function showScreen(name) {
  ['menuScreen', 'characterScreen', 'mapScreen', 'eventScreen', 'restScreen', 'shopScreen', 'rewardScreen', 'combatScreen', 'endScreen', 'profileScreen', 'historyScreen', 'leaderboardScreen']
    .forEach(s => el[s].classList.toggle('hidden', s !== name));
  const noAbandonScreens = ['menuScreen', 'characterScreen', 'endScreen', 'profileScreen', 'historyScreen', 'leaderboardScreen'];
  if (el.abandonRunBtn) el.abandonRunBtn.classList.toggle('hidden', !run || noAbandonScreens.includes(name));
  if (name === 'menuScreen') checkResumeAvailable();
}

// ---------------- Character select ----------------
function renderCharacterSelect() {
  showScreen('characterScreen');
  el.characterList.innerHTML = '';
  Object.values(CHARACTERS).forEach(ch => {
    const unlocked = isCharacterUnlocked(ch, meta);
    const box = document.createElement('div');
    box.className = 'character-card' + (unlocked ? '' : ' locked');
    const lockAch = ch.unlockAchievement ? ACHIEVEMENTS.find(a => a.id === ch.unlockAchievement) : null;
    box.innerHTML = `
      <div class="character-icon">${unlocked ? ch.icon : '🔒'}</div>
      <div class="character-name">${unlocked ? ch.name : '???'}</div>
      <div class="character-desc">${unlocked ? ch.desc : `完成成就「${lockAch ? lockAch.name : ''}」后解锁`}</div>
    `;
    if (unlocked) box.addEventListener('click', () => selectCharacterAndStart(ch.id));
    el.characterList.appendChild(box);
  });
}

function selectCharacterAndStart(characterId) {
  proceedToRelicSelect(characterId, (CHARACTERS[characterId] || CHARACTERS.warrior).startingDeck.slice());
}

// Achievement-unlocked cards are injected into reward/shop/event pools dynamically.
// See getUnlockedAchievementCardIds() in cards.js.

function proceedToRelicSelect(characterId, deckIds) {
  const hasRelicUnlock = meta.achievements['relic_hoarder'];
  if (!hasRelicUnlock) { newRun(characterId, { customDeck: deckIds }); return; }
  showRelicSelectScreen(characterId, deckIds);
}

function showRelicSelectScreen(characterId, deckIds) {
  showScreen('eventScreen');
  el.eventIcon.textContent = '💎';
  el.eventName.textContent = '出征遗物选择';
  el.eventDesc.textContent = '你过往的成就为本次冒险带来了一件额外的初始遗物，请选择：';
  el.eventOptions.innerHTML = '';
  el.eventCardSelect.className = 'card-grid';
  el.eventCardSelect.innerHTML = '';
  el.eventResult.className = 'event-result hidden';
  el.eventContinueBtn.classList.add('hidden');

  const offered = [];
  while (offered.length < 3) {
    const id = pickRandomRelic(offered);
    if (!offered.includes(id)) offered.push(id);
  }
  offered.forEach(id => {
    const relic = RELICS[id];
    const box = document.createElement('div');
    box.className = 'relic-card';
    box.textContent = relic.icon;
    attachTooltip(box, `<b>${relic.name}</b><br>${relic.desc}`);
    box.addEventListener('click', () => newRun(characterId, { customDeck: deckIds, bonusRelicId: id }));
    el.eventCardSelect.appendChild(box);
  });

  const skipBtn = document.createElement('button');
  skipBtn.className = 'btn btn-ghost';
  skipBtn.textContent = '⏭️ 不需要额外遗物，直接出发';
  skipBtn.addEventListener('click', () => newRun(characterId, { customDeck: deckIds }));
  el.eventOptions.appendChild(skipBtn);
}

// ---------------- Run lifecycle ----------------
function newRun(characterId, bonus = {}) {
  const character = CHARACTERS[characterId] || CHARACTERS.warrior;
  const deckIds = bonus.customDeck ? bonus.customDeck.slice() : character.startingDeck.slice();
  if (bonus.bonusCardId) deckIds.push(bonus.bonusCardId);
  run = {
    characterId: character.id,
    player: { hp: character.startingHp, maxHp: character.startingHp },
    gold: STARTING_GOLD,
    relics: [],
    deck: deckIds.map(id => makeCardInstance(id, false)),
    map: generateMap(ACT_FLOOR_COUNT, 1),
    currentNodeId: null,
    removeCount: 0,
    act: 1,
    stats: { goldEarned: 0, enemiesDefeated: 0, elitesDefeated: 0, bossesDefeated: 0, cardsPlayed: 0, floorReached: 0, actsCleared: 0, actOffset: 0, treasureFound: false, uniqueCardIds: {}, eventsEncountered: 0, eventsLeft: 0, shopsVisited: 0, shopSpent: false, noBlockKillNormal: false, noBlockKillElite: false, eliteKilledIn3Turns: false, fortress: false, killedByNormal: false, goldStolen: 0, adventurerAttacks: 0, killedTypes: [] },
  };
  if (bonus.bonusRelicId) addRelicToRun(run, bonus.bonusRelicId);
  deckIds.forEach(id => discover('discoveredCards', id));
  showScreen('mapScreen');
  renderHud();
  renderMap();
  renderDeck();
}

function renderHud() {
  if (!run) return;
  el.hudHp.textContent = `${Math.max(0, Math.round(run.player.hp))}/${run.player.maxHp}`;
  el.hudGold.textContent = run.gold;
  const node = run.currentNodeId ? findNode(run.map, run.currentNodeId) : null;
  const floorText = node ? `${node.floor + 1} / ${run.map.floorCount + 1}` : `0 / ${run.map.floorCount + 1}`;
  el.hudFloor.textContent = `维度${run.act} · ${floorText}`;
  el.hudRelics.innerHTML = '';
  run.relics.forEach(id => {
    const span = document.createElement('span');
    span.innerHTML = RELICS[id].icon;
    attachTooltip(span, `<b>${RELICS[id].name}</b><br>${RELICS[id].desc}`);
    span.addEventListener('click', () => showInfoModal(relicInfoHtml(id)));
    el.hudRelics.appendChild(span);
  });
}

function checkRunDeath() {
  if (run.player.hp <= 0) {
    finishRun(false, '你在旅途中倒下了……');
    return true;
  }
  return false;
}

// ---------------- Map ----------------
function renderMap() {
  saveRunState();
  if (el.mapActName) el.mapActName.textContent = `第 ${run.act} 维度 · ${ACT_DEFS[run.act - 1].name}`;
  const reachable = new Set(getReachableNodeIds(run.map, run.currentNodeId));
  el.mapContainer.innerHTML = '';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'map-edges-svg');
  el.mapContainer.appendChild(svg);
  let currentNodeEl = null;
  const nodeElsById = {};
  run.map.floors.forEach(floorNodes => {
    const row = document.createElement('div');
    row.className = 'map-row';
    floorNodes.forEach(node => {
      const btn = document.createElement('div');
      const classes = ['map-node'];
      if (node.visited) classes.push('visited');
      if (node.id === run.currentNodeId) classes.push('current');
      else if (reachable.has(node.id) && !node.visited) classes.push('reachable');
      btn.className = classes.join(' ');
      btn.textContent = MAP_TYPE_ICON[node.type];
      btn.title = nodeLabel(node.type);
      btn.dataset.nodeId = node.id;
      if (node.id === run.currentNodeId) currentNodeEl = btn;
      if (classes.includes('reachable')) {
        btn.addEventListener('click', () => enterNode(node));
      }
      btn.addEventListener('mouseenter', () => highlightPathToNode(node.id));
      btn.addEventListener('mouseleave', clearPathHighlight);
      nodeElsById[node.id] = btn;
      row.appendChild(btn);
    });
    el.mapContainer.appendChild(row);
  });
  drawMapEdges(svg, nodeElsById);
  if (currentNodeEl) currentNodeEl.scrollIntoView({ block: 'center', behavior: 'instant' });
}

function drawMapEdges(svg, nodeElsById) {
  const containerRect = el.mapContainer.getBoundingClientRect();
  svg.setAttribute('width', containerRect.width);
  svg.setAttribute('height', containerRect.height);
  svg.innerHTML = '';
  Object.entries(run.map.edges).forEach(([fromId, toIds]) => {
    const fromEl = nodeElsById[fromId];
    if (!fromEl) return;
    toIds.forEach(toId => {
      const toEl = nodeElsById[toId];
      if (!toEl) return;
      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', fromRect.left + fromRect.width / 2 - containerRect.left);
      line.setAttribute('y1', fromRect.top + fromRect.height / 2 - containerRect.top);
      line.setAttribute('x2', toRect.left + toRect.width / 2 - containerRect.left);
      line.setAttribute('y2', toRect.top + toRect.height / 2 - containerRect.top);
      line.setAttribute('class', 'map-edge-line');
      line.dataset.from = fromId;
      line.dataset.to = toId;
      svg.appendChild(line);
    });
  });
}

// BFS forward through the map's edges to find a path from the player's current
// node to any given node, so hovering a future node can preview the route to it.
function computePathToNode(targetNodeId) {
  const start = run.currentNodeId;
  if (!start) {
    return run.map.floors[0].some(n => n.id === targetNodeId) ? [targetNodeId] : null;
  }
  if (start === targetNodeId) return [start];
  const queue = [start];
  const visitedSet = new Set([start]);
  const parent = { [start]: null };
  while (queue.length) {
    const cur = queue.shift();
    const nexts = run.map.edges[cur] || [];
    for (const n of nexts) {
      if (visitedSet.has(n)) continue;
      visitedSet.add(n);
      parent[n] = cur;
      if (n === targetNodeId) {
        const path = [];
        let p = n;
        while (p !== null && p !== undefined) { path.unshift(p); p = parent[p]; }
        return path;
      }
      queue.push(n);
    }
  }
  return null;
}

let currentPathHighlight = [];
function highlightPathToNode(targetNodeId) {
  clearPathHighlight();
  const path = computePathToNode(targetNodeId);
  if (!path) return;
  currentPathHighlight = path;
  path.forEach(id => {
    const elm = el.mapContainer.querySelector(`.map-node[data-node-id="${id}"]`);
    if (elm) elm.classList.add('path-highlight');
  });
  for (let i = 0; i < path.length - 1; i++) {
    const line = el.mapContainer.querySelector(`.map-edge-line[data-from="${path[i]}"][data-to="${path[i + 1]}"]`);
    if (line) line.classList.add('path-highlight');
  }
}
function clearPathHighlight() {
  currentPathHighlight.forEach(id => {
    const elm = el.mapContainer.querySelector(`.map-node[data-node-id="${id}"]`);
    if (elm) elm.classList.remove('path-highlight');
  });
  const svg = el.mapContainer.querySelector('.map-edges-svg');
  if (svg) svg.querySelectorAll('.map-edge-line.path-highlight').forEach(l => l.classList.remove('path-highlight'));
  currentPathHighlight = [];
}

function nodeLabel(type) {
  return { monster: '战斗', elite: '精英战斗', rest: '营地', shop: '商人', event: '未知事件', treasure: '宝藏', boss: 'Boss战' }[type] || type;
}

function renderDeck() {
  el.deckCount.textContent = `(${run.deck.length} 张)`;
  el.deckList.innerHTML = '';
  run.deck.forEach(card => el.deckList.appendChild(renderCardEl(card, { clickable: false })));
}

function enterNode(node) {
  node.visited = true;
  run.currentNodeId = node.id;
  run.stats.floorReached = Math.max(run.stats.floorReached, run.stats.actOffset + node.floor + 1);
  renderHud();
  switch (node.type) {
    case 'monster': startCombat(spawnEnemyGroup('normal', run.act, node.floor), 'normal', node); break;
    case 'elite': startCombat(spawnEnemyGroup('elite', run.act, node.floor), 'elite', node); break;
    case 'boss': startCombat(spawnEnemyGroup('boss', run.act, node.floor), 'boss', node); break;
    case 'rest': showRestScreen(node); break;
    case 'shop': showShopScreen(node); break;
    case 'event': showEventScreenUI(node); break;
    case 'treasure': showTreasureNode(node); break;
  }
}

function backToMapOrVictory(node) {
  if (checkRunDeath()) return;
  if (!node) {
    showScreen('mapScreen');
    renderMap();
    renderDeck();
    renderHud();
    return;
  }
  if (node.type === 'boss') {
    if (run.act < ACT_DEFS.length) {
      advanceToNextAct(node);
      return;
    }
    const bossName = ENEMIES[ACT_DEFS[run.act - 1].bossId].name;
    finishRun(true, `你击败了${bossName}，穿越了全部 ${ACT_DEFS.length} 个维度，成功登顶！`);
    return;
  }
  showScreen('mapScreen');
  renderMap();
  renderDeck();
  renderHud();
}

function advanceToNextAct(node) {
  const clearedBossName = ENEMIES[ACT_DEFS[run.act - 1].bossId].name;
  run.stats.actsCleared += 1;
  run.stats.actOffset += ACT_FLOOR_COUNT + 1;
  run.act += 1;
  run.player.maxHp += 20;
  healPlayerRun(run, run.player.maxHp);
  run.map = generateMap(ACT_FLOOR_COUNT, run.act);
  run.currentNodeId = null;

  showRelicRewardScreen(clearedBossName);
}

function showRelicRewardScreen(clearedBossName) {
  showScreen('eventScreen');
  el.eventIcon.textContent = '🎁';
  el.eventName.textContent = `击败${clearedBossName}！免费遗物奖励`;
  el.eventDesc.textContent = `你击败了${clearedBossName}！生命已完全恢复。作为奖励，请从遗物池中免费选择一件遗物：`;
  el.eventOptions.innerHTML = '';
  el.eventCardSelect.className = 'relic-reward-grid';
  el.eventCardSelect.innerHTML = '';
  el.eventResult.className = 'event-result hidden';
  el.eventContinueBtn.classList.add('hidden');

  const proceedAfterRelic = () => {
    if (run.act === 2) {
      showCardRewardScreen(clearedBossName);
    } else {
      showScreen('mapScreen'); renderMap(); renderDeck(); renderHud();
    }
  };

  const allRelicIds = [
    ...RELIC_LIST_COMMON,
    ...RELIC_LIST_UNCOMMON,
    ...RELIC_LIST_RARE,
    ...RELIC_LIST_SHOP,
  ].filter(id => !run.relics.includes(id));

  allRelicIds.forEach(id => {
    const relic = RELICS[id];
    const box = document.createElement('div');
    box.className = 'relic-card relic-reward-card';
    box.textContent = relic.icon;
    const rarityTag = document.createElement('span');
    rarityTag.className = 'relic-rarity-tag';
    rarityTag.textContent = relic.rarity === 'common' ? '普通' : relic.rarity === 'uncommon' ? '罕见' : relic.rarity === 'rare' ? '稀有' : relic.rarity === 'shop' ? '商店' : '事件';
    box.appendChild(rarityTag);
    attachTooltip(box, `<b>${relic.icon} ${relic.name}</b> [${rarityTag.textContent}]<br>${relic.desc}`);
    box.addEventListener('click', () => {
      addRelicToRun(run, id);
      el.eventCardSelect.className = 'card-grid hidden';
      el.eventCardSelect.innerHTML = '';
      el.eventResult.className = 'event-result good';
      el.eventResult.textContent = `获得了遗物：${relic.icon} ${relic.name}！`;
      el.eventContinueBtn.classList.remove('hidden');
      el.eventContinueBtn.onclick = proceedAfterRelic;
      renderHud();
    });
    el.eventCardSelect.appendChild(box);
  });

  const skipBtn = document.createElement('button');
  skipBtn.className = 'btn btn-ghost';
  skipBtn.textContent = '⏭️ 不需要遗物，直接进入';
  skipBtn.addEventListener('click', () => {
    el.eventCardSelect.className = 'card-grid hidden';
    el.eventCardSelect.innerHTML = '';
    proceedAfterRelic();
  });
  el.eventOptions.appendChild(skipBtn);
}

function showCardRewardScreen(clearedBossName) {
  showScreen('eventScreen');
  el.eventIcon.textContent = '🎴';
  el.eventName.textContent = `击败${clearedBossName}！卡牌奖励`;
  el.eventDesc.textContent = `作为额外奖励，你可以从卡牌池中免费挑选最多 3 张卡牌加入卡组。也可以跳过不选。`;
  el.eventOptions.innerHTML = '';
  el.eventCardSelect.className = 'card-grid';
  el.eventCardSelect.innerHTML = '';
  el.eventResult.className = 'event-result hidden';
  el.eventContinueBtn.classList.add('hidden');

  const selectedCards = [];
  const allCardIds = [];
  // Build full card pool from all rarities
  ['common', 'uncommon', 'rare'].forEach(rarity => {
    const tier = REWARD_POOLS[rarity];
    if (tier) {
      [...(tier.neutral || []), ...(tier[run.characterId] || tier.warrior || [])].forEach(id => {
        if (!allCardIds.includes(id)) allCardIds.push(id);
      });
    }
  });

  const continueBtn = document.createElement('button');
  continueBtn.className = 'btn btn-ghost';
  continueBtn.textContent = '✅ 确认选择，继续前进';
  continueBtn.style.marginTop = '12px';
  continueBtn.addEventListener('click', () => {
    selectedCards.forEach(id => {
      run.deck.push(makeCardInstance(id, false));
      discover('discoveredCards', id);
    });
    showScreen('mapScreen'); renderMap(); renderDeck(); renderHud();
  });

  allCardIds.forEach(id => {
    const def = CARDS[id];
    if (!def) return;
    const card = makeCardInstance(id, false);
    const cardEl = renderCardEl(card, {
      clickable: true,
      onClick: (c) => {
        if (selectedCards.includes(id)) {
          // Deselect
          const idx = selectedCards.indexOf(id);
          selectedCards.splice(idx, 1);
          cardEl.classList.remove('card-selected');
        } else {
          if (selectedCards.length >= 3) return;
          selectedCards.push(id);
          cardEl.classList.add('card-selected');
        }
        el.eventResult.className = 'event-result good';
        el.eventResult.textContent = selectedCards.length > 0
          ? `已选择 ${selectedCards.length}/3 张卡牌：${selectedCards.map(sid => CARDS[sid].name).join('、')}`
          : '';
        if (selectedCards.length > 0) {
          el.eventContinueBtn.classList.add('hidden');
          el.eventOptions.innerHTML = '';
          el.eventOptions.appendChild(continueBtn);
        } else {
          el.eventOptions.innerHTML = '';
          el.eventOptions.appendChild(continueBtn);
        }
      },
    });
    el.eventCardSelect.appendChild(cardEl);
  });

  el.eventOptions.appendChild(continueBtn);
}

// ---------------- Generic card element renderer ----------------
function patchCardEl(node, card, combat) {
  // 只 patch 主要内容，不重建节点，不处理 opts
  const def = CARDS[card.defId];
  const unplayable = combat && !combat.canAfford(card);
  const selected = selectedCardUid === card.uid;
  node.className = `game-card type-${def.type}`
    + (card.upgraded ? ' upgraded' : '')
    + (unplayable ? ' unplayable' : '')
    + (selected ? ' selected' : '');
  const baseCost = combat ? combat.getCardCost(card) : ((card.upgraded && def.upgradedCost !== undefined) ? def.upgradedCost : def.cost);
  const isEntangled = combat && combat.entangledUids && combat.entangledUids.includes(card.uid);
  node.querySelector('.cost').textContent = (combat && ((combat.firstAttackFree && def.type === 'attack') || (combat.geminiLeftActive && def.type !== 'status' && def.type !== 'curse'))) ? 0 : baseCost;
  node.classList.toggle('entangled', !!isEntangled);
  node.querySelector('.rarity-tag').textContent = def.rarity;
  node.querySelector('.icon').innerHTML = def.icon;
  node.querySelector('.name').textContent = def.name;
  node.querySelector('.type-label').textContent = { attack: '攻击', skill: '技能', power: '能力' }[def.type];
  node.querySelector('.desc').textContent = cardDesc(card);
}

function renderCardEl(cardInstance, opts = {}) {
  const def = CARDS[cardInstance.defId];
  const div = document.createElement('div');
  div.className = `game-card type-${def.type}` + (cardInstance.upgraded ? ' upgraded' : '');
  if (opts.selected) div.classList.add('selected');
  if (opts.unplayable) div.classList.add('unplayable');
  const liveCombat = opts.liveCombat || null;
  const baseCost = (liveCombat && liveCombat.chaosCostMap && liveCombat.chaosCostMap.has(cardInstance.uid)) ? liveCombat.chaosCostMap.get(cardInstance.uid) : ((cardInstance.upgraded && def.upgradedCost !== undefined) ? def.upgradedCost : def.cost);
  const isEntangled = liveCombat && liveCombat.entangledUids && liveCombat.entangledUids.includes(cardInstance.uid);
  if (isEntangled) div.classList.add('entangled');
  const cost = (liveCombat && ((liveCombat.firstAttackFree && def.type === 'attack') || (liveCombat.geminiLeftActive && def.type !== 'status' && def.type !== 'curse'))) ? 0 : baseCost;
  div.innerHTML = `
    <div class="cost">${cost}</div>
    <div class="rarity-tag">${def.rarity}</div>
    <div class="icon">${def.icon}</div>
    <div class="name">${def.name}</div>
    <div class="type-label">${{ attack: '攻击', skill: '技能', power: '能力' }[def.type]}</div>
    <div class="desc">${cardDesc(cardInstance)}</div>
  `;
  if (opts.clickable) div.addEventListener('click', () => opts.onClick(cardInstance));
  return div;
}

// ---------------- Pile viewer (draw/discard) ----------------
function showPileModal(title, cards) {
  el.pileModalTitle.textContent = `${title}（${cards.length} 张）`;
  el.pileModalGrid.innerHTML = '';
  cards.forEach(card => {
    const cardEl = renderCardEl(card, { clickable: false });
    el.pileModalGrid.appendChild(cardEl);
  });
  el.pileModal.classList.remove('hidden');
}
function hidePileModal() { el.pileModal.classList.add('hidden'); }
document.getElementById('drawPileBox').addEventListener('click', () => {
  if (!combat || combat.finished) return;
  showPileModal('抽牌堆', combat.drawPile.slice().reverse());
});
document.getElementById('discardPileBox').addEventListener('click', () => {
  if (!combat || combat.finished) return;
  showPileModal('弃牌堆', combat.discardPile.slice().reverse());
});

// ---------------- Event screen ----------------
function showEventScreenUI(node) {
  const evt = pickRandomEvent();
  run.stats.eventsEncountered = (run.stats.eventsEncountered || 0) + 1;
  showScreen('eventScreen');
  el.eventIcon.textContent = evt.icon;
  el.eventName.textContent = evt.name;
  el.eventDesc.textContent = evt.desc;
  el.eventResult.className = 'event-result hidden';
  el.eventCardSelect.className = 'card-grid hidden';
  el.eventCardSelect.innerHTML = '';
  el.eventOptions.innerHTML = '';

  const finishOption = (result) => {
    Array.from(el.eventOptions.children).forEach(b => b.disabled = true);
    el.eventCardSelect.className = 'card-grid hidden';
    el.eventCardSelect.innerHTML = '';
    el.eventResult.className = 'event-result ' + (result.cls || 'info');
    el.eventResult.textContent = result.text;
    el.eventContinueBtn.classList.remove('hidden');
    renderHud();
  };

  evt.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'event-option-btn';
    const isLocked = opt.disabled && opt.disabled(run);
    btn.textContent = opt.label + (isLocked ? '（条件不足）' : '');
    btn.disabled = !!isLocked;
    if (isLocked) { el.eventOptions.appendChild(btn); return; }
    btn.addEventListener('click', () => {
      if (opt.label.includes('🚶') || opt.label.includes('离开') || opt.label.includes('绕道')) {
        run.stats.eventsLeft = (run.stats.eventsLeft || 0) + 1;
      }
      if (opt.selectCard) {
        if (opt.canPick && !opt.canPick(run)) {
          finishOption({ text: opt.blockedText || '无法选择。', cls: 'bad' });
          return;
        }
        Array.from(el.eventOptions.children).forEach(b => b.disabled = true);
        el.eventCardSelect.className = 'card-grid';
        el.eventCardSelect.innerHTML = '';
        if (opt.pickHint) {
          const hint = document.createElement('div');
          hint.className = 'hint';
          hint.textContent = opt.pickHint;
          el.eventCardSelect.appendChild(hint);
        }
        const cards = opt.selectUpgrade ? getUpgradableCards(run) : run.deck;
        if (opt.selectUpgrade && cards.length === 0) {
          finishOption({ text: '卡组中没有可以强化的卡牌了。', cls: 'info' });
          return;
        }
        // Multi-select upgrade mode
        if (opt.selectUpgradeCount && opt.selectUpgradeCount > 1) {
          const maxPick = Math.min(opt.selectUpgradeCount, cards.length);
          const picked = [];
          const hint2 = document.createElement('div');
          hint2.className = 'hint';
          hint2.textContent = `请选择 ${maxPick} 张卡牌进行强化（已选 ${picked.length}/${maxPick}）：`;
          el.eventCardSelect.appendChild(hint2);
          const selectedUids = new Set();
          cards.forEach(card => {
            const cardEl = renderCardEl(card, {
              clickable: true,
              onClick: (c) => {
                if (selectedUids.has(c.uid)) return;
                selectedUids.add(c.uid);
                picked.push(c);
                cardEl.classList.add('upgraded');
                hint2.textContent = `请选择 ${maxPick} 张卡牌进行强化（已选 ${picked.length}/${maxPick}）：`;
                if (picked.length >= maxPick) {
                  const results = picked.map(p => upgradeCardByUid(run, p.uid)).filter(Boolean);
                  const names = results.map(c => CARDS[c.defId].name);
                  finishOption(opt.effect(run, null, names));
                }
              },
            });
            el.eventCardSelect.appendChild(cardEl);
          });
          return;
        }
        cards.forEach(card => {
          el.eventCardSelect.appendChild(renderCardEl(card, {
            clickable: true,
            onClick: (c) => finishOption(opt.effect(run, c.uid)),
          }));
        });
        return;
      }
      finishOption(opt.effect(run));
    });
    el.eventOptions.appendChild(btn);
  });
  el.eventContinueBtn.classList.add('hidden');
  el.eventContinueBtn.onclick = () => backToMapOrVictory(node);
}

function showTreasureNode(node) {
  const gold = 15 + Math.floor(Math.random() * 20);
  run.gold += gold;
  run.stats.goldEarned += gold;
  run.stats.treasureFound = true;
  const relicId = pickRandomRelic(run.relics);
  addRelicToRun(run, relicId);
  showScreen('eventScreen');
  el.eventIcon.textContent = '💎';
  el.eventName.textContent = '宝藏';
  el.eventDesc.textContent = `你发现了一个宝箱！获得 ${gold} 金币，以及遗物：${RELICS[relicId].icon} ${RELICS[relicId].name}`;
  el.eventOptions.innerHTML = '';
  el.eventCardSelect.className = 'card-grid hidden';
  el.eventCardSelect.innerHTML = '';
  el.eventResult.className = 'event-result hidden';
  el.eventContinueBtn.classList.remove('hidden');
  el.eventContinueBtn.onclick = () => backToMapOrVictory(node);
  renderHud();
}

// ---------------- Rest screen ----------------
function showRestScreen(node) {
  showScreen('restScreen');
  el.restUpgradeList.classList.add('hidden');
  el.restUpgradeList.innerHTML = '';
  el.restUpgradePreview.classList.add('hidden');
  el.restHealBtn.disabled = false;
  el.restUpgradeBtn.disabled = false;
  el.restLiftBtn.disabled = false;
  el.restHealBtn.onclick = () => {
    const amount = Math.round(run.player.maxHp * 0.3);
    healPlayerRun(run, amount);
    renderHud();
    backToMapOrVictory(node);
  };
  el.restLiftBtn.onclick = () => {
    run.player.maxHp += 8;
    run.player.hp += 8;
    renderHud();
    backToMapOrVictory(node);
  };

  const renderUpgradeList = () => {
    const upgradable = run.deck.filter(c => !c.upgraded && !['status', 'curse'].includes((CARDS[c.defId] || {}).type));
    if (upgradable.length === 0) { alert('卡组中所有卡牌都已经强化过了！'); return; }
    el.restUpgradePreview.classList.add('hidden');
    el.restUpgradeList.classList.remove('hidden');
    el.restUpgradeList.innerHTML = '';
    upgradable.forEach(card => {
      el.restUpgradeList.appendChild(renderCardEl(card, {
        clickable: true,
        onClick: () => showUpgradePreview(card),
      }));
    });
  };

  const showUpgradePreview = (card) => {
    el.restUpgradeList.classList.add('hidden');
    el.restUpgradePreview.classList.remove('hidden');
    el.restPreviewBefore.innerHTML = '';
    el.restPreviewAfter.innerHTML = '';
    el.restPreviewBefore.appendChild(renderCardEl(card, { clickable: false }));
    el.restPreviewAfter.appendChild(renderCardEl({ uid: card.uid + '_preview', defId: card.defId, upgraded: true }, { clickable: false }));
    el.restConfirmUpgradeBtn.onclick = () => { card.upgraded = true; backToMapOrVictory(node); };
    el.restCancelUpgradeBtn.onclick = () => renderUpgradeList();
  };

  el.restUpgradeBtn.onclick = renderUpgradeList;
}

// ---------------- Shop screen ----------------
function showShopScreen(node) {
  showScreen('shopScreen');
  run.stats.shopsVisited = (run.stats.shopsVisited || 0) + 1;
  const actMul = 1 + (run.act - 1) * 0.3;
  const shopRelicId = pickShopRelic(run.relics);
  currentShop = {
    cards: [0, 1, 2, 3, 4].map(() => ({ id: pickRandomCardId(run.characterId), cost: 0 })),
    ethereal: [0, 1].map(() => {
      const pool = SHOP_ETHEREAL_POOL.filter(id => !currentShop || true);
      return { id: pool[Math.floor(Math.random() * pool.length)], cost: 0 };
    }),
    relics: [0, 1].map(() => ({ id: pickRandomRelic(run.relics), cost: 0 })),
    shopRelic: shopRelicId ? { id: shopRelicId, cost: 0 } : null,
  };
  currentShop.cards.forEach(offer => {
    const rarity = CARDS[offer.id].rarity;
    offer.cost = Math.round((rarity === 'rare' ? 90 + Math.floor(Math.random() * 25) : rarity === 'uncommon' ? 50 + Math.floor(Math.random() * 15) : 30 + Math.floor(Math.random() * 12)) * actMul);
  });
  currentShop.ethereal.forEach(offer => {
    offer.cost = Math.round((22 + Math.floor(Math.random() * 10)) * actMul);
  });
  currentShop.relics.forEach(offer => {
    const rarity = RELICS[offer.id].rarity;
    offer.cost = Math.round((rarity === 'rare' ? 130 + Math.floor(Math.random() * 30) : rarity === 'uncommon' ? 90 + Math.floor(Math.random() * 25) : 60 + Math.floor(Math.random() * 20)) * actMul);
  });
  if (currentShop.shopRelic) {
    currentShop.shopRelic.cost = 120 + Math.floor(Math.random() * 50);
  }
  renderShop(node);
  el.shopLeaveBtn.onclick = () => backToMapOrVictory(node);
}

function renderShop(node) {
  el.removeCost.textContent = 15;
  el.shopRemoveBtn.disabled = run.gold < 15 || run.deck.length <= 5;
  el.shopRemoveBtn.onclick = () => {
    const cost = 15;
    if (run.gold < cost || run.deck.length <= 5) return;
    const cardEls = run.deck.map(card => renderCardEl(card, {
      clickable: true,
      onClick: (c) => {
        run.gold -= cost;
        run.removeCount += 1;
        run.stats.shopSpent = true;
        const idx = run.deck.findIndex(x => x.uid === c.uid);
        if (idx !== -1) run.deck.splice(idx, 1);
        renderHud();
        renderShop(node);
        el.shopCards.scrollIntoView();
      },
    }));
    el.shopCards.innerHTML = '';
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = '点击一张卡牌将其移除：';
    el.shopCards.appendChild(hint);
    cardEls.forEach(c => el.shopCards.appendChild(c));
  };

  el.shopCards.innerHTML = '';
  currentShop.cards.forEach((offer, i) => {
    if (!offer) return;
    const inst = makeCardInstance(offer.id, false);
    const card = renderCardEl(inst, { clickable: run.gold >= offer.cost, unplayable: run.gold < offer.cost });
    const priceTag = document.createElement('div');
    priceTag.className = 'hint';
    priceTag.textContent = `💰 ${offer.cost}`;
    const wrap = document.createElement('div');
    wrap.appendChild(card);
    wrap.appendChild(priceTag);
    if (run.gold >= offer.cost) {
      card.addEventListener('click', () => {
        run.gold -= offer.cost;
        addCardToDeck(run, offer.id, false);
        currentShop.cards[i] = null;
        run.stats.shopSpent = true;
        renderHud();
        renderShop(node);
      });
    }
    el.shopCards.appendChild(wrap);
  });

  if (el.shopEthereal) el.shopEthereal.innerHTML = '';
  currentShop.ethereal.forEach((offer, i) => {
    if (!offer) return;
    const inst = makeCardInstance(offer.id, false);
    const card = renderCardEl(inst, { clickable: run.gold >= offer.cost, unplayable: run.gold < offer.cost });
    const priceTag = document.createElement('div');
    priceTag.className = 'hint';
    priceTag.textContent = `💰 ${offer.cost}`;
    const wrap = document.createElement('div');
    wrap.appendChild(card);
    wrap.appendChild(priceTag);
    if (run.gold >= offer.cost) {
      card.addEventListener('click', () => {
        run.gold -= offer.cost;
        addCardToDeck(run, offer.id, false);
        currentShop.ethereal[i] = null;
        run.stats.shopSpent = true;
        renderHud();
        renderShop(node);
      });
    }
    if (el.shopEthereal) el.shopEthereal.appendChild(wrap);
  });
  el.shopRelics.innerHTML = '';
  currentShop.relics.forEach((offer, i) => {
    if (!offer) return;
    const relic = RELICS[offer.id];
    const box = document.createElement('div');
    box.className = 'relic-card';
    box.innerHTML = artIcon('relics', offer.id, relic.icon);
    attachTooltip(box, `<b>${relic.name}</b><br>${relic.desc}<br>💰 ${offer.cost}`);
    if (run.gold >= offer.cost) {
      box.addEventListener('click', () => {
        run.gold -= offer.cost;
        addRelicToRun(run, offer.id);
        currentShop.relics[i] = null;
        run.stats.shopSpent = true;
        renderHud();
        renderShop(node);
      });
    } else {
      box.style.opacity = 0.4;
    }
    el.shopRelics.appendChild(box);
  });
  if (currentShop.shopRelic) {
    const offer = currentShop.shopRelic;
    const relic = RELICS[offer.id];
    const box = document.createElement('div');
    box.className = 'relic-card shop-relic-card';
    box.innerHTML = artIcon('relics', offer.id, relic.icon);
    attachTooltip(box, `<b>${relic.name}</b> 🏪<br>${relic.desc}<br>💰 ${offer.cost}`);
    if (run.gold >= offer.cost) {
      box.addEventListener('click', () => {
        run.gold -= offer.cost;
        addRelicToRun(run, offer.id);
        currentShop.shopRelic = null;
        run.stats.shopSpent = true;
        renderHud();
        renderShop(node);
      });
    } else {
      box.style.opacity = 0.4;
    }
    el.shopRelics.appendChild(box);
  }
}

// ---------------- Combat ----------------
function startCombat(enemyDefIds, tier, node) {
  const hpScaling = ACT_DEFS[run.act - 1].scaling;
  const dmgScaling = ACT_DEFS[run.act - 1].dmgScaling || 1.0;
  combat = new CombatEngine(run, enemyDefIds, hpScaling, dmgScaling);
  combat.rewardTier = tier;
  combat.node = node;
  combat.enemies.forEach(e => discover('discoveredEnemies', e.defId));
  combat.start();
  selectedCardUid = null;
  // Reset tracking data for new combat
  el.handRow.innerHTML = '';
  delete el.playerHpFill.dataset.lastHp;
  delete el.playerBlockBadge.dataset.lastBlock;
  delete el.energyBadge.dataset.lastEnergy;
  showScreen('combatScreen');
  // Boss intro speech bubble
  const boss = combat.enemies.find(e => ENEMIES[e.defId] && ENEMIES[e.defId].rarity === 'boss');
  if (boss) {
    showBossIntro(boss);
  } else {
    renderCombat();
  }
}

function showBossIntro(boss) {
  const overlay = document.createElement('div');
  overlay.className = 'boss-intro-overlay';
  const speechMap = {
    abyss_lord: '我的怒火将吞噬你。',
    iron_colossus: '系统过载……歼灭模式启动。',
    void_progenitor: '虚空已在你们心中生根。',
  };
  const speech = speechMap[boss.defId] || '你无法战胜我。';
  overlay.innerHTML = `
    <div class="boss-intro-content">
      <div class="boss-intro-icon">${artIcon('enemies', boss.defId, boss.icon)}</div>
      <div class="boss-intro-name">${boss.name}</div>
      <div class="boss-speech-bubble">💬 "${speech}"</div>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => {
    overlay.classList.add('boss-intro-fade-out');
    setTimeout(() => {
      overlay.remove();
      renderCombat();
    }, 600);
  }, 2500);
}

const BOSS_SPEECHES = {
  abyss_lord: {
    intro: '我的怒火将吞噬你。',
    highDamage: ['化为灰烬吧！', '感受深渊的力量！', '燃烧吧，虫蚁！'],
    tookDamage: ['你无法打败深渊', '这点疼痛不算什么……', '深渊不会倒下！'],
    lowHp: ['人类……离开深渊', '不可能……我的力量在消逝', '你竟敢……'],
    turn: ['颤抖吧', '绝望吧', '深渊永不停息'],
  },
  iron_colossus: {
    intro: '系统过载……歼灭模式启动。',
    highDamage: ['目标锁定，歼灭！', '过载打击！', '系统全功率输出！'],
    tookDamage: ['护甲受损……重新校准', '外部冲击已记录', '系统不受影响'],
    lowHp: ['警告……核心不稳定', '系统……崩溃中', '不可能……过热临界'],
    turn: ['执行清扫程序', '热能积蓄中', '下一轮攻击准备就绪'],
  },
  void_progenitor: {
    intro: '虚空已在你们心中生根。',
    highDamage: ['虚空吞噬你！', '感受虚无的力量！', '万物归于虚空！'],
    tookDamage: ['虚空不可被伤害', '你的攻击毫无意义', '我即是虚无本身'],
    lowHp: ['虚空……在崩塌？', '这不可能发生……', '你们……无法理解'],
    turn: ['虚空在扩张', '你们的力量在消逝', '虚无即将降临'],
  },
};

function showBossSpeech(bossDefId, text) {
  const existing = document.getElementById('bossCombatSpeech');
  if (existing) existing.remove();
  const bubble = document.createElement('div');
  bubble.id = 'bossCombatSpeech';
  bubble.className = 'boss-combat-speech';
  bubble.textContent = `💬 "${text}"`;
  document.body.appendChild(bubble);
  setTimeout(() => {
    bubble.classList.add('boss-combat-speech-fade-out');
    setTimeout(() => bubble.remove(), 500);
  }, 2000);
}

function tryBossSpeech(trigger) {
  if (!combat) return;
  const boss = combat.enemies.find(e => e.hp > 0 && ENEMIES[e.defId] && ENEMIES[e.defId].rarity === 'boss');
  if (!boss) return;
  const speeches = BOSS_SPEECHES[boss.defId];
  if (!speeches) return;
  let lines;
  if (trigger === 'highDamage') lines = speeches.highDamage;
  else if (trigger === 'tookDamage') lines = speeches.tookDamage;
  else if (trigger === 'lowHp') lines = speeches.lowHp;
  else if (trigger === 'turn') lines = speeches.turn;
  if (!lines || lines.length === 0) return;
  if (Math.random() < 0.5) return; // 50% chance to speak
  const text = lines[Math.floor(Math.random() * lines.length)];
  showBossSpeech(boss.defId, text);
}

function startCombatFromEvent(enemyDefIds, tier) {
  const hpScaling = ACT_DEFS[run.act - 1].scaling;
  const dmgScaling = ACT_DEFS[run.act - 1].dmgScaling || 1.0;
  combat = new CombatEngine(run, enemyDefIds, hpScaling, dmgScaling);
  combat.rewardTier = tier;
  combat.node = null;
  combat.fromEvent = true;
  combat.enemies.forEach(e => discover('discoveredEnemies', e.defId));
  combat.start();
  selectedCardUid = null;
  el.handRow.innerHTML = '';
  delete el.playerHpFill.dataset.lastHp;
  delete el.playerBlockBadge.dataset.lastBlock;
  delete el.energyBadge.dataset.lastEnergy;
  showScreen('combatScreen');
  const boss = combat.enemies.find(e => ENEMIES[e.defId] && ENEMIES[e.defId].rarity === 'boss');
  if (boss) {
    showBossIntro(boss);
  } else {
    renderCombat();
  }
}

function buildStatusBadge(name, amount, showLabel) {
  const meta = STATUS_META[name];
  const span = document.createElement('span');
  span.className = 'status-badge';
  span.textContent = `${meta.icon}${showLabel ? ' ' + meta.label + ' ' : ''}${amount}`;
  attachTooltip(span, `<b>${meta.icon} ${meta.label} ${amount} 层</b><br>${meta.desc}`);
  return span;
}

function showDamageNumber(container, amount, type) {
  const el2 = document.createElement('div');
  el2.className = 'dmg-float dmg-' + type;
  el2.textContent = (type === 'heal' ? '+' : '-') + amount;
  const offsetX = (Math.random() - 0.5) * 40;
  el2.style.setProperty('margin-left', offsetX.toFixed(0) + 'px');
  container.appendChild(el2);
  setTimeout(() => el2.remove(), 1000);
}

function triggerHitEffect(node) {
  // Shake is applied to the icon child (not `node` itself), since patchEnemyBox
  // reassigns node.className on every render and would otherwise wipe it instantly.
  const icon = node.querySelector('.enemy-icon');
  if (icon) {
    icon.classList.remove('hit-shake');
    void icon.offsetWidth; // restart animation
    icon.classList.add('hit-shake');
    setTimeout(() => icon.classList.remove('hit-shake'), 400);
  }
  const burst = document.createElement('div');
  burst.className = 'blood-particles';
  const count = 6 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'blood-particle';
    const angle = Math.random() * Math.PI * 2;
    const dist = 18 + Math.random() * 28;
    p.style.setProperty('--dx', (Math.cos(angle) * dist).toFixed(1) + 'px');
    p.style.setProperty('--dy', (Math.sin(angle) * dist).toFixed(1) + 'px');
    p.style.animationDelay = (Math.random() * 0.08).toFixed(2) + 's';
    burst.appendChild(p);
  }
  node.appendChild(burst);
  setTimeout(() => burst.remove(), 650);
}

function patchEnemyBox(node, enemy) {
  const prevHp = node.dataset.lastHp !== undefined ? parseFloat(node.dataset.lastHp) : enemy.hp;
  const prevBlock = node.dataset.lastBlock !== undefined ? parseFloat(node.dataset.lastBlock) : enemy.block;
  // Process queued damage events for this enemy (multi-hit support)
  const events = combat.damageEvents.filter(ev => ev.enemyId === enemy.id);
  if (events.length > 0) {
    events.forEach((ev, i) => {
      setTimeout(() => {
        if (ev.amount > 0) {
          triggerHitEffect(node);
          showDamageNumber(node, ev.amount, 'enemy');
        }
      }, i * 180);
    });
  } else if (enemy.hp < prevHp) {
    triggerHitEffect(node);
    showDamageNumber(node, Math.round(prevHp - enemy.hp), 'enemy');
  }
  if (enemy.hp > prevHp) {
    showDamageNumber(node, Math.round(enemy.hp - prevHp), 'heal');
  }
  node.dataset.lastHp = enemy.hp;
  // Boss speech triggers
  const eDef = ENEMIES[enemy.defId];
  if (eDef && eDef.rarity === 'boss') {
    if (enemy.hp < prevHp) {
      const dmgTaken = prevHp - enemy.hp;
      if (dmgTaken >= 15) tryBossSpeech('tookDamage');
    }
    if (enemy.hp > 0 && enemy.hp <= enemy.maxHp * 0.3 && prevHp > enemy.maxHp * 0.3) {
      tryBossSpeech('lowHp');
    }
  }
  // Block pulse on gain
  if (enemy.block > prevBlock) {
    const badge = node.querySelector('.block-badge');
    if (badge) {
      badge.classList.remove('block-pulse');
      void badge.offsetWidth;
      badge.classList.add('block-pulse');
      setTimeout(() => badge.classList.remove('block-pulse'), 400);
    }
  }
  node.dataset.lastBlock = enemy.block;
  const hasTauntAlive = combat.enemies.some(e => e.hp > 0 && e.taunt);
  const canTarget = enemy.hp > 0 && selectedCardUid && (!hasTauntAlive || enemy.taunt);
  node.className = 'enemy-box' + (canTarget ? ' targetable' : '') + (enemy.taunt && enemy.hp > 0 ? ' taunt-enemy' : '');
  node.style.opacity = enemy.hp <= 0 ? 0.25 : 1;
  // 更新 icon
  node.querySelector('.enemy-icon').innerHTML = artIcon('enemies', enemy.defId, enemy.icon);
  // 更新名字
  node.querySelector('.enemy-name').textContent = enemy.name;
  // 更新血条
  node.querySelector('.hp-fill').style.width = Math.max(0, enemy.hp / enemy.maxHp * 100) + '%';
  node.querySelector('.hp-text').textContent = `${Math.max(0, enemy.hp)}/${enemy.maxHp}`;
  // 更新格挡
  node.querySelector('.block-badge').textContent = enemy.block > 0 ? `🛡️ ${enemy.block}` : '';
  // 更新意图
  const move = enemy.nextMove;
  const intentDiv = node.querySelector('.intent');
  if (enemy.hp > 0) {
    const intentText = move ? `${move.icon} ${move.type === 'attack' ? (() => {
      let val = move.displayValue;
      const str = enemy.statuses.strength || 0;
      if (str) val = val + str;
      if (combat.player.statuses.vulnerable > 0) val = Math.floor(val * 1.5);
      if (enemy.statuses.weak > 0) val = Math.floor(val * 0.75);
      return val + (move.hitsCount ? ` x${move.hitsCount}` : '');
    })() : (move.type === 'defend' ? move.displayValue : (move.type === 'heal' ? move.displayValue : (move.type === 'idle' ? move.name : '')))}` : '';
    intentDiv.textContent = intentText;
    intentDiv.className = 'intent';
    if (move && move.type === 'idle') {
      intentDiv.classList.add('intent-idle');
      attachTooltip(intentDiv, `<b>${move.icon} ${move.name}</b><br>本回合${enemy.name}不会采取任何行动，放心进攻或补充资源吧。`);
    }
    if (move && move.statusPreview && move.statusPreview.length) {
      const previewSpan = document.createElement('span');
      previewSpan.className = 'intent-preview';
      previewSpan.textContent = ' + ' + move.statusPreview.map(s => `${STATUS_META[s.name].icon}${s.amount}`).join(' ');
      const tipText = move.statusPreview.map(s => `${STATUS_META[s.name].icon} ${STATUS_META[s.name].label} +${s.amount}：${STATUS_META[s.name].desc}`).join('<br>');
      attachTooltip(previewSpan, `<b>该攻击还会施加：</b><br>${tipText}`);
      intentDiv.appendChild(previewSpan);
    }
  } else {
    intentDiv.textContent = '💀';
    intentDiv.className = 'intent';
  }
  // 更新状态
  const statusRow = node.querySelector('.status-row');
  statusRow.innerHTML = '';
  ['strength', 'weak', 'vulnerable', 'poison'].forEach(name => {
    if (enemy.statuses[name]) statusRow.appendChild(buildStatusBadge(name, enemy.statuses[name], false));
  });
  // 更新点击事件
  node.onclick = null;
  if (enemy.hp > 0 && selectedCardUid && canTarget) {
    node.onclick = () => {
      const res = combat.playCard(selectedCardUid, enemy.id);
      selectedCardUid = null;
      if (res.success) afterCombatAction(); else renderCombat();
    };
  }
}

function createEnemyBox(enemy) {
  const box = document.createElement('div');
  box.innerHTML = `
    <div class="enemy-icon"></div>
    <div class="enemy-name"></div>
    <div class="hp-bar"><div class="hp-fill"></div><div class="hp-text"></div></div>
    <div class="block-badge"></div>
    <div class="intent"></div>
    <div class="status-row"></div>
  `;
  patchEnemyBox(box, enemy);
  return box;
}

function renderCombat() {
  // --- ENEMY ZONE DIFF PATCH ---
  const enemyMap = {};
  Array.from(el.enemyRow.children).forEach(child => {
    const eid = child.getAttribute('data-eid');
    if (eid) enemyMap[eid] = child;
  });
  const newEnemyOrder = [];
  combat.enemies.forEach(enemy => {
    let node = enemyMap[enemy.id];
    if (node) {
      patchEnemyBox(node, enemy);
      delete enemyMap[enemy.id];
    } else {
      node = createEnemyBox(enemy);
    }
    node.setAttribute('data-eid', enemy.id);
    newEnemyOrder.push(node);
  });
  Object.values(enemyMap).forEach(n => {
    if (!n.classList.contains('enemy-dying')) {
      n.classList.add('enemy-dying');
      setTimeout(() => n.remove(), 500);
    }
  });
  newEnemyOrder.forEach(n => el.enemyRow.appendChild(n));
  combat.damageEvents = [];

  const p = combat.player;
  // Player damage / heal number
  const prevPlayerHp = el.playerHpFill.dataset.lastHp !== undefined ? parseFloat(el.playerHpFill.dataset.lastHp) : run.player.hp;
  if (run.player.hp < prevPlayerHp) {
    const dmgTaken = prevPlayerHp - run.player.hp;
    showDamageNumber(el.playerBlockBadge.parentElement, Math.round(dmgTaken), 'player');
    if (dmgTaken >= 10) tryBossSpeech('highDamage');
  }
  if (run.player.hp > prevPlayerHp) showDamageNumber(el.playerBlockBadge.parentElement, Math.round(run.player.hp - prevPlayerHp), 'heal');
  el.playerHpFill.dataset.lastHp = run.player.hp;
  // Player block pulse
  const prevPlayerBlock = el.playerBlockBadge.dataset.lastBlock !== undefined ? parseFloat(el.playerBlockBadge.dataset.lastBlock) : p.block;
  if (p.block > prevPlayerBlock) {
    el.playerBlockBadge.classList.remove('block-pulse');
    void el.playerBlockBadge.offsetWidth;
    el.playerBlockBadge.classList.add('block-pulse');
    setTimeout(() => el.playerBlockBadge.classList.remove('block-pulse'), 400);
  }
  el.playerBlockBadge.dataset.lastBlock = p.block;
  el.playerHpFill.style.width = Math.max(0, run.player.hp / run.player.maxHp * 100) + '%';
  el.playerHpText.textContent = `${Math.max(0, Math.round(run.player.hp))}/${run.player.maxHp}`;
  el.playerBlockBadge.textContent = p.block > 0 ? `🛡️ ${p.block}` : '';
  el.playerStatusRow.innerHTML = '';
  ['strength', 'dexterity', 'weak', 'vulnerable', 'frail', 'poison', 'metallicize', 'venom',
    'darkEmbrace', 'feelNoPain', 'barricade', 'juggernaut', 'noxiousFumes', 'wellLaidPlans', 'toolsOfTrade',
    'cardLock', 'entangle', 'chaos', 'battleHymn', 'corruption', 'demonForm'].forEach(name => {
    if (p.statuses[name]) el.playerStatusRow.appendChild(buildStatusBadge(name, p.statuses[name], true));
  });

  // Energy badge pulse on change
  const prevEnergy = el.energyBadge.dataset.lastEnergy !== undefined ? parseFloat(el.energyBadge.dataset.lastEnergy) : combat.energy;
  if (combat.energy !== prevEnergy) {
    el.energyBadge.classList.remove('energy-pulse');
    void el.energyBadge.offsetWidth;
    el.energyBadge.classList.add('energy-pulse');
    setTimeout(() => el.energyBadge.classList.remove('energy-pulse'), 500);
  }
  el.energyBadge.dataset.lastEnergy = combat.energy;
  el.energyBadge.textContent = `${combat.energy}/${combat.energyMax}`;
  el.drawCount.textContent = combat.drawPile.length;
  el.discardCount.textContent = combat.discardPile.length;

  // --- HAND ZONE DIFF PATCH ---
  const handMap = {};
  Array.from(el.handRow.children).forEach(child => {
    if (child.dataset.removing) return; // skip fly-out nodes
    const uid = child.getAttribute('data-uid');
    if (uid) handMap[uid] = child;
  });
  const newHandOrder = [];
  combat.hand.forEach(card => {
    let node = handMap[card.uid];
    if (node) {
      patchCardEl(node, card, combat);
      delete handMap[card.uid];
    } else {
      node = renderCardEl(card, {
        clickable: true,
        selected: selectedCardUid === card.uid,
        unplayable: !combat.canAfford(card),
        liveCombat: combat,
        onClick: (c) => {
          if (!combat.canAfford(c)) return;
          const def = CARDS[c.defId];
          if (def.target === 'enemy') {
            selectedCardUid = selectedCardUid === c.uid ? null : c.uid;
            renderCombat();
          } else {
            const res = combat.playCard(c.uid, null);
            if (res.success) afterCombatAction();
          }
        },
      });
      node.classList.add('card-draw-in');
      setTimeout(() => node.classList.remove('card-draw-in'), 400);
    }
    node.setAttribute('data-uid', card.uid);
    newHandOrder.push(node);
  });
  Object.values(handMap).forEach(n => {
    n.dataset.removing = '1';
    n.classList.add('card-fly-out');
    setTimeout(() => n.remove(), 400);
  });
  newHandOrder.forEach(n => el.handRow.appendChild(n));

  el.combatLog.innerHTML = combat.log_.slice(-40).reverse().map(e => `<div class="log-entry ${e.cls}">${e.text}</div>`).join('');
  el.endTurnBtn.disabled = combat.finished;
}

function afterCombatAction() {
  combat.cleanupDeadEnemies();
  renderHud();
  renderCombat();
  if (combat.finished && !combat.resultHandled) {
    combat.resultHandled = true;
    setTimeout(() => {
      if (combat.winner === 'player') showRewardScreen();
      else {
        const killer = combat.killerName;
        const deathDesc = killer
          ? `你被${killer}击败了……`
          : '你在战斗中被击败了……';
        finishRun(false, deathDesc);
      }
    }, 400);
  }
}

// ---------------- Reward screen ----------------
function showRewardScreen() {
  // Remove cards with removeFromDeck trait from run.deck
  if (combat.removedFromDeck && combat.removedFromDeck.length > 0) {
    combat.removedFromDeck.forEach(removed => {
      const idx = run.deck.findIndex(c => c.defId === removed.defId && c.upgraded === removed.upgraded);
      if (idx !== -1) run.deck.splice(idx, 1);
    });
  }
  showScreen('rewardScreen');
  const tier = combat.rewardTier;
  const actScaling = ACT_DEFS[run.act - 1].scaling;
  const goldReward = Math.round((tier === 'boss' ? 60 + Math.floor(Math.random() * 20)
    : tier === 'elite' ? 25 + Math.floor(Math.random() * 15)
    : 10 + Math.floor(Math.random() * 10)) * actScaling);
  run.gold += goldReward;
  run.stats.goldEarned += goldReward;
  run.stats.enemiesDefeated += combat.enemies.length;
  if (tier === 'elite') run.stats.elitesDefeated += 1;
  if (tier === 'boss') run.stats.bossesDefeated = (run.stats.bossesDefeated || 0) + 1;
  if (combat.combatStats.killedTypes) {
    run.stats.killedTypes = (run.stats.killedTypes || []);
    combat.combatStats.killedTypes.forEach(t => run.stats.killedTypes.push(t));
  }
  let goldText = `获得 ${goldReward} 金币`;
  if (tier === 'elite') {
    const relicId = pickRandomRelic(run.relics);
    addRelicToRun(run, relicId);
    goldText += `，以及遗物：${RELICS[relicId].icon} ${RELICS[relicId].name}`;
  }
  el.rewardTitle.textContent = tier === 'boss' ? '👑 击败了Boss！' : tier === 'elite' ? '💀 精英战斗胜利！' : '⚔️ 战斗胜利！';
  el.rewardGold.textContent = goldText;
  renderHud();

  const offerCards = tier !== 'normal' || Math.random() < 0.5;
  if (offerCards) {
    const offered = [];
    while (offered.length < 3) {
      const id = pickRandomCardId(run.characterId, offered);
      if (!offered.includes(id)) offered.push(id);
    }
    el.rewardCards.innerHTML = '';
    offered.forEach(id => {
      const inst = makeCardInstance(id, false);
      const cardEl = renderCardEl(inst, {
        clickable: true,
        onClick: () => {
          addCardToDeck(run, id, false);
          backToMapOrVictory(combat.node);
        },
      });
      el.rewardCards.appendChild(cardEl);
    });
    el.rewardSkipBtn.classList.remove('hidden');
    el.rewardSkipBtn.textContent = '跳过，不选卡';
  } else {
    el.rewardCards.innerHTML = '<p class="hint" style="margin:20px 0">本次战斗未掉落卡牌</p>';
    el.rewardSkipBtn.classList.remove('hidden');
    el.rewardSkipBtn.textContent = '继续';
  }
  el.rewardSkipBtn.onclick = () => backToMapOrVictory(combat.node);
}

// ---------------- End screen ----------------
function statBoxHtml(label, value) {
  return `<div class="stat-box"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
}

function finishRun(victory, desc) {
  clearRunState();
  showScreen('endScreen');
  const stats = {
    won: victory,
    act: run.act,
    actsCleared: run.stats.actsCleared,
    floorReached: run.stats.floorReached,
    goldEarned: run.stats.goldEarned,
    enemiesDefeated: run.stats.enemiesDefeated,
    elitesDefeated: run.stats.elitesDefeated,
    cardsPlayed: run.stats.cardsPlayed,
    relicsHeld: run.relics.length,
    relicIds: run.relics.slice(),
    deckSize: run.deck.length,
    finalHp: run.player.hp,
    maxHp: run.player.maxHp,
    treasureFound: run.stats.treasureFound,
    uniqueCardIds: Object.keys(run.stats.uniqueCardIds || {}).length,
    uniqueCardsUsed: Object.keys(run.stats.uniqueCardIds || {}).length,
    eventsEncountered: run.stats.eventsEncountered || 0,
    eventsLeft: run.stats.eventsLeft || 0,
    shopsVisited: run.stats.shopsVisited || 0,
    shopSpent: run.stats.shopSpent || false,
    noBlockKillNormal: run.stats.noBlockKillNormal || false,
    noBlockKillElite: run.stats.noBlockKillElite || false,
    eliteKilledIn3Turns: run.stats.eliteKilledIn3Turns || false,
    fortress: run.stats.fortress || false,
    killedByNormal: run.stats.killedByNormal || false,
    killedTypes: run.stats.killedTypes || [],
    goldStolen: run.stats.goldStolen || 0,
    adventurerAttacks: run.stats.adventurerAttacks || 0,
  };
  const { score, newlyUnlocked } = applyRunToMeta(meta, stats);

  // Save run history (keep last 2)
  const historyRecord = {
    characterId: run.characterId,
    characterName: (CHARACTERS[run.characterId] || {}).name || run.characterId,
    characterIcon: (CHARACTERS[run.characterId] || {}).icon || '❓',
    victory,
    deathCause: desc || '',
    act: run.act,
    floor: run.stats.floorReached,
    score,
    finalHp: run.player.hp,
    maxHp: run.player.maxHp,
    relicIds: run.relics.slice(),
    deckIds: run.deck.map(c => c.defId + (c.upgraded ? '+' : '')),
    enemiesDefeated: run.stats.enemiesDefeated,
    elitesDefeated: run.stats.elitesDefeated,
    bossesDefeated: run.stats.bossesDefeated || 0,
    goldEarned: run.stats.goldEarned,
    timestamp: Date.now(),
  };
  meta.runHistory = meta.runHistory || [];
  meta.runHistory.unshift(historyRecord);
  if (meta.runHistory.length > 2) meta.runHistory = meta.runHistory.slice(0, 2);
  saveMeta(meta);

  // Upload to cloud leaderboard if logged in
  if (typeof uploadRunToLeaderboard === 'function') uploadRunToLeaderboard(historyRecord);

  el.endTitle.textContent = victory ? '🏆 通关成功！' : '💀 游戏结束';
  el.endDesc.textContent = desc || '';
  el.endStatsGrid.innerHTML = [
    statBoxHtml('到达维度', `${stats.act}`),
    statBoxHtml('到达楼层', `${stats.floorReached}`),
    statBoxHtml('本局得分', score),
    statBoxHtml('获得金币', stats.goldEarned),
    statBoxHtml('击败敌人', stats.enemiesDefeated),
    statBoxHtml('击败精英', stats.elitesDefeated),
    statBoxHtml('击败Boss', stats.bossesDefeated || 0),
    statBoxHtml('持有遗物', stats.relicsHeld),
    statBoxHtml('卡组大小', stats.deckSize),
    statBoxHtml('打出卡牌', stats.cardsPlayed),
  ].join('');

  if (newlyUnlocked.length > 0) {
    el.endNewAchievements.classList.remove('hidden');
    el.endAchievementList.innerHTML = newlyUnlocked.map(ach => `
      <div class="achievement-badge unlocked">
        <div class="ach-icon">${ach.icon}</div>
        <div class="ach-name">${ach.name}</div>
        <div class="ach-desc">${ach.desc}</div>
      </div>`).join('');
  } else {
    el.endNewAchievements.classList.add('hidden');
    el.endAchievementList.innerHTML = '';
  }

  el.endRestartBtn.onclick = () => { showScreen('menuScreen'); };
  el.endProfileBtn.onclick = () => showProfileScreen();
}

// ---------------- Cloud sync UI ----------------
function renderCloudSyncStatus() {
  if (cloudUser) {
    const name = cloudUser.user_metadata && (cloudUser.user_metadata.user_name || cloudUser.user_metadata.full_name);
    el.cloudSyncStatus.textContent = `☁️ 已登录${name ? '：' + name : ''} — 进度已同步到云端`;
    el.cloudLoginBtn.classList.add('hidden');
    el.cloudLogoutBtn.classList.remove('hidden');
  } else {
    el.cloudSyncStatus.textContent = '☁️ 未登录 — 进度仅保存在本设备';
    el.cloudLoginBtn.classList.remove('hidden');
    el.cloudLogoutBtn.classList.add('hidden');
  }
}

function onCloudAuthChanged(user) {
  renderCloudSyncStatus();
  if (el.profileScreen && !el.profileScreen.classList.contains('hidden')) showProfileScreen();
}

// ---------------- Profile / Personal Center ----------------
function showProfileScreen() {
  showScreen('profileScreen');
  renderCloudSyncStatus();
  el.profileStatsGrid.innerHTML = [
    statBoxHtml('总局数', meta.totalRuns),
    statBoxHtml('胜利次数', meta.wins),
    statBoxHtml('最高得分', meta.highScore),
    statBoxHtml('最深楼层', meta.bestFloorReached),
    statBoxHtml('累计金币', meta.totalGoldEarned),
    statBoxHtml('累计击杀', meta.totalEnemiesDefeated),
  ].join('');

  el.profileAchievements.innerHTML = '';
  ACHIEVEMENTS.forEach(ach => {
    const unlocked = !!meta.achievements[ach.id];
    const div = document.createElement('div');
    div.className = `achievement-badge ${unlocked ? 'unlocked' : 'locked'}`;
    div.innerHTML = `
      <div class="ach-icon">${unlocked ? ach.icon : '🔒'}</div>
      <div class="ach-name">${unlocked ? ach.name : '???'}</div>
      <div class="ach-desc">${unlocked ? ach.desc : '尚未解锁'}</div>
    `;
    div.addEventListener('click', () => showInfoModal(achievementInfoHtml(ach, unlocked)));
    el.profileAchievements.appendChild(div);
  });

  const buildCollectionGrid = (container, ids, discoveredList, infoFn, label, isCard) => {
    container.innerHTML = '';
    ids.forEach(id => {
      const discovered = discoveredList.includes(id);
      const div = document.createElement('div');
      div.className = `collection-item ${discovered ? '' : 'undiscovered'}`;
      div.innerHTML = discovered ? infoFn.icon(id) : '❔';
      div.addEventListener('click', () => {
        if (!discovered) { showInfoModal(unknownInfoHtml(label)); return; }
        if (isCard) showCardInfoModal(id); else showInfoModal(infoFn.html(id));
      });
      container.appendChild(div);
    });
  };

  const cardIds = Object.keys(CARDS);
  el.profileCardProgress.textContent = `(${meta.discoveredCards.length} / ${cardIds.length})`;
  buildCollectionGrid(el.profileCards, cardIds, meta.discoveredCards, { icon: (id) => artIcon('cards', id, CARDS[id].icon), html: cardInfoHtml }, '卡牌', true);

  const relicIds = Object.keys(RELICS);
  el.profileRelicProgress.textContent = `(${meta.discoveredRelics.length} / ${relicIds.length})`;
  buildCollectionGrid(el.profileRelics, relicIds, meta.discoveredRelics, { icon: (id) => artIcon('relics', id, RELICS[id].icon), html: relicInfoHtml }, '遗物');

  const enemyIds = Object.keys(ENEMIES);
  el.profileEnemyProgress.textContent = `(${meta.discoveredEnemies.length} / ${enemyIds.length})`;
  buildCollectionGrid(el.profileEnemies, enemyIds, meta.discoveredEnemies, { icon: (id) => artIcon('enemies', id, ENEMIES[id].icon), html: enemyInfoHtml }, '敌人');
}

// ---------------- Adventure History ----------------
function floorToActFloorStr(globalFloor) {
  if (!globalFloor || globalFloor <= 0) return '维度1 第1层';
  const actSize = ACT_FLOOR_COUNT + 1; // floors per act including boss
  const act = Math.floor((globalFloor - 1) / actSize) + 1;
  const floorInAct = ((globalFloor - 1) % actSize) + 1;
  return `维度${act} 第${floorInAct}层`;
}

function showHistoryScreen() {
  showScreen('historyScreen');
  const history = meta.runHistory || [];
  if (history.length === 0) {
    el.historyList.innerHTML = '<div class="hint" style="padding:1rem">暂无游玩记录。开始你的第一轮冒险吧！</div>';
    return;
  }
  el.historyList.innerHTML = '';
  history.forEach((rec, i) => {
    const card = document.createElement('div');
    card.className = 'history-card';
    const dateStr = new Date(rec.timestamp).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const floorStr = floorToActFloorStr(rec.floor || rec.act * (ACT_FLOOR_COUNT + 1));

    // Relics — clickable spans with names (build as HTML, attach listeners after)
    const relicIds = (rec.relicIds || []).filter(id => RELICS[id]);
    const relicHtml = relicIds.map(id =>
      `<span class="history-relic-tag" data-relic-id="${id}">${RELICS[id].icon} ${RELICS[id].name}</span>`
    ).join(' ');

    // Deck — clickable tags with names and counts
    const deckSummary = (rec.deckIds || []).reduce((acc, id) => {
      const key = id.replace(/\+$/, '');
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const deckEntries = Object.entries(deckSummary).filter(([id]) => CARDS[id]);
    const deckTags = deckEntries.map(([id, count]) => {
      const def = CARDS[id];
      const upgraded = rec.deckIds.some(d => d === id + '+');
      return `<span class="history-card-tag" data-card-id="${id}">${def.icon} ${def.name}${upgraded ? '+' : ''}×${count}</span>`;
    }).join(' ');

    // Detail button — shows full run info in modal
    const detailBtn = document.createElement('button');
    detailBtn.className = 'btn btn-ghost history-detail-btn';
    detailBtn.textContent = '📋 详情';
    detailBtn.addEventListener('click', () => {
      const relicTags = (rec.relicIds || []).map(id => {
        const r = RELICS[id];
        return r ? `<span class="history-relic-tag" data-relic-id="${id}">${r.icon} ${r.name}</span>` : '';
      }).filter(s => s).join(' ');
      const deckTags = Object.entries(deckSummary).map(([id, count]) => {
        const def = CARDS[id];
        if (!def) return '';
        const upgraded = rec.deckIds.some(d => d === id + '+');
        return `<span class="history-card-tag" data-card-id="${id}">${def.icon} ${def.name}${upgraded ? '+' : ''}×${count}</span>`;
      }).filter(s => s).join(' ');
      showInfoModal(`
        <div class="modal-name">${rec.characterIcon} ${rec.characterName} — ${rec.victory ? '🏆 通关' : '💀 阵亡'}</div>
        <div class="modal-meta">${dateStr}</div>
        <div class="modal-desc">
          📊 得分：${rec.score}<br>
          🏔️ 到达：${floorStr}<br>
          ⚔️ 击败：${rec.enemiesDefeated}敌 / ${rec.elitesDefeated}精英 / ${rec.bossesDefeated || 0}Boss<br>
          💰 金币：${rec.goldEarned}<br>
          ❤️ 生命：${rec.finalHp}/${rec.maxHp}<br>
          ${!rec.victory && rec.deathCause ? `☠️ 死因：${rec.deathCause}<br>` : ''}
        </div>
        <div class="modal-meta">💎 遗物</div>
        <div class="modal-desc">${relicTags || '无'}</div>
        <div class="modal-meta">🎴 牌组</div>
        <div class="modal-desc">${deckTags || '空'}</div>
      `);
      el.infoModalContent.querySelectorAll('.history-relic-tag').forEach(tag => {
        tag.addEventListener('click', () => {
          const r = RELICS[tag.dataset.relicId];
          if (r) showInfoModal(`<div class="modal-name">${r.icon} ${r.name}</div><div class="modal-desc">${r.desc}</div>`);
        });
      });
      el.infoModalContent.querySelectorAll('.history-card-tag').forEach(tag => {
        tag.addEventListener('click', () => showCardInfoModal(tag.dataset.cardId));
      });
    });

    card.innerHTML = `
      <div class="history-header">
        <span class="history-char">${rec.characterIcon} ${rec.characterName}</span>
        <span class="history-result ${rec.victory ? 'victory' : 'defeat'}">${rec.victory ? '🏆 通关' : '💀 阵亡'}</span>
        <span class="hint">${dateStr}</span>
      </div>
      <div class="history-stats">
        <span>🏔️ ${floorStr}</span>
        <span>📊 得分 ${rec.score}</span>
        <span>⚔️ 击败${rec.enemiesDefeated}敌 / ${rec.elitesDefeated}精英 / ${rec.bossesDefeated || 0}Boss</span>
        <span>💰 ${rec.goldEarned}金</span>
        <span>❤️ ${rec.finalHp}/${rec.maxHp}</span>
      </div>
      ${!rec.victory && rec.deathCause ? `<div class="history-death">☠️ 死因：${rec.deathCause}</div>` : ''}
      <div class="history-relics">💎 遗物：${relicHtml || '无'}</div>
      <div class="history-deck">🎴 牌组：${deckTags || '空'}</div>
    `;
    card.appendChild(detailBtn);
    el.historyList.appendChild(card);
    // Attach click listeners to relic/card tags
    card.querySelectorAll('.history-relic-tag').forEach(tag => {
      tag.addEventListener('click', () => showInfoModal(relicInfoHtml(tag.dataset.relicId)));
    });
    card.querySelectorAll('.history-card-tag').forEach(tag => {
      tag.addEventListener('click', () => showCardInfoModal(tag.dataset.cardId));
    });
  });
}

// ---------------- Leaderboard ----------------
function showLeaderboardScreen() {
  showScreen('leaderboardScreen');
  if (el.cloudSyncStatus2) {
    el.cloudSyncStatus2.textContent = cloudUser
      ? `☁️ 已登录 — 显示全球玩家最近游玩记录`
      : `☁️ 未登录 — 仅显示本地记录。登录后可查看全球玩家记录`;
  }
  el.leaderboardList.innerHTML = '<div class="hint" style="padding:1rem">加载中…</div>';
  fetchLeaderboard();
}

async function fetchLeaderboard() {
  let entries = [];
  // Try cloud fetch
  if (cloudUser && typeof supabaseClient !== 'undefined') {
    try {
      const { data, error } = await supabaseClient
        .from('leaderboard')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (!error && data) entries = data;
    } catch (e) { /* fall back to local */ }
  }
  // Fallback: show local history as leaderboard
  if (entries.length === 0) {
    const local = (meta.runHistory || []).map(r => ({
      player_name: '你',
      character_name: r.characterName,
      character_icon: r.characterIcon,
      victory: r.victory,
      death_cause: r.deathCause,
      act: r.act,
      floor: r.floor,
      score: r.score,
      enemies_defeated: r.enemiesDefeated,
      elites_defeated: r.elitesDefeated,
      bosses_defeated: r.bossesDefeated || 0,
      relic_ids: r.relicIds,
      deck_ids: r.deckIds,
      created_at: new Date(r.timestamp).toISOString(),
    }));
    entries = local;
  }
  renderLeaderboard(entries);
}

function renderLeaderboard(entries) {
  if (!entries || entries.length === 0) {
    el.leaderboardList.innerHTML = '<div class="hint" style="padding:1rem">暂无玩家记录。</div>';
    return;
  }
  const table = document.createElement('div');
  table.className = 'leaderboard-table';
  entries.forEach((e, i) => {
    const row = document.createElement('div');
    row.className = 'leaderboard-row';
    const name = e.player_name || e.user_id || '匿名玩家';
    const date = e.created_at ? new Date(e.created_at).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '';
    const floorStr = e.floor ? floorToActFloorStr(e.floor) : `维度${e.act || 1}`;
    row.innerHTML = `
      <span class="lb-char">${e.character_icon || ''} ${e.character_name || '?'}</span>
      <span class="lb-player">${name}</span>
      <span class="lb-result ${e.victory ? 'victory' : 'defeat'}">${e.victory ? '🏆' : '💀'}</span>
      <span class="lb-score">${e.score || 0}</span>
      <span class="lb-act">${floorStr}</span>
      <span class="lb-kills">⚔️${e.enemies_defeated || 0} 💀${e.elites_defeated || 0} 👑${e.bosses_defeated || 0}</span>
      <span class="lb-date hint">${date}</span>
      ${!e.victory && e.death_cause ? `<span class="lb-death hint">☠️ ${e.death_cause}</span>` : ''}
    `;
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => {
      const relicIds = e.relic_ids || [];
      const relicList = relicIds.map(id => {
        const r = RELICS[id];
        return r ? `${r.icon} ${r.name} — ${r.desc}` : '';
      }).filter(s => s).join('<br>');
      const deckIds = e.deck_ids || [];
      const deckSummary = deckIds.reduce((acc, id) => {
        const key = id.replace(/\+$/, '');
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const deckTags = Object.entries(deckSummary).map(([id, count]) => {
        const def = CARDS[id];
        if (!def) return '';
        const upgraded = deckIds.some(d => d === id + '+');
        return `<span class="history-card-tag" data-card-id="${id}">${def.icon} ${def.name}${upgraded ? '+' : ''}×${count}</span>`;
      }).filter(s => s).join(' ');
      const relicTags = relicIds.map(id => {
        const r = RELICS[id];
        return r ? `<span class="history-relic-tag" data-relic-id="${id}">${r.icon} ${r.name}</span>` : '';
      }).filter(s => s).join(' ');
      showInfoModal(`
        <div class="modal-name">${e.character_icon || ''} ${e.character_name || '?'} — ${name}</div>
        <div class="modal-meta">${date} · ${e.victory ? '🏆 通关' : '💀 阵亡'}</div>
        <div class="modal-desc">
          📊 得分：${e.score || 0}<br>
          🏔️ 到达：${floorStr}<br>
          ⚔️ 击败：${e.enemies_defeated || 0}敌 / ${e.elites_defeated || 0}精英 / ${e.bosses_defeated || 0}Boss<br>
          ${!e.victory && e.death_cause ? `☠️ 死因：${e.death_cause}<br>` : ''}
        </div>
        ${relicTags ? `<div class="modal-meta">💎 遗物</div><div class="modal-desc">${relicTags}</div>` : ''}
        ${deckTags ? `<div class="modal-meta">🎴 牌组</div><div class="modal-desc">${deckTags}</div>` : ''}
      `);
      // Attach click listeners to tags in the modal
      el.infoModalContent.querySelectorAll('.history-relic-tag').forEach(tag => {
        tag.addEventListener('click', () => {
          const r = RELICS[tag.dataset.relicId];
          if (r) showInfoModal(`<div class="modal-name">${r.icon} ${r.name}</div><div class="modal-desc">${r.desc}</div>`);
        });
      });
      el.infoModalContent.querySelectorAll('.history-card-tag').forEach(tag => {
        tag.addEventListener('click', () => showCardInfoModal(tag.dataset.cardId));
      });
    });
    table.appendChild(row);
  });
  el.leaderboardList.innerHTML = '';
  el.leaderboardList.appendChild(table);
}

// ---------------- Zoom control (mobile) ----------------
let combatZoom = 1.0;
function applyCombatZoom() {
  el.combatScreen.style.transform = `scale(${combatZoom})`;
  el.zoomLevel.textContent = Math.round(combatZoom * 100) + '%';
}
function setCombatZoom(z) {
  combatZoom = Math.max(0.6, Math.min(1.6, z));
  applyCombatZoom();
}

// ---------------- init ----------------
document.addEventListener('DOMContentLoaded', () => {
  cacheEls();
  meta = loadMeta();
  el.startRunBtn.addEventListener('click', () => {
    if (loadRunState() && !confirm('你有一局未完成的冒险，开始新的一局将会覆盖它，是否继续？')) return;
    clearRunState();
    renderCharacterSelect();
  });
  el.resumeRunBtn.addEventListener('click', resumeRun);
  el.abandonRunBtn.addEventListener('click', abandonRun);
  el.characterBackBtn.addEventListener('click', () => showScreen('menuScreen'));
  el.openProfileBtn.addEventListener('click', () => showProfileScreen());
  el.profileBackBtn.addEventListener('click', () => showScreen('menuScreen'));
  el.openHistoryBtn.addEventListener('click', () => showHistoryScreen());
  el.historyBackBtn.addEventListener('click', () => showScreen('menuScreen'));
  el.openLeaderboardBtn.addEventListener('click', () => showLeaderboardScreen());
  el.leaderboardBackBtn.addEventListener('click', () => showScreen('menuScreen'));
  el.endTurnBtn.addEventListener('click', () => {
    combat.endTurn();
    afterCombatAction();
  });
  el.infoModalClose.addEventListener('click', hideInfoModal);
  el.infoModal.addEventListener('click', (e) => { if (e.target === el.infoModal) hideInfoModal(); });
  el.infoModal.addEventListener('touchstart', (e) => { if (e.target === el.infoModal) { e.preventDefault(); hideInfoModal(); } }, { passive: false });
  el.zoomInBtn.addEventListener('click', () => setCombatZoom(combatZoom + 0.1));
  el.zoomOutBtn.addEventListener('click', () => setCombatZoom(combatZoom - 0.1));
  el.zoomResetBtn.addEventListener('click', () => setCombatZoom(1.0));
  // Pinch-to-zoom on combat screen
  let pinchDist = 0;
  el.combatScreen.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchDist = Math.sqrt(dx * dx + dy * dy);
    }
  }, { passive: true });
  el.combatScreen.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinchDist > 0) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = dist / pinchDist;
      setCombatZoom(combatZoom * ratio);
      pinchDist = dist;
    }
  }, { passive: true });
  el.cloudLoginBtn.addEventListener('click', signInWithGitHub);
  el.cloudLogoutBtn.addEventListener('click', signOutCloud);
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (!run || el.mapScreen.classList.contains('hidden')) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderMap, 150);
  });
  initCloudSync();
  showScreen('menuScreen');
});
