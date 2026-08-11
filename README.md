# 🗡️ Spire Climber — An Original Card-Battling Roguelike Demo

A minimal playable prototype inspired by **Slay the Spire**'s core loop, but with entirely original mechanics, cards, enemies, and relics.

No build step, no backend — just double-click `index.html` or serve it with any static server.

## Core gameplay loop
> Climb a branching map → run into combat / elite / boss / event / rest / shop / treasure nodes → fight turn-based, energy-driven card battles → on victory, pick a card to add to your deck → defeat the act's boss to fully heal and descend into a tougher new dimension → repeat across 3 dimensions until you defeat the final boss, or die trying.

## Systems implemented
- **Turn-based card combat**: fixed energy per turn (3 by default), draw 5 cards a turn, playing cards costs energy, block resets at the start of your own turn
- **Status effects**: Strength (+attack damage), Dexterity (+block gained), Weak (-25% damage dealt), Vulnerable (+50% damage taken), Frail (-25% block gained), Poison (ticks damage down each turn), Metallicize (gain block at end of turn)
- **Branching map**: each act generates a random branching path ~28 floors deep with node types — Combat⚔️ / Elite💀 / Rest🔥 / Shop🛒 / Event❓ / Treasure💎 / Boss👑 — you can only advance along unlocked connections, with guaranteed rest checkpoints along the way so a long act isn't pure attrition
- **3 dimensions (acts)**: clearing an act's boss fully heals you and drops you into a new, harder dimension with its own boss and elite roster, and an HP scaling multiplier applied to every enemy (1.0x → 1.35x → 1.7x) — by the time you reach the final boss you'll have had far more combats, rewards, and rest stops to actually grow your deck
- **Original enemy AI**: 5 normal enemies (reused across dimensions), 4 elites, and 3 bosses, each with its own independent move cycle / scaling mechanic (e.g. the "Rampaging Hound" bite damage grows every turn; every boss enters an enrage phase below 50% HP)
- **Relic system**: 12 passive effects that don't take up deck space, earned from elites/treasure/events/shops, with hooks covering combat start, turn start/end, card played, damage taken, and enemy killed
- **Random events**: sacrifice HP for a relic at an altar, open a suspicious chest, a storyteller who removes a card for free, a wandering blacksmith who upgrades a card for free, a wishing well gamble, and a merchant trading HP for a rare card
- **Rest sites**: heal 30% of max HP, or permanently upgrade a card (stats improve, name gets a `+`)
- **Merchant**: buy cards/relics, or pay an increasing gold cost to remove a card from your deck (deck-thinning strategy)
- **Post-run summary**: on victory or defeat, see a stats recap (floor reached, score, gold earned, enemies/elites defeated, deck size, cards played) and any achievements newly unlocked
- **Personal Center**: a persistent (localStorage-backed) profile screen showing lifetime stats (total runs, wins, high score, best floor), an achievement list, and a collection log of every card/relic/enemy you've ever discovered — purely cosmetic progress tracking, it never gates what appears in a run

## File structure
- `index.html` / `style.css` — page structure and styling
- `js/cards.js` — card definitions (starter deck + common/uncommon/rare reward pools, with upgrade values)
- `js/relics.js` — relic definitions (hook-based passive effects)
- `js/enemies.js` — enemy definitions and original AI move logic
- `js/events.js` — random non-combat event pool
- `js/map.js` — branching map generation and reachable-node logic
- `js/combat.js` — `CombatEngine`: pure-logic turn-based battle simulator (energy/draw/discard/exhaust piles, status effects)
- `js/meta.js` — persistent meta-progression: `localStorage` load/save, achievement definitions, score calculation
- `js/game.js` — state machine: rendering and interaction wiring for map/event/rest/shop/combat/end/profile screens

## How to test if this is fun
1. Open the page and click "Start a New Run"
2. Pick reachable nodes on the map — prioritize combat for gold and cards, and be cautious with elites (high HP, strong mechanics, but a guaranteed relic drop)
3. In combat: click a hand card to select it, then click an enemy if it needs a target; click "End Turn" once you're out of energy or want to save cards
4. At rest sites, decide whether to heal or upgrade a card; at shops, decide whether to buy cards/relics or thin your deck
5. Fight your way through all 3 dimensions — Abyss Lord → Iron Colossus → Void Progenitor — and see if you have enough damage/block to survive each one's enrage phase below 50% HP

## Possible next steps
- A potion system, and more rarity tiers for cards and relics
- Multiple starting decks/classes for replay variety
- More complex multi-phase boss mechanics, curse/status cards
- Run progress saving (localStorage) so a page refresh doesn't lose the current run
- Cloud-synced profiles (e.g. Supabase + GitHub login) so lifetime stats/achievements/collection follow you across devices instead of being tied to one browser's `localStorage`
