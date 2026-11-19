import { compress } from './compress';
import { inspect, loadPDF } from './document';
import { transform } from './tools';
import { validateSelection, type Job } from './types';
self.onmessage = async (e: MessageEvent<Job>) => {
  try {
    const job = e.data,
      progress = (percent: number, stage: string, candidate?: number) =>
        self.postMessage({ type: 'progress', percent, stage, candidate });
    let result;
    if (job.type === 'analyze') {
      validateSelection([job.file]);
      result = await inspect(await loadPDF(new Uint8Array(await job.file.arrayBuffer())));
    } else if (job.type === 'compress') result = await compress(job.file, job.settings, progress);
    else result = await transform(job.tool, job.files, job.options, progress);
    self.postMessage({ type: 'done', result });
  } catch (e) {
    self.postMessage({
      type: 'error',
      message: e instanceof Error ? e.message : 'Document processing failed. Try a smaller file.',
    });
  }
};
