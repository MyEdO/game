/**
 * Migration #1695 — un État « pour la durée du Sort » est PORTÉ par l'effet actif du sort.
 *
 * L'op `condition` de ces Sorts copiait la durée sur le PION (`durationRounds` → `ConditionInstance.
 * roundsLeft`) : le pion vivait alors sa vie propre, hors de portée de la Dissipation et de la
 * Surincantation de Durée. Elle porte désormais `carried: true` (`src/engine/ops.ts`) : l'État est posé
 * en op PASSIVE sur l'`ActiveEffect` du Sort, à `durationFromCtx`, et réconcilié en pion DÉRIVÉ.
 *
 * MOTIF AU SOURCE — la PROSE de chaque Sort, mot pour mot :
 *  - `transmutation-de-chamon` (`Source/Warhammer v4 - Livre de base version corrigee/48 - Magie des
 *    Couleurs.md` l.495) : « le Sort ignore le Bonus d'Endurance et inflige +1 États *Aveuglé*,
 *    *Assourdi* et *Sonné*, qui persistent tous pour la durée du Sort. » ;
 *  - `miasme-mystifiant` (même chapitre, Domaine des Ombres) : « gagnant +1 État Aveuglé, +1 État
 *    Assourdi et +1 État Exténué, qui persistent pour la durée du Sort. » ;
 *  - `brume-mystique-magie-du-marais` (VDM p.217) : « Brume mystique a le même effet que le Sort du
 *    Domaine des *Ombres Miasme mystifiant* (page 112) » — il HÉRITE donc de la phrase ci-dessus.
 * `sommeil` NE BOUGE PAS : sa prose (LDB 47 l.269-277) noue l'Inconscient à des réveils sur ÉVÉNEMENT
 * (bruit fort, cible déplacée ou bousculée), un régime distinct de la seule durée — il reste à
 * `durationRounds` (#1695 lot 2) : la migration ne le lit pas.
 *
 * GESTE 2 — l'op `narrative` de Chamon PARAPHRASAIT la clause de fin du Sort et la renvoyait au MJ
 * (« — arbitrage MJ »). La clause EXISTE au livre et reste non modélisée : elle doit donc rester
 * JOURNALISÉE, mais VERBATIM (règle 5, aucune reformulation) — `48 - Magie des Couleurs.md` l.495 :
 * « Si les cibles meurent pendant que le Sort est actif, elles sont enfermées de façon permanente dans
 * une carapace de métaux communs, un macabre rappel des risques de la sorcellerie. »
 * L'op est donc RÉÉCRITE à ce texte — ni supprimée (la clause disparaîtrait du jeu et le tableau
 * `docs/sorts-implementation.md` afficherait un ✅ qui ment), ni laissée paraphrasée.
 *
 * ENTRÉE : `src/data/spells.json`, aux SEULES entrées nommées ci-dessous : 9 op `condition` (3 par
 * Sort) + 1 op `narrative` chez Chamon.
 * FORME D'AVANT SEULE : une op `condition` d'un État déclaré ne se migre qu'EXACTEMENT à sa forme
 * d'avant (durée du Bonus de Force Mentale, sans `carried`), l'op `narrative` qu'à la paraphrase
 * maison EXACTE ; un Sort ou une op absents, migrés ou révisés depuis, sont laissés tels quels.
 * IDEMPOTENT : rejouée sur l'état final, elle ne trouve plus aucun porteur et sort 0.
 * FORMATAGE PRÉSERVÉ : `JSON.stringify(doc, null, 2)` exact (LF, sans newline final), constaté AVANT
 * toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { porteLaTranche } from './lib/formeDAvant.mjs';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FICHIER = 'src/data/spells.json';

/** Sorts PORTEURS et le jeu d'États que leur prose dit « pour la durée du Sort » — LISTE CLOSE. */
const PORTEURS = {
  'transmutation-de-chamon': ['aveugle', 'assourdi', 'sonne'],
  'miasme-mystifiant': ['aveugle', 'assourdi', 'extenue'],
  'brume-mystique-magie-du-marais': ['aveugle', 'assourdi', 'extenue'],
};
/** Durée attendue sur CHAQUE op porteuse avant migration (la Durée du Sort, déjà déclarée à `duration`). */
const DUREE_ATTENDUE = { bonusOf: 'force-mentale' };
/** Texte MAISON à remplacer (EXACT, jamais un motif) et texte VERBATIM d'arrivée (LDB 48 l.495). */
const NARRATIVE_MAISON = 'Transmutation de Chamon : une cible qui meurt pendant le Sort est enfermée dans une carapace de métal — arbitrage MJ.';
const NARRATIVE_VERBATIM = 'Si les cibles meurent pendant que le Sort est actif, elles sont enfermées de façon permanente dans une carapace de métaux communs, un macabre rappel des risques de la sorcellerie.';

const abs = path.join(ROOT, FICHIER);
const brut = fs.readFileSync(abs, 'utf8');
const data = JSON.parse(brut);
if (serializeDataset(data) !== brut) {
  console.error(`FORME NON CANONIQUE — ${FICHIER} n'est pas un JSON indenté à 2 ; AUCUNE écriture.`);
  process.exit(1);
}
if (!Array.isArray(data)) {
  console.error(`FORME INATTENDUE — ${FICHIER} n'est pas une liste d'entrées ; AUCUNE écriture.`);
  process.exit(1);
}

/** Tous les nœuds d'op `condition` d'une entrée, où qu'ils vivent dans son arbre d'effets. */
function* opsCondition(noeud) {
  if (Array.isArray(noeud)) { for (const e of noeud) yield* opsCondition(e); return; }
  if (noeud == null || typeof noeud !== 'object') return;
  if (noeud.op === 'condition') yield noeud;
  for (const v of Object.values(noeud)) yield* opsCondition(v);
}

/** Le tableau `ops` d'une feuille `do`/`ops` qui porte les op `condition` de l'entrée — c'est LÀ que
 *  vit la clause narrative du Sort (même feuille, même cible). */
function listeDesConditions(noeud) {
  if (Array.isArray(noeud)) {
    if (noeud.some((o) => o && o.op === 'condition')) return noeud;
    for (const e of noeud) { const t = listeDesConditions(e); if (t) return t; }
    return null;
  }
  if (noeud == null || typeof noeud !== 'object') return null;
  for (const v of Object.values(noeud)) { const t = listeDesConditions(v); if (t) return t; }
  return null;
}

/** Les gestes en attente dans `doc` : les op `condition` à leur forme d'avant, et l'op `narrative`
 *  de Chamon à la paraphrase maison. */
function gestes(doc) {
  const sites = [];
  for (const [id, etats] of Object.entries(PORTEURS)) {
    for (const op of opsCondition(doc.find((s) => s?.id === id))) {
      if (etats.includes(op.id) && porteLaTranche(op, { durationRounds: DUREE_ATTENDUE, carried: undefined })) sites.push({ id, op });
    }
  }
  const chamon = doc.find((s) => s?.id === 'transmutation-de-chamon');
  const liste = chamon ? listeDesConditions(chamon.effects) : null;
  const narrative = liste?.find((o) => porteLaTranche(o, { op: 'narrative', text: NARRATIVE_MAISON })) ?? null;
  return { sites, narrative, liste };
}

const { sites, narrative, liste } = gestes(data);

// FORME, jamais cardinal (#1812) : le catalogue des Sorts grandit à chaque livre FR, et un Sort neuf
// à l'État « pour la durée du Sort » doit se MIGRER, pas faire sortir 1.
if (sites.length === 0 && narrative === null) {
  console.log('RIEN À FAIRE — aucun État « pour la durée du Sort » ni clause de Chamon à leur forme d\'avant.');
  process.exit(0);
}

for (const { op } of sites) {
  delete op.durationRounds; // la durée du pion EST celle de l'effet porteur (`durationFromCtx`)
  op.carried = true;
}
if (narrative) {
  narrative.text = NARRATIVE_VERBATIM;
  // L'ARRIVÉE se PROUVE, elle ne se suppose pas : une seule op `narrative` chez Chamon, au VERBATIM.
  const narratives = liste.filter((o) => o.op === 'narrative');
  assert.equal(narratives.length, 1, `transmutation-de-chamon : ${narratives.length} op \`narrative\`, 1 attendue`);
}

fs.writeFileSync(abs, serializeDataset(data));
console.log(`${sites.length} op \`condition\` → « carried: true » :`);
for (const s of sites) console.log(`  ${s.id}.${s.op.id}`);
console.log(`transmutation-de-chamon, clause de fin de Sort (LDB 48 l.495) : ${narrative ? 'paraphrase maison → VERBATIM' : 'hors forme d\'avant'}.`);
