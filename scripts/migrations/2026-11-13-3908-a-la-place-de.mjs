/**
 * Migration #3908 L2 — `careers[].aLaPlaceDe` devient une référence `{ id }` (la carrière tirée au Tableau), et
 * `careers[].especesALaPlaceDe` porte les espèces auxquelles la substitution s'ouvre. Pose les substitutions des livres :
 *  - les 4 de l'ADE I (ADE I 07 l.11-23), passées de chaîne à `{ id }` ; le Chevaucheur de blaireau ouvert à
 *    l'espèce `halflings` seule (valeur `maison`) et gardé par la règle optionnelle `creation-chevaucheur-de-blaireau`
 *    (ADE I 07 l.9) ;
 *  - Flagellant à la place de Frère Loup (Middenheim 09 l.57) ;
 *  - Nonne et Prêtre à la place de Flagellant, Cavalier léger de Cavalier, Piquier de Soldat, Prêtre de Myrmidia de
 *    Prêtre guerrier, pour l'espèce `humains-tileens` (AA 05 l.135-140) ;
 *  - les 8 carrières de Collège à la place de Sorcier (VDM 03 l.11, l.27) ;
 *  - `races: ['humain']` sur Flagellant, Nonne et Prêtre (LDB 08 l.1676, l.2292, l.2357).
 *
 * Entrées : src/data/careers.json (lue et écrite).
 *
 * FORME D'AVANT SEULE (`lib/formeDAvant.mjs`) : le lot ne joue que si l'une des 4 carrières de l'ADE I porte encore
 * son `aLaPlaceDe` en chaîne (rejeu sur l'arbre migré : no-op byte-identique) ; chaque geste n'agit alors que sur la
 * forme d'avant exacte de la carrière qu'il nomme — une carrière absente ou révisée depuis passe sans faute.
 * ARRÊT (exit 1), AUCUNE écriture : un fichier non canonique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';
import { tableTotale } from '../../src/lib/tableTotale.ts';
import { porteLaTranche } from './lib/formeDAvant.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CAREERS = join(ROOT, 'src/data/careers.json');
const CHEVAUCHEUR = 'chevaucheur-de-blaireau';
const MAISON_CHEVAUCHEUR =
  '« halfling du Mootland » (ADE I 07 l.11) = l’espèce Halfling du Livre de base seule : les 12 clans sont du Reikland (ADE I 02 l.11) ; valeur d’adaptation du ticket #3908 (https://github.com/MyEdO/game/issues/3908#issuecomment-6841841671)';
/** Les 4 de l'ADE I : la chaîne d'avant, et la forme d'après. */
const ADE_I = {
  [CHEVAUCHEUR]: {
    avant: 'soldat',
    apres: { aLaPlaceDe: { id: 'soldat' }, especesALaPlaceDe: ['halflings'], gatedByRule: { id: 'creation-chevaucheur-de-blaireau' }, maison: MAISON_CHEVAUCHEUR },
  },
  'rodeur-fantome': { avant: 'chasseur-de-primes', apres: { aLaPlaceDe: { id: 'chasseur-de-primes' } } },
  'patrouilleur-des-karak': { avant: 'messager', apres: { aLaPlaceDe: { id: 'messager' } } },
  'gardechamps': { avant: 'patrouilleur-routier', apres: { aLaPlaceDe: { id: 'patrouilleur-routier' } } },
};
const TILEENS = { especesALaPlaceDe: ['humains-tileens'] };
const HUMAIN = { races: ['humain'] };
const COLLEGES = ['hierophante', 'alchimiste', 'druide', 'astromancien', 'umbramancien', 'spirite', 'pyromancien', 'chamane'];
/** Les substitutions posées sur une carrière qui n'en porte aucune (et, pour Flagellant, Nonne, Prêtre, sans `races`). */
const POSEES = {
  'flagellant': { ...HUMAIN, aLaPlaceDe: { id: 'frere-loup' } },
  'nonne': { ...HUMAIN, aLaPlaceDe: { id: 'flagellant' }, ...TILEENS },
  'pretre': { ...HUMAIN, aLaPlaceDe: { id: 'flagellant' }, ...TILEENS },
  'cavalier-leger': { aLaPlaceDe: { id: 'cavalier' }, ...TILEENS },
  'piquier': { aLaPlaceDe: { id: 'soldat' }, ...TILEENS },
  'pretre-de-myrmidia': { aLaPlaceDe: { id: 'pretre-guerrier' }, ...TILEENS },
  ...tableTotale(COLLEGES, () => ({ aLaPlaceDe: { id: 'sorcier' } })),
};
/** La forme d'avant d'un geste : les clés qu'il pose, absentes ; `aLaPlaceDe` en chaîne pour l'ADE I. */
const avantDe = (apres, aLaPlaceDe) => ({ ...tableTotale(Object.keys(apres), () => undefined), aLaPlaceDe });

const brut = readFileSync(CAREERS, 'utf8');
const careers = JSON.parse(brut);
if (brut !== serializeDataset(careers)) {
  console.error('ARRÊT — careers.json : forme non canonique, AUCUNE écriture.');
  process.exit(1);
}
const geste = (c) => {
  const ade = ADE_I[c.id];
  if (ade) return porteLaTranche(c, avantDe(ade.apres, ade.avant)) ? ade.apres : undefined;
  const posee = POSEES[c.id];
  return posee && porteLaTranche(c, avantDe(posee, undefined)) ? posee : undefined;
};
if (!careers.some((c) => ADE_I[c.id] && geste(c))) {
  console.log('migration 3908 L2 : aucun `aLaPlaceDe` de l’ADE I en chaîne, rien à faire.');
} else {
  let n = 0;
  const migrees = careers.map((c) => {
    const apres = geste(c);
    if (!apres) return c;
    n++;
    const { desc, source, aLaPlaceDe: _avant, ...reste } = c;
    const { races, ...relation } = apres;
    return { ...reste, ...(races ? { races } : {}), ...relation, desc, source };
  });
  writeFileSync(CAREERS, serializeDataset(migrees), 'utf8');
  console.log(`migration 3908 L2 : ${n} carrière(s) migrée(s) (\`aLaPlaceDe\` de l’ADE I en \`{ id }\`, substitutions et \`races\` posées).`);
}
