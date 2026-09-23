import type { RunConfig, EventSink } from '../../automation/runner';
import { validateRunConfig } from '../../automation/runner';

/** The subset of AutomationRunner the controller relies on (kept small so tests can fake it). */
export interface RunnerLike {
  currentRunId: number;
  launch: (config: RunConfig) => { runId: number; completion: Promise<number> };
  stop: () => Promise<void>;
}

export type RunnerFactory = () => RunnerLike;

export interface ActiveRun {
  runId: number;
  accountLabel: string;
}

interface Entry extends ActiveRun {
  key: string;
  runner: RunnerLike;
  completion: Promise<void>;
}

export interface ControllerDeps {
  sink: EventSink;
  makeRunner: RunnerFactory;
  getFailedPracticeIds: (runId: number) => number[];
}

/**
 * Owns the set of running automations. Pure TypeScript — no Electron imports —
 * so the start/stop/error semantics are unit-testable. `registerAutomationHandlers`
 * wires it to ipcMain.
 */
export function createAutomationController(deps: ControllerDeps) {
  const active = new Map<number, Entry>();
  const keys = new Set<string>();

  function accountKey(config: RunConfig): string {
    return config.credentials.username.trim().toLowerCase();
  }

  async function start(config: RunConfig): Promise<{ runId: number }> {
    if (!config || typeof config !== 'object') throw new Error('Run config is required');
    validateRunConfig(config);

    const key = accountKey(config);
    if (keys.has(key)) {
      throw new Error(`A run is already in progress for account: ${config.credentials.username}`);
    }
    keys.add(key);

    const runner = deps.makeRunner();
    const accountLabel = config.accountLabel || config.credentials.username;

    let launched: { runId: number; completion: Promise<number> };
    try {
      launched = runner.launch(config);
    } catch (err) {
      keys.delete(key);
      throw err;
    }

    const { runId } = launched;
    const completion = launched.completion
      .then(() => undefined)
      .catch((err: unknown) => {
        deps.sink.send('automation:error', {
          runId,
          accountLabel,
          error: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => {
        active.delete(runId);
        keys.delete(key);
      });

    active.set(runId, { runId, accountLabel, key, runner, completion });
    return { runId };
  }

  async function stop(runId: number): Promise<void> {
    const entry = active.get(runId);
    if (!entry) return;
    await entry.runner.stop();
  }

  async function stopAll(): Promise<void> {
    await Promise.allSettled([...active.values()].map((e) => e.runner.stop()));
  }

  function activeRuns(): ActiveRun[] {
    return [...active.values()].map(({ runId, accountLabel }) => ({ runId, accountLabel }));
  }

  /** Resolves once every active run has finished writing to the database. */
  async function waitForAll(): Promise<void> {
    await Promise.allSettled([...active.values()].map((e) => e.completion));
  }

  function retryFailed(runId: number): { practiceIds: number[] } {
    const practiceIds = deps.getFailedPracticeIds(runId);
    if (practiceIds.length === 0) throw new Error('No failed practices to retry');
    return { practiceIds };
  }

  return { start, stop, stopAll, activeRuns, waitForAll, retryFailed };
}

export type AutomationController = ReturnType<typeof createAutomationController>;
