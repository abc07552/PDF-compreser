import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { zipSync } from 'fflate';
import { createHash } from 'node:crypto';
// Allowlist the material delivered. Never include local signing credentials or user files.
const roots = [
  'README.md',
  'THIRD_PARTY_NOTICES.md',
  '.gitignore',
  '.prettierignore',
  '.prettierrc.json',
  '.github/workflows',
  'package.json',
  'package-lock.json',
  'index.html',
  'vite.config.ts',
  'tsconfig.json',
  'playwright.config.mjs',
  'src',
  'scripts',
  'tests',
  'docs',
  'public/art/compression-engine.webp',
  'public/mark.svg',
  'public/manifest.webmanifest',
  'public/icon-192.png',
  'public/icon-512.png',
  'public/QPDF-NOTICE.txt',
  'android/gradle',
  'android/gradlew',
  'android/gradlew.bat',
  'android/gradle.properties',
  'android/settings.gradle.kts',
  'android/build.gradle.kts',
  'android/app/build.gradle.kts',
  'android/app/proguard-rules.pro',
  'android/app/src',
];
const archive = {};
const root = 'PDF-MB-Reducer-AI-PRO/';
async function add(path) {
  const s = await stat(path);
  if (s.isDirectory()) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (!entry.isSymbolicLink()) await add(path + '/' + entry.name);
    }
  } else if (!/\.(keystore|jks)$|(?:^|\/)(local|keystore)\.properties$/.test(path))
    archive[root + path] = [
      await readFile(path),
      { os: 3, attrs: (path === 'android/gradlew' ? 0o100755 : 0o100644) << 16 },
    ];
}
for (const path of roots) await add(path);
const bytes = zipSync(archive, { level: 6 });
const name = 'PDF-MB-Reducer-AI-PRO-source.zip';
await mkdir('deliverables', { recursive: true });
await writeFile('deliverables/' + name, bytes);
await writeFile(
  'deliverables/SHA256SUMS.txt',
  createHash('sha256').update(bytes).digest('hex') + '  ' + name + '\n',
);
console.log(
  `Complete source and prebuilt offline Android assets: deliverables/${name} (${(bytes.length / 1048576).toFixed(2)} MB).`,
);
