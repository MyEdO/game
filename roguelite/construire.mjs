// Construit l'hôte roguelite pour le navigateur : `dist/noyau.js` (la façade du noyau, `src/noyau/`, et tout ce
// qu'elle tire du dépôt), `dist/jeu.js` (l'interface et la boucle de jeu), qui importe la façade par `./noyau.js`,
// la page et le kit des maquettes (`kit.css`).
// Usage : node roguelite/construire.mjs
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const dist = join(ici, 'dist');
mkdirSync(dist, { recursive: true });
const commun = { bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, legalComments: 'none', logLevel: 'warning' };

await build({ ...commun, entryPoints: [join(ici, 'src/noyau/index.ts')], outfile: join(dist, 'noyau.js') });
await build({
  ...commun,
  entryPoints: [join(ici, 'src/main.ts')],
  outfile: join(dist, 'jeu.js'),
  plugins: [{
    name: 'facade-du-noyau',
    setup(b) {
      const facade = join(ici, 'src/noyau');
      b.onResolve({ filter: /(^|\/)noyau$/ }, (a) => (join(a.resolveDir, a.path) === facade ? { path: './noyau.js', external: true } : undefined));
    },
  }],
});
for (const f of ['index.html', 'kit.css']) copyFileSync(join(ici, f), join(dist, f));
// La page de recette (`recette/`) : la page enveloppée comme l'hôte des artefacts l'enveloppe, jamais publiée.
writeFileSync(join(dist, 'recette.html'), `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${readFileSync(join(ici, 'index.html'), 'utf8')}</body></html>`);
