/**
 * Migration #3578 L4 — la borne haute d100 `species[].rand` (portée par l'ENTITÉ, partagée par toutes les
 * espèces d'une race) devient les documents TABLE de `especes-aleatoires.json`, famille `entite`, au patron
 * de la migration L1 (`2026-11-10-3578-talents-aleatoires.mjs`) : un document par table imprimée, une rangée
 * `{ id, min, max }` qui désigne l'espèce NOMINALE de sa race (LDB 04 l.93-101).
 *
 *   id                     source                                      bornes
 *   `races-ldb`            LDB 04 l.93-101                             01-90 / 91-94 / 95-98 / 99 / 00
 *   `races-gnome`          NADJ 14 l.66-75                             01-89 / 90-93 / 94-97 / 98 gnomes / 99 / 00
 *   `races-ogre`           ADE II 02 l.112-121 (VO l.94-97)             01-89 / 90-93 / 94-97 / 98 ogres / 99 / 00
 *   `races-gnome-et-ogre`  maison (NADJ 14 l.70, VO d’ADE II l.95)    01-88 / 89-92 / 93-96 / 97 gnomes / 98 ogres / 99 / 00
 *
 * La VF d'ADE II (02 l.112-121) a perdu la colonne d100 : ses bornes se prennent à la VO (nombres seuls, fiche
 * `user-doctrine-vo-fournit-la-donnee-mecanique-absente-de-la-vf`). L'Ogre devient une espèce gatée par la règle
 * optionnelle `creation-ogre-jouable` (ADE II 02 l.110), comme le Gnome (NADJ 14 l.5).
 *
 * Entrées : src/data/species.json (lue et écrite : `rand` retiré, `gatedByRule` posé sur `ogres`),
 * src/data/especes-aleatoires.json (écrite).
 *
 * FORME D'AVANT SEULE : un `species.json` dont aucune entrée ne porte `rand` est laissé tel quel (rejeu sur
 * l'arbre migré : no-op byte-identique). ARRÊT nominatif (exit 1), AUCUNE écriture : un fichier non
 * canonique, `especes-aleatoires.json` déjà présent alors que `species.json` porte encore `rand`, une rangée
 * qui désigne une espèce inconnue, une race d'espèce (`refChar`) qu'aucune table ne tire, `ogres` déjà gatée
 * par une autre règle.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SPECIES = join(ROOT, 'src/data/species.json');
const TABLE = join(ROOT, 'src/data/especes-aleatoires.json');
const REGLE_OGRE = 'creation-ogre-jouable';

const rangees = (bornes) => bornes.map(([id, min, max]) => ({ id, min, max }));
const DOCUMENTS = [
  {
    id: 'races-ldb', type: 'especes-aleatoires', label: 'Tableau des Races aléatoires', die: 'd100',
    source: { book: 'livre-de-base', page: 24, note: 'Tableau des Races aléatoires, LDB 04 l.93-101' },
    entries: rangees([['humains-reiklander', 1, 90], ['halflings', 91, 94], ['nains', 95, 98], ['hauts-elfes', 99, 99], ['elfes-sylvains', 100, 100]]),
  },
  {
    id: 'races-gnome', type: 'especes-aleatoires', label: 'Tableau des Races aléatoires — avec le Gnome', die: 'd100',
    source: { book: 'nuits-agitees-et-dures-journees', page: 87, note: 'Tableau des Races aléatoires, NADJ 14 l.66-75' },
    entries: rangees([['humains-reiklander', 1, 89], ['halflings', 90, 93], ['nains', 94, 97], ['gnomes', 98, 98], ['hauts-elfes', 99, 99], ['elfes-sylvains', 100, 100]]),
  },
  {
    id: 'races-ogre', type: 'especes-aleatoires', label: 'Tableau des Races aléatoires — avec l’Ogre', die: 'd100',
    source: { book: 'archives-de-l-empire-2', page: 18, note: 'Tableau des Races aléatoires, ADE II 02 l.112-121 ; la VF a perdu la colonne 1d100, bornes prises à la VO (« Grabbing a Bite », l.94-97)' },
    entries: rangees([['humains-reiklander', 1, 89], ['halflings', 90, 93], ['nains', 94, 97], ['ogres', 98, 98], ['hauts-elfes', 99, 99], ['elfes-sylvains', 100, 100]]),
  },
  {
    id: 'races-gnome-et-ogre', type: 'especes-aleatoires', label: 'Tableau des Races aléatoires — avec le Gnome et l’Ogre', die: 'd100',
    source: { book: 'nuits-agitees-et-dures-journees', page: 87, note: 'Tableaux des Races aléatoires, NADJ 14 l.66-75 et ADE II 02 l.112-121 (bornes de la VO « Grabbing a Bite », l.94-97), fusionnés' },
    maison: 'NADJ 14 l.70 et la VO d’ADE II (« Grabbing a Bite », l.95) ôtent chacun 1 valeur à la seule plage Humain (LDB 04 l.97 : 01-90 → 01-89) pour leur race ; Halfling et Nain gardent 4 valeurs chacun et se décalent. Avec les deux races, Humain cède 2 valeurs.',
    entries: rangees([['humains-reiklander', 1, 88], ['halflings', 89, 92], ['nains', 93, 96], ['gnomes', 97, 97], ['ogres', 98, 98], ['hauts-elfes', 99, 99], ['elfes-sylvains', 100, 100]]),
  },
];

const arrets = [];
const brut = readFileSync(SPECIES, 'utf8');
const species = JSON.parse(brut);
const porteurs = species.filter((s) => 'rand' in s);
if (brut !== serializeDataset(species)) arrets.push('species.json : forme non canonique');
if (porteurs.length) {
  if (existsSync(TABLE)) arrets.push('especes-aleatoires.json : déjà présent alors que species.json porte encore `rand`');
  const parId = new Map(species.map((s) => [s.id, s]));
  const tirees = new Set();
  for (const d of DOCUMENTS) {
    for (const r of d.entries) {
      const s = parId.get(r.id);
      if (!s) arrets.push(`${d.id} : la rangée ${r.min}-${r.max} désigne l'espèce inconnue « ${r.id} »`);
      else tirees.add(s.refChar);
    }
  }
  for (const s of species) if (!tirees.has(s.refChar)) arrets.push(`species.json › ${s.id} : aucune table ne tire sa race « ${s.refChar} »`);
  const ogre = parId.get('ogres');
  if (ogre?.gatedByRule && ogre.gatedByRule.id !== REGLE_OGRE) arrets.push(`species.json › ogres : déjà gatée par « ${ogre.gatedByRule.id} »`);
  if (!arrets.length) {
    const migrees = species.map(({ rand: _rand, ...s }) => (s.id === 'ogres' ? { ...s, gatedByRule: { id: REGLE_OGRE } } : s));
    writeFileSync(TABLE, serializeDataset(DOCUMENTS), 'utf8');
    writeFileSync(SPECIES, serializeDataset(migrees), 'utf8');
    console.log(`migration 3578 L4 : ${DOCUMENTS.length} table(s) écrites dans especes-aleatoires.json, \`rand\` retiré de ${porteurs.length} espèce(s), \`ogres\` gatée par « ${REGLE_OGRE} ».`);
  }
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
if (!porteurs.length) console.log('migration 3578 L4 : aucun `rand` dans species.json, rien à faire.');
