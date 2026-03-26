import { CancellationToken, CancellationError } from './cancellation-token';

/**
 * Concurrent work queue with cursor-based O(n/k) distribution.
 *
 * k workers pull from a shared monotonically increasing cursor.
 * Each item is processed exactly once. No item is visited twice
 * because cursor++ is atomic in single-threaded JS.
 *
 * Complexity:
 *   Wall time: O(n/k) where n = items, k = concurrency
 *   Total work: O(n) across all workers
 *   Memory: O(k) for worker promises. Items array is by reference.
 */

export interface WorkQueueResult {
  completed: number;
  failed: number;
  cancelled: number;
}

export interface WorkQueueOptions<T> {
  items: T[];
  concurrency: number;
  token: CancellationToken;
  worker: (item: T, workerIndex: number) => Promise<void>;
}

export class WorkQueue<T> {
  private _cursor = 0;
  private _completed = 0;
  private _failed = 0;
  private readonly items: T[];
  private readonly concurrency: number;
  private readonly token: CancellationToken;
  private readonly worker: (item: T, workerIndex: number) => Promise<void>;

  constructor(opts: WorkQueueOptions<T>) {
    this.items = opts.items;
    // Clamp concurrency: at least 1, at most items.length (no idle workers)
    this.concurrency = Math.max(1, Math.min(opts.concurrency, opts.items.length || 1));
    this.token = opts.token;
    this.worker = opts.worker;
  }

  /** Current cursor position (how many items have been dequeued). */
  get cursor(): number {
    return this._cursor;
  }

  /** Number of successfully completed items. */
  get completed(): number {
    return this._completed;
  }

  /** Number of failed items. */
  get failed(): number {
    return this._failed;
  }

  /** Total processed (completed + failed). */
  get processed(): number {
    return this._completed + this._failed;
  }

  /**
   * Run the queue. Spawns k worker loops via Promise.allSettled.
   * Returns after all workers finish or are cancelled.
   */
  async run(): Promise<WorkQueueResult> {
    if (this.items.length === 0) {
      return { completed: 0, failed: 0, cancelled: 0 };
    }

    const workers = Array.from(
      { length: this.concurrency },
      (_, i) => this.workerLoop(i),
    );

    await Promise.allSettled(workers);

    const cancelled = this.items.length - this._cursor;
    return {
      completed: this._completed,
      failed: this._failed,
      cancelled: Math.max(0, cancelled),
    };
  }

  /**
   * Worker loop: pull next item from shared cursor, process, repeat.
   * O(n/k) iterations per worker.
   */
  private async workerLoop(workerIndex: number): Promise<void> {
    while (!this.token.isCancelled) {
      // Atomically claim the next item (single-threaded JS, no races)
      const index = this._cursor;
      if (index >= this.items.length) break;
      this._cursor++;

      try {
        await this.worker(this.items[index], workerIndex);
        this._completed++;
      } catch (error) {
        if (error instanceof CancellationError) break;
        this._failed++;
      }
    }
  }
}
