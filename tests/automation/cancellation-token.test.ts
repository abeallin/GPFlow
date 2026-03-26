import { describe, it, expect, vi } from 'vitest';
import { CancellationToken, CancellationError } from '../../automation/cancellation-token';

describe('CancellationToken', () => {
  it('starts uncancelled', () => {
    const token = new CancellationToken();
    expect(token.isCancelled).toBe(false);
  });

  it('cancel() sets isCancelled to true', () => {
    const token = new CancellationToken();
    token.cancel();
    expect(token.isCancelled).toBe(true);
  });

  it('cancel() is idempotent', () => {
    const token = new CancellationToken();
    const fn = vi.fn();
    token.onCancel(fn);
    token.cancel();
    token.cancel();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throwIfCancelled() does nothing when not cancelled', () => {
    const token = new CancellationToken();
    expect(() => token.throwIfCancelled()).not.toThrow();
  });

  it('throwIfCancelled() throws CancellationError after cancel', () => {
    const token = new CancellationToken();
    token.cancel();
    expect(() => token.throwIfCancelled()).toThrow(CancellationError);
  });

  it('onCancel fires listener when cancel() is called', () => {
    const token = new CancellationToken();
    const fn = vi.fn();
    token.onCancel(fn);
    expect(fn).not.toHaveBeenCalled();
    token.cancel();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('onCancel fires immediately if already cancelled', () => {
    const token = new CancellationToken();
    token.cancel();
    const fn = vi.fn();
    token.onCancel(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('race() resolves if promise resolves before cancel', async () => {
    const token = new CancellationToken();
    const result = await token.race(Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('race() rejects with CancellationError if already cancelled', async () => {
    const token = new CancellationToken();
    token.cancel();
    await expect(token.race(Promise.resolve(42))).rejects.toThrow(CancellationError);
  });

  it('race() rejects when cancel() is called during pending promise', async () => {
    const token = new CancellationToken();
    const neverResolves = new Promise(() => {}); // hangs forever

    const racePromise = token.race(neverResolves);

    // Cancel after a tick
    setTimeout(() => token.cancel(), 10);

    await expect(racePromise).rejects.toThrow(CancellationError);
  });

  it('race() propagates the original error if promise rejects', async () => {
    const token = new CancellationToken();
    const err = new Error('original');
    await expect(token.race(Promise.reject(err))).rejects.toThrow('original');
  });
});
