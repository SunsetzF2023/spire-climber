// ============================================================
// Game state machine — screens, run state, map navigation, shop/rest/event UI,
// and combat rendering (delegates logic to CombatEngine).
// ============================================================

const STARTING_HP = 70;
const STARTING_GOLD = 99;
const ACT_FLOOR_COUNT = 26; // travel floors per act, before the guaranteed pre-boss rest + boss floor

let run = null;
let combat = null;
let selectedCardUid = null;
let currentShop = null;
let meta = null;

const el = {};
function cacheEls() {
  [
    'menuScreen', 'startRunBtn', 'openProfileBtn',
    'mapScreen', 'mapContainer', 'mapActName', 'deckList', 'deckCount',
    'eventScreen', 'eventIcon', 'eventName', 'eventDesc', 'eventOptions', 'eventCardSelect', 'eventResult', 'eventContinueBtn',
    'restScreen', 'restHealBtn', 'restUpgradeBtn', 'restUpgradeList',
    'restUpgradePreview', 'restPreviewBefore', 'restPreviewAfter', 'restConfirmUpgradeBtn', 'restCancelUpgradeBtn',
    'shopScreen', 'shopCards', 'shopRelics', 'shopRemoveBtn', 'removeCost', 'shopLeaveBtn',
    'rewardScreen', 'rewardTitle', 'rewardGold', 'rewardCards', 'rewardSkipBtn',
    'combatScreen', 'enemyRow', 'drawCount', 'discardCount', 'playerHpFill', 'playerHpText', 'playerBlockBadge', 'playerStatusRow',
    'energyBadge', 'handRow', 'endTurnBtn', 'combatLog',
    'endScreen', 'endTitle', 'endDesc', 'endStatsGrid', 'endNewAchievements', 'endAchievementList', 'endRestartBtn', 'endProfileBtn',
    'profileScreen', 'profileStatsGrid', 'profileAchievements', 'profileCards', 'profileRelics', 'profileEnemies',
    'profileCardProgress', 'profileRelicProgress', 'profileEnemyProgress', 'profileBackBtn',
    'hudHp', 'hudGold', 'hudFloor', 'hudRelics', 'tooltip',
    'infoModal', 'infoModalContent', 'infoModalClose',
  ].forEach(id => { el[id] = document.getElementById(id); });
}

// ---------------- Tooltip (hover) + info modal (click) ----------------
function positionTooltip(e) {
  el.tooltip.style.left = (e.clientX + 14) + 'px';
  el.tooltip.style.top = (e.clientY + 14) + 'px';
}
function attachTooltip(elm, html) {
  elm.addEventListener('mouseenter', (e) => { el.tooltip.innerHTML = html; el.tooltip.style.display = 'block'; positionTooltip(e); });
  elm.addEventListener('mousemove', positionTooltip);
  elm.addEventListener('mouseleave', () => { el.tooltip.style.display = 'none'; });
}
function showInfoModal(html) {
  el.infoModalContent.innerHTML = html;
  el.infoModal.classList.remove('hidden');
}
function hideInfoModal() { el.infoModal.classList.add('hidden'); }

function relicInfoHtml(relicId) {
  const r = RELICS[relicId];
  return `<div class="modal-icon">${r.icon}</div><div class="modal-name">${r.name}</div><div class="modal-meta">遗物 · ${r.rarity}</div><div class="modal-desc">${r.desc}</div>`;
}
function cardInfoHtml(defId) {
  const def = CARDS[defId];
  const typeLabel = { attack: '攻击', skill: '技能', power: '能力' }[def.type];
  return `<div class="modal-icon">${def.icon}</div><div class="modal-name">${def.name}</div><div class="modal-meta">${typeLabel} · 费用 ${def.cost} · ${def.rarity}</div><div class="modal-desc">${def.descTemplate(def.vars(false))}</div>`;
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
function addCardToDeck(run, defId, upgraded) {
  run.deck.push(makeCardInstance(defId, upgraded));
  discover('discoveredCards', defId);
}

// ---------------- Screen switching ----------------
function showScreen(name) {
  ['menuScreen', 'mapScreen', 'eventScreen', 'restScreen', 'shopScreen', 'rewardScreen', 'combatScreen', 'endScreen', 'profileScreen']
    .forEach(s => el[s].classList.toggle('hidden', s !== name));
}

// ---------------- Run lifecycle ----------------
function newRun() {
  run = {
    player: { hp: STARTING_HP, maxHp: STARTING_HP },
    gold: STARTING_GOLD,
    relics: [],
    deck: STARTER_DECK.map(id => makeCardInstance(id, false)),
    map: generateMap(ACT_FLOOR_COUNT),
    currentNodeId: null,
    removeCount: 0,
    act: 1,
    stats: { goldEarned: 0, enemiesDefeated: 0, elitesDefeated: 0, cardsPlayed: 0, floorReached: 0, actsCleared: 0, actOffset: 0, treasureFound: false },
  };
  STARTER_DECK.forEach(id => discover('discoveredCards', id));
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
    span.textContent = RELICS[id].icon;
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
  if (el.mapActName) el.mapActName.textContent = `第 ${run.act} 维度 · ${ACT_DEFS[run.act - 1].name}`;
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
  run.stats.floorReached = Math.max(run.stats.floorReached, run.stats.actOffset + node.floor + 1);
  renderHud();
  switch (node.type) {
    case 'monster': startCombat(spawnEnemyGroup('normal', run.act), 'normal', node); break;
    case 'elite': startCombat(spawnEnemyGroup('elite', run.act), 'elite', node); break;
    case 'boss': startCombat(spawnEnemyGroup('boss', run.act), 'boss', node); break;
    case 'rest': showRestScreen(node); break;
    case 'shop': showShopScreen(node); break;
    case 'event': showEventScreenUI(node); break;
    case 'treasure': showTreasureNode(node); break;
  }
}

function backToMapOrVictory(node) {
  if (checkRunDeath()) return;
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
  healPlayerRun(run, run.player.maxHp);
  run.map = generateMap(ACT_FLOOR_COUNT);
  run.currentNodeId = null;

  showScreen('eventScreen');
  el.eventIcon.textContent = '🌌';
  el.eventName.textContent = `进入第 ${run.act} 维度`;
  el.eventDesc.textContent = `你击败了${clearedBossName}！${ACT_DEFS[run.act - 1].name} —— 你感觉到更强大的威胁正在逼近……（生命已完全恢复）`;
  el.eventOptions.innerHTML = '';
  el.eventCardSelect.className = 'card-grid hidden';
  el.eventCardSelect.innerHTML = '';
  el.eventResult.className = 'event-result hidden';
  el.eventContinueBtn.classList.remove('hidden');
  el.eventContinueBtn.onclick = () => { showScreen('mapScreen'); renderMap(); renderDeck(); renderHud(); };
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
    const isLocked = opt.disabled && opt.disabled(run);
    btn.textContent = opt.label + (isLocked ? '（条件不足）' : '');
    btn.disabled = !!isLocked;
    if (isLocked) { el.eventOptions.appendChild(btn); return; }
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
  run.stats.goldEarned += gold;
  run.stats.treasureFound = true;
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
  el.restUpgradePreview.classList.add('hidden');
  el.restHealBtn.disabled = false;
  el.restUpgradeBtn.disabled = false;
  el.restHealBtn.onclick = () => {
    const amount = Math.round(run.player.maxHp * 0.3);
    healPlayerRun(run, amount);
    renderHud();
    backToMapOrVictory(node);
  };

  const renderUpgradeList = () => {
    const upgradable = run.deck.filter(c => !c.upgraded);
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
    attachTooltip(box, `<b>${relic.name}</b><br>${relic.desc}<br>💰 ${offer.cost}`);
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
  const hpScaling = ACT_DEFS[run.act - 1].scaling;
  combat = new CombatEngine(run, enemyDefIds, hpScaling);
  combat.rewardTier = tier;
  combat.node = node;
  combat.enemies.forEach(e => discover('discoveredEnemies', e.defId));
  combat.start();
  selectedCardUid = null;
  showScreen('combatScreen');
  renderCombat();
}

function buildStatusBadge(name, amount, showLabel) {
  const meta = STATUS_META[name];
  const span = document.createElement('span');
  span.className = 'status-badge';
  span.textContent = `${meta.icon}${showLabel ? ' ' + meta.label + ' ' : ''}${amount}`;
  attachTooltip(span, `<b>${meta.icon} ${meta.label} ${amount} 层</b><br>${meta.desc}`);
  return span;
}

function renderCombat() {
  el.enemyRow.innerHTML = '';
  combat.enemies.forEach(enemy => {
    const box = document.createElement('div');
    box.className = 'enemy-box' + (enemy.hp > 0 && selectedCardUid ? ' targetable' : '');
    if (enemy.hp <= 0) box.style.opacity = 0.25;
    const move = enemy.nextMove;
    const intentText = move ? `${move.icon} ${move.type === 'attack' ? move.displayValue + (move.hitsCount ? ` x${move.hitsCount}` : '') : (move.type === 'defend' ? move.displayValue : (move.type === 'heal' ? move.displayValue : (move.type === 'idle' ? move.name : '')))}` : '';
    box.innerHTML = `
      <div class="enemy-icon">${enemy.icon}</div>
      <div class="enemy-name">${enemy.name}</div>
      <div class="hp-bar"><div class="hp-fill" style="width:${Math.max(0, enemy.hp / enemy.maxHp * 100)}%"></div><div class="hp-text">${Math.max(0, enemy.hp)}/${enemy.maxHp}</div></div>
      <div class="block-badge">${enemy.block > 0 ? '🛡️ ' + enemy.block : ''}</div>
      <div class="intent"></div>
      <div class="status-row"></div>
    `;
    const intentDiv = box.querySelector('.intent');
    if (enemy.hp > 0) {
      intentDiv.textContent = intentText;
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
    }
    const statusRow = box.querySelector('.status-row');
    ['strength', 'weak', 'vulnerable', 'poison'].forEach(name => {
      if (enemy.statuses[name]) statusRow.appendChild(buildStatusBadge(name, enemy.statuses[name], false));
    });
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
  el.playerStatusRow.innerHTML = '';
  ['strength', 'dexterity', 'weak', 'vulnerable', 'frail', 'poison', 'metallicize'].forEach(name => {
    if (p.statuses[name]) el.playerStatusRow.appendChild(buildStatusBadge(name, p.statuses[name], true));
  });

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
      else finishRun(false, '你在战斗中被击败了……');
    }, 400);
  }
}

// ---------------- Reward screen ----------------
function showRewardScreen() {
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
function statBoxHtml(label, value) {
  return `<div class="stat-box"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
}

function finishRun(victory, desc) {
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
    deckSize: run.deck.length,
    finalHp: run.player.hp,
    treasureFound: run.stats.treasureFound,
  };
  const { score, newlyUnlocked } = applyRunToMeta(meta, stats);

  el.endTitle.textContent = victory ? '🏆 通关成功！' : '💀 游戏结束';
  el.endDesc.textContent = desc || '';
  el.endStatsGrid.innerHTML = [
    statBoxHtml('到达维度', `${stats.act}`),
    statBoxHtml('到达楼层', `${stats.floorReached}`),
    statBoxHtml('本局得分', score),
    statBoxHtml('获得金币', stats.goldEarned),
    statBoxHtml('击败敌人', stats.enemiesDefeated),
    statBoxHtml('击败精英', stats.elitesDefeated),
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

// ---------------- Profile / Personal Center ----------------
function showProfileScreen() {
  showScreen('profileScreen');
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

  const buildCollectionGrid = (container, ids, discoveredList, infoFn, label) => {
    container.innerHTML = '';
    ids.forEach(id => {
      const discovered = discoveredList.includes(id);
      const div = document.createElement('div');
      div.className = `collection-item ${discovered ? '' : 'undiscovered'}`;
      div.textContent = discovered ? infoFn.icon(id) : '❔';
      div.addEventListener('click', () => showInfoModal(discovered ? infoFn.html(id) : unknownInfoHtml(label)));
      container.appendChild(div);
    });
  };

  const cardIds = Object.keys(CARDS);
  el.profileCardProgress.textContent = `(${meta.discoveredCards.length} / ${cardIds.length})`;
  buildCollectionGrid(el.profileCards, cardIds, meta.discoveredCards, { icon: (id) => CARDS[id].icon, html: cardInfoHtml }, '卡牌');

  const relicIds = Object.keys(RELICS);
  el.profileRelicProgress.textContent = `(${meta.discoveredRelics.length} / ${relicIds.length})`;
  buildCollectionGrid(el.profileRelics, relicIds, meta.discoveredRelics, { icon: (id) => RELICS[id].icon, html: relicInfoHtml }, '遗物');

  const enemyIds = Object.keys(ENEMIES);
  el.profileEnemyProgress.textContent = `(${meta.discoveredEnemies.length} / ${enemyIds.length})`;
  buildCollectionGrid(el.profileEnemies, enemyIds, meta.discoveredEnemies, { icon: (id) => ENEMIES[id].icon, html: enemyInfoHtml }, '敌人');
}

// ---------------- init ----------------
document.addEventListener('DOMContentLoaded', () => {
  cacheEls();
  meta = loadMeta();
  el.startRunBtn.addEventListener('click', newRun);
  el.openProfileBtn.addEventListener('click', () => showProfileScreen());
  el.profileBackBtn.addEventListener('click', () => showScreen('menuScreen'));
  el.endTurnBtn.addEventListener('click', () => {
    combat.endTurn();
    afterCombatAction();
  });
  el.infoModalClose.addEventListener('click', hideInfoModal);
  el.infoModal.addEventListener('click', (e) => { if (e.target === el.infoModal) hideInfoModal(); });
  showScreen('menuScreen');
});
