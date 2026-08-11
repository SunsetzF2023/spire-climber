// ============================================================
// Map generation — simplified Slay-the-Spire-style branching path.
// Floors: 0 (start, monsters only) .. N-2 (mixed) .. N-1 (forced rest) .. N (boss)
// ============================================================

const MAP_TYPE_ICON = {
  monster: '⚔️', elite: '💀', rest: '🔥', shop: '🛒', event: '❓', treasure: '💎', boss: '👑',
};

function weightedPick(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [type, w] of entries) {
    if (r < w) return type;
    r -= w;
  }
  return entries[0][0];
}

function generateMap(travelFloors = 6) {
  const FLOOR_COUNT = travelFloors; // floors 0..FLOOR_COUNT-1 are travel floors, FLOOR_COUNT is boss
  const floors = [];

  // For long acts, sprinkle a couple of guaranteed rest checkpoints roughly
  // at the 1/3 and 2/3 marks so a 20-30 floor act isn't pure attrition.
  const midCheckpoints = new Set();
  if (FLOOR_COUNT >= 10) {
    midCheckpoints.add(Math.round(FLOOR_COUNT / 3));
    midCheckpoints.add(Math.round((FLOOR_COUNT * 2) / 3));
  }

  for (let f = 0; f <= FLOOR_COUNT; f++) {
    const nodes = [];
    if (f === 0) {
      const n = 3;
      for (let i = 0; i < n; i++) nodes.push({ id: `${f}_${i}`, floor: f, idx: i, type: 'monster', visited: false });
    } else if (f === FLOOR_COUNT - 1 || midCheckpoints.has(f)) {
      // guaranteed rest site right before the boss, and at act midpoints
      nodes.push({ id: `${f}_0`, floor: f, idx: 0, type: 'rest', visited: false });
    } else if (f === FLOOR_COUNT) {
      nodes.push({ id: `${f}_0`, floor: f, idx: 0, type: 'boss', visited: false });
    } else {
      const n = 2 + Math.floor(Math.random() * 2); // 2-3 nodes
      for (let i = 0; i < n; i++) {
        const weights = { monster: 42, event: 20, shop: 12, treasure: 8, rest: 10 };
        if (f >= 2) weights.elite = 14;
        const type = weightedPick(weights);
        nodes.push({ id: `${f}_${i}`, floor: f, idx: i, type, visited: false });
      }
    }
    floors.push(nodes);
  }

  // Build forward edges: each node connects to 1-2 nodes in the next floor
  const edgesByNodeId = {};
  for (let f = 0; f < FLOOR_COUNT; f++) {
    const cur = floors[f];
    const next = floors[f + 1];
    cur.forEach(node => {
      const candidates = next
        .map((n, i) => i)
        .filter(i => Math.abs(i - node.idx) <= 1);
      const pool = candidates.length > 0 ? candidates : next.map((n, i) => i);
      const connectCount = next.length === 1 ? 1 : (Math.random() < 0.35 ? 2 : 1);
      const chosen = new Set();
      chosen.add(pool[Math.floor(Math.random() * pool.length)]);
      if (connectCount === 2 && pool.length > 1) {
        chosen.add(pool[Math.floor(Math.random() * pool.length)]);
      }
      edgesByNodeId[node.id] = [...chosen].map(i => next[i].id);
    });
  }

  // Ensure every node (except floor 0) has at least one incoming edge
  for (let f = 1; f <= FLOOR_COUNT; f++) {
    floors[f].forEach(targetNode => {
      const hasIncoming = floors[f - 1].some(prevNode => edgesByNodeId[prevNode.id].includes(targetNode.id));
      if (!hasIncoming) {
        const prevNodes = floors[f - 1];
        const nearest = prevNodes.reduce((best, n) => Math.abs(n.idx - targetNode.idx) < Math.abs(best.idx - targetNode.idx) ? n : best, prevNodes[0]);
        edgesByNodeId[nearest.id].push(targetNode.id);
      }
    });
  }

  return { floors, edges: edgesByNodeId, floorCount: FLOOR_COUNT };
}

function getReachableNodeIds(map, currentNodeId) {
  if (!currentNodeId) return map.floors[0].map(n => n.id);
  return map.edges[currentNodeId] || [];
}

function findNode(map, nodeId) {
  for (const floor of map.floors) {
    const n = floor.find(x => x.id === nodeId);
    if (n) return n;
  }
  return null;
}
