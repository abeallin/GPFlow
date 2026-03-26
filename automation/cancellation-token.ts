/**
 * Cooperative cancellation primitive.
 * Wraps any Promise with race() to enable sub-second cancellation
 * of Playwright operations that otherwise block for 30+ seconds.
 *
 * Complexity: All operations O(1). Listener drain on cancel is O(k)
 * where k = number of active waiters (bounded by concurrency).
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

  /** Register a callback for when cancel() is called. If already cancelled, fires immediately. */
  onCancel(fn: () => void): void {
    if (this._cancelled) {
      fn();
      return;
    }
    this._listeners.push(fn);
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

      this.onCancel(onCancel);

      promise.then(
        (value) => {
          if (!settled) {
            settled = true;
            resolve(value);
          }
        },
        (error) => {
          if (!settled) {
            settled = true;
            reject(error);
          }
        },
      );
    });
  }
}
