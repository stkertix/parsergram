/**
 * Simple in-memory TTL cache with optional in-flight promise dedupe.
 */

/**
 * @template T
 */
class TtlCache {
  /**
   * @param {{ ttlMs?: number, name?: string }} [options]
   */
  constructor(options = {}) {
    this.ttlMs = options.ttlMs || 3 * 60 * 1000;
    this.name = options.name || 'cache';
    /** @type {Map<string, { value: T, expiresAt: number }>} */
    this.store = new Map();
    /** @type {Map<string, Promise<T>>} */
    this.inflight = new Map();
  }

  /**
   * @param {string} key
   * @returns {T|undefined}
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * @param {string} key
   * @param {T} value
   * @param {number} [ttlMs]
   */
  set(key, value, ttlMs) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs || this.ttlMs)
    });
  }

  /**
   * Get cached value or run loader once (deduped while in flight).
   * @param {string} key
   * @param {() => Promise<T>} loader
   * @returns {Promise<{ value: T, cache: 'hit'|'miss'|'inflight' }>}
   */
  async getOrLoad(key, loader) {
    const cached = this.get(key);
    if (cached !== undefined) {
      return { value: cached, cache: 'hit' };
    }

    const pending = this.inflight.get(key);
    if (pending) {
      const value = await pending;
      return { value, cache: 'inflight' };
    }

    const promise = Promise.resolve()
      .then(loader)
      .then((value) => {
        this.set(key, value);
        this.inflight.delete(key);
        return value;
      })
      .catch((error) => {
        this.inflight.delete(key);
        throw error;
      });

    this.inflight.set(key, promise);
    const value = await promise;
    return { value, cache: 'miss' };
  }

  clear() {
    this.store.clear();
    this.inflight.clear();
  }
}

module.exports = {
  TtlCache
};
