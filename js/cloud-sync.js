// ============================================================
// Cloud sync — GitHub OAuth login via Supabase Auth, and syncing the
// local `meta` (achievements/discovery log/lifetime stats) object to
// a `profiles` row in Supabase Postgres (see supabase/schema.sql).
//
// Strategy: on login, pull the cloud copy and merge it with whatever
// is currently in localStorage (taking the "better"/union of both),
// so playing on a second device never silently loses progress from
// the first. After that, every local saveMeta() call also pushes the
// merged object back up to the cloud (fire-and-forget).
// ============================================================

let cloudUser = null;
let cloudSyncEnabled = false;

function mergeMeta(a, b) {
  if (!a) return b;
  if (!b) return a;
  const merged = {
    totalRuns: Math.max(a.totalRuns || 0, b.totalRuns || 0),
    wins: Math.max(a.wins || 0, b.wins || 0),
    bestFloorReached: Math.max(a.bestFloorReached || 0, b.bestFloorReached || 0),
    highScore: Math.max(a.highScore || 0, b.highScore || 0),
    totalGoldEarned: Math.max(a.totalGoldEarned || 0, b.totalGoldEarned || 0),
    totalEnemiesDefeated: Math.max(a.totalEnemiesDefeated || 0, b.totalEnemiesDefeated || 0),
    achievements: Object.assign({}, a.achievements, b.achievements),
    discoveredCards: Array.from(new Set([...(a.discoveredCards || []), ...(b.discoveredCards || [])])),
    discoveredRelics: Array.from(new Set([...(a.discoveredRelics || []), ...(b.discoveredRelics || [])])),
    discoveredEnemies: Array.from(new Set([...(a.discoveredEnemies || []), ...(b.discoveredEnemies || [])])),
  };
  return merged;
}

async function pullCloudMeta(userId) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('meta')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) { console.error('[cloud-sync] pull failed:', error.message); return null; }
  return data ? data.meta : null;
}

async function pushCloudMeta(userId, metaObj) {
  const { error } = await supabaseClient
    .from('profiles')
    .upsert({ user_id: userId, meta: metaObj }, { onConflict: 'user_id' });
  if (error) console.error('[cloud-sync] push failed:', error.message);
}

// Called by meta.js's saveMeta() after every local write.
function onMetaSaved(metaObj) {
  if (cloudSyncEnabled && cloudUser) {
    pushCloudMeta(cloudUser.id, metaObj);
  }
}

async function signInWithGitHub() {
  await supabaseClient.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: window.location.href.split('#')[0].split('?')[0] },
  });
}

async function signInAnonymously() {
  const { data, error } = await supabaseClient.auth.signInAnonymously();
  if (error) console.error('[cloud-sync] anonymous sign-in failed:', error.message);
  return data;
}

async function signOutCloud() {
  await supabaseClient.auth.signOut();
  cloudUser = null;
  cloudSyncEnabled = false;
  if (typeof onCloudAuthChanged === 'function') onCloudAuthChanged(null);
}

async function handleSignedIn(user) {
  cloudUser = user;
  const cloudMeta = await pullCloudMeta(user.id);
  const merged = mergeMeta(meta, cloudMeta);
  meta = merged;
  saveMeta(meta); // writes localStorage + triggers onMetaSaved -> pushes merged copy to cloud
  cloudSyncEnabled = true;
  if (typeof onCloudAuthChanged === 'function') onCloudAuthChanged(user);
}

async function initCloudSync() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session && session.user) {
    await handleSignedIn(session.user);
  } else {
    // Auto anonymous sign-in for cloud features (ratings, leaderboard)
    await signInAnonymously();
    // If anonymous sign-in failed, update UI to show GitHub login button
    if (!cloudUser && typeof onCloudAuthChanged === 'function') onCloudAuthChanged(null);
  }
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session && session.user) {
      handleSignedIn(session.user);
    } else if (event === 'SIGNED_OUT') {
      cloudUser = null;
      cloudSyncEnabled = false;
      if (typeof onCloudAuthChanged === 'function') onCloudAuthChanged(null);
      // Re-sign-in anonymously after explicit logout
      setTimeout(() => signInAnonymously(), 500);
    }
  });
}

async function uploadRunToLeaderboard(record) {
  if (!cloudSyncEnabled || !cloudUser) return;
  try {
    let playerName;
    if (cloudUser.is_anonymous) {
      const shortId = cloudUser.id.substring(0, 6);
      playerName = `游客#${shortId}`;
    } else {
      playerName = (cloudUser.user_metadata && (cloudUser.user_metadata.user_name || cloudUser.user_metadata.full_name)) || '匿名玩家';
    }
    const { error } = await supabaseClient
      .from('leaderboard')
      .insert({
        user_id: cloudUser.id,
        player_name: playerName,
        character_id: record.characterId,
        character_name: record.characterName,
        character_icon: record.characterIcon,
        victory: record.victory,
        death_cause: record.deathCause,
        act: record.act,
        floor: record.floor,
        score: record.score,
        final_hp: record.finalHp,
        max_hp: record.maxHp,
        enemies_defeated: record.enemiesDefeated,
        elites_defeated: record.elitesDefeated,
        bosses_defeated: record.bossesDefeated || 0,
        gold_earned: record.goldEarned,
        relic_ids: record.relicIds,
        deck_ids: record.deckIds,
      });
    if (error) console.error('[cloud-sync] leaderboard upload failed:', error.message);
  } catch (e) {
    console.error('[cloud-sync] leaderboard upload error:', e);
  }
}
