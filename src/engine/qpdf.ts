interface Wasm {
  callMain(args: string[]): number;
  FS: {
    writeFile(path: string, bytes: Uint8Array): void;
    readFile(path: string): Uint8Array;
    unlink(path: string): void;
  };
}
let instance: Promise<Wasm> | undefined;
let errors: string[] = [],
  stdout: string[] = [];
async function getModule() {
  if (!instance) {
    const url = new URL('/vendor/qpdf.mjs', self.location.origin).href;
    instance = import(/* @vite-ignore */ url).then(({ default: factory }) =>
      factory({
        noInitialRun: true,
        locateFile: () => '/vendor/qpdf.wasm',
        print: (s: string) => {
          if (stdout.length < 10) stdout.push(s);
        },
        printErr: (s: string) => {
          if (errors.length < 20) errors.push(s);
        },
      }),
    );
  }
  return instance!;
}
/** Probes do not try any passwords. In the WASM CLI an encrypted object-stream file may
 * return the normal invalid-password exit instead of the --is-encrypted special exit. */
export async function encryptedState(bytes: Uint8Array, password?: string) {
  const m = await getModule();
  errors = [];
  stdout = [];
  try {
    m.FS.writeFile('/probe.pdf', bytes);
    const rc = m.callMain([
      ...(password ? [`--password=${password}`] : []),
      '--is-encrypted',
      '/probe.pdf',
    ]);
    return rc === 0 || errors.some((s) => /invalid password/i.test(s));
  } finally {
    m.FS.unlink('/probe.pdf');
    errors = [];
    stdout = [];
  }
}
export async function authenticatedPageCount(bytes: Uint8Array, password: string) {
  const m = await getModule();
  errors = [];
  stdout = [];
  try {
    m.FS.writeFile('/probe.pdf', bytes);
    const rc = m.callMain([`--password=${password}`, '--show-npages', '/probe.pdf']);
    if (rc !== 0) throw Error('Could not verify the protected output.');
    return Number(stdout.join('').trim());
  } finally {
    m.FS.unlink('/probe.pdf');
    errors = [];
    stdout = [];
  }
}
/** One short-lived worker owns its WASM heap; document bytes never touch a server or disk. */
export async function qpdf(
  inputs: Uint8Array[],
  args: string[],
  output = true,
): Promise<Uint8Array> {
  const m = await getModule();
  errors = [];
  stdout = [];
  const paths = inputs.map((_, i) => `/in${i}.pdf`);
  try {
    inputs.forEach((b, i) => m.FS.writeFile(paths[i], b));
    const rc = m.callMain([...args]);
    if (rc !== 0 && (rc !== 3 || !output)) {
      const msg = errors.join(' ');
      throw Error(
        /password|encrypted/i.test(msg)
          ? 'The password is incorrect or the PDF cannot be unlocked.'
          : 'The PDF engine could not validate this document. It may be damaged or unsupported.',
      );
    }
    return output ? m.FS.readFile('/out.pdf') : new Uint8Array();
  } finally {
    for (const p of [...paths, '/out.pdf']) {
      try {
        m.FS.unlink(p);
      } catch {
        /* File may not have been created. */
      }
    }
    errors = [];
    stdout = [];
  }
}
export const optimizeArgs = [
  '--object-streams=generate',
  '--compress-streams=y',
  '--recompress-flate',
  '--compression-level=9',
  '--remove-unreferenced-resources=yes',
  '--remove-info',
  '--remove-metadata',
];
