import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

let cacheModule;

async function freshImport() {
  localStorage.clear();
  vi.resetModules();
  vi.useRealTimers();
  cacheModule = await import('../src/common/cache.js');
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
    cacheModule.cacheSet('repos', ['r1'], 60000);
    vi.advanceTimersByTime(30000);
    expect(cacheModule.cacheGet('repos')).toEqual(['r1']);
  });

  it('returns null after TTL expires', () => {
    vi.useFakeTimers();
    cacheModule.cacheSet('repos', ['r1'], 60000);
    vi.advanceTimersByTime(60001);
    expect(cacheModule.cacheGet('repos')).toBeNull();
  });

  it('uses default TTL of 15 minutes when not specified', () => {
    vi.useFakeTimers();
    cacheModule.cacheSet('repos', ['r1']);
    vi.advanceTimersByTime(14 * 60 * 1000);
    expect(cacheModule.cacheGet('repos')).toEqual(['r1']);
    vi.advanceTimersByTime(2 * 60 * 1000);
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
      JSON.stringify({ data: ['r1'] })
    );
    expect(cacheModule.cacheGet('repos')).toBeNull();
  });

  it('returns null for entry missing data field', () => {
    localStorage.setItem(
      'ap_cache_repos',
      JSON.stringify({ ts: Date.now(), ttl: 900000 })
    );
    expect(cacheModule.cacheGet('repos')).toBeNull();
  });

  it('handles localStorage quota exceeded gracefully', () => {
    const original = localStorage.setItem;
    localStorage.setItem = () => {
      throw new DOMException('QuotaExceededError');
    };
    expect(() => cacheModule.cacheSet('repos', ['r1'])).not.toThrow();
    localStorage.setItem = original;
  });
});
