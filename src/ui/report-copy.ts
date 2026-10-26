export const REPORT_COPY_TIMEOUT_MS = 5000;
export type ReportCopyResult = 'copied' | 'unavailable' | 'timeout' | 'cancelled';

function writeClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function copyReportText(
  text: string,
  signal: AbortSignal,
  writeText: (text: string) => Promise<void> = writeClipboard,
): Promise<ReportCopyResult> {
  if (signal.aborted) return Promise.resolve('cancelled');
  return new Promise((resolve) => {
    let finished = false;
    function finish(result: ReportCopyResult): void {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      resolve(result);
    }
    function cancel(): void {
      finish('cancelled');
    }
    const timer = setTimeout(() => finish('timeout'), REPORT_COPY_TIMEOUT_MS);
    signal.addEventListener('abort', cancel, { once: true });
    try {
      // Invoke before yielding so the browser still sees the user's click activation.
      // Cancellation ends our wait; the platform write itself cannot be withdrawn.
      Promise.resolve(writeText(text)).then(
        () => finish('copied'),
        () => finish('unavailable'),
      );
    } catch {
      finish('unavailable');
    }
  });
}
