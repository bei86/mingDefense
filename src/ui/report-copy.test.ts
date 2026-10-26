import { afterEach, expect, test, vi } from 'vitest';
import { copyReportText, REPORT_COPY_TIMEOUT_MS } from './report-copy';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test('在当前调用栈写入准确全文，成功才返回copied，并清理计时器', async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, 'removeEventListener');
  const write = vi.fn(() => Promise.resolve());
  const promise = copyReportText('中文\n完整战报', controller.signal, write);
  expect(write).toHaveBeenCalledExactlyOnceWith('中文\n完整战报');
  expect(await promise).toBe('copied');
  expect(vi.getTimerCount()).toBe(0);
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
});

test.each(['reject', 'throw'] as const)('%s返回unavailable且不重试', async (mode) => {
  vi.useFakeTimers();
  const write = vi.fn(() => {
    if (mode === 'throw') throw Error('blocked');
    return Promise.reject(Error('denied'));
  });
  expect(await copyReportText('text', new AbortController().signal, write)).toBe('unavailable');
  expect(write).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

test('浏览器Clipboard API缺失时允许手动复制', async () => {
  vi.stubGlobal('navigator', {});
  expect(await copyReportText('text', new AbortController().signal)).toBe('unavailable');
});

test('保留Clipboard方法接收者并且只写不读', async () => {
  const clipboard = {
    writeText: vi.fn(function (this: unknown, text: string) {
      expect(this).toBe(clipboard);
      expect(text).toBe('text');
      return Promise.resolve();
    }),
    readText: vi.fn(() => Promise.reject(Error('must not read'))),
  };
  vi.stubGlobal('navigator', { clipboard });
  expect(await copyReportText('text', new AbortController().signal)).toBe('copied');
  expect(clipboard.readText).not.toHaveBeenCalled();
});

test('永久挂起只等5000ms，不假报成功且释放计时器和监听', async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, 'removeEventListener');
  const write = vi.fn(() => new Promise<void>(() => {}));
  const done = vi.fn();
  const result = copyReportText('text', controller.signal, write);
  void result.then(done);
  await vi.advanceTimersByTimeAsync(REPORT_COPY_TIMEOUT_MS - 1);
  expect(done).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(await result).toBe('timeout');
  expect(done).toHaveBeenCalledExactlyOnceWith('timeout');
  expect(write).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
});

test.each(['resolve', 'reject'] as const)(
  '超时后迟到%s不改变结果或产生未处理拒绝',
  async (mode) => {
    vi.useFakeTimers();
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const pending = new Promise<void>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    const done = vi.fn();
    const result = copyReportText('text', new AbortController().signal, () => pending);
    void result.then(done);
    await vi.advanceTimersByTimeAsync(REPORT_COPY_TIMEOUT_MS);
    if (mode === 'resolve') resolve();
    else reject(Error('late'));
    await Promise.resolve();
    expect(await result).toBe('timeout');
    expect(done).toHaveBeenCalledExactlyOnceWith('timeout');
    expect(vi.getTimerCount()).toBe(0);
  },
);

test('预先取消不触发平台写入', async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  controller.abort();
  const write = vi.fn(() => Promise.resolve());
  expect(await copyReportText('text', controller.signal, write)).toBe('cancelled');
  expect(write).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

test('进行中取消立即结束等待，迟到成功不能改写结果', async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  let resolve!: () => void;
  const pending = new Promise<void>((yes) => {
    resolve = yes;
  });
  const result = copyReportText('text', controller.signal, () => pending);
  controller.abort();
  expect(await result).toBe('cancelled');
  resolve();
  await Promise.resolve();
  expect(await result).toBe('cancelled');
  expect(vi.getTimerCount()).toBe(0);
});
