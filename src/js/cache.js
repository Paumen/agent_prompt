/**
 * localStorage cache with TTL support.
 * All keys are prefixed with `ap_cache_` to avoid collision with app state.
 *
 * Supports:
 * - TTL-based expiry (default 15 minutes)
 * - Full cache clear for PAT-change cascade (GL-05)
 * - Corrupted entry recovery
 */

const PREFIX = 'ap_cache_';
const DEFAULT_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Retrieve cached data by key.
 * Returns null if missing, expired, or corrupted.
 */
export function cacheGet(key) {
  const storageKey = PREFIX + key;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return null;

    const entry = JSON.parse(raw);

    // Validate entry shape
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof entry.ts !== 'number' ||
      !('data' in entry)
    ) {
      localStorage.removeItem(storageKey);
      return null;
    }

    // Check TTL expiry
    const ttl = entry.ttl ?? DEFAULT_TTL;
    if (Date.now() - entry.ts > ttl) {
      localStorage.removeItem(storageKey);
      return null;
    }

    return entry.data;
  } catch {
    // Corrupted JSON — remove and return null
    localStorage.removeItem(storageKey);
    return null;
  }
}

/**
 * Store data in cache with optional TTL.
 * @param {string} key
 * @param {*} data - JSON-serializable data
 * @param {number} [ttlMs] - TTL in milliseconds (default 15 minutes)
 */
export function cacheSet(key, data, ttlMs) {
  const storageKey = PREFIX + key;
  const ttl = ttlMs ?? DEFAULT_TTL;
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ data, ts: Date.now(), ttl })
    );
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

/**
 * Remove a specific cache entry.
 */
export function cacheRemove(key) {
  localStorage.removeItem(PREFIX + key);
}

/**
 * Clear ALL cache entries (PAT-change cascade).
 * Only removes keys with the ap_cache_ prefix — does not touch app state.
 */
export function cacheClear() {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) {
      keysToRemove.push(k);
    }
  }
  for (const k of keysToRemove) {
    localStorage.removeItem(k);
  }
}
