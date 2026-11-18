import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { fixtures } from './fixtures.mjs';
await fixtures();
const env = { ...process.env };
let tmp;
if (process.platform === 'linux' && process.arch === 'x64' && !env.BROWSER_EXECUTABLE) {
  const { default: serverless } = await import('@sparticuz/chromium');
  env.BROWSER_EXECUTABLE = await serverless.executablePath();
  tmp = await mkdtemp(path.join(tmpdir(), 'pdf-test-'));
  const tar = path.join(tmp, 'libs.tar');
  await writeFile(
    tar,
    brotliDecompressSync(await readFile('node_modules/@sparticuz/chromium/bin/al2023.tar.br')),
  );
  execFileSync('tar', ['xf', tar, '-C', tmp]);
  env.LD_LIBRARY_PATH = path.join(tmp, 'lib') + ':' + (env.LD_LIBRARY_PATH || '');
}
const proc = spawn(
  process.execPath,
  ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)],
  { env, stdio: 'inherit' },
);
const status = await new Promise((resolve) => proc.on('exit', resolve));
if (tmp) await rm(tmp, { recursive: true, force: true });
process.exitCode = status ?? 1;
