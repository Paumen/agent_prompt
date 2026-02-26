// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

let cacheModule;

async function freshImport() {
  localStorage.clear();
  vi.resetModules();
  vi.useRealTimers();
  cacheModule = await import('../src/js/cache.js');
}

beforeEach(async () => {
  await freshImport();
});

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe('cacheSet() + cacheGet()', () => {
  it('stores and retrieves data', () => {
    cacheModule.cacheSet('repos', ['repo-a', 'repo-b']);
    expect(cacheModule.cacheGet('repos')).toEqual(['repo-a', 'repo-b']);
  });

  it('stores objects with nested data', () => {
    const data = { name: 'main', sha: 'abc123' };
    cacheModule.cacheSet('branches', data);
    expect(cacheModule.cacheGet('branches')).toEqual(data);
  });

  it('returns null for missing key', () => {
    expect(cacheModule.cacheGet('nonexistent')).toBeNull();
  });

  it('overwrites existing cache entry', () => {
    cacheModule.cacheSet('repos', ['old']);
    cacheModule.cacheSet('repos', ['new']);
    expect(cacheModule.cacheGet('repos')).toEqual(['new']);
  });

  it('uses ap_cache_ prefix in localStorage keys', () => {
    cacheModule.cacheSet('repos', ['r1']);
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter((k) => k.startsWith('ap_cache_'));
    expect(cacheKeys.length).toBe(1);
    expect(cacheKeys[0]).toBe('ap_cache_repos');
  });

  it('does not collide with agent_prompt_state key', () => {
    localStorage.setItem('agent_prompt_state', JSON.stringify({ pat: 'x' }));
    cacheModule.cacheSet('repos', ['r1']);
    expect(JSON.parse(localStorage.getItem('agent_prompt_state'))).toEqual({
      pat: 'x',
    });
  });
});

describe('TTL expiry', () => {
  it('returns data before TTL expires', () => {
    vi.useFakeTimers();
    cacheModule.cacheSet('repos', ['r1'], 60000); // 1 minute TTL
    vi.advanceTimersByTime(30000); // 30 seconds
    expect(cacheModule.cacheGet('repos')).toEqual(['r1']);
  });

  it('returns null after TTL expires', () => {
    vi.useFakeTimers();
    cacheModule.cacheSet('repos', ['r1'], 60000); // 1 minute TTL
    vi.advanceTimersByTime(60001); // Just past TTL
    expect(cacheModule.cacheGet('repos')).toBeNull();
  });

  it('uses default TTL of 15 minutes when not specified', () => {
    vi.useFakeTimers();
    cacheModule.cacheSet('repos', ['r1']); // default TTL
    vi.advanceTimersByTime(14 * 60 * 1000); // 14 minutes
    expect(cacheModule.cacheGet('repos')).toEqual(['r1']);
    vi.advanceTimersByTime(2 * 60 * 1000); // 16 minutes total
    expect(cacheModule.cacheGet('repos')).toBeNull();
  });

  it('removes expired entry from localStorage on access', () => {
    vi.useFakeTimers();
    cacheModule.cacheSet('repos', ['r1'], 1000);
    vi.advanceTimersByTime(2000);
    cacheModule.cacheGet('repos');
    expect(localStorage.getItem('ap_cache_repos')).toBeNull();
  });
});

describe('cacheClear()', () => {
  it('removes all cache entries', () => {
    cacheModule.cacheSet('repos', ['r1']);
    cacheModule.cacheSet('branches', ['main']);
    cacheModule.cacheSet('tree', ['/src']);
    cacheModule.cacheClear();
    expect(cacheModule.cacheGet('repos')).toBeNull();
    expect(cacheModule.cacheGet('branches')).toBeNull();
    expect(cacheModule.cacheGet('tree')).toBeNull();
  });

  it('does not remove non-cache localStorage entries', () => {
    localStorage.setItem('agent_prompt_state', JSON.stringify({ pat: 'x' }));
    localStorage.setItem('some_other_key', 'value');
    cacheModule.cacheSet('repos', ['r1']);
    cacheModule.cacheClear();
    expect(localStorage.getItem('agent_prompt_state')).toBe(
      JSON.stringify({ pat: 'x' })
    );
    expect(localStorage.getItem('some_other_key')).toBe('value');
  });
});

describe('cacheRemove()', () => {
  it('removes a specific cache entry', () => {
    cacheModule.cacheSet('repos', ['r1']);
    cacheModule.cacheSet('branches', ['main']);
    cacheModule.cacheRemove('repos');
    expect(cacheModule.cacheGet('repos')).toBeNull();
    expect(cacheModule.cacheGet('branches')).toEqual(['main']);
  });

  it('does nothing for nonexistent key', () => {
    expect(() => cacheModule.cacheRemove('nonexistent')).not.toThrow();
  });
});

describe('corrupted data handling', () => {
  it('returns null for corrupted JSON in localStorage', () => {
    localStorage.setItem('ap_cache_repos', 'not valid json{{{');
    expect(cacheModule.cacheGet('repos')).toBeNull();
  });

  it('removes corrupted entry from localStorage', () => {
    localStorage.setItem('ap_cache_repos', 'broken');
    cacheModule.cacheGet('repos');
    expect(localStorage.getItem('ap_cache_repos')).toBeNull();
  });

  it('returns null for entry missing timestamp', () => {
    localStorage.setItem(
      'ap_cache_repos',
      JSON.stringify({ data: ['r1'] }) // no ts field
    );
    expect(cacheModule.cacheGet('repos')).toBeNull();
  });

  it('returns null for entry missing data field', () => {
    localStorage.setItem(
      'ap_cache_repos',
      JSON.stringify({ ts: Date.now(), ttl: 900000 }) // no data field
    );
    expect(cacheModule.cacheGet('repos')).toBeNull();
  });

  it('handles localStorage quota exceeded gracefully', () => {
    // Mock setItem to throw
    const original = localStorage.setItem;
    localStorage.setItem = () => {
      throw new DOMException('QuotaExceededError');
    };
    expect(() => cacheModule.cacheSet('repos', ['r1'])).not.toThrow();
    localStorage.setItem = original;
  });
});
