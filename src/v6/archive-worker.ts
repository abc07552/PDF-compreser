import { backup, readBackup, zipResults } from './archives';
import type { Output } from '../engine/types';
export type ArchiveJob =
  | { type: 'results'; outputs: Output[] }
  | { type: 'backup'; args: Parameters<typeof backup> }
  | { type: 'restore'; file: File };
self.onmessage = async (e: MessageEvent<ArchiveJob>) => {
  try {
    const j = e.data;
    const result =
      j.type === 'backup'
        ? await backup(...j.args)
        : j.type === 'restore'
          ? await readBackup(j.file)
          : await zipResults(j.outputs);
    self.postMessage({ type: 'done', result });
  } catch (e) {
    self.postMessage({
      type: 'error',
      message: (e as Error).message || 'Invalid workspace archive.',
    });
  }
};
