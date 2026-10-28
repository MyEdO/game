/**
 * Migration #1659 L-1659-2 (vague `plage-en-tuple`) — la DISPONIBILITÉ SAISONNIÈRE d'une cargaison
 * passe du TUPLE à la FOURCHETTE :
 *
 *   `sea-cargo.json  › cargoes[].avail.{printemps,ete,automne,hiver}`  `[a, b]` → `{ min: a, max: b }`
 *   `land-cargo.json › cargoes[].avail.{printemps,ete,automne,hiver}`  `[a, b]` → `{ min: a, max: b }`
 *
 * Les deux livres impriment une table d100 à quatre colonnes saisonnières ; les bornes étaient
 * encodées par POSITION (`c.avail[season][0]` / `[1]`), donc invisibles au Codex comme au lookup
 * partagé. Elles deviennent celles que `findTableEntry`/`findTableEntryIndex` (`src/engine/tables.ts`)
 * lisent, et que le refine de couverture des defs garde (1–100, par colonne).
 *
 * MARITIME — `Source/WH - V4 - La Mer de Griffe/15 - Longs voyages.md` l.406-418 :
 *   « |                            | Printemps | Été   | Automne | Hiver |
 *     | Céréales                   | 01-05     | 01-09 | 01-18   | 01-09 |
 *     … | Pièces détachées de navire | 91-00     | 91-00 | 91-00   | 91-00 | »
 *   Onze cargaisons × 4 saisons = 44 cellules. `00` est le 100 du d100.
 *
 * TERRESTRE — `Source/Warhammer v4 - 2.0 Mort sur le Reik Compagnon/13 - CHAPITRE 11 - Règles du
 * commerce.md` l.73-78 (table TRANSPOSÉE : une ligne par saison, une colonne par bien) :
 *   « | Chance de trouver : | Vivres | Armement | Produits de<br>luxe | Métal | Bois  | Vin/Eau-de-vie | Laine |
 *     | Printemps           | 01–09  | 10–15    | 16–20               | 21–30 | 31–55 | 56–75          | 76–00 |
 *     | Été                 | 01–19  | 20–23    | 24–29               | 30–39 | 40–74 | 75–85          | 86–00 |
 *     | Automne             | 01–35  | 36–40    | 41–44               | 45–60 | 61–80 | 81–95          | 96–00 |
 *     | Hiver               | 01–19  | 20–23    | 24–29               | 30–44 | 45–60 | 61–95          | 96–00 | »
 *   Sept cargaisons × 4 saisons = 28 cellules.
 *
 * FORME D'AVANT SEULE : seule une cellule encore TUPLE se convertit ; une cargaison absente, ou déjà en
 * fourchettes (migrée, ou révisée depuis), est laissée telle quelle.
 *
 * CARDINAL ASSERTÉ SUR CE QUI EST CONVERTI : un catalogue dont une cellule se convertit doit sortir
 * entier en fourchettes (44 maritimes, 28 terrestres), chaque cellule ÉGALE à ce que le livre imprime
 * (tables `ATTENDU_*` ci-dessous, transcrites des lignes citées), et ses 4 colonnes saisonnières
 * couvrant 1–100 d'un seul tenant — 0 trou, 0 chevauchement ; tout écart est un ARRÊT (exit 1).
 *
 * ENTRÉES : `src/data/sea-cargo.json`, `src/data/land-cargo.json` (seuls documents lus et écrits).
 * IDEMPOTENT : rejouée, elle ne voit plus aucun tuple et n'écrit rien.
 * FORMATAGE : `JSON.stringify(doc, null, 2)`, vérifié canonique AVANT toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MER = path.join(ROOT, 'src/data/sea-cargo.json');
const TERRE = path.join(ROOT, 'src/data/land-cargo.json');

/** Les quatre colonnes saisonnières, dans l'ordre imprimé par les deux livres. */
const SAISONS = ['printemps', 'ete', 'automne', 'hiver'];

/** Cellules maritimes attendues au RÉSULTAT (MDG 15 l.408-418), `id` → [printemps, été, automne, hiver]. */
const ATTENDU_MER = {
  cereales: [[1, 5], [1, 9], [1, 18], [1, 9]],
  armes: [[6, 8], [10, 12], [19, 21], [10, 12]],
  'produits-de-luxe': [[9, 13], [13, 16], [22, 25], [13, 16]],
  metaux: [[14, 19], [17, 22], [26, 30], [17, 25]],
  bois: [[20, 28], [23, 44], [31, 46], [26, 36]],
  vin: [[29, 33], [45, 56], [47, 60], [37, 56]],
  laine: [[34, 50], [57, 62], [61, 65], [57, 60]],
  sel: [[51, 60], [63, 75], [66, 72], [61, 64]],
  huile: [[61, 70], [76, 82], [73, 83], [65, 81]],
  'poisson-sale': [[71, 90], [83, 90], [84, 90], [82, 90]],
  'pieces-detachees-de-navire': [[91, 100], [91, 100], [91, 100], [91, 100]],
};

/** Cellules terrestres attendues au RÉSULTAT (MSRC 13 l.75-78), `id` → [printemps, été, automne, hiver]. */
const ATTENDU_TERRE = {
  vivres: [[1, 9], [1, 19], [1, 35], [1, 19]],
  armement: [[10, 15], [20, 23], [36, 40], [20, 23]],
  'produits-de-luxe': [[16, 20], [24, 29], [41, 44], [24, 29]],
  metal: [[21, 30], [30, 39], [45, 60], [30, 44]],
  bois: [[31, 55], [40, 74], [61, 80], [45, 60]],
  vin: [[56, 75], [75, 85], [81, 95], [61, 95]],
  laine: [[76, 100], [86, 100], [96, 100], [96, 100]],
};

const arrets = [];

/** Lit un document en refusant toute forme non canonique. */
function lire(fichier) {
  const brut = fs.readFileSync(fichier, 'utf8');
  const doc = JSON.parse(brut);
  if (brut !== serializeDataset(doc)) {
    console.error(`FORME NON CANONIQUE — ${path.relative(ROOT, fichier)} ; AUCUNE écriture.`);
    process.exit(1);
  }
  return { brut, doc };
}

const mer = lire(MER);
const terre = lire(TERRE);

/** Les entrées MARCHANDES d'un catalogue : celles qui portent une disponibilité — un marqueur de la
 *  colonne Production/Produits (`echangeable: false`) n'en a pas (`isEchangeable`, `src/engine/cargo.ts`). */
const marchandes = (doc) => (doc.cargoes ?? []).filter((c) => c.echangeable !== false);

/**
 * Convertit les 4 colonnes d'une cargaison du TUPLE à la FOURCHETTE, en place. Rend le nombre de
 * cellules converties (0 si elles étaient déjà migrées).
 * @param {object} cargo entrée marchande
 * @param {string} nom nom du site, pour les arrêts
 */
function enFourchettes(cargo, nom) {
  let n = 0;
  for (const saison of SAISONS) {
    const cellule = cargo.avail?.[saison];
    if (!Array.isArray(cellule)) continue;
    if (cellule.length !== 2 || !cellule.every((v) => typeof v === 'number')) {
      arrets.push(`${nom} › ${saison} : ${JSON.stringify(cellule)} n'est pas une paire de nombres`);
      continue;
    }
    cargo.avail[saison] = { min: cellule[0], max: cellule[1] };
    n++;
  }
  return n;
}

/** CONSTAT sur le RÉSULTAT : la disponibilité lue au document, confrontée à ce que le livre imprime. */
function confronter(doc, attendu, nom, cardinal) {
  const entrees = marchandes(doc);
  const vus = entrees.map((c) => c.id).sort();
  const nommes = Object.keys(attendu).sort();
  if (vus.join('\n') !== nommes.join('\n')) {
    arrets.push(`${nom} : cargaisons du document ≠ cargaisons nommées :\n    vues   : ${vus.join(', ') || '(aucune)'}\n    nommées: ${nommes.join(', ')}`);
    return 0;
  }
  let cellules = 0;
  for (const c of entrees) {
    for (const [i, saison] of SAISONS.entries()) {
      const f = c.avail?.[saison];
      if (!f || typeof f !== 'object' || Array.isArray(f) || typeof f.min !== 'number' || typeof f.max !== 'number') {
        arrets.push(`${nom} › ${c.id} › ${saison} : ${JSON.stringify(f)} hors forme \`{min, max}\``);
        continue;
      }
      const [min, max] = attendu[c.id][i];
      if (f.min !== min || f.max !== max) {
        arrets.push(`${nom} › ${c.id} › ${saison} : ${f.min}–${f.max}, le livre imprime ${min}–${max}`);
        continue;
      }
      cellules++;
    }
  }
  if (cellules !== cardinal) arrets.push(`${nom} : ${cellules} cellule(s) conforme(s), attendu ${cardinal}`);

  // COUVERTURE des 4 colonnes : le d100 de 1 à 100, d'un seul tenant (0 trou, 0 chevauchement) —
  // re-vérifiée APRÈS écriture par le rejeu, et gardée en permanence par le refine des defs.
  for (const saison of SAISONS) {
    const bandes = entrees
      .map((c) => ({ id: c.id, f: c.avail?.[saison] }))
      .filter((b) => b.f && typeof b.f.min === 'number' && typeof b.f.max === 'number')
      .sort((a, b) => a.f.min - b.f.min);
    let attenduMin = 1;
    for (const b of bandes) {
      if (b.f.min !== attenduMin) arrets.push(`${nom} › colonne ${saison} : « ${b.id} » commence à ${b.f.min} au lieu de ${attenduMin}`);
      attenduMin = b.f.max + 1;
    }
    if (attenduMin !== 101) arrets.push(`${nom} › colonne ${saison} : la colonne s'arrête à ${attenduMin - 1} au lieu de 100`);
  }
  return cellules;
}

let migresMer = 0;
for (const c of marchandes(mer.doc)) migresMer += enFourchettes(c, `sea-cargo.json › cargoes[${c.id}].avail`);
let migresTerre = 0;
for (const c of marchandes(terre.doc)) migresTerre += enFourchettes(c, `land-cargo.json › cargoes[${c.id}].avail`);

const cellulesMer = migresMer ? confronter(mer.doc, ATTENDU_MER, 'sea-cargo.json › cargoes[].avail', 44) : 0;
const cellulesTerre = migresTerre ? confronter(terre.doc, ATTENDU_TERRE, 'land-cargo.json › cargoes[].avail', 28) : 0;

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}

let ecrits = 0;
for (const [fichier, etat, migres] of [[MER, mer, migresMer], [TERRE, terre, migresTerre]]) {
  const rel = path.relative(ROOT, fichier).replace(/\\/g, '/');
  const out = serializeDataset(etat.doc);
  if (out === etat.brut) { console.log(`${rel} — INCHANGÉ (no-op byte-identique).`); continue; }
  if (out.includes('\r')) {
    console.error(`${fichier} : \\r dans le texte réécrit ; AUCUNE écriture.`);
    process.exit(1);
  }
  fs.writeFileSync(fichier, out, 'utf8');
  ecrits++;
  console.log(`${rel} — réécrit (${migres} cellule(s) de disponibilité passée(s) du tuple à la fourchette).`);
}
console.log(`Disponibilités saisonnières converties et vérifiées : ${cellulesMer} maritime(s) + ${cellulesTerre} terrestre(s).`);
if (!ecrits) process.exit(0);
