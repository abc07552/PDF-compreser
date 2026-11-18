import type { Analysis, Job, Output, Progress } from './types';
export function runJob<J extends Job>(
  job: J,
  signal?: AbortSignal,
  progress?: Progress,
): Promise<J extends { type: 'analyze' } ? Analysis : Output> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Processing cancelled.', 'AbortError'));
      return;
    }
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const clean = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      worker.terminate();
    };
    const fail = (e: Error) => {
      clean();
      reject(e);
    };
    const cancel = () =>
      fail(new DOMException('Processing cancelled. Your original is unchanged.', 'AbortError'));
    const timer = setTimeout(
      () =>
        fail(Error('The file exceeded the three-minute processing limit. Try a smaller document.')),
      180000,
    );
    signal?.addEventListener('abort', cancel, { once: true });
    worker.onmessage = (e) => {
      if (e.data.type === 'progress') progress?.(e.data.percent, e.data.stage);
      else if (e.data.type === 'error') fail(Error(e.data.message));
      else {
        clean();
        resolve(e.data.result);
      }
    };
    worker.onerror = () =>
      fail(Error('The local worker stopped. Try a smaller document or update your browser.'));
    worker.postMessage(job);
  });
}
