/**
 * Migration #1658 (#1463, L4) — la Caractéristique (`CharKey`) n'a qu'un nom de champ,
 * `characteristic`, la graphie de `sujetDuJetSchema` (`src/data/schemas/grammaire/mecanique.ts`).
 * L'homonyme OBJET `char` (profil chiffré d'un statblock, `charStatsSchema`) est un autre concept :
 * il n'est jamais touché.
 *
 * GESTE, par porteur : la clé `char` devient `characteristic`, à son rang (les autres clés gardent le
 * leur). RENOMMAGE PAR CLÉ AU CHEMIN EXACT, jamais par mot. Porteurs, par famille :
 *  - toute op `charMod`, `testMod`, `charDRBonus`, `charDamage` ou `actGate`, à toute profondeur ;
 *  - `creatures.json › [].optionals[]` de `note: 'swap'` › `grant[]` (octroi d'une variante) ;
 *  - toute Condition `kind: 'compare'` › `subject` et `value` (référence de Caractéristique `CharRef`).
 *
 * ENTRÉES : `src/data/*.json`, `src/scenes/<projet>/*.json` (les seules données lues et écrites).
 * CARDINAL ASSERTÉ : `CARDINAL` porteurs renommés au premier passage, chacun de famille connue.
 * IDEMPOTENT : un porteur déjà en `characteristic` n'a aucun geste ; rejouée sur l'état final, rien ne
 * s'écrit et la sortie est 0.
 * FAIL-FAST — sortie 1 avant toute écriture : porteur qui porte à la fois `char` et `characteristic`,
 * valeur hors des 10 Caractéristiques, compte de gestes ≠ `CARDINAL`, fichier à réécrire hors de son
 * formatage, ou clé `char` à valeur chaîne restante hors des porteurs déclarés.
 * FORMATAGE : `serializeDataset` (`src/data/serialize.ts`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Gestes du premier passage, mesurés le 2026-11-07 sur `88a6c29e7e` : ops 275 (`charMod` 204,
 *  `testMod` 46, `charDRBonus` 17, `charDamage` 6, `actGate` 2), octrois 5, Conditions 2. */
const CARDINAL = 282;

/** Les 10 Caractéristiques (`charKeySchema`, `src/data/schemas/grammaire/valeurs.ts`), figées à la date. */
const CARACTERISTIQUES = new Set([
  'capacite-de-combat', 'capacite-de-tir', 'force', 'endurance', 'initiative', 'agilite', 'dexterite',
  'intelligence', 'force-mentale', 'sociabilite',
]);

const OPS_PORTEUSES = new Set(['charMod', 'testMod', 'charDRBonus', 'charDamage', 'actGate']);

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Tout objet de `valeur` satisfaisant `pred`, à toute profondeur, avec son adresse. */
function partout(valeur, pred, ou = '', acc = []) {
  if (Array.isArray(valeur)) valeur.forEach((v, i) => partout(v, pred, `${ou}[${i}]`, acc));
  else if (estObjet(valeur)) {
    if (pred(valeur)) acc.push([valeur, ou]);
    for (const [k, v] of Object.entries(valeur)) partout(v, pred, `${ou}.${k}`, acc);
  }
  return acc;
}

/** Les porteurs déclarés d'un document, avec leur famille et leur adresse. */
function porteursDe(rel, doc) {
  const ops = partout(doc, (o) => OPS_PORTEUSES.has(o.op)).map(([o, ou]) => [o, `op ${o.op}`, ou]);
  const comparaisons = partout(doc, (o) => o.kind === 'compare').flatMap(([o, ou]) =>
    ['subject', 'value'].filter((k) => estObjet(o[k])).map((k) => [o[k], 'Condition compare', `${ou}.${k}`]));
  const octrois = rel !== 'src/data/creatures.json' ? [] : doc.flatMap((c) => (c.optionals ?? [])
    .flatMap((n, i) => (n?.note === 'swap' ? (n.grant ?? []).map((g, j) => [g, 'octroi swap', `${c.id} › optionals[${i}].grant[${j}]`]) : [])));
  return [...ops, ...comparaisons, ...octrois];
}

/** Porteur `char` → `characteristic`, à son rang. Rend le nombre de gestes (0 ou 1). */
function renommer(porteur, ou, fautes) {
  if (!Object.hasOwn(porteur, 'char')) return 0;
  if (Object.hasOwn(porteur, 'characteristic')) { fautes.push(`${ou} : \`char\` ET \`characteristic\``); return 0; }
  if (!CARACTERISTIQUES.has(porteur.char)) { fautes.push(`${ou} : \`char\` hors des Caractéristiques (${JSON.stringify(porteur.char)})`); return 0; }
  const entrees = Object.entries(porteur).map(([k, v]) => [k === 'char' ? 'characteristic' : k, v]);
  for (const k of Object.keys(porteur)) delete porteur[k];
  Object.assign(porteur, Object.fromEntries(entrees));
  return 1;
}

const jsonDe = (dossier) => fs.readdirSync(path.join(ROOT, dossier), { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith('.json')).map((e) => `${dossier}/${e.name}`);
const projets = fs.readdirSync(path.join(ROOT, 'src/scenes'), { withFileTypes: true })
  .filter((e) => e.isDirectory()).flatMap((e) => jsonDe(`src/scenes/${e.name}`));
const ENTREES = [...jsonDe('src/data'), ...projets].sort();

const fautes = [];
const aEcrire = [];
const parFamille = {};
let gestes = 0;
for (const rel of ENTREES) {
  const chemin = path.join(ROOT, rel);
  const texte = fs.readFileSync(chemin, 'utf8');
  if (!texte.includes('"char"')) continue;
  const doc = JSON.parse(texte);
  let ici = 0;
  for (const [porteur, famille, ou] of porteursDe(rel, doc)) {
    const n = renommer(porteur, `${rel} › ${ou}`, fautes);
    ici += n;
    parFamille[famille] = (parFamille[famille] ?? 0) + n;
  }
  // EXHAUSTIVITÉ : toute clé `char` à valeur chaîne, hors des porteurs déclarés, est une anomalie.
  for (const [o, ou] of partout(doc, (x) => typeof x.char === 'string')) {
    fautes.push(`${rel} › ${ou} : \`char\` chaîne hors porteur déclaré (${JSON.stringify(o).slice(0, 160)})`);
  }
  if (!ici) continue;
  if (serializeDataset(JSON.parse(texte)) !== texte) { fautes.push(`${rel} : formatage non canonique`); continue; }
  gestes += ici;
  aEcrire.push([chemin, serializeDataset(doc)]);
}

if (gestes && gestes !== CARDINAL) {
  fautes.push(`${gestes} geste(s), ${CARDINAL} attendus (${JSON.stringify(parFamille)}) — périmètre déplacé`);
}
if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
for (const [chemin, sortie] of aEcrire) fs.writeFileSync(chemin, sortie);
console.log(aEcrire.length === 0
  ? `RIEN À FAIRE — les ${CARDINAL} porteurs nomment déjà \`characteristic\`.`
  : `migration 1658 : ${gestes} porteur(s) renommé(s) dans ${aEcrire.length} fichier(s) ${JSON.stringify(parFamille)}.`);
