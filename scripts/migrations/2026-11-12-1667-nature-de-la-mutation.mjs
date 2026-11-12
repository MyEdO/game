/**
 * Migration #1667 lot C-a — le seuil de mutation physique `species[].mutationBodyMax` (porté par l'ESPÈCE,
 * recopié sur toutes les espèces d'une race) devient les documents TABLE de `mutation-nature.json`, famille
 * `entite`, au patron de la migration #3578 L4 (`2026-11-11-3578-especes-aleatoires.mjs`) : un document par
 * race, son dé `d100`, des rangées `{ id: 'physique' | 'mentale', min, max }`.
 *
 *   id                              race           physique   mentale   source
 *   `mutation-nature-humain`        humain         01-50      51-100    LDB 19 l.76-81
 *   `mutation-nature-halfling`      halfling       01-10      11-100    LDB 19 l.76-81
 *   `mutation-nature-nain`          nain           01-05      06-100    LDB 19 l.76-81
 *   `mutation-nature-haut-elfe`     haut-elfe      -          01-100    LDB 19 l.76-81
 *   `mutation-nature-elfe-sylvain`  elfe-sylvain   -          01-100    LDB 19 l.76-81
 *   `mutation-nature-ogre`          ogre           01-10      11-100    ADE II 02 l.172-177
 *   `mutation-nature-gnome`         gnome          01-50      51-100    NADJ 15 l.173
 *
 * Entrées : src/data/species.json (lue et écrite : `mutationBodyMax` retiré), src/data/mutation-nature.json
 * (écrite).
 *
 * FORME D'AVANT SEULE : un `species.json` dont aucune entrée ne porte `mutationBodyMax` est laissé tel quel
 * (rejeu sur l'arbre migré : no-op byte-identique). ARRÊT nominatif (exit 1), AUCUNE écriture : un fichier non
 * canonique, `mutation-nature.json` déjà présent alors que `species.json` porte encore `mutationBodyMax`, une
 * espèce dont le seuil contredit la bande physique de sa race (`refChar`), une race d'espèce qu'aucun document ne
 * tire.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SPECIES = join(ROOT, 'src/data/species.json');
const TABLE = join(ROOT, 'src/data/mutation-nature.json');

const LDB = { book: 'livre-de-base', page: 183, note: 'Tableau corps ou esprit, LDB 19 l.76-81' };
const document = (race, libelle, physiqueMax, source) => ({
  id: `mutation-nature-${race}`, type: 'mutation-nature', label: `Corps ou esprit — ${libelle}`, race, die: 'd100', source,
  entries: [
    ...(physiqueMax > 0 ? [{ id: 'physique', min: 1, max: physiqueMax }] : []),
    { id: 'mentale', min: physiqueMax + 1, max: 100 },
  ],
});
const DOCUMENTS = [
  document('humain', 'Humain', 50, LDB),
  document('halfling', 'Halfling', 10, LDB),
  document('nain', 'Nain', 5, LDB),
  document('haut-elfe', 'Haut-elfe', 0, LDB),
  document('elfe-sylvain', 'Elfe sylvain', 0, LDB),
  document('ogre', 'Ogre', 10, { book: 'archives-de-l-empire-2', page: 18, note: 'Ogres et Mutations, ADE II 02 l.172-177' }),
  document('gnome', 'Gnome', 50, { book: 'nuits-agitees-et-dures-journees', page: 91, note: 'Gnomes et Corruption, NADJ 15 l.173' }),
];

const arrets = [];
const brut = readFileSync(SPECIES, 'utf8');
const species = JSON.parse(brut);
const porteurs = species.filter((s) => 'mutationBodyMax' in s);
if (brut !== serializeDataset(species)) arrets.push('species.json : forme non canonique');
if (porteurs.length) {
  if (existsSync(TABLE)) arrets.push('mutation-nature.json : déjà présent alors que species.json porte encore `mutationBodyMax`');
  const parRace = new Map(DOCUMENTS.map((d) => [d.race, d]));
  for (const s of species) {
    const d = parRace.get(s.refChar);
    if (!d) { arrets.push(`species.json › ${s.id} : aucun document ne tire sa race « ${s.refChar} »`); continue; }
    const physiqueMax = d.entries.find((r) => r.id === 'physique')?.max ?? 0;
    if ((s.mutationBodyMax ?? 50) !== physiqueMax) arrets.push(`species.json › ${s.id} : seuil ${s.mutationBodyMax ?? 50} ≠ bande physique ${physiqueMax} de ${d.id}`);
  }
  if (!arrets.length) {
    writeFileSync(TABLE, serializeDataset(DOCUMENTS), 'utf8');
    writeFileSync(SPECIES, serializeDataset(species.map(({ mutationBodyMax: _seuil, ...s }) => s)), 'utf8');
    console.log(`migration 1667 C-a : ${DOCUMENTS.length} table(s) écrites dans mutation-nature.json, \`mutationBodyMax\` retiré de ${porteurs.length} espèce(s).`);
  }
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
if (!porteurs.length) console.log('migration 1667 C-a : aucun `mutationBodyMax` dans species.json, rien à faire.');
