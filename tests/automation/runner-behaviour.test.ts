import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDatabase } from '../helpers/sqlite-adapter';
import { createSchema } from '../../database/schema';
import { getRunSteps, getRuns } from '../../database/queries/runs';
import { AutomationRunner, type RunnerDeps, type RunConfig } from '../../automation/runner';

const TEMPLATES_URL = 'https://web.accurx.com/w/1/settings/templates?tab=OrganisationTemplates';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function fakeBrowser() {
  const pages: any[] = [];
  const makePage = () => {
    const page = {
      goto: vi.fn(async () => {}),
      url: () => TEMPLATES_URL,
      close: vi.fn(async () => {}),
      content: async () => '<html><body>same</body></html>',
      screenshot: async () => {},
      isClosed: () => false,
    };
    pages.push(page);
    return page;
  };
  const context = { newPage: async () => makePage(), close: vi.fn(async () => {}) };
  const browser = { newContext: async () => context, close: vi.fn(async () => {}) };
  return { browser, pages, context };
}

function sink() {
  const events: { channel: string; payload: any }[] = [];
  return { events, send: (channel: string, payload: unknown) => { events.push({ channel, payload }); } };
}

const practices = [
  { id: 901, name: 'Park Surgery', accurx_id: 'AAA' },
  { id: 902, name: 'Hill Practice', accurx_id: 'BBB' },
  { id: 903, name: 'Lake Clinic', accurx_id: 'CCC' },
];

const baseConfig = (): RunConfig => ({
  type: 'create',
  templateConfig: { template_name: 'Flu', message: 'Hi', individual: true, batch: false, allow_respond: false },
  practices,
  screenshotMode: 'off',
  credentials: { username: 'a@b.com', password: 'pw' },
  accountLabel: 'Account A',
  concurrency: 2,
});

describe('AutomationRunner', () => {
  let db: any;
  let fb: ReturnType<typeof fakeBrowser>;
  let events: ReturnType<typeof sink>;
  let deps: RunnerDeps;

  beforeEach(async () => {
    db = await createTestDatabase();
    createSchema(db);
    fb = fakeBrowser();
    events = sink();
    deps = {
      launchBrowser: async () => fb.browser as any,
      login: vi.fn(async () => ({ success: true, requires2fa: false })),
      waitFor2fa: vi.fn(async () => true),
      createTemplate: vi.fn(async () => ({ success: true, alreadyExists: false })),
      deleteTemplate: vi.fn(async () => ({ success: true, deletedCount: 1, notFound: false })),
      captureScreenshot: vi.fn(async () => '/tmp/x.png'),
      powerSaveBlocker: { start: vi.fn(() => 1), stop: vi.fn() },
      screenshotDir: '/tmp/screens',
      retryDelayMs: 0,
      maxConsecutiveFailures: 5,
    };
  });

  afterEach(() => db.close());

  const makeRunner = () => new AutomationRunner(events, db, deps);

  it('processes practices that are NOT in the SQLite practices table, using the supplied accurx_id', async () => {
    const runner = makeRunner();
    const runId = await runner.run(baseConfig());

    const steps = getRunSteps(db, runId);
    expect(steps.map((s) => s.status)).toEqual(['success', 'success', 'success']);
    const visited = fb.pages.flatMap((p) => p.goto.mock.calls.map((c: any[]) => c[0]));
    expect(visited).toEqual(expect.arrayContaining([
      expect.stringContaining('/w/AAA/'), expect.stringContaining('/w/BBB/'), expect.stringContaining('/w/CCC/'),
    ]));
  });

  it('launch() returns the run id before login has finished', async () => {
    const login = deferred<{ success: boolean; requires2fa: boolean }>();
    deps.login = vi.fn(() => login.promise);
    const runner = makeRunner();

    const { runId, completion } = runner.launch(baseConfig());

    expect(runId).toBeGreaterThan(0);
    expect(getRuns(db)[0].status).toBe('running');
    login.resolve({ success: true, requires2fa: false });
    await completion;
    expect(getRuns(db)[0].status).toBe('completed');
  });

  it('stop() during a run leaves no step pending and records the run as cancelled', async () => {
    const gate = deferred<{ success: boolean; alreadyExists: boolean }>();
    let calls = 0;
    deps.createTemplate = vi.fn(() => { calls++; return gate.promise; });
    const runner = makeRunner();

    const { runId, completion } = runner.launch({ ...baseConfig(), concurrency: 2 });
    // wait until both workers are inside createTemplate
    while (calls < 2) await new Promise((r) => setTimeout(r, 5));

    await runner.stop();
    gate.resolve({ success: true, alreadyExists: false }); // in-flight work finishes after cancel
    await completion;

    const statuses = getRunSteps(db, runId).map((s) => s.status);
    expect(statuses).not.toContain('pending');
    expect(statuses).toContain('cancelled');
    expect(getRuns(db)[0].status).toBe('cancelled');
  });

  it('login failure marks every step failed with the login error and rejects completion', async () => {
    deps.login = vi.fn(async () => ({ success: false, requires2fa: false, error: 'Invalid password' }));
    const runner = makeRunner();

    const { runId, completion } = runner.launch(baseConfig());
    await expect(completion).rejects.toThrow(/Invalid password/);

    const steps = getRunSteps(db, runId);
    expect(steps.map((s) => s.status)).toEqual(['failed', 'failed', 'failed']);
    expect(steps[0].error_message).toMatch(/Invalid password/);
    expect(getRuns(db)[0].status).toBe('failed');
    expect(fb.browser.close).toHaveBeenCalled();
    expect(deps.powerSaveBlocker!.stop).toHaveBeenCalledWith(1);
  });

  it("stores the action's real error message, not a generic one", async () => {
    deps.createTemplate = vi.fn(async () => ({ success: false, alreadyExists: false, error: 'Save button not found' }));
    const runner = makeRunner();
    const runId = await runner.run({ ...baseConfig(), practices: practices.slice(0, 1) }).catch(() => runner.currentRunId);

    const [step] = getRunSteps(db, runId);
    expect(step.status).toBe('failed');
    expect(step.error_message).toMatch(/Save button not found/);
    expect(deps.createTemplate).toHaveBeenCalledTimes(2); // one retry
  });

  it('delete: notFound → skipped, other failure → failed with its message', async () => {
    deps.deleteTemplate = vi.fn(async (_page: any, _name: string) => ({ success: false, deletedCount: 0, notFound: true, error: 'No template' }));
    let runner = makeRunner();
    let runId = await runner.run({ ...baseConfig(), type: 'delete', practices: practices.slice(0, 1) });
    expect(getRunSteps(db, runId)[0].status).toBe('skipped');

    deps.deleteTemplate = vi.fn(async () => ({ success: false, deletedCount: 0, notFound: false, error: 'Dialog never appeared' }));
    runner = makeRunner();
    runId = await runner.run({ ...baseConfig(), type: 'delete', practices: practices.slice(0, 1) }).catch(() => runner.currentRunId);
    const [step] = getRunSteps(db, runId);
    expect(step.status).toBe('failed');
    expect(step.error_message).toMatch(/Dialog never appeared/);
  });

  it('aborts after N consecutive failures instead of burning time on every remaining practice', async () => {
    deps.maxConsecutiveFailures = 2;
    deps.createTemplate = vi.fn(async () => ({ success: false, alreadyExists: false, error: 'Session expired' }));
    const many = Array.from({ length: 8 }, (_, i) => ({ id: 1000 + i, name: `P${i}`, accurx_id: `ID${i}` }));
    const runner = makeRunner();

    const { runId, completion } = runner.launch({ ...baseConfig(), practices: many, concurrency: 1 });
    await expect(completion).rejects.toThrow(/consecutive failures/);

    const steps = getRunSteps(db, runId);
    expect(steps.filter((s) => s.status === 'failed')).toHaveLength(2);
    expect(steps.filter((s) => s.status === 'cancelled')).toHaveLength(6);
    expect(steps.find((s) => s.status === 'cancelled')!.error_message).toMatch(/consecutive failures/);
    expect(getRuns(db)[0].status).toBe('cancelled');
  });

  it('rejects an invalid config before starting the power-save blocker or a browser', () => {
    const runner = makeRunner();
    expect(() => runner.launch({ ...baseConfig(), practices: [] })).toThrow(/practice/i);
    expect(() => runner.launch({ ...baseConfig(), credentials: { username: '', password: '' } })).toThrow(/credential/i);
    expect(() => runner.launch({ ...baseConfig(), type: 'explode' as any })).toThrow(/type/i);
    expect(deps.powerSaveBlocker!.start).not.toHaveBeenCalled();
  });

  it('emits at most one change-detected event per run', async () => {
    const runner1 = makeRunner();
    await runner1.run(baseConfig());
    fb = fakeBrowser();
    (fb.pages as any).contentOverride = true;
    deps.launchBrowser = async () => ({
      ...fb.browser,
      newContext: async () => ({
        newPage: async () => { const p = await fb.context.newPage(); p.content = async () => '<html>different</html>'; return p; },
        close: async () => {},
      }),
    }) as any;
    const runner2 = makeRunner();
    await runner2.run(baseConfig());

    const changes = events.events.filter((e) => e.channel === 'automation:change-detected');
    expect(changes).toHaveLength(1);
  });

  it('progress events carry the account label and the run id', async () => {
    const runner = makeRunner();
    const runId = await runner.run(baseConfig());
    const progress = events.events.filter((e) => e.channel === 'automation:progress');
    expect(progress).toHaveLength(3);
    expect(progress[0].payload).toMatchObject({ runId, accountLabel: 'Account A', total: 3 });
    const complete = events.events.find((e) => e.channel === 'automation:complete');
    expect(complete?.payload).toMatchObject({ runId, accountLabel: 'Account A', summary: { successCount: 3, failCount: 0 } });
  });
});
