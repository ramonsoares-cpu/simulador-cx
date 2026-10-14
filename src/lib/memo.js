/**
 * Cache com TTL e single-flight: leituras concorrentes compartilham a mesma Promise.
 * Falhas não são cacheadas.
 */
function memo(fn, ttlMs) {
  let cached = null; // { promise, expiresAt }

  const wrapped = (...args) => {
    const now = Date.now();
    if (cached && cached.expiresAt > now) return cached.promise;

    const entry = { promise: null, expiresAt: now + ttlMs };
    entry.promise = Promise.resolve()
      .then(() => fn(...args))
      .catch((err) => {
        if (cached === entry) cached = null;
        throw err;
      });
    cached = entry;
    return entry.promise;
  };

  wrapped.clear = () => {
    cached = null;
  };
  return wrapped;
}

module.exports = memo;
