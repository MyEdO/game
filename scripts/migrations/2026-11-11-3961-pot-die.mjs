/**
 * Migration #3961 — le dé du pot d'un jeu de taverne prend la forme UNIQUE du dé d'une table tirée, `die`
 * (`deDeTirageSchema`, `src/data/schemas/grammaire/valeurs.ts`), lue par `deDeLaTableTiree`
 * (`src/engine/tables.ts`). Le dé ne change pas, seule sa forme :
 *
 *   fichier              jeu         avant                                après
 *   `tavernGames.json`   `al-zahr`   `pot.dice: { count: 2, faces: 10 }`  `pot.die: '2d10'`  NADJ 16 l.17
 *
 * Entrée : src/data/tavernGames.json.
 *
 * `die` prend la place de `dice` dans le nœud `pot`. Un `pot` sans `dice` et à `die` égal à `APRES` : no-op.
 * Toute autre forme, un fichier non canonique ou une racine qui n'est pas une liste de `tavernGames` est un
 * ARRÊT nominatif (exit 1), AUCUNE écriture. Rejouée sur l'arbre migré : no-op byte-identique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { serializeDataset } from '../../src/data/serialize.ts';
import { estObjet } from '../../src/lib/objet.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FICHIER = 'tavernGames.json';
const AVANT = { count: 2, faces: 10 };
const APRES = '2d10';

const chemin = join(ROOT, 'src/data', FICHIER);
const brut = readFileSync(chemin, 'utf8');
const doc = JSON.parse(brut);
const arrets = [];
const gestes = [];

if (brut !== serializeDataset(doc)) arrets.push(`${FICHIER} : forme non canonique`);
else if (!Array.isArray(doc) || !doc.every((j) => estObjet(j) && j.type === 'tavernGames')) arrets.push(`${FICHIER} : racine qui n'est pas une liste de \`tavernGames\``);
else {
  for (const jeu of doc) {
    const { pot } = jeu;
    if (pot === undefined) continue;
    if (!estObjet(pot)) { arrets.push(`${FICHIER} › ${jeu.id}.pot : forme inattendue ${JSON.stringify(pot)}`); continue; }
    if (!('dice' in pot) && pot.die === APRES) continue;
    if ('die' in pot || !isDeepStrictEqual(pot.dice, AVANT)) { arrets.push(`${FICHIER} › ${jeu.id}.pot : forme inattendue ${JSON.stringify({ dice: pot.dice, die: pot.die })}`); continue; }
    jeu.pot = Object.fromEntries(Object.entries(pot).map(([k, v]) => (k === 'dice' ? ['die', APRES] : [k, v])));
    gestes.push(jeu.id);
  }
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
if (gestes.length) writeFileSync(chemin, serializeDataset(doc), 'utf8');
console.log(`migration 3961 (dé du pot en \`die\`) : ${gestes.length} geste(s)${gestes.length ? `, ${FICHIER} › ${gestes.join(', ')}` : ''}.`);
