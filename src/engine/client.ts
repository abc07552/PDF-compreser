import type { Analysis, Job, Output, Progress } from './types';
/** One job owns one disposable worker and its memory. Used by PDF and archive operations. */
export function dispatch<R>(
  factory: () => Worker,
  job: unknown,
  signal?: AbortSignal,
  progress?: Progress,
): Promise<R> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Processing cancelled.', 'AbortError'));
      return;
    }
    const worker = factory();
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
      if (e.data.type === 'progress') progress?.(e.data.percent, e.data.stage, e.data.candidate);
      else if (e.data.type === 'error') fail(Error(e.data.message));
      else {
        clean();
        resolve(e.data.result);
      }
    };
    worker.onerror = () =>
      fail(Error('The local worker stopped. Try a smaller document or update your browser.'));
    try {
      worker.postMessage(job);
    } catch (e) {
      fail(e as Error);
    }
  });
}
export function runJob<J extends Job>(
  job: J,
  signal?: AbortSignal,
  progress?: Progress,
): Promise<J extends { type: 'analyze' } ? Analysis : Output> {
  return dispatch(
    () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
    job,
    signal,
    progress,
  );
}
