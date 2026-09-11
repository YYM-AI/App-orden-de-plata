import { readdir, readFile } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
const root = resolve('.');
async function check(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      await check(path);
      continue;
    }
    if (!/\.[cm]?[jt]sx?$/.test(path)) continue;
    const source = await readFile(path, 'utf8');
    for (const match of source.matchAll(/(?:from\s+|import\s*\()['"]([^'"]+)['"]/g)) {
      const target = match[1];
      if (
        /alerts/i.test(target) ||
        (target.startsWith('.') && relative(root, resolve(dirname(path), target)).startsWith('..'))
      ) {
        throw Error(`Import outside Patrimonio boundary: ${relative(root, path)}`);
      }
    }
  }
}
for (const folder of ['app', 'components', 'domain', 'data', 'persistence', 'server', 'database'])
  await check(resolve(folder));
console.log('PASS: Patrimonio imports remain inside its independent application boundary.');
