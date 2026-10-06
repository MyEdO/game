/**
 * Migration #1887 lot 6a-2b T3 — `regles:navigation-progression` ADRESSE sa prose : la phrase de MDG 13
 * l.66 et le tableau PROGRESSION l.68-75, par la relation de texte étendue (`aligner` : la séparatrice
 * est de la syntaxe, la bannière absorbée un habillage qui se saute).
 *
 * ENTRÉES :
 *   - `src/data/regles.json`  (le SEUL document écrit)
 *   - `Source/**`             (MDG 13, lu par `scripts/source/lecteur-fs.mjs`)
 *   - `src/data/books.json`   (id de livre → dossier d'extraction, via `sigleDe`)
 *
 * TABLE FIGÉE (`ADRESSES`, mesurée le 2026-10-06) : l'intervalle des blocs 4 (l.66) et 5 (la table) de
 * `irregularites-numeriques#1`, et l'`ajoute` CONSIGNÉ : la bannière `PROGRESSION` (l.68), que la desc
 * omet. La preuve est le geste commun `migrerParAdressesFigees` (`scripts/migrations/lib/adressesFigees.mjs`,
 * `prouver` de `scripts/source/lieux.mjs`) :
 * l'adresse résout, contient la desc avec cet `ajoute`, UN seul lieu du livre la contient (la suite des
 * blocs 4-5) et l'adresse en est la plus petite unité. Une preuve qui échoue : RIEN n'est écrit, sortie 1.
 *
 * IDEMPOTENT : une entrée adressée n'a plus de `desc`, elle est sautée. `src/data/regles-migration-fidelite.test.ts`
 * la rejoue sur la pré-image ; `src/data/regles-adresses-prouvees.test.ts` prouve sa table.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrerParAdressesFigees } from './lib/adressesFigees.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const FICHIER = 'src/data/regles.json';

/** Date de la mesure de la table. */
export const DATE_DE_LA_TABLE = '2026-10-06';

/** Table FIGÉE : l'adresse de l'entrée et l'`ajoute` de sa preuve, mesurés à `DATE_DE_LA_TABLE`. */
export const ADRESSES = Object.freeze({
  'navigation-progression': {
    ch: '13',
    sec: 'irregularites-numeriques',
    secOcc: 1,
    b0: 4,
    b1: 5,
    ajoute: [{ unite: 1, pos: { sec: 'irregularites-numeriques', secOcc: 1, rang: 5, ligne: 0 }, kind: 'ligne', habillage: true, cote: 'entiere' }],
  },
});

/**
 * Migre le TEXTE d'un `regles.json` par la table de ce fichier ; sur panne, le texte rendu est l'entrée intacte.
 * @param {string} brut
 */
export const migrer = (brut) => migrerParAdressesFigees(brut, ADRESSES, FICHIER);

if (import.meta.main) {
  const cible = path.join(ROOT, FICHIER);
  const brut = readFileSync(cible, 'utf8');
  const { texte, gestes, echecs } = migrer(brut);
  console.log(`${FICHIER} — ${gestes.length} adressée(s)`);
  for (const g of gestes) console.log(`  ${g.id.padEnd(40)} ${g.adresse}`);
  if (echecs.length) {
    console.error(`\nPANNE — ${echecs.length} adresse(s) refusée(s), RIEN n'a été écrit :`);
    for (const e of echecs) console.error(`  ${e}`);
    process.exit(1);
  }
  if (texte !== brut) writeFileSync(cible, texte, 'utf8');
  console.log(`\nRemplacements écrits : ${gestes.length}`);
}
