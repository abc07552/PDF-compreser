import { cp, rm, mkdir } from 'node:fs/promises';
const dest = 'android/app/src/main/assets/workspace';
await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
await cp('dist', dest, { recursive: true });
console.log('Offline workspace packaged for Android.');
