import { readFile, readdir } from 'node:fs/promises';
process.loadEnvFile('.env.local');
const secrets = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.DATABASE_URL].filter(Boolean);
if (secrets.length !== 2)
  throw Error('Configure the local environment before checking the private build.');
const forbidden = [
  ...secrets,
  'María Demo',
  '60240000',
  '52540000',
  '11111111-1111-4111-8111-111111111111',
];
let checked = 0;
async function scan(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = path + '/' + entry.name;
    if (entry.isDirectory()) await scan(file);
    else if (/\.(js|json|html|map)$/.test(file)) {
      const source = await readFile(file, 'utf8');
      checked++;
      if (forbidden.some((value) => source.includes(value)))
        throw Error(
          'Private build scan found a configured secret or canonical household payload in a public asset. Values were not printed.',
        );
    }
  }
}
await scan('.next/static');
console.log(
  `PASS: ${checked} public build assets contain no configured service/database credentials or canonical fixture payload markers.`,
);
