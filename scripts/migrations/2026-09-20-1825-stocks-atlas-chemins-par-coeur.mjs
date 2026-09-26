/**
 * Migration #1825 — un chemin de page d'Atlas cité par un STOCK NOMINATIF porte son CŒUR.
 *
 * L'Atlas se partitionne par cœur de règles (`docs/raw/<coeur>/<page>.md`, couture `pagesDeLAtlas`
 * de `scripts/raw/_lib.mjs`). Les trois stocks nominatifs de l'Atlas keyent leurs entrées par le
 * CHEMIN de la page en dette : un chemin qui ne désigne plus aucun fichier rend leur cliquet à
 * double sens aveugle — `reanchor.mjs` et `citation-graphy-guard.mjs` déclarent alors TOUTES leurs
 * entrées caduques et tous leurs sites neufs.
 *
 * ENTRÉES : `scripts/raw/reanchor-low-stock.json`, `scripts/raw/graphy-stock.json`,
 * `scripts/raw/reconciliation-stock.json` — LU aussi : l'Atlas sur disque (`docs/raw/`), la SEULE
 * source du cœur d'une page. Aucun nom de cœur ne vit dans ce fichier. Un stock SOLDÉ est ABSENT
 * du disque (`fs.existsSync`) : il ne cite aucun chemin, la migration le saute sans écrire.
 *
 * GESTE : réécriture de CHEMIN seule, sur le TEXTE (le formatage du document est préservé à
 * l'octet). Un `docs/raw/<nom>.md` dont l'Atlas porte la page sous UN cœur devient
 * `docs/raw/<coeur>/<nom>.md` ; le champ `fichier` d'une entrée, un membre de `sites`, ou la même
 * citation en PROSE dans un champ `quoi` — la réécriture ne connaît que le chemin. Les autres
 * champs (`ref`, `occurrence`, `famille`, `lot`, `date`) sont INTOUCHÉS : le cardinal des entrées ne
 * bouge pas.
 * NE BOUGE PAS : une page que l'Atlas porte AUSSI à sa racine (le routeur `00-index.md`) — le chemin
 * cité y reste vrai.
 * IDEMPOTENT : rejouée sur l'état final, aucun chemin à plat ne subsiste et elle sort 0 sans écrire,
 * même quand l'Atlas porte un nom sous plusieurs cœurs sans qu'aucun stock ne le cite à plat.
 * FAIL-FAST GROUPÉ, AVANT toute écriture : un nom CITÉ À PLAT que deux cœurs portent (le chemin cité
 * ne dirait plus lequel), un `docs/raw/…md` qui ne désigne aucun fichier de l'arbre après réécriture.
 * TÉMOIN : le texte d'arrivée, ramené à plat (tout `docs/raw/<coeur>/` → `docs/raw/`), est IDENTIQUE
 * au texte de départ ramené à plat — la migration n'a rien changé d'AUTRE qu'un préfixe de chemin.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { pagesDeLAtlas, CLASSES_DE_PAGE, coeursDuRegistre } from '../raw/_lib.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const RAWDIR = 'docs/raw';
const FICHIERS = [
  'scripts/raw/reanchor-low-stock.json',
  'scripts/raw/graphy-stock.json',
  'scripts/raw/reconciliation-stock.json',
];

const pages = pagesDeLAtlas(path.join(ROOT, RAWDIR), { classes: CLASSES_DE_PAGE });

/** Nom de page -> chemins relatifs SOUS un cœur. Un nom que l'Atlas porte aussi à la RACINE n'est
 *  pas à réécrire : le chemin à plat qui le cite désigne toujours ce fichier. */
const sousCoeur = new Map();
const aLaRacine = new Set();
for (const page of pages) {
  if (page.coeur === null) { aLaRacine.add(page.nom); continue; }
  if (!sousCoeur.has(page.nom)) sousCoeur.set(page.nom, []);
  sousCoeur.get(page.nom).push(page.relatif);
}

const anomalies = [];
/** Nom de page -> chemin relatif unique sous un cœur. */
const cible = new Map();
/** Nom de page -> chemins relatifs sous PLUSIEURS cœurs. */
const ambigus = new Map();
for (const [nom, relatifs] of sousCoeur) {
  if (aLaRacine.has(nom)) continue;
  if (relatifs.length > 1) {
    ambigus.set(nom, relatifs);
    continue;
  }
  cible.set(nom, relatifs[0]);
}

const echappe = (s) => s.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const COEURS = coeursDuRegistre();
/** Le texte RAMENÉ À PLAT : tout préfixe de cœur retiré des chemins d'Atlas. Le témoin s'y mesure. */
const aPlat = (texte) =>
  COEURS.reduce((t, coeur) => t.replaceAll(`${RAWDIR}/${coeur}/`, `${RAWDIR}/`), texte);

const CITATION = new RegExp(String.raw`${echappe(RAWDIR)}/([\w.-]+\.md)`, 'gu');

const sites = []; // { fichier, avant, apres, n }
for (const fichier of FICHIERS) {
  const abs = path.join(ROOT, fichier);
  if (!fs.existsSync(abs)) continue;
  const brut = fs.readFileSync(abs, 'utf8');
  let n = 0;
  /** Les noms ambigus cités à plat dans CE stock — une anomalie par nom, pas par occurrence. */
  const citesAmbigus = new Set();
  const apres = brut.replace(CITATION, (tout, nom) => {
    const relatifs = ambigus.get(nom);
    if (relatifs) {
      if (citesAmbigus.has(nom)) return tout;
      citesAmbigus.add(nom);
      anomalies.push(`${fichier} : « ${RAWDIR}/${nom} » est cité à plat, que l'Atlas porte sous ${relatifs.length} cœurs (${relatifs.join(', ')}) — le chemin ne dit pas lequel`);
      return tout;
    }
    const relatif = cible.get(nom);
    if (!relatif) return tout;
    n += 1;
    return `${RAWDIR}/${relatif}`;
  });
  try { JSON.parse(apres); } catch (e) { anomalies.push(`${fichier} : le document réécrit n'est plus un JSON valide (${e.message})`); continue; }
  assert.equal(aPlat(apres), aPlat(brut), `${fichier} : la migration a changé autre chose qu'un préfixe de chemin`);
  for (const [, nom] of apres.matchAll(CITATION)) {
    if (citesAmbigus.has(nom)) continue;
    if (!fs.existsSync(path.join(ROOT, RAWDIR, nom))) anomalies.push(`${fichier} : « ${RAWDIR}/${nom} » ne désigne aucune page de l'Atlas`);
  }
  for (const m of apres.matchAll(new RegExp(String.raw`${echappe(RAWDIR)}/[\w.-]+/[\w.-]+\.md`, 'gu'))) {
    if (!fs.existsSync(path.join(ROOT, m[0]))) anomalies.push(`${fichier} : « ${m[0]} » ne désigne aucune page de l'Atlas`);
  }
  if (apres !== brut) sites.push({ fichier, abs, apres, n });
}

if (anomalies.length) {
  console.error(`ANOMALIES (${anomalies.length}) — AUCUNE écriture :`);
  for (const a of anomalies) console.error(`  - ${a}`);
  process.exit(1);
}

if (sites.length === 0) {
  const presents = FICHIERS.filter((f) => fs.existsSync(path.join(ROOT, f))).length;
  console.log(`RIEN À FAIRE — les ${presents} stock(s) nominatifs présents citent l'Atlas par un chemin à cœur.`);
  process.exit(0);
}

for (const s of sites) fs.writeFileSync(s.abs, s.apres);
for (const s of sites) console.log(`${s.fichier} : ${s.n} chemin(s) de page portent leur cœur`);
