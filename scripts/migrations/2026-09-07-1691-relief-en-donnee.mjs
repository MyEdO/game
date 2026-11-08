/**
 * Migration #1691 — la matière de RELIEF passe en DONNÉE, volet `src/data`.
 *
 * Deux gestes, un seul lot :
 *  1. `terrains.json` — chaque terrain à BLOC PLEIN (`solidHeightM`) reçoit la MATIÈRE de ses flancs
 *     (`matiere`, id de `materials.json` domaine `relief`). Le builder de sols (`floors.ts:198`) la LIT
 *     désormais au lieu de choisir `pierre` en dur ; le schéma exige le champ ⟺ `solidHeightM`.
 *     La valeur posée est celle que le code choisissait, terrain par terrain (table `MATIERE_DE_BLOC`) :
 *     l'identité de rendu est le contrat de ce lot, pas une occasion de retoucher le monde.
 *  2. `materials.json` — l'entrée de toiture qui EST le plan vu du dessus se DÉCLARE (`vueDeDessus`),
 *     au lieu d'être atteinte par son id littéral au call-site (le peintre des toits
 *     lit maintenant `matierePlan()`). Elle est identifiée par sa DONNÉE — la seule entrée `roof` sans
 *     `couverture` —, jamais par son nom.
 *
 * Entrées : `src/data/terrains.json`, `src/data/materials.json` (lus et écrits).
 * PORTE DE FORME, jamais de CARDINAL (#1812) : terrains et matières sont des catalogues app-owned
 * qui grandissent. Ce qui fait sortir 1 AVANT toute écriture, c'est un bloc plein sans MATIÈRE
 * déclarée, ou un plan vu du dessus qui ne serait plus UNIQUE.
 * MARQUEURS D'IDEMPOTENCE : présence de `matiere` sur les terrains à bloc, présence de
 * `vueDeDessus`. Rejouée sur l'arbre migré, la migration n'écrit rien et sort 0.
 * FORMATAGE PRÉSERVÉ : `src/data/*.json` est `JSON.stringify(doc, null, 2)` (sans saut final) ; une
 * entrée n'est pas réordonnée — le champ posé s'ajoute en queue.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const NOM = '2026-09-07-1691-relief-en-donnee';

/** MATIÈRE des flancs, par terrain à bloc plein — la valeur que `floors.ts` choisissait en dur. */
const MATIERE_DE_BLOC = { mur: 'pierre' };

const echec = (m) => {
  console.error(`[${NOM}] ${m}`);
  process.exit(1);
};

/** Lit un document de `src/data`, en refusant tout formatage non canonique. */
function lire(rel) {
  const abs = path.join(ROOT, rel);
  const brut = fs.readFileSync(abs, 'utf8');
  const doc = JSON.parse(brut);
  if (brut !== JSON.stringify(doc, null, 2)) echec(`${rel} : formatage non canonique en entrée`);
  if (!Array.isArray(doc)) echec(`${rel} : racine non-TABLEAU`);
  return { abs, brut, doc };
}

// ── 1/3 · terrains.json ─────────────────────────────────────────────────────────────────────────
const T = lire('src/data/terrains.json');
const blocs = T.doc.filter((e) => e.solidHeightM !== undefined);
const aPoser = blocs.filter((e) => e.matiere === undefined);
if (aPoser.length) {
  // PORTE DE FORME, jamais de CARDINAL (#1812) : les catalogues de terrain et de matière grandissent.
  // Ce qui arrête la migration, c'est un bloc plein dont la MATIÈRE n'est pas déclarée — pas un compte.
  const inconnus = aPoser.filter((e) => MATIERE_DE_BLOC[e.id] === undefined).map((e) => e.id);
  if (inconnus.length) echec(`terrains.json : aucune matière déclarée pour le(s) bloc(s) ${inconnus.join(', ')}`);
}
const orphelins = T.doc.filter((e) => e.solidHeightM === undefined && e.matiere !== undefined).map((e) => e.id);
if (orphelins.length) echec(`terrains.json : \`matiere\` sans \`solidHeightM\` sur ${orphelins.join(', ')}`);
for (const e of aPoser) e.matiere = MATIERE_DE_BLOC[e.id];

// ── 2/2 · materials.json ────────────────────────────────────────────────────────────────────────
const M = lire('src/data/materials.json');
const roofs = M.doc.filter((e) => e.domain === 'roof');
const plans = roofs.filter((e) => e.couverture === undefined);
const dejaMarquee = roofs.filter((e) => e.vueDeDessus !== undefined);

if (dejaMarquee.length === 0 && !roofs.length) echec('materials.json : AUCUNE matière de toit — périmètre déplacé');
// Le plan vu du dessus est UNIQUE par construction (une seule matière `roof` sans `couverture`) :
// c'est une FORME, pas un cardinal de population (#1812).
if (plans.length !== 1)
  echec(`materials.json : ${plans.length} entrée(s) \`roof\` sans \`couverture\` — le plan vu du dessus est UNIQUE et se désigne par sa donnée`);

for (const e of M.doc) if (e.domain === 'roof' && e.couverture === undefined && e.vueDeDessus === undefined) e.vueDeDessus = true;

// ── ÉCRITURE ────────────────────────────────────────────────────────────────────────────────────
const sorties = [
  { rel: 'src/data/terrains.json', abs: T.abs, brut: T.brut, doc: T.doc },
  { rel: 'src/data/materials.json', abs: M.abs, brut: M.brut, doc: M.doc },
];
let ecrits = 0;
for (const s of sorties) {
  const out = JSON.stringify(s.doc, null, 2);
  if (out === s.brut) continue;
  fs.writeFileSync(s.abs, out, 'utf8');
  ecrits++;
}
if (!ecrits) {
  console.log(`[${NOM}] déjà migrée — rien à écrire`);
  process.exit(0);
}

// ── PREUVE POST-ÉCRITURE ────────────────────────────────────────────────────────────────────────
const terrainsRelus = JSON.parse(fs.readFileSync(T.abs, 'utf8'));
const muets = terrainsRelus.filter((e) => e.solidHeightM !== undefined && e.matiere === undefined).map((e) => e.id);
if (muets.length) echec(`ÉCHEC POST-ÉCRITURE : bloc(s) plein(s) sans matière — ${muets.join(', ')}`);
if (terrainsRelus.length !== T.doc.length) echec(`ÉCHEC POST-ÉCRITURE : ${terrainsRelus.length} terrain(s) ≠ ${T.doc.length} lus`);

const materialsRelus = JSON.parse(fs.readFileSync(M.abs, 'utf8'));
if (materialsRelus.length !== M.doc.length) echec(`ÉCHEC POST-ÉCRITURE : ${materialsRelus.length} matière(s) ≠ ${M.doc.length} lues`);
const marquees = materialsRelus.filter((e) => e.vueDeDessus === true);
if (marquees.length !== 1) echec(`ÉCHEC POST-ÉCRITURE : ${marquees.length} entrée(s) \`vueDeDessus\` ≠ 1`);
if (marquees[0].couverture !== undefined) echec(`ÉCHEC POST-ÉCRITURE : \`${marquees[0].id}\` est à la fois couverture et plan`);

console.log(
  `[${NOM}] migré — ${aPoser.length} terrain(s) à bloc plein reçoivent leur matière (${aPoser.map((e) => `${e.id}→${e.matiere}`).join(', ')}) ; ` +
    `relief ${materialsRelus.filter((e) => e.domain === 'relief').length} intact ; ` +
    `plan vu du dessus déclaré sur \`${marquees[0].id}\``,
);
