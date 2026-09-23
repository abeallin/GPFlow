/**
 * Cooperative cancellation primitive.
 * Wraps any Promise with race() to enable sub-second cancellation
 * of Playwright operations that otherwise block for 30+ seconds.
 *
 * Listeners are removed as soon as the raced promise settles, so the
 * listener list is bounded by the number of in-flight race() calls.
 */

export class CancellationError extends Error {
  constructor() {
    super('Operation cancelled');
    this.name = 'CancellationError';
  }
}

export class CancellationToken {
  private _cancelled = false;
  private _listeners: Array<() => void> = [];

  get isCancelled(): boolean {
    return this._cancelled;
  }

  /** Cancel the token. Fires all listeners once. Idempotent. */
  cancel(): void {
    if (this._cancelled) return;
    this._cancelled = true;
    for (const listener of this._listeners) {
      try { listener(); } catch { /* listener errors don't propagate */ }
    }
    this._listeners = [];
  }

  /** Number of race() calls still waiting on cancellation. Exposed for leak checks. */
  get pendingWaiters(): number {
    return this._listeners.length;
  }

  /** Register a callback for when cancel() is called. If already cancelled, fires immediately. */
  onCancel(fn: () => void): () => void {
    if (this._cancelled) {
      fn();
      return () => {};
    }
    this._listeners.push(fn);
    return () => {
      const idx = this._listeners.indexOf(fn);
      if (idx !== -1) this._listeners.splice(idx, 1);
    };
  }

  /** Throws CancellationError if the token has been cancelled. */
  throwIfCancelled(): void {
    if (this._cancelled) throw new CancellationError();
  }

  /**
   * Race a promise against cancellation. O(1) overhead — no polling.
   * Resolves with the promise's value if it settles first.
   * Rejects with CancellationError if cancel() is called first.
   */
  race<T>(promise: Promise<T>): Promise<T> {
    if (this._cancelled) return Promise.reject(new CancellationError());

    return new Promise<T>((resolve, reject) => {
      let settled = false;

      const onCancel = () => {
        if (!settled) {
          settled = true;
          reject(new CancellationError());
        }
      };

      const unsubscribe = this.onCancel(onCancel);

      promise.then(
        (value) => {
          unsubscribe();
          if (!settled) {
            settled = true;
            resolve(value);
          }
        },
        (error) => {
          unsubscribe();
          if (!settled) {
            settled = true;
            reject(error);
          }
        },
      );
    });
  }
}
