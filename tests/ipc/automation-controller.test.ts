import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAutomationController, type RunnerFactory, type RunnerLike } from '../../electron/ipc/automation-controller';
import type { RunConfig } from '../../automation/runner';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function fakeRunner(runId: number) {
  const done = deferred<number>();
  const runner: RunnerLike & { done: typeof done; launchedWith: RunConfig | null } = {
    currentRunId: 0,
    launchedWith: null,
    done,
    launch: vi.fn((config: RunConfig) => { runner.launchedWith = config; runner.currentRunId = runId; return { runId, completion: done.promise }; }),
    stop: vi.fn(async () => {}),
  };
  return runner;
}

const config = (username: string) => ({
  type: 'create' as const,
  templateConfig: { template_name: 'T', message: 'm', individual: true, batch: false, allow_respond: false },
  practices: [{ id: 1, name: 'P', accurx_id: 'A' }],
  screenshotMode: 'off' as const,
  credentials: { username, password: 'pw' },
  accountLabel: username.split('@')[0],
});

describe('automation controller', () => {
  let sent: { channel: string; payload: unknown }[];
  let runners: ReturnType<typeof fakeRunner>[];
  let nextId: number;
  let controller: ReturnType<typeof createAutomationController>;

  beforeEach(() => {
    sent = [];
    runners = [];
    nextId = 1;
    const factory: RunnerFactory = () => { const r = fakeRunner(nextId++); runners.push(r); return r; };
    controller = createAutomationController({
      sink: { send: (channel, payload) => sent.push({ channel, payload }) },
      makeRunner: factory,
      getFailedPracticeIds: () => [],
    });
  });

  it('start() resolves with the run id immediately, while the run is still executing', async () => {
    const { runId } = await controller.start(config('a@x.com'));
    expect(runId).toBe(1);
    expect(runners[0].launch).toHaveBeenCalledTimes(1);
    expect(controller.activeRuns()).toEqual([{ runId: 1, accountLabel: 'a' }]);
  });

  it('two accounts run at the same time', async () => {
    await controller.start(config('a@x.com'));
    await controller.start(config('b@x.com'));
    expect(runners).toHaveLength(2);
    expect(runners[1].launch).toHaveBeenCalled(); // launched before the first completed
    expect(controller.activeRuns().map((r) => r.runId)).toEqual([1, 2]);
  });

  it('refuses a second run for an account that is already running', async () => {
    await controller.start(config('a@x.com'));
    await expect(controller.start(config('a@x.com'))).rejects.toThrow(/already in progress/);
  });

  it('forwards accountLabel and the full config to the runner', async () => {
    await controller.start(config('a@x.com'));
    expect(runners[0].launchedWith).toMatchObject({ accountLabel: 'a', practices: [{ id: 1, accurx_id: 'A' }] });
  });

  it('removes the run from the active list when it completes', async () => {
    await controller.start(config('a@x.com'));
    runners[0].done.resolve(1);
    await controller.waitForAll();
    expect(controller.activeRuns()).toEqual([]);
  });

  it('turns a fatal run error into an automation:error event instead of an unhandled rejection', async () => {
    await controller.start(config('a@x.com'));
    runners[0].done.reject(new Error('Login failed: bad password'));
    await controller.waitForAll();
    expect(sent).toContainEqual({ channel: 'automation:error', payload: { runId: 1, accountLabel: 'a', error: 'Login failed: bad password' } });
    expect(controller.activeRuns()).toEqual([]);
  });

  it('stop(runId) stops only that run; stopAll() stops every run', async () => {
    await controller.start(config('a@x.com'));
    await controller.start(config('b@x.com'));
    await controller.stop(2);
    expect(runners[0].stop).not.toHaveBeenCalled();
    expect(runners[1].stop).toHaveBeenCalled();
    await controller.stopAll();
    expect(runners[0].stop).toHaveBeenCalled();
  });

  it('stop() with an unknown or zero run id does nothing', async () => {
    await controller.start(config('a@x.com'));
    await controller.stop(0);
    await controller.stop(99);
    expect(runners[0].stop).not.toHaveBeenCalled();
  });

  it('rejects invalid input before creating a runner', async () => {
    await expect(controller.start({ ...config('a@x.com'), practices: [] } as unknown as RunConfig)).rejects.toThrow(/practice/i);
    await expect(controller.start({ ...config('a@x.com'), type: 'nuke' } as unknown as RunConfig)).rejects.toThrow(/type/i);
    await expect(controller.start(null as unknown as RunConfig)).rejects.toThrow();
    expect(runners).toHaveLength(0);
  });

  it('waitForAll() resolves only after every run has settled (so the DB can be closed safely)', async () => {
    await controller.start(config('a@x.com'));
    let settled = false;
    const wait = controller.waitForAll().then(() => { settled = true; });
    await new Promise((r) => setTimeout(r, 10));
    expect(settled).toBe(false);
    runners[0].done.resolve(1);
    await wait;
    expect(settled).toBe(true);
  });
});
