// Run in DevTools Console on the SAME localhost:8081 browser profile used for deletion.
// Read-only: no storage writes, no network, no token/content output.
(() => {
  if (location.origin !== 'http://localhost:8081') throw new Error('Open LOADS at http://localhost:8081 first.');
  const owner = (prompt('Deleted account user_id (UUID):') || '').trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(owner)) throw new Error('A valid deleted user UUID is required.');
  const keys = Object.keys(localStorage).filter(key => key.startsWith('@loads/'));
  const read = key => {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch { throw new Error('Unreadable LOADS data; audit is incomplete.'); }
  };
  const localPrefix = `@loads/local/v1/${owner}/`;
  const outboxPrefix = `@loads/cloud-posts/v1/${owner}/`;
  const owned = keys.filter(key => key.startsWith(localPrefix) || key.startsWith(outboxPrefix));
  const receiptKeys = keys.filter(key => /account-deletion|deletion-status/.test(key));
  const migration = read('@loads/local-data-migration/v1');
  const legacyKeys = ['@loads/workouts', '@loads/active-workout', '@loads/templates'];
  const legacyOwned = migration?.owner === owner ? legacyKeys.filter(key => localStorage.getItem(key) !== null) : [];
  const others = [...new Set(keys.flatMap(key => {
    const match = key.match(/^@loads\/(?:local|cloud-posts)\/v1\/([0-9a-f-]{36})\//i);
    return match && match[1].toLowerCase() !== owner ? [match[1]] : [];
  }))];
  const count = key => {
    const value = read(key);
    return value === null ? 0 : Array.isArray(value) ? value.length : 1;
  };
  // Catch references outside the known owner keys without printing the stored contents.
  const references = keys.filter(key => key !== '@loads/local-data-migration/v1' &&
    !owned.includes(key) && (localStorage.getItem(key) || '').toLowerCase().includes(owner));
  const report = {
    origin: location.origin,
    deletedOwner: {
      workoutKeyPresent: localStorage.getItem(localPrefix + 'workouts') !== null,
      activeWorkoutKeyPresent: localStorage.getItem(localPrefix + 'active-workout') !== null,
      templateKeyPresent: localStorage.getItem(localPrefix + 'templates') !== null,
      outboxKeysRemaining: owned.filter(key => key.startsWith(outboxPrefix)).length,
      allOwnedKeysRemaining: owned.length,
      appSavedWebPhotosAbsent: !owned.some(key => key.startsWith(outboxPrefix)),
      receiptOrStatusKeysRemaining: receiptKeys.length,
      assignedLegacyKeysRemaining: legacyOwned.length,
      otherKeysReferencingOwner: references.length,
      migrationAssignmentMarkerRetained: migration?.owner === owner,
    },
    otherAccounts: others.map((id, index) => ({
      label: `Other account ${index + 1}`,
      workouts: count(`@loads/local/v1/${id}/workouts`),
      activeWorkout: count(`@loads/local/v1/${id}/active-workout`),
      templates: count(`@loads/local/v1/${id}/templates`),
      outboxKeys: keys.filter(key => key.startsWith(`@loads/cloud-posts/v1/${id}/`)).length,
    })),
    scope: 'App-owned persistent localStorage only. Web photo copies live in outbox. Original photo library, browser HTTP cache and native iPhone files are not inspected.',
  };
  console.log(JSON.stringify(report, null, 2));
  return report;
})();
