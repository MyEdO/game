/**
 * Migration #3578 L2a — la colonne `careers[].rand` (borne haute d100 par colonne d'espèce, portée par
 * l'ENTITÉ) devient les documents TABLE de `carrieres-aleatoires.json`, famille `entite`, au patron de la
 * migration L1 (`2026-11-10-3578-talents-aleatoires.mjs`). Une rangée `{ id, min, max }` désigne UNE carrière
 * (LDB 05 l.232, l.237) : celle du livre de la colonne ; `min` = la borne précédente + 1.
 *
 * Les carrières des suppléments que `rand` rangeait à la borne de leur carrière parente en sortent :
 *  - les 15 d'Aux Armes forment, par carrière parente, un document `variantes-<parente>` (`carriere` posée,
 *    plages du « Jet optionnel », AA 02 l.117-128) dont `colonnes` = celles de `COLONNES_AA` qui tirent la
 *    parente ;
 *  - les 4 de l'Annexe I de l'ADE I portent `aLaPlaceDe` = la carrière qu'elles remplacent (ADE I 07 l.11-23) ;
 *  - les 19 portent `races` (AA : race imprimée sous le titre de la carrière, VF ou VO « Up in Arms » ; ADE I
 *    07 l.11-23).
 *
 * Le REMPLACEMENT d'une Classe (MDG 09 l.9, `classes.json › remplace`) : sur une colonne qui tire les deux
 * Classes du couple, la base ne porte que la Classe remplacée, et la PORTION (document à `colonne`) porte
 * les rangées de la remplaçante, tirées de la même colonne sans la Classe remplacée. Une colonne qui ne tire
 * que l'une des deux (Norse) reste une base seule.
 *
 * Entrées : src/data/careers.json et src/data/classes.json (lues), src/data/careers.json (écrite, sans
 * `rand`), src/data/carrieres-aleatoires.json (écrite).
 *
 * FORME D'AVANT SEULE : un `careers.json` dont aucune entrée ne porte `rand` est laissé tel quel (rejeu sur
 * l'arbre migré : no-op byte-identique). ARRÊT nominatif (exit 1), AUCUNE écriture : un fichier non
 * canonique, `carrieres-aleatoires.json` déjà présent alors que `careers.json` porte encore `rand`, une
 * borne non entière, une colonne inconnue, une borne qui ne désigne pas exactement une carrière hors
 * suppléments, une carrière de supplément inconnue.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CAREERS = join(ROOT, 'src/data/careers.json');
const CLASSES = join(ROOT, 'src/data/classes.json');
const TABLE = join(ROOT, 'src/data/carrieres-aleatoires.json');

const LDB = { book: 'livre-de-base', page: 30, note: 'Tableau des Classes et Carrières aléatoires, LDB 05 l.214-299' };
const MIDDENHEIM = { book: 'middenheim', page: 148, note: 'Tableau des Classes et Carrières aléatoires, Middenheim 09 l.13-46, l.65-98' };
/** Les colonnes imprimées : id, libellé de la colonne, source. */
const COLONNES = [
  ['humain', 'Humain', LDB],
  ['halfling', 'Halfling', LDB],
  ['nain', 'Nain', LDB],
  ['gnome', 'Gnome', { book: 'nuits-agitees-et-dures-journees', page: 87, note: 'Tableau des Classes et Carrières aléatoires, NADJ 14 l.81-125' }],
  ['ogre', 'Ogre', { book: 'archives-de-l-empire-2', page: 18, note: 'Tableau des Classes et Carrières aléatoires, ADE II 02 l.128-154' }],
  ['haut-elfe', 'Haut elfe', LDB],
  ['elfe-sylvain', 'Elfe sylvain', LDB],
  ['middenheim', 'Middenheimer', MIDDENHEIM],
  ['middenland', 'Middenlander', MIDDENHEIM],
  ['nordland', 'Nordlander', MIDDENHEIM],
  ['norse', 'Norse', { book: 'mer-des-griffes', page: 57, note: 'Carrières norses, MDG 07 l.271-303' }],
];
const SOURCE_DES_PORTIONS = { book: 'mer-des-griffes', page: 64, note: 'La classe Côtier, MDG 09 l.9, l.21-30' };
const SOURCE_DES_VARIANTES = { book: 'aux-armes', page: 9, note: 'Nouvelles Carrières, Jet optionnel, AA 02 l.109-128' };
/** Portée d'AA (valeur d'adaptation #3578) : les colonnes où 62ec12bfc offrait ses carrières. */
const COLONNES_AA = ['humain', 'halfling', 'nain', 'haut-elfe', 'elfe-sylvain', 'middenheim', 'middenland', 'nordland'];

const H = ['humain'];
const CINQ = ['humain', 'nain', 'halfling', 'haut-elfe', 'elfe-sylvain'];
/** AA 02 l.117-128 : la carrière parente, puis `[carrière, min, max]` du Jet optionnel. */
const VARIANTES = {
  cavalier: [['cavalier', 1, 75], ['cavalier-leger', 76, 100]],
  chevalier: [['chevalier', 1, 55], ['chevalier-errant', 56, 65], ['chevalier-du-soleil-flamboyant', 66, 70], ['chevalier-du-loup-blanc', 71, 85], ['chevalier-panthere', 86, 100]],
  'pretre-guerrier': [['pretre-guerrier', 1, 85], ['pretre-de-myrmidia', 86, 100]],
  soldat: [['soldat', 1, 40], ['archer', 41, 50], ['hallebardier', 51, 70], ['arquebusier', 71, 85], ['joueur-d-epee', 86, 90], ['piquier', 91, 96], ['specialiste-de-siege', 97, 100]],
  colporteur: [['colporteur', 1, 75], ['suiveur-de-camp', 76, 100]],
  erudit: [['erudit', 1, 85], ['cartographe', 86, 100]],
  ingenieur: [['ingenieur', 1, 75], ['artilleur', 76, 100]],
};
/** Races des carrières des suppléments : AA VF 02 l.137, l.379, l.599 ; 03 l.222, l.302 ; 04 l.257 ; VO « Up in
 *  Arms » 03 l.163, l.240, l.302, l.381 ; 04 l.136, l.336 ; 05 l.88, l.249 ; 07 l.370 ; ADE I 07 l.11-23. */
const RACES = {
  archer: ['elfe-sylvain', 'haut-elfe', 'halfling', 'humain'],
  cartographe: CINQ,
  'suiveur-de-camp': CINQ,
  'chevalier-du-loup-blanc': H,
  'chevalier-du-soleil-flamboyant': H,
  'specialiste-de-siege': ['halfling', 'haut-elfe', 'humain', 'nain'],
  'joueur-d-epee': H,
  hallebardier: ['nain', 'halfling', 'humain'],
  arquebusier: ['nain', 'halfling', 'humain'],
  artilleur: ['nain', 'halfling', 'haut-elfe', 'humain'],
  'chevalier-errant': H,
  'chevalier-panthere': H,
  'cavalier-leger': ['humain', 'haut-elfe', 'elfe-sylvain'],
  piquier: H,
  'pretre-de-myrmidia': H,
  'chevaucheur-de-blaireau': ['halfling'],
  gardechamps: ['halfling'],
  'patrouilleur-des-karak': ['nain'],
  'rodeur-fantome': ['elfe-sylvain'],
};
/** ADE I 07 l.11, l.15, l.19, l.23 */
const A_LA_PLACE_DE = { 'chevaucheur-de-blaireau': 'soldat', gardechamps: 'patrouilleur-routier', 'patrouilleur-des-karak': 'messager', 'rodeur-fantome': 'chasseur-de-primes' };

const brut = readFileSync(CAREERS, 'utf8');
const careers = JSON.parse(brut);
const brutClasses = readFileSync(CLASSES, 'utf8');
const classes = JSON.parse(brutClasses);
const arrets = [];
if (brut !== serializeDataset(careers)) arrets.push('careers.json : forme non canonique');
if (brutClasses !== serializeDataset(classes)) arrets.push('classes.json : forme non canonique');
const porteurs = careers.filter((c) => Object.hasOwn(c, 'rand'));
const supplements = new Set(Object.keys(RACES));

/** Les rangées de la colonne `col` tirées des carrières `pool` : une par borne, la carrière hors suppléments. */
function rangees(pool, col) {
  const tirees = pool.filter((c) => c.rand?.[col] != null);
  const bornes = [...new Set(tirees.map((c) => c.rand[col]))].sort((a, b) => a - b);
  return bornes.map((max, i) => {
    const ids = tirees.filter((c) => c.rand[col] === max && !supplements.has(c.id)).map((c) => c.id);
    if (ids.length !== 1) arrets.push(`colonne « ${col} », borne ${max} : ${ids.length} carrière(s) hors suppléments (${ids.join(', ')}), une attendue`);
    return { id: ids[0], min: i ? bornes[i - 1] + 1 : 1, max };
  });
}

if (!arrets.length && porteurs.length) {
  if (existsSync(TABLE)) arrets.push('carrieres-aleatoires.json existe déjà alors que careers.json porte encore `rand`');
  const connues = new Set(COLONNES.map(([id]) => id));
  for (const c of porteurs) {
    for (const [col, borne] of Object.entries(c.rand)) {
      if (!connues.has(col)) arrets.push(`careers.json › ${c.id} : colonne inconnue « ${col} »`);
      if (borne !== null && !Number.isInteger(borne)) arrets.push(`careers.json › ${c.id} : \`rand.${col}\` non entier (${JSON.stringify(borne)})`);
    }
  }
  for (const id of [...supplements, ...Object.keys(VARIANTES)]) if (!careers.some((c) => c.id === id)) arrets.push(`careers.json : carrière « ${id} » absente`);
  if (!arrets.length) {
    const couples = classes.flatMap((k) => (k.remplace ? [{ par: k.id, de: k.remplace.id }] : []));
    const tire = (col, classe) => careers.some((c) => c.class.id === classe && c.rand?.[col] != null);
    const bases = [];
    const portions = [];
    for (const [col, nom, source] of COLONNES) {
      const offerts = couples.filter(({ par, de }) => tire(col, de) && tire(col, par));
      const sans = (exclues) => careers.filter((c) => !exclues.has(c.class.id));
      bases.push({ id: col, type: 'carrieres-aleatoires', label: `Tableau des Classes et Carrières aléatoires — ${nom}`, die: 'd100', source, entries: rangees(sans(new Set(offerts.map(({ par }) => par))), col) });
      for (const { par, de } of offerts) {
        const classe = classes.find((k) => k.id === par);
        const entries = rangees(sans(new Set([de])), col).filter((r) => careers.find((c) => c.id === r.id).class.id === par);
        portions.push({ id: `${par}-${col}`, type: 'carrieres-aleatoires', label: `${classe.label} — ${nom}`, die: 'd100', colonne: col, source: SOURCE_DES_PORTIONS, entries });
      }
    }
    const variantes = Object.entries(VARIANTES).map(([carriere, plages]) => ({
      id: `variantes-${carriere}`,
      type: 'carrieres-aleatoires',
      label: `Jet optionnel — ${careers.find((c) => c.id === carriere).label}`,
      die: 'd100',
      carriere,
      colonnes: COLONNES_AA.filter((col) => bases.find((b) => b.id === col).entries.some((r) => r.id === carriere)),
      source: SOURCE_DES_VARIANTES,
      entries: plages.map(([id, min, max]) => ({ id, min, max })),
    }));
    if (!arrets.length) {
      const migrees = careers.map(({ rand: _rand, desc, source, ...c }) => ({
        ...c,
        ...(RACES[c.id] ? { races: RACES[c.id] } : {}),
        ...(A_LA_PLACE_DE[c.id] ? { aLaPlaceDe: A_LA_PLACE_DE[c.id] } : {}),
        desc,
        source,
      }));
      writeFileSync(TABLE, serializeDataset([...bases, ...portions, ...variantes]), 'utf8');
      writeFileSync(CAREERS, serializeDataset(migrees), 'utf8');
      console.log(`migration 3578 L2a : ${bases.length} colonne(s), ${portions.length} portion(s) et ${variantes.length} variante(s) écrites dans carrieres-aleatoires.json, \`rand\` retiré de ${porteurs.length} carrière(s), \`races\` posé sur ${supplements.size}.`);
    }
  }
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
if (!porteurs.length) console.log('migration 3578 L2a : aucun `rand` dans careers.json, rien à faire.');
