// Dashboard fallback for deployments without a CLI login. Generates exact single-file sources.
const fs = require('node:fs');
const path = require('node:path');
const base = 'supabase/functions';
const read = name => fs.readFileSync(path.join(base, name), 'utf8').replace(/^import .* from ['"]\..*['"];\r?\n/gm, '');
fs.mkdirSync('.expo/deletion-deploy', { recursive: true });
for (const name of ['delete-post', 'deletion-worker', 'delete-account', 'account-deletion-status']) {
  const helpers = name === 'deletion-worker' ? ['photo-cleanup', 'account-cleanup'] : name === 'delete-post' ? ['photo-cleanup'] : ['account-receipt'];
  const source = [read('_shared/runtime.ts'), ...helpers.map(helper => read(`_shared/${helper}.ts`)), read(name + '/index.ts').replace(/^import \{ createClient \} from 'npm:.*';\r?\n/gm, '')].join('\n');
  fs.writeFileSync(`.expo/deletion-deploy/${name}.txt`, source);
  console.log(`Prepared ${name} from checked-in source`);
}
