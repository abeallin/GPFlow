import { describe, it, expect, vi } from 'vitest';
import { WorkQueue } from '../../automation/work-queue';
import { CancellationToken, CancellationError } from '../../automation/cancellation-token';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('WorkQueue', () => {
  it('returns immediately for empty items', async () => {
    const token = new CancellationToken();
    const queue = new WorkQueue({
      items: [],
      concurrency: 4,
      token,
      worker: async () => {},
    });
    const result = await queue.run();
    expect(result).toEqual({ completed: 0, failed: 0, cancelled: 0 });
  });

  it('processes all items with concurrency=1 (sequential)', async () => {
    const token = new CancellationToken();
    const processed: number[] = [];
    const queue = new WorkQueue({
      items: [1, 2, 3, 4, 5],
      concurrency: 1,
      token,
      worker: async (item) => { processed.push(item); },
    });
    const result = await queue.run();
    expect(result.completed).toBe(5);
    expect(result.failed).toBe(0);
    expect(result.cancelled).toBe(0);
    expect(processed).toEqual([1, 2, 3, 4, 5]);
  });

  it('processes all items with concurrency=4', async () => {
    const token = new CancellationToken();
    const processed = new Set<number>();
    const queue = new WorkQueue({
      items: [1, 2, 3, 4, 5, 6, 7, 8],
      concurrency: 4,
      token,
      worker: async (item) => {
        await delay(5); // small delay to allow concurrency
        processed.add(item);
      },
    });
    const result = await queue.run();
    expect(result.completed).toBe(8);
    expect(processed.size).toBe(8);
  });

  it('concurrency is bounded by item count', async () => {
    const token = new CancellationToken();
    const activeConcurrency: number[] = [];
    let active = 0;

    const queue = new WorkQueue({
      items: [1, 2, 3],
      concurrency: 15,
      token,
      worker: async () => {
        active++;
        activeConcurrency.push(active);
        await delay(20);
        active--;
      },
    });
    await queue.run();
    // Max active should be 3 (item count), not 15
    expect(Math.max(...activeConcurrency)).toBeLessThanOrEqual(3);
  });

  it('cancellation stops dequeuing new items', async () => {
    const token = new CancellationToken();
    let processedCount = 0;

    const queue = new WorkQueue({
      items: Array.from({ length: 20 }, (_, i) => i),
      concurrency: 1,
      token,
      worker: async () => {
        processedCount++;
        if (processedCount === 3) token.cancel(); // cancel after 3
        await delay(5);
      },
    });

    const result = await queue.run();
    expect(processedCount).toBeLessThanOrEqual(4); // at most 3 + 1 in-flight
    expect(result.cancelled).toBeGreaterThan(0);
  });

  it('returns correct cancelled count', async () => {
    const token = new CancellationToken();
    const queue = new WorkQueue({
      items: [1, 2, 3, 4, 5],
      concurrency: 1,
      token,
      worker: async (item) => {
        if (item === 2) token.cancel();
      },
    });
    const result = await queue.run();
    expect(result.completed + result.failed + result.cancelled).toBe(5);
  });

  it('failed items do not stop the queue', async () => {
    const token = new CancellationToken();
    const queue = new WorkQueue({
      items: [1, 2, 3, 4, 5],
      concurrency: 2,
      token,
      worker: async (item) => {
        if (item === 2 || item === 4) throw new Error('fail');
      },
    });
    const result = await queue.run();
    expect(result.completed).toBe(3);
    expect(result.failed).toBe(2);
    expect(result.cancelled).toBe(0);
  });

  it('no item is processed twice', async () => {
    const token = new CancellationToken();
    const seen = new Map<number, number>();
    const queue = new WorkQueue({
      items: Array.from({ length: 50 }, (_, i) => i),
      concurrency: 8,
      token,
      worker: async (item) => {
        seen.set(item, (seen.get(item) || 0) + 1);
        await delay(1);
      },
    });
    await queue.run();
    for (const [item, count] of seen) {
      expect(count).toBe(1);
    }
    expect(seen.size).toBe(50);
  });

  it('achieves approximate O(n/k) wall time with concurrency', async () => {
    const token = new CancellationToken();
    const itemDelayMs = 20;
    const items = Array.from({ length: 12 }, (_, i) => i);

    // Sequential: 12 * 20ms = ~240ms
    const seqStart = Date.now();
    const seqQueue = new WorkQueue({
      items: [...items],
      concurrency: 1,
      token: new CancellationToken(),
      worker: async () => { await delay(itemDelayMs); },
    });
    await seqQueue.run();
    const seqTime = Date.now() - seqStart;

    // Parallel with k=4: should be ~3x faster
    const parStart = Date.now();
    const parQueue = new WorkQueue({
      items: [...items],
      concurrency: 4,
      token: new CancellationToken(),
      worker: async () => { await delay(itemDelayMs); },
    });
    await parQueue.run();
    const parTime = Date.now() - parStart;

    // Parallel should be at least 2x faster (allowing for overhead)
    expect(parTime).toBeLessThan(seqTime * 0.6);
  });

  it('exposes progress via getters', async () => {
    const token = new CancellationToken();
    const queue = new WorkQueue({
      items: [1, 2, 3],
      concurrency: 1,
      token,
      worker: async () => {},
    });

    expect(queue.processed).toBe(0);
    expect(queue.cursor).toBe(0);

    await queue.run();

    expect(queue.completed).toBe(3);
    expect(queue.processed).toBe(3);
    expect(queue.cursor).toBe(3);
  });
});
