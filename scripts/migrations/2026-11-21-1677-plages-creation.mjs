/**
 * Migration #1677 — plages des quatre tables de création.
 *
 * ADE II 03 l.42-63, l.504-514 ; LDB 05 l.744-768 ; NADJ 15 l.86-104 ; ADE II 02 l.286-311.
 * Entrées : src/data/astrology.json, src/data/eyes.json, src/data/hairs.json, src/data/stars.json.
 * Les données déjà migrées sont laissées à l'octet. Toute anomalie de la forme historique
 * est signalée avant la moindre écriture.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { serializeDataset } from '../../src/data/serialize.ts';
import { estMonoTable, lignesDe } from './lib/monoTable.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const BORNES_COULEUR = [2, 3, 4, 7, 11, 14, 17, 18, 19, 20];

const TABLES = [
  { fichier: 'astrology.json', premier: 1, bornes: [2, 4, 6, 8, 10] },
  { fichier: 'eyes.json', die: { n: 2, sides: 10 }, premier: 2, bornes: BORNES_COULEUR },
  { fichier: 'hairs.json', die: { n: 2, sides: 10 }, premier: 2, bornes: BORNES_COULEUR },
  { fichier: 'stars.json', die: { n: 1, sides: 100 }, premier: 1, bornes: Array.from({ length: 20 }, (_, i) => (i + 1) * 5) },
];

const ETOILE_DU_SORCIER = new Map([
  ['l-etoile-du-sorcier-sixieme-sens', { min: 1, max: 3 }],
  ['l-etoile-du-sorcier-seconde-vue', { min: 4, max: 6 }],
  ['l-etoile-du-sorcier-magie-mineure', { min: 7, max: 9 }],
  ['l-etoile-du-sorcier-sorcier', { min: 10, max: 10 }],
]);

const CHEVEUX_GNOME = new Map([
  ['blond-roux', { bornePrincipale: 4, ancienneBorne: 6, plage: { min: 4, max: 6 } }],
  ['brun-dore', { bornePrincipale: 7, ancienneBorne: 10, plage: { min: 7, max: 10 } }],
  ['brun-clair', { bornePrincipale: 11, plage: { min: 11, max: 11 } }],
]);

function exiger(condition, message) {
  if (!condition) throw new Error(message);
}

function plagesDesBornes(bornes, premier) {
  let min = premier;
  const plages = new Map();
  for (const max of bornes) {
    plages.set(max, { min, max });
    min = max + 1;
  }
  return plages;
}

function convertirRangee(rangee, plage, gnome) {
  const convertis = [...Object.entries(plage)];
  if (gnome) convertis.push(['plageParRace', { gnome: gnome.plage }]);
  return Object.fromEntries(Object.entries(rangee).flatMap(([cle, valeur]) => {
    if (cle === 'rand') return convertis;
    if (cle === 'randByRace') return [];
    return [[cle, valeur]];
  }));
}

function actualiserNote(source) {
  if (typeof source?.note !== 'string') return source;
  const note = source.note
    .replace(" — d'où randByRace.gnome sur « blond-roux » (6) et « brun-dore » (10) (#420).", ' (#420).')
    .replace(' ⇒ pas de randByRace.ogre (#423).', ' (#423).');
  exiger(!note.includes('randByRace'), 'hairs.json › source.note : attribution historique inattendue');
  return { ...source, note };
}

function preparer({ fichier, premier, bornes, die }) {
  const chemin = join(RACINE, 'src/data', fichier);
  const brut = readFileSync(chemin, 'utf8');
  const doc = JSON.parse(brut);
  exiger(serializeDataset(doc) === brut, fichier + ' : forme non canonique');
  exiger(die ? estMonoTable(doc) : Array.isArray(doc), fichier + ' : enveloppe inattendue');
  const rangees = lignesDe(doc);
  exiger(rangees.every((r) => typeof r?.id === 'string'), fichier + ' : rangée sans identifiant');
  const anciensChamps = (r) => Object.hasOwn(r, 'rand') || Object.hasOwn(r, 'randByRace');
  if (!rangees.some(anciensChamps)) return null;

  const cheveux = fichier === 'hairs.json';
  const signes = fichier === 'stars.json';
  const cardinal = bornes.length + (signes ? ETOILE_DU_SORCIER.size - 1 : 0);
  if (die) exiger(isDeepStrictEqual(doc.die, die), fichier + ' : dé principal inattendu');
  if (signes) exiger(isDeepStrictEqual(doc.sub?.die, { n: 1, sides: 10 }), fichier + ' : dé du sous-tirage inattendu');

  const ids = new Set(rangees.map((r) => r.id));
  const plages = plagesDesBornes(bornes, premier);
  const vues = new Set(rangees.map((r) => r.rand));
  exiger(rangees.length === cardinal && ids.size === cardinal, fichier + ' : population historique inattendue (attendu ' + cardinal + ')');
  exiger(vues.size === bornes.length && bornes.every((borne) => vues.has(borne)), fichier + ' : bornes historiques inattendues');
  if (cheveux) exiger([...CHEVEUX_GNOME.keys()].every((id) => ids.has(id)), fichier + ' : rangées gnomes historiques manquantes');
  if (signes) exiger([...ETOILE_DU_SORCIER.keys()].every((id) => ids.has(id)), fichier + ' : variantes historiques manquantes');

  const entries = rangees.map((r) => {
    const site = fichier + ' › ' + r.id;
    const plage = plages.get(r.rand);
    exiger(plage && !['min', 'max', 'plageParRace'].some((cle) => Object.hasOwn(r, cle)), site + ' : mélange de champs historiques et canoniques');
    const gnome = cheveux ? CHEVEUX_GNOME.get(r.id) : undefined;
    if (gnome) exiger(r.rand === gnome.bornePrincipale, site + ' : borne principale historique inattendue');
    if (gnome?.ancienneBorne !== undefined) {
      exiger(isDeepStrictEqual(r.randByRace, { gnome: gnome.ancienneBorne }), site + ' : borne historique gnome inattendue');
    } else {
      exiger(!Object.hasOwn(r, 'randByRace'), site + ' : surcharge historique inattendue');
    }
    if (signes) {
      const sousPlage = ETOILE_DU_SORCIER.get(r.id);
      exiger((r.rand === 100) === (sousPlage !== undefined) && isDeepStrictEqual(r.sub, sousPlage), site + ' : sous-tirage historique inattendu');
    }
    return convertirRangee(r, plage, gnome);
  });

  let converti = die ? { ...doc, entries } : entries;
  if (cheveux) converti = { ...converti, source: actualiserNote(doc.source) };
  return { fichier, chemin, texte: serializeDataset(converti), cardinal };
}

let migrations;
try {
  migrations = TABLES.map(preparer).filter((m) => m !== null);
} catch (e) {
  console.error('Migration #1677, aucune écriture : ' + e.message);
  process.exit(1);
}

for (const m of migrations) {
  writeFileSync(m.chemin, m.texte, 'utf8');
  console.log(m.fichier + ' : ' + m.cardinal + ' rangées migrées');
}
console.log('Migration #1677 : ' + migrations.length + ' document(s) réécrit(s).');
