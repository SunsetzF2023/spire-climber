# 卡牌图片制作指南

## 项目概述

Spire Climber 是一个类杀戮尖塔的网页卡牌游戏。卡牌可以使用自定义 PNG 图片替代默认的 emoji 显示。

## 快速上手（新电脑）

1. `git clone https://github.com/SunsetzF2023/spire-climber.git`
2. 用本地服务器打开项目（如 VS Code Live Server，或 `python -m http.server`）
3. 访问 `index.html` 即可游玩

## 卡牌图片系统

### 图片存放路径

```
assets/cards/{card_id}.png
```

### 图片要求

- 格式：PNG
- 尺寸建议：竖向比例（约 3:4），推荐 400x533 或更大
- 图片会通过 `object-fit: cover` 填满整个卡牌区域
- 卡牌显示尺寸：桌面 132x176px，平板 110x150px，手机 92x128px

### 如何添加新卡牌图片

1. 把图片放到 `assets/cards/` 目录，文件名为卡牌ID + `.png`
2. 打开 `js/game.js`，找到 `CARD_IMAGE_IDS`（约第23行）
3. 在 Set 数组中添加卡牌ID：
   ```js
   const CARD_IMAGE_IDS = new Set(['apex_form', 'bandage_up', 'defend', 'purify', 'second_skin', 'swift_focus', '新卡牌ID']);
   ```
4. 修改 `index.html` 中 `game.js` 的缓存版本号（`?v=XX` 加1）
5. `git add -A && git commit -m "feat: add card image for {card_id}" && git push origin`

### 已有图片的卡牌

| 卡牌ID | 中文名 | 图标 |
|--------|--------|------|
| apex_form | 巅峰形态 | 🌟 |
| bandage_up | 包扎 | 🩹 |
| defend | 防御 | 🛡️ |
| purify | 净化 | 🌿 |
| second_skin | 铁壁 | 🦾 |
| swift_focus | 专注 | 🎯 |

### 显示效果

- **有图片的卡牌**：整张卡牌显示为图片，左上角叠加费用角标，升级卡牌右上角显示金色 `+`
- **没有图片的卡牌**：保持原有 emoji UI（费用、图标、名称、类型、描述）
- 鼠标悬停图片卡牌时显示 tooltip（名称、类型、费用、描述）

## 常用卡牌ID查询

在 `js/cards.js` 中搜索 `id: 'xxx'` 即可找到所有卡牌定义。常用卡牌ID：

### 中性卡牌
- `strike` - 打击
- `defend` - 防御
- `bandage_up` - 包扎
- `purify` - 净化
- `flash_strike` - 闪击
- `second_skin` - 铁壁
- `swift_focus` - 专注
- `apex_form` - 巅峰形态

### 战士卡牌
- `uppercut` - 上勾拳
- `whirlwind` - 旋风斩
- `bloodletting` - 放血
- `second_wind` - 第二口
- `inflame` - 燃烧
- `rampage` - 暴走
- `dark_embrace` - 暗影之拥
- `feel_no_pain` - 痛感
- `entrench` - 巩固
- `spot_weakness` - 寻找弱点

### 女猎手卡牌
在 `js/cards.js` 中搜索 `cls: 'huntress'` 查找所有女猎手卡牌

## 遗物图片系统（预留）

路径：`assets/relics/{relic_id}.png`

目前遗物仍使用 emoji，`artIcon` 函数已预留图片加载能力但尚未启用。

## 敌人图片系统（预留）

路径：`assets/enemies/{enemy_id}.png`

目前敌人仍使用 emoji，`artIcon` 函数已预留图片加载能力但尚未启用。

## 注意事项

- 图片文件较大时（>500KB）建议压缩，GitHub 仓库不宜过大
- `CARD_IMAGE_IDS` 必须准确匹配，否则有图片但没注册的卡牌不会显示图片
- 每次修改 `js/` 目录下的文件后，记得在 `index.html` 中 bump 对应的 `?v=XX` 缓存版本号
- `patchCardEl` 函数处理手牌中已有卡牌的更新，全图卡牌会跳过 DOM 元素更新逻辑，修改时注意兼容
