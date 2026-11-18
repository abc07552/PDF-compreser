/** Public files must resolve inside the project site, not the github.io account root.
 * Production workers live under assets/; Vite development workers live under src/.
 * The document shell uses hash routing, so its base URI remains the install directory.
 */
export function assetUrl(file: string): string {
  const base = import.meta.env.DEV
    ? new URL(import.meta.env.BASE_URL, self.location.origin)
    : typeof document === 'undefined'
      ? new URL('../', self.location.href)
      : document.baseURI;
  return new URL(file, base).href;
}
