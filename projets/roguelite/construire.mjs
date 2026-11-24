// Construit l'hôte roguelite pour le navigateur, sous `dist/roguelite/` à la racine du dépôt (ignoré par git, hors de
// toute zone) : `noyau.js` (la façade du noyau, `src/noyau/`, et tout ce qu'elle tire du dépôt), `jeu.js` (l'interface
// et la boucle de jeu), qui importe la façade par `./noyau.js`, la page, sa feuille `jeu.css` et le kit des maquettes
// (`kit.css`).
// Usage : npm run roguelite:construire
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
/** Le dossier de la construction, que la recette sert. */
export const SORTIE = join(ici, '../../dist/roguelite');

if (import.meta.main) await construire();

/** Les paquets, la page et ses feuilles, sous `SORTIE`. */
async function construire() {
  mkdirSync(SORTIE, { recursive: true });
  const commun = { bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, legalComments: 'none', logLevel: 'warning' };

  await build({ ...commun, entryPoints: [join(ici, 'src/noyau/index.ts')], outfile: join(SORTIE, 'noyau.js') });
  await build({
    ...commun,
    entryPoints: [join(ici, 'src/main.ts')],
    outfile: join(SORTIE, 'jeu.js'),
    // La page est le point d'entrée de `main.ts` (`import.meta.main`).
    define: { 'import.meta.main': 'true' },
    plugins: [{
      name: 'facade-du-noyau',
      setup(b) {
        const facade = join(ici, 'src/noyau');
        b.onResolve({ filter: /(^|\/)noyau$/ }, (a) => (join(a.resolveDir, a.path) === facade ? { path: './noyau.js', external: true } : undefined));
      },
    }],
  });
  // La feuille du jeu : celle de chaque module de l'interface, à côté de lui, recollées dans l'ordre de la cascade.
  const FEUILLES = ['base', 'ecran', 'pieces', 'fiche', 'services', 'lieux', 'rejeu'];
  writeFileSync(join(SORTIE, 'jeu.css'), FEUILLES.map((f) => readFileSync(join(ici, `src/ui/${f}.css`), 'utf8')).join('\n'));
  for (const f of ['index.html', 'kit.css']) copyFileSync(join(ici, f), join(SORTIE, f));
  // La page de recette (`recette/`) : la page enveloppée comme l'hôte des artefacts l'enveloppe, jamais publiée.
  writeFileSync(join(SORTIE, 'recette.html'), `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${readFileSync(join(ici, 'index.html'), 'utf8')}</body></html>`);
}
