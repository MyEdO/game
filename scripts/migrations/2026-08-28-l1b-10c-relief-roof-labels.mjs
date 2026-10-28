/**
 * Migration #1467 L1b V-P0d — les matières de RELIEF et de TOITURE reçoivent leur `label`.
 *
 * MOTIF : l'enveloppe exige `label` non vide. Contrairement à 10a/10b, ces libellés ne sont
 * DÉRIVABLES d'aucune source mesurée — ils sont ARBITRÉS (#1467 V-P0d). La table ci-dessous EST donc
 * l'arbitrage lui-même, pas la recopie d'une vérité qui vivrait ailleurs. Deux conséquences portées
 * par le lot : les matériaux de couverture prennent le SINGULIER (`Tuile`, et non le `Tuiles` que le
 * doublon codé en dur `ROOF_MATERIALS` affichait).
 *
 * TABLE RECALÉE #1686 lot 1, dans le train qui la fait bouger (même doctrine que le cardinal de
 * `…-11a-entite-type.mjs`) : `ardoise` → `toit-ardoise` (id composé de l'homonyme, le libellé ne bouge
 * pas), et les deux reliefs MORTS purgés du dataset quittent la table.
 * TABLE RECALÉE #1686 lot 2 : les deux catalogues sont devenus les domaines `relief` et `roof` d'un
 * SEUL document (`materials.json`). L'arbitrage ne change pas ; son PORTEUR, si. Les entrées des
 * autres domaines ne sont pas de la juridiction de cette vague et traversent intactes.
 * TABLE RECALÉE #1715 : `plafond` (relief) purgé du dataset — 0 émetteur mesuré (le dessous d'un
 * surplomb est une dalle `deck`), quitte la table.
 *
 * Entrées : `src/data/materials.json` (lu et écrit).
 *
 * POSITION : `label` s'insère juste après `id`, en 2ᵉ clé.
 * FORME D'AVANT SEULE : seule une entrée d'un domaine arbitré SANS `label` reçoit le sien ; une entrée
 * déjà libellée (révisée ou non depuis), ou absente, est laissée telle quelle.
 * IDEMPOTENT / NO-OP : rejouée, elle n'écrit rien, sort 0.
 * FAIL-FAST : entrée d'un domaine arbitré SANS `label` et absente de la table, entrée sans `id` → rien
 * n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FICHIER = 'src/data/materials.json';

/** Domaine de `materials.json` → le libellé ARBITRÉ de chacune de ses entrées. */
const LOTS = [
  {
    domaine: 'relief',
    labels: {
      terre: 'Terre',
      pierre: 'Pierre',
      pilier: 'Pilier',
    },
  },
  {
    domaine: 'roof',
    labels: {
      tuile: 'Tuile',
      chaume: 'Chaume',
      'toit-ardoise': 'Ardoise',
      plan: 'Plan (vue de dessus)',
    },
  },
];

const erreurs = [];
const cible = path.join(ROOT, FICHIER);
const brut = fs.readFileSync(cible, 'utf8');
const data = JSON.parse(brut);
if (serializeDataset(data) !== brut) erreurs.push(`${FICHIER} : FORME NON CANONIQUE (pas \`JSON.stringify(doc, null, 2)\`)`);
if (!Array.isArray(data)) erreurs.push(`${FICHIER} : racine de forme inattendue (tableau attendu)`);

/** Le libellé arbitré d'une entrée, ou `undefined` si son domaine n'est pas de cette vague. */
const arbitrage = (entree) => LOTS.find((l) => l.domaine === entree.domain)?.labels[entree.id];
const juridiction = (entree) => LOTS.some((l) => l.domaine === entree.domain);

const sortie = [];
const posees = new Set();
if (!erreurs.length) {
  for (const [i, entree] of data.entries()) {
    if (!entree || typeof entree !== 'object' || typeof entree.id !== 'string' || entree.id === '') {
      erreurs.push(`${FICHIER} entrée #${i} : \`id\` absent ou non-chaîne`);
      continue;
    }
    if (!juridiction(entree)) {
      sortie.push(entree);
      continue;
    }
    // PORTE DE FORME (#1812) : la table ne répond que des entrées à la forme SOURCE — sans `label`.
    if (entree.label !== undefined) {
      sortie.push(entree);
      continue;
    }
    const label = arbitrage(entree);
    if (label === undefined) {
      erreurs.push(`${FICHIER} : \`${entree.id}\` (domaine ${entree.domain}) sans \`label\` NI arbitrage — arbitrage requis`);
      continue;
    }
    posees.add(entree.id);
    const { id, ...reste } = entree;
    sortie.push({ id, label, ...reste });
  }
}
const poses = posees.size;

if (erreurs.length) {
  console.error(`relief/roof labels : ${erreurs.length} anomalie(s) — RIEN n'est écrit :`);
  for (const m of erreurs) console.error(`  ${m}`);
  process.exit(1);
}

// NO-OP SÉMANTIQUE : ce script ne possède que la POSE du `label` arbitré — les labels déjà présents
// sont vérifiés égaux à l'arbitrage par la porte ci-dessus. Aucun à poser = rien à écrire, quel que
// soit l'ordre des clés : l'insertion de `label` en 2ᵉ clé est une normalisation d'enveloppe, et une
// égalité à l'octet en ferait une réécriture à elle seule.
if (poses > 0) fs.writeFileSync(cible, serializeDataset(sortie), 'utf8');

// PREUVE post-écriture : cardinal conservé, `id` en tête, `label` non vide égal à l'arbitrage.
const echecs = [];
const apres = JSON.parse(fs.readFileSync(cible, 'utf8'));
if (apres.length !== sortie.length) echecs.push(`POST — ${FICHIER} : ${apres.length} entrée(s) ≠ ${sortie.length}`);
let arbitres = 0;
for (const e of apres) {
  if (!posees.has(e.id)) continue;
  arbitres++;
  if (e.label !== arbitrage(e) || !e.label) echecs.push(`POST — ${FICHIER} : ${e.id} label ${JSON.stringify(e.label)} ≠ arbitrage`);
  if (Object.keys(e)[0] !== 'id') echecs.push(`POST — ${FICHIER} : ${e.id} première clé ${Object.keys(e)[0]} ≠ id`);
}
console.log(`${poses === 0 ? 'no-op' : 'migré'} ${path.basename(FICHIER)} — ${poses} label(s) posé(s), ${arbitres} vérifié(s) sur ${apres.length} entrée(s)`);

if (echecs.length) {
  console.error(`ÉCHEC POST-ÉCRITURE — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}
