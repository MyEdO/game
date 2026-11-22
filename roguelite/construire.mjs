// Construit l'hôte roguelite pour le navigateur : `dist/noyau.js` (la façade du noyau, `src/combat.ts`, et tout ce
// qu'elle tire du dépôt), `dist/jeu.js` (l'interface et la boucle de jeu), qui importe la façade par `./noyau.js`,
// la page, le kit des maquettes (`kit.css`) et ses deux illustrations.
// Usage : node roguelite/construire.mjs
import { build } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const dist = join(ici, 'dist');
mkdirSync(dist, { recursive: true });
const commun = { bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, legalComments: 'none', logLevel: 'warning' };

await build({ ...commun, entryPoints: [join(ici, 'src/combat.ts')], outfile: join(dist, 'noyau.js') });
await build({
  ...commun,
  entryPoints: [join(ici, 'src/main.ts')],
  outfile: join(dist, 'jeu.js'),
  plugins: [{
    name: 'facade-du-noyau',
    setup(b) {
      b.onResolve({ filter: /^\.\/combat$/ }, () => ({ path: './noyau.js', external: true }));
    },
  }],
});
for (const [de, vers] of [['index.html', 'index.html'], ['kit.css', 'kit.css'], ['illustrations/hameau.jpg', 'hameau.jpg'], ['illustrations/bivouac.jpg', 'bivouac.jpg']]) copyFileSync(join(ici, de), join(dist, vers));
