// Le lot de recettes du roguelite sur la construction (`npm run roguelite:construire`) : chaque recette de `RECETTES`
// jouée dans son processus, sur la partie fixe (`partie-fixe.ts`) et avec ses captures sous `dist/roguelite-recette/`
// (ignoré par git). Rend 1 si une recette échoue.
// Usage : npm run roguelite:recette
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = fileURLToPath(new URL('.', import.meta.url));
const CAPTURES = join(ici, '../../../dist/roguelite-recette');
const FIXE = join(CAPTURES, 'partie-fixe.json');
/** Les recettes du lot, chacune sur la partie fixe. */
const RECETTES = ['parcours', 'partie', 'debords', 'rejeu', 'socle', 'images'];

mkdirSync(CAPTURES, { recursive: true });
const fixe = spawnSync(process.execPath, ['--import', 'tsx', join(ici, 'partie-fixe.ts')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
if (fixe.status !== 0) process.exit(1);
writeFileSync(FIXE, fixe.stdout);
const echecs = RECETTES.filter((nom) => {
  const debut = Date.now();
  console.log(`— ${nom}`);
  const { status } = spawnSync(process.execPath, [join(ici, `${nom}.mjs`), CAPTURES, FIXE], { stdio: 'inherit' });
  console.log(`— ${nom} : ${status === 0 ? 'vert' : `rouge (${status})`}, ${Math.round((Date.now() - debut) / 1000)} s`);
  return status !== 0;
});
console.log(echecs.length ? `recettes rouges : ${echecs.join(', ')}` : `${RECETTES.length} recettes vertes`, `· captures : ${CAPTURES}`);
process.exit(echecs.length ? 1 : 0);
