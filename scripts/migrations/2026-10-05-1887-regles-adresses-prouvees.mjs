/**
 * Migration #1887 lot 6a-2c — les `regles` que `2026-09-28-1887-regles-desc-vers-descref.mjs` laisse
 * inline ADRESSENT leur prose : chacune adresse la plus petite unité adressable du livre qui CONTIENT
 * sa prose.
 *  - (A) ligne ou case de table → le tableau ENTIER, légende comprise (`adresseDe`) : fiche
 *    `user-doctrine-regle-ligne-de-tableau-adresse-le-tableau-entier`, utilisateur, 2026-09-28 :
 *    « Le tableau entier (Recommandé) ».
 *  - (B) partie stricte d'un bloc de prose ou de liste → le BLOC entier : extension d'ingénierie,
 *    révisable, par analogie à la même fiche — elle ne couvre que les lignes de table.
 *
 * ENTRÉES :
 *   - `src/data/regles.json`  (le SEUL document écrit)
 *   - `Source/**`             (les chapitres du livre cité, lus par `scripts/source/lecteur-fs.mjs`)
 *   - `src/data/books.json`   (id de livre → dossier d'extraction, via `sigleDe`)
 *
 * TABLE FIGÉE (`ADRESSES`, mesurée le 2026-10-05) : `id → { ch, sec, secOcc, b0, b1 }`. Elle ne consomme
 * pas `judge` : un changement de son verdict ne fait pas rejouer la migration autrement. Chaque adresse est
 * PROUVÉE avant d'être écrite — résolution, contenance, unicité du lieu, plus petite unité (`prouver`,
 * `scripts/source/lieux.mjs`) — par le geste commun `migrerParAdressesFigees`
 * (`scripts/migrations/lib/adressesFigees.mjs`). Une preuve qui échoue : RIEN n'est écrit, sortie 1
 * nominative.
 *
 * `migrer(brut)` ne lit que le Source sur le disque : `src/data/regles-migration-fidelite.test.ts`
 * la rejoue sur la pré-image, `src/data/regles-adresses-prouvees.test.ts` prouve la table.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrerParAdressesFigees } from './lib/adressesFigees.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const FICHIER = 'src/data/regles.json';

/** Date de la mesure de la table. */
export const DATE_DE_LA_TABLE = '2026-10-05';

/** Table FIGÉE : l'adresse (chapitre, section, bornes) de chaque entrée, mesurée à `DATE_DE_LA_TABLE`. */
export const ADRESSES = Object.freeze({
  'main-secondaire': { ch: '14', sec: 'combat-sup-a-sup-deux-armes', secOcc: 1, b0: 1, b1: 1 },
  'viser-une-localisation': { ch: '14', sec: 'difficultes-de-combat', secOcc: 1, b0: 1, b1: 1 },
  viser: { ch: '14', sec: 'difficultes-de-combat', secOcc: 1, b0: 1, b1: 1 },
  'tir-en-mouvement': { ch: '14', sec: 'difficultes-de-combat', secOcc: 1, b0: 1, b1: 1 },
  'ragot-au-marche': { ch: '59', sec: 'interpreter-les-seances-d-achats', secOcc: 1, b0: 1, b1: 1 },
  'surincantation-des-sorts-d-augure': { ch: '03', sec: 'table-de-surincantation-des-sorts-d-augure', secOcc: 1, b0: 0, b1: 0 },
  'maladresse-tableau-des-oups': { ch: '14', sec: 'maladresses', secOcc: 1, b0: 1, b1: 1 },
  'attaque-de-flanc-ou-de-dos': { ch: '14', sec: 'difficultes-de-combat', secOcc: 1, b0: 1, b1: 1 },
  'cible-en-contrebas': { ch: '14', sec: 'difficultes-de-combat', secOcc: 1, b0: 1, b1: 1 },
  'cible-dissimulee': { ch: '14', sec: 'difficultes-de-combat', secOcc: 1, b0: 1, b1: 1 },
  'navigation-derive': { ch: '07', sec: 'notes', secOcc: 1, b0: 0, b1: 0 },
  'navigation-louvoyage': { ch: '07', sec: 'notes', secOcc: 1, b0: 0, b1: 0 },
  'navigation-chavirage': { ch: '07', sec: 'notes', secOcc: 1, b0: 0, b1: 0 },
  'navigation-greement': { ch: '07', sec: 'notes', secOcc: 1, b0: 0, b1: 0 },
});

/**
 * Migre le TEXTE d'un `regles.json` par une table figée — celle de ce fichier par défaut ; sur panne, le
 * texte rendu est l'entrée intacte.
 * @param {string} brut
 * @param {Readonly<Record<string, { ch: string, sec: string, secOcc: number, b0: number, b1: number, ajoute?: object[] }>>} [adresses]
 */
export const migrer = (brut, adresses = ADRESSES) => migrerParAdressesFigees(brut, adresses, FICHIER);

if (import.meta.main) {
  const cible = path.join(ROOT, FICHIER);
  const brut = readFileSync(cible, 'utf8');
  const { texte, gestes, restantes, echecs } = migrer(brut);
  console.log(`${FICHIER} — ${gestes.length} adressée(s), ${restantes.length} hors table`);
  for (const g of gestes) console.log(`  ${g.id.padEnd(40)} ${g.adresse}`);
  for (const r of restantes) console.log(`  · ${r}`);
  if (echecs.length) {
    console.error(`\nPANNE — ${echecs.length} adresse(s) refusée(s), RIEN n'a été écrit :`);
    for (const e of echecs) console.error(`  ${e}`);
    process.exit(1);
  }
  if (texte !== brut) writeFileSync(cible, texte, 'utf8');
  console.log(`\nRemplacements écrits : ${gestes.length}`);
}
