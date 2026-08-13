# 开发日志 — 2026-08-12 ~ 2026-08-13

## 概述

本次 session 主要解决了战斗渲染闪烁问题、移除了美术资源自动加载方案、修复了 `patchCardEl` 运行时错误、平衡了女猎手起始卡组、以及新增了大量卡牌内容。

---

## Commit 记录

### 1. `e8aa580` — fix: combat enemy/hand zone DOM diff patch, eliminate image flicker

**改动文件：** `js/game.js`

**内容：**
- 对 `renderCombat` 的敌人区实现最小 DOM diff patch：用 `enemy.id` 作为 key，复用已有 `.enemy-box[data-eid]` 节点，只 patch 内容（血量、状态、意图），新增/删除才操作 DOM。
- 对手牌区实现同样的 diff patch：用 `card.uid` 作为 key，复用已有 `.game-card[data-uid]` 节点。
- 新增 `patchEnemyBox(node, enemy)` 和 `createEnemyBox(enemy)` 函数。
- 新增 `patchCardEl(node, card, combat)` 函数。

**目的：** 解决战斗中每次 `renderCombat` 都 `innerHTML = ''` 重建所有节点导致的图片闪烁/重复加载问题。

---

### 2. `6dff1c8` — revert: remove art asset system, all icons use emoji only

**改动文件：** `js/game.js`

**内容：**
- 彻底移除 `artIcon` 美术资源自动加载逻辑，所有 `artIcon('cards', id, emoji)` 调用恢复为直接使用 emoji。
- 不再请求任何 PNG 文件，消除 404 错误和图片加载闪烁。

**目的：** 美术资源 PNG 文件不存在导致大量 404 和 `onerror` 回退闪烁，用户要求一劳永逸移除。

---

### 3. `b28cc2a` — fix: patchCardEl no longer references opts, prevents click errors in combat

**改动文件：** `js/game.js`

**内容：**
- `patchCardEl(node, card, combat)` 函数中移除所有 `opts` 引用（`opts.selected`、`opts.unplayable`、`opts.clickable`、`opts.onClick`）。
- 只 patch 卡牌内容（cost、icon、name、desc 等），不再处理选中/可用状态和点击事件。

**目的：** `patchCardEl` 被调用时没有传入 `opts` 参数，导致 `ReferenceError: opts is not defined`，战斗中点击手牌直接报错无法打出。

---

### 4. `0e977ed` — balance: huntress starter deck rebalance

**改动文件：** `js/cards.js`

**内容：**
- **飞刀**（dagger_throw）：移除中毒效果，改为纯 6/9 点伤害攻击牌（对应战士的打击）。
- **脚步**（footwork）：移除敏捷效果，改为纯 5/8 点格挡技能（对应战士的防御）。
- **毒刃突击**（venom_strike）：保留原设计（9/12 伤害 + 3/4 层中毒），作为女猎手专属强力起始牌。

**目的：** 女猎手起始牌全带中毒/敏捷过于超模，改为与战士结构对称，毒素/敏捷 build 需通过奖励池卡牌构建。

---

### 5. `f058c14` — balance+content: power cards always exhaust, upgradedCost fixes, 8 new cards

**改动文件：** `js/cards.js`、`js/combat.js`

**内容：**

#### 5a. 能力牌消耗机制（`js/combat.js:220`）
- 所有 `type: 'power'` 卡牌打出后必定消耗（进入 exhaustPile），不再回到弃牌堆。
- 解决能力牌（如渗毒獠牙）可被反复抽到并无限叠加的问题。

#### 5b. 升级费用减免（`js/cards.js`）
- `entrench`（巩固）：新增 `upgradedCost: 0`（原 1 → 升级后 0）。
- `limit_break`（极限突破）：新增 `upgradedCost: 0`（原 1 → 升级后 0）。
- 与已有的 `barricade`/`corruption`/`demon_form`/`tools_of_the_trade` 保持一致。

#### 5c. 新增 8 张卡牌（`js/cards.js`）

| 阵营 | 卡牌 ID | 名称 | 类型 | 费用 | 稀有度 | 效果 |
|---|---|---|---|---|---|---|
| 中立 | `deflect` | 闪避格挡 | 技能 | 0 | common | 获得 4/7 点格挡 |
| 中立 | `bite` | 噬咬 | 攻击 | 1 | uncommon | 造成 6/9 伤害，回复 3/5 生命 |
| 战士 | `clothesline` | 横扫倒地 | 攻击 | 2 | uncommon | 造成 12/16 伤害，施加 2/3 层虚弱 |
| 战士 | `sword_boomerang` | 回旋剑 | 攻击 | 1 | uncommon | 对随机敌人造成 3 次 3/4 伤害 |
| 战士 | `reckless_charge` | 鲁莽冲锋 | 攻击 | 0 | common | 造成 11/15 伤害，弃 1 张随机手牌 |
| 猎手 | `caltrops` | 铁蒺藜 | 技能 | 1 | common | 获得 6/9 格挡，对所有敌人施加 2/3 层中毒 |
| 猎手 | `poison_gas` | 毒气弹 | 技能 | 1 | common | 使目标获得 3/5 层中毒和 1/2 层虚弱 |
| 猎手 | `snipe` | 狙击 | 攻击 | 2 | rare | 造成 20/26 点巨额伤害（消耗）|

#### 5d. 奖励池更新（`REWARD_POOLS`）
- common.neutral: 新增 `deflect`
- common.warrior: 新增 `reckless_charge`
- common.huntress: 新增 `caltrops`、`poison_gas`
- uncommon.neutral: 新增 `bite`
- uncommon.warrior: 新增 `clothesline`、`sword_boomerang`
- rare.huntress: 新增 `snipe`

**目的：**
- 能力牌无限叠加是核心平衡 bug，消耗机制一劳永逸解决。
- 部分能力牌升级无变化，改为减费升级。
- 奖励池过于重复（总是那几张消耗牌），新增 8 张卡牌丰富选择。

---

## 涉及文件清单

| 文件 | 改动内容 |
|---|---|
| `js/game.js` | DOM diff patch、移除 artIcon、修复 patchCardEl |
| `js/cards.js` | 女猎手平衡、能力牌升级减费、新增 8 张卡牌、奖励池更新 |
| `js/combat.js` | 能力牌打出后必定消耗 |
