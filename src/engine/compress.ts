import { PDFName, PDFDict, PDFArray } from 'pdf-lib';
import { recolorPages } from './colors';
import { deduplicate, inspect, loadPDF, requireEditable, stripMetadata } from './document';
import { optimizeImages } from './images';
import { optimizeArgs, qpdf } from './qpdf';
import {
  exactBuffer,
  profile,
  stem,
  type Progress,
  type Settings,
  type Output,
  validateSelection,
} from './types';
export async function compress(file: File, s: Settings, progress: Progress): Promise<Output> {
  validateSelection([file]);
  if (
    ![72, 96, 120, 150, 200, 300].includes(s.dpi) ||
    !Number.isFinite(s.quality) ||
    !Number.isFinite(s.target) ||
    s.quality < 10 ||
    s.quality > 100 ||
    s.target > 1000 * 1024 * 1024 ||
    s.target < 0
  )
    throw Error('Choose a valid compression profile.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  progress(2, 'Reading document structure');
  let doc = await loadPDF(bytes);
  requireEditable(doc);
  const a = await inspect(doc),
    p = profile(s, a);
  const clarity = !!s.clarity || ['Clarity First', 'Government Form'].includes(s.preset);
  const form = doc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
  const fieldCount = form?.lookupMaybe(PDFName.of('Fields'), PDFArray)?.size();
  const formOnly = s.preset === 'Government Form' && !!form;
  const args = formOnly
    ? optimizeArgs
        .filter((a) => !a.startsWith('--remove-unreferenced-resources'))
        .concat('--remove-unreferenced-resources=no')
    : optimizeArgs;
  const geometry = doc
    .getPages()
    .map((page) => [page.getWidth(), page.getHeight(), page.getRotation().angle]);
  let best = bytes as Uint8Array,
    bestImages = 0,
    attempts = 0,
    applied = p.label;
  let losslessFits = false,
    bestDpi = 0,
    bestQuality = 100;
  const enhance = s.enhancement || 'Off';
  // Prefer an untouched visual representation if lossless packing already meets the target.
  if ((a.images && s.color === 'Color' && enhance === 'Off') || formOnly) {
    progress(5, 'Checking a lossless optimization');
    const structural = await qpdf([bytes], [...args, '/in0.pdf', '/out.pdf']);
    if (structural.length < best.length) {
      best = structural;
      applied = 'Lossless structure';
    }
    progress(5, 'Lossless candidate measured', best.length);
    losslessFits = !!s.target && best.length <= s.target;
  }
  const max =
    losslessFits || formOnly ? 0 : s.target && s.retry && a.images ? (s.exact ? 5 : 3) : 1;
  let previousProfile = '';
  for (let pass = 0; pass < max; pass++) {
    attempts++;
    if (pass) doc = await loadPDF(bytes);
    const update: Progress = (n, label) =>
      progress(
        5 + ((pass + n / 100) / max) * 88,
        pass ? `Retry ${pass} · ${label}` : label,
        best.length,
      );
    const dpi = Math.max(
        clarity ? 150 : 72,
        Math.round(p.dpi * (1 - pass * (s.exact ? 0.14 : 0.24))),
      ),
      quality = Math.max(clarity ? 78 : 10, p.quality - pass * (s.exact ? 9 : 17));
    if (previousProfile === `${dpi}:${quality}`) {
      attempts--;
      break;
    }
    previousProfile = `${dpi}:${quality}`;
    const n = await optimizeImages(doc, dpi, quality, s.color, update, enhance);
    await recolorPages(doc, s.color);
    update(68, 'Removing duplicate resources');
    await deduplicate(doc);
    stripMetadata(doc);
    update(76, 'Packing document objects');
    const serialized = await doc.save({
      useObjectStreams: true,
      updateFieldAppearances: false,
      objectsPerTick: 80,
    });
    const candidate = await qpdf([serialized], [...args, '/in0.pdf', '/out.pdf']);
    if (candidate.length < best.length) {
      best = candidate;
      bestImages = n;
      bestDpi = n ? dpi : 0;
      bestQuality = n ? quality : 100;
      applied = pass ? `${p.label} · ${dpi} DPI retry` : p.label;
    }
    if (!s.target || best.length <= s.target || !a.images) break;
  }
  progress(96, 'Validating output pages', best.length);
  const outputDoc = await loadPDF(best);
  const outputForm = outputDoc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
  if (
    formOnly &&
    (!outputForm || outputForm.lookupMaybe(PDFName.of('Fields'), PDFArray)?.size() !== fieldCount)
  )
    throw Error('Form validation failed. Your original is unchanged.');
  if (
    outputDoc.getPageCount() !== a.pages ||
    outputDoc
      .getPages()
      .some((page, i) =>
        [page.getWidth(), page.getHeight(), page.getRotation().angle].some(
          (v, k) => v !== geometry[i][k],
        ),
      )
  )
    throw Error('Page validation failed. Your original has not been changed.');
  await qpdf([best], ['--check', '/in0.pdf'], false);
  progress(100, 'Verified and ready');
  return {
    name: `${stem(file.name)}-compressed.pdf`,
    blob: new Blob([exactBuffer(best)], { type: 'application/pdf' }),
    pages: a.pages,
    report: {
      requestedTarget: s.target,
      requestedProfile: s.preset,
      color: s.color,
      dpi: bestDpi,
      quality: bestQuality,
      enhanced: enhance !== 'Off' ? bestImages : 0,
      clarityProtected: clarity,
      formProtected: formOnly,
      original: file.size,
      output: best.length,
      attempts: Math.max(1, attempts),
      unchanged: best === bytes,
      imagesOptimized: bestImages,
      targetMet: !s.target || best.length <= s.target,
      profile: applied,
      pages: a.pages,
    },
  };
}
