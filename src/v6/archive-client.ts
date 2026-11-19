import { dispatch } from '../engine/client';
import type { Output } from '../engine/types';
import type { readBackup } from './archives';
import type { ArchiveJob } from './archive-worker';
export const archiveJob = <J extends ArchiveJob>(job: J, signal: AbortSignal) =>
  dispatch<J extends { type: 'restore' } ? Awaited<ReturnType<typeof readBackup>> : Output>(
    () => new Worker(new URL('./archive-worker.ts', import.meta.url), { type: 'module' }),
    job,
    signal,
  );
