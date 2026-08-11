// ============================================================
// Game state machine — screens, run state, map navigation, shop/rest/event UI,
// and combat rendering (delegates logic to CombatEngine).
// ============================================================

const STARTING_HP = 70;
const STARTING_GOLD = 99;

let run = null;
let combat = null;
let selectedCardUid = null;
let currentShop = null;

const el = {};
function cacheEls() {
  [
    'menuScreen', 'startRunBtn',
    'mapScreen', 'mapContainer', 'deckList', 'deckCount',
    'eventScreen', 'eventIcon', 'eventName', 'eventDesc', 'eventOptions', 'eventResult', 'eventContinueBtn',
    'restScreen', 'restHealBtn', 'restUpgradeBtn', 'restUpgradeList',
    'shopScreen', 'shopCards', 'shopRelics', 'shopRemoveBtn', 'removeCost', 'shopLeaveBtn',
    'rewardScreen', 'rewardTitle', 'rewardGold', 'rewardCards', 'rewardSkipBtn',
    'combatScreen', 'enemyRow', 'drawCount', 'discardCount', 'playerHpFill', 'playerHpText', 'playerBlockBadge', 'playerStatusRow',
    'energyBadge', 'handRow', 'endTurnBtn', 'combatLog',
    'endScreen', 'endTitle', 'endDesc', 'endRestartBtn',
    'hudHp', 'hudGold', 'hudFloor', 'hudRelics', 'tooltip',
  ].forEach(id => { el[id] = document.getElementById(id); });
}

// ---------------- Run helpers (used by events.js too) ----------------
function addRelicToRun(run, relicId) {
  const relic = RELICS[relicId];
  if (relic.onPickup) relic.onPickup(run);
  run.relics.push(relicId);
  return relicId;
}
function healPlayerRun(run, amount) { run.player.hp = Math.min(run.player.maxHp, run.player.hp + amount); }
function damagePlayerRun(run, amount) { run.player.hp = Math.max(0, run.player.hp - amount); }
function removeRandomCardFromDeck(run) {
  if (run.deck.length === 0) return null;
  const idx = Math.floor(Math.random() * run.deck.length);
  return run.deck.splice(idx, 1)[0];
}
function upgradeRandomCardInDeck(run) {
  const candidates = run.deck.filter(c => !c.upgraded);
  if (candidates.length === 0) return null;
  const card = candidates[Math.floor(Math.random() * candidates.length)];
  card.upgraded = true;
  return card;
}
function addCardToDeck(run, defId, upgraded) { run.deck.push(makeCardInstance(defId, upgraded)); }

// ---------------- Screen switching ----------------
function showScreen(name) {
  ['menuScreen', 'mapScreen', 'eventScreen', 'restScreen', 'shopScreen', 'rewardScreen', 'combatScreen', 'endScreen']
    .forEach(s => el[s].classList.toggle('hidden', s !== name));
}

// ---------------- Run lifecycle ----------------
function newRun() {
  run = {
    player: { hp: STARTING_HP, maxHp: STARTING_HP },
    gold: STARTING_GOLD,
    relics: [],
    deck: STARTER_DECK.map(id => makeCardInstance(id, false)),
    map: generateMap(),
    currentNodeId: null,
    removeCount: 0,
  };
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
  el.hudFloor.textContent = node ? `${node.floor + 1} / ${run.map.floorCount + 1}` : `0 / ${run.map.floorCount + 1}`;
  el.hudRelics.innerHTML = run.relics.map(id => `<span title="${RELICS[id].name}: ${RELICS[id].desc}">${RELICS[id].icon}</span>`).join('');
}

function checkRunDeath() {
  if (run.player.hp <= 0) {
    showEndScreen(false, '你在旅途中倒下了……');
    return true;
  }
  return false;
}

// ---------------- Map ----------------
function renderMap() {
  const reachable = new Set(getReachableNodeIds(run.map, run.currentNodeId));
  el.mapContainer.innerHTML = '';
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
      if (classes.includes('reachable')) {
        btn.addEventListener('click', () => enterNode(node));
      }
      row.appendChild(btn);
    });
    el.mapContainer.appendChild(row);
  });
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
  renderHud();
  switch (node.type) {
    case 'monster': startCombat(spawnEnemyGroup('normal'), 'normal', node); break;
    case 'elite': startCombat(spawnEnemyGroup('elite'), 'elite', node); break;
    case 'boss': startCombat(spawnEnemyGroup('boss'), 'boss', node); break;
    case 'rest': showRestScreen(node); break;
    case 'shop': showShopScreen(node); break;
    case 'event': showEventScreenUI(node); break;
    case 'treasure': showTreasureNode(node); break;
  }
}

function backToMapOrVictory(node) {
  if (checkRunDeath()) return;
  if (node.type === 'boss') {
    showEndScreen(true, '你击败了深渊领主，成功登顶！');
    return;
  }
  showScreen('mapScreen');
  renderMap();
  renderDeck();
  renderHud();
}

// ---------------- Generic card element renderer ----------------
function renderCardEl(cardInstance, opts = {}) {
  const def = CARDS[cardInstance.defId];
  const div = document.createElement('div');
  div.className = `game-card type-${def.type}` + (cardInstance.upgraded ? ' upgraded' : '');
  if (opts.selected) div.classList.add('selected');
  if (opts.unplayable) div.classList.add('unplayable');
  const liveCombat = opts.liveCombat || null;
  const cost = (liveCombat && liveCombat.firstAttackFree && def.type === 'attack') ? 0 : def.cost;
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

// ---------------- Event screen ----------------
function showEventScreenUI(node) {
  const evt = pickRandomEvent();
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
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
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
        run.deck.forEach(card => {
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
  const relicId = pickRandomRelic(run.relics);
  addRelicToRun(run, relicId);
  showScreen('eventScreen');
  el.eventIcon.textContent = '💎';
  el.eventName.textContent = '宝藏';
  el.eventDesc.textContent = `你发现了一个宝箱！获得 ${gold} 金币，以及遗物：${RELICS[relicId].icon} ${RELICS[relicId].name}`;
  el.eventOptions.innerHTML = '';
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
  el.restHealBtn.disabled = false;
  el.restUpgradeBtn.disabled = false;
  el.restHealBtn.onclick = () => {
    const amount = Math.round(run.player.maxHp * 0.3);
    healPlayerRun(run, amount);
    renderHud();
    backToMapOrVictory(node);
  };
  el.restUpgradeBtn.onclick = () => {
    const upgradable = run.deck.filter(c => !c.upgraded);
    if (upgradable.length === 0) { alert('卡组中所有卡牌都已经强化过了！'); return; }
    el.restUpgradeList.classList.remove('hidden');
    el.restUpgradeList.innerHTML = '';
    upgradable.forEach(card => {
      el.restUpgradeList.appendChild(renderCardEl(card, {
        clickable: true,
        onClick: () => { card.upgraded = true; backToMapOrVictory(node); },
      }));
    });
  };
}

// ---------------- Shop screen ----------------
function showShopScreen(node) {
  showScreen('shopScreen');
  currentShop = {
    cards: [0, 1, 2].map(() => ({ id: pickRandomCardId(), cost: 0 })),
    relics: [0, 1].map(() => ({ id: pickRandomRelic(run.relics), cost: 0 })),
  };
  currentShop.cards.forEach(offer => {
    const rarity = CARDS[offer.id].rarity;
    offer.cost = rarity === 'rare' ? 120 + Math.floor(Math.random() * 30) : rarity === 'uncommon' ? 65 + Math.floor(Math.random() * 20) : 40 + Math.floor(Math.random() * 15);
  });
  currentShop.relics.forEach(offer => {
    const rarity = RELICS[offer.id].rarity;
    offer.cost = rarity === 'rare' ? 180 + Math.floor(Math.random() * 40) : rarity === 'uncommon' ? 120 + Math.floor(Math.random() * 30) : 80 + Math.floor(Math.random() * 20);
  });
  renderShop(node);
  el.shopLeaveBtn.onclick = () => backToMapOrVictory(node);
}

function renderShop(node) {
  el.removeCost.textContent = 15 + run.removeCount * 15;
  el.shopRemoveBtn.disabled = run.gold < (15 + run.removeCount * 15) || run.deck.length <= 5;
  el.shopRemoveBtn.onclick = () => {
    const cost = 15 + run.removeCount * 15;
    if (run.gold < cost || run.deck.length <= 5) return;
    const cardEls = run.deck.map(card => renderCardEl(card, {
      clickable: true,
      onClick: (c) => {
        run.gold -= cost;
        run.removeCount += 1;
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
        renderHud();
        renderShop(node);
      });
    }
    el.shopCards.appendChild(wrap);
  });

  el.shopRelics.innerHTML = '';
  currentShop.relics.forEach((offer, i) => {
    if (!offer) return;
    const relic = RELICS[offer.id];
    const box = document.createElement('div');
    box.className = 'relic-card';
    box.textContent = relic.icon;
    box.title = `${relic.name}\n${relic.desc}\n💰 ${offer.cost}`;
    if (run.gold >= offer.cost) {
      box.addEventListener('click', () => {
        run.gold -= offer.cost;
        addRelicToRun(run, offer.id);
        currentShop.relics[i] = null;
        renderHud();
        renderShop(node);
      });
    } else {
      box.style.opacity = 0.4;
    }
    el.shopRelics.appendChild(box);
  });
}

// ---------------- Combat ----------------
function startCombat(enemyDefIds, tier, node) {
  combat = new CombatEngine(run, enemyDefIds);
  combat.rewardTier = tier;
  combat.node = node;
  combat.start();
  selectedCardUid = null;
  showScreen('combatScreen');
  renderCombat();
}

function renderCombat() {
  el.enemyRow.innerHTML = '';
  combat.enemies.forEach(enemy => {
    const box = document.createElement('div');
    box.className = 'enemy-box' + (enemy.hp > 0 && selectedCardUid ? ' targetable' : '');
    if (enemy.hp <= 0) box.style.opacity = 0.25;
    const move = enemy.nextMove;
    const intentText = move ? `${move.icon} ${move.type === 'attack' ? move.displayValue + (move.hitsCount ? ` x${move.hitsCount}` : '') : (move.type === 'defend' ? move.displayValue : (move.type === 'heal' ? move.displayValue : ''))}` : '';
    let statusBadges = '';
    if (enemy.statuses.strength) statusBadges += `<span class="status-badge">💪${enemy.statuses.strength}</span>`;
    if (enemy.statuses.weak) statusBadges += `<span class="status-badge">😵${enemy.statuses.weak}</span>`;
    if (enemy.statuses.vulnerable) statusBadges += `<span class="status-badge">🎯${enemy.statuses.vulnerable}</span>`;
    if (enemy.statuses.poison) statusBadges += `<span class="status-badge">☠️${enemy.statuses.poison}</span>`;
    box.innerHTML = `
      <div class="enemy-icon">${enemy.icon}</div>
      <div class="enemy-name">${enemy.name}</div>
      <div class="hp-bar"><div class="hp-fill" style="width:${Math.max(0, enemy.hp / enemy.maxHp * 100)}%"></div><div class="hp-text">${Math.max(0, enemy.hp)}/${enemy.maxHp}</div></div>
      <div class="block-badge">${enemy.block > 0 ? '🛡️ ' + enemy.block : ''}</div>
      <div class="intent">${enemy.hp > 0 ? intentText : '💀'}</div>
      <div class="status-row">${statusBadges}</div>
    `;
    if (enemy.hp > 0 && selectedCardUid) {
      box.addEventListener('click', () => {
        const res = combat.playCard(selectedCardUid, enemy.id);
        selectedCardUid = null;
        if (res.success) afterCombatAction(); else renderCombat();
      });
    }
    el.enemyRow.appendChild(box);
  });

  const p = combat.player;
  el.playerHpFill.style.width = Math.max(0, run.player.hp / run.player.maxHp * 100) + '%';
  el.playerHpText.textContent = `${Math.max(0, Math.round(run.player.hp))}/${run.player.maxHp}`;
  el.playerBlockBadge.textContent = p.block > 0 ? `🛡️ ${p.block}` : '';
  let pStatus = '';
  if (p.statuses.strength) pStatus += `<span class="status-badge">💪 力量 ${p.statuses.strength}</span>`;
  if (p.statuses.dexterity) pStatus += `<span class="status-badge">🤸 敏捷 ${p.statuses.dexterity}</span>`;
  if (p.statuses.weak) pStatus += `<span class="status-badge">😵 虚弱 ${p.statuses.weak}</span>`;
  if (p.statuses.vulnerable) pStatus += `<span class="status-badge">🎯 易伤 ${p.statuses.vulnerable}</span>`;
  if (p.statuses.frail) pStatus += `<span class="status-badge">🍂 脆弱 ${p.statuses.frail}</span>`;
  if (p.statuses.poison) pStatus += `<span class="status-badge">☠️ 中毒 ${p.statuses.poison}</span>`;
  if (p.statuses.metallicize) pStatus += `<span class="status-badge">🔩 金属化 ${p.statuses.metallicize}</span>`;
  el.playerStatusRow.innerHTML = pStatus;

  el.energyBadge.textContent = `${combat.energy}/${combat.energyMax}`;
  el.drawCount.textContent = combat.drawPile.length;
  el.discardCount.textContent = combat.discardPile.length;

  el.handRow.innerHTML = '';
  combat.hand.forEach(card => {
    const def = CARDS[card.defId];
    const affordable = combat.canAfford(card);
    const cardEl = renderCardEl(card, {
      clickable: true,
      selected: selectedCardUid === card.uid,
      unplayable: !affordable,
      liveCombat: combat,
      onClick: (c) => {
        if (!combat.canAfford(c)) return;
        if (def.target === 'enemy') {
          selectedCardUid = selectedCardUid === c.uid ? null : c.uid;
          renderCombat();
        } else {
          const res = combat.playCard(c.uid, null);
          if (res.success) afterCombatAction();
        }
      },
    });
    el.handRow.appendChild(cardEl);
  });

  el.combatLog.innerHTML = combat.log_.slice(-40).reverse().map(e => `<div class="log-entry ${e.cls}">${e.text}</div>`).join('');
  el.endTurnBtn.disabled = combat.finished;
}

function afterCombatAction() {
  renderHud();
  renderCombat();
  if (combat.finished && !combat.resultHandled) {
    combat.resultHandled = true;
    setTimeout(() => {
      if (combat.winner === 'player') showRewardScreen();
      else showEndScreen(false, '你在战斗中被击败了……');
    }, 400);
  }
}

// ---------------- Reward screen ----------------
function showRewardScreen() {
  showScreen('rewardScreen');
  const tier = combat.rewardTier;
  const goldReward = tier === 'boss' ? 60 + Math.floor(Math.random() * 20)
    : tier === 'elite' ? 25 + Math.floor(Math.random() * 15)
    : 10 + Math.floor(Math.random() * 10);
  run.gold += goldReward;
  let goldText = `获得 ${goldReward} 金币`;
  if (tier === 'elite') {
    const relicId = pickRandomRelic(run.relics);
    addRelicToRun(run, relicId);
    goldText += `，以及遗物：${RELICS[relicId].icon} ${RELICS[relicId].name}`;
  }
  el.rewardTitle.textContent = tier === 'boss' ? '👑 击败了Boss！' : tier === 'elite' ? '💀 精英战斗胜利！' : '⚔️ 战斗胜利！';
  el.rewardGold.textContent = goldText;
  renderHud();

  const offered = [];
  while (offered.length < 3) {
    const id = pickRandomCardId(offered);
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
  el.rewardSkipBtn.onclick = () => backToMapOrVictory(combat.node);
}

// ---------------- End screen ----------------
function showEndScreen(victory, desc) {
  showScreen('endScreen');
  el.endTitle.textContent = victory ? '🏆 通关成功！' : '💀 游戏结束';
  el.endDesc.textContent = desc || '';
  el.endRestartBtn.onclick = () => { showScreen('menuScreen'); };
}

// ---------------- init ----------------
document.addEventListener('DOMContentLoaded', () => {
  cacheEls();
  el.startRunBtn.addEventListener('click', newRun);
  el.endTurnBtn.addEventListener('click', () => {
    combat.endTurn();
    afterCombatAction();
  });
  el.endRestartBtn.addEventListener('click', () => showScreen('menuScreen'));
  showScreen('menuScreen');
});
