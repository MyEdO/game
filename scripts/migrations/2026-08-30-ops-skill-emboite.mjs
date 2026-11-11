/**
 * Migration L2 #1548 (commit 3c) — les FRÈRES PLATS `skill` + `spec` MEURENT : partout où une donnée
 * DÉSIGNE une Compétence, elle écrit la référence EMBOÎTÉE `skill: { id, spec? }`.
 *
 * TROIS transformations, sur le MÊME slot `skill` :
 *  - `skill: "athletisme"`            → `skill: { id: "athletisme" }`
 *  - `skill: "metier", spec: "forgeron"` → `skill: { id: "metier", spec: "forgeron" }` (le frère meurt)
 *  - `skill: ["ramer", "voile"]`      → `skill: [{ id: "ramer" }, { id: "voile" }]` (liste de réfs)
 *  - op `castPenalty` `skill: "all"`  → le slot DISPARAÎT : l'ABSENCE dit « toute magie », idiome déjà
 *    posé par `grantReverseToken` (`src/engine/ops.ts:483` : « `skill` absent = tout »).
 *
 * HOMONYMES NON TOUCHÉS PAR CE GESTE (le champ `skill` n'y désigne pas une Compétence) : le coût en PX
 * d'une Augmentation (`advancementCosts[]`, un NOMBRE), l'effet de scène `{type, skill: 55, intBonus}`
 * (une VALEUR de Test) et `tavernGames[].skill: null` (le jeu ne teste AUCUNE Compétence) — les trois
 * sont ÉTEINTS par la migration suivante (`2026-08-30-l2-3d-homonyme-skill.mjs`, commit 3d).
 *
 * SPÉCIALISATION EN LIBELLÉ corrigée dans le geste (même correction que « Ingénieur » au commit 3b) :
 * `tavernGames` alvatafl écrivait `spec: "Art de la Guerre"` (LIBELLÉ) ×2 → id de pool `guerre`
 * (`src/data/skills.json:1394` `{"id":"guerre","label":"Guerre"}`). La graphie « Savoir (Guerre) » est
 * celle des sources FR (LDB 08 l.1089, ADE II 08 l.81 qui porte LA règle, VDM 04 l.90, ACE 05 l.1005) ;
 * « Savoir (Art de la Guerre) » (NADJ 16 l.25) en est la variante d'écriture, conservée VERBATIM dans
 * le `desc` de l'entrée — seule la RÉFÉRENCE mécanique prend l'id.
 *
 * TRANSFORMATION PAR CHEMIN DE SCHÉMA (jamais un remplacement de texte) : chaque chemin est énuméré
 * ci-dessous et visité par un marcheur ; un porteur migrable rencontré HORS de ces chemins est une
 * anomalie → rien n'est écrit, sortie 1.
 * RENAME PUR : aucune valeur ne change (hors la spéc en libellé, déclarée ci-dessus).
 * PREUVE : les deux artefacts (avant, après) ramenés à la graphie PLATE sont deep-equal.
 * ENTRÉES : les documents énumérés par la table de CHEMINS ci-dessous (21 documents des deux racines,
 * chacun avec son chemin de schéma) — aucun autre fichier n'est lu.
 * IDEMPOTENT : rejouée sur l'état final, elle n'écrit rien et sort 0.
 * FORMATAGE PRÉSERVÉ : chaque fichier est EXACTEMENT `JSON.stringify(doc, null, 2)` (les datasets de
 * `src/data`) ou `JSON.stringify(doc)` (les documents de scène, compacts), constaté AVANT toute
 * écriture et réécrit dans SA forme (LF, aucun `\r`).
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { estObjet } from '../../src/lib/objet.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Chemins PORTEURS, par fichier : la suite des clés depuis la racine, `[]` traversant un tableau,
 *  `{}` traversant les valeurs d'un objet. Relevé exhaustif du 2026-08-30 sur les 2 racines authorées. */
const CHEMINS = [
  // #1657 B2a : la Compétence testée d'une rangée de Critique vit dans le nœud `test` du Flow,
  // dont `flowTestSchema.skill` est DÉJÀ la référence emboîtée — plus aucun chemin à migrer ici.
  ['src/data/criticals.json', ['[]', 'entries', '[]', 'test', 'test']],
  ['src/data/activities.json', ['[]', 'outcomes', '[]', 'ops', '[]']],
  ['src/data/domains.json', ['[]', 'windModifiers', '[]', 'cancelledBy', 'test']],
  ['src/data/drunkenness.json', ['entries', '[]', 'ops', '[]']],
  ['src/data/etats.json', ['[]', 'effects', '[]', 'flow', 'test']],
  ['src/data/etats.json', ['[]', 'recover']],
  ['src/data/maneuvers.json', ['[]', 'effects', '[]', 'flow', 'steps', '[]', 'test']],
  ['src/data/miscast.json', ['[]', 'entries', '[]', 'ops', '[]']],
  ['src/data/miscast.json', ['[]', 'entries', '[]', 'test']],
  ['src/data/mutations.json', ['[]', 'passive', '[]']],
  ['src/data/naval-traits.json', ['[]', 'passive', '[]']],
  ['src/data/psychology.json', ['[]', 'test']],
  ['src/data/qualities.json', ['[]', 'effects', '[]', 'flow', 'then', 'test']],
  ['src/data/qualities.json', ['[]', 'effects', '[]', 'flow', 'oui', 'test']],
  ['src/data/sea-shanties.json', ['[]', 'crewOps', '[]']],
  ['src/data/spells.json', ['[]', 'effects', 'steps', '[]', 'effect', 'ops', '[]']],
  ['src/data/spells.json', ['[]', 'effects', 'steps', '[]', 'effect', 'ops', '[]', 'onHitEffects', '[]', 'flow', 'test']],
  ['src/data/spells.json', ['[]', 'effects', 'steps', '[]', 'fail', 'steps', '[]', 'test']],
  ['src/data/spells.json', ['[]', 'effects', 'steps', '[]', 'test']],
  ['src/data/spells.json', ['[]', 'effects', 'steps', '[]', 'then', 'effect', 'ops', '[]']],
  ['src/data/spells.json', ['[]', 'effects', 'steps', '[]', 'then', 'steps', '[]', 'test']],
  ['src/data/spells.json', ['[]', 'effects', 'steps', '[]', 'yes', 'test']],
  ['src/data/spells.json', ['[]', 'variants', '[]', 'effects', 'steps', '[]', 'test']],
  ['src/data/tables.json', ['[]', 'rows', '[]', 'ops', '[]']],
  ['src/data/talents.json', ['[]', 'combat', 'reverseFailed']],
  ['src/data/talents.json', ['[]', 'effects', '[]', 'flow', 'test']],
  ['src/data/talents.json', ['[]', 'test', 'matches', '[]']],
  ['src/data/talents.json', ['[]', 'variants', '[]', 'test', 'matches', '[]']],
  ['src/data/tavernGames.json', ['[]']],
  ['src/data/tavernGames.json', ['[]', 'options', '[]']],
  ['src/data/tavernGames.json', ['[]', 'throwerPenalty', 'test']],
  ['src/data/traits.json', ['[]', 'aura', 'passive', '[]']],
  ['src/data/traits.json', ['[]', 'effects', '[]', 'flow', 'then', 'test']],
  ['src/data/traits.json', ['[]', 'passive', '[]']],
  ['src/data/trappings.json', ['[]', 'consumable', 'effect', 'ops', '[]']],
  ['src/data/trappings.json', ['[]', 'consumable', 'effect', 'ops', '[]', 'onHitEffects', '[]', 'flow', 'then', 'test']],
  ['src/data/trappings.json', ['[]', 'consumable', 'else', 'success', 'effect', 'ops', '[]']],
  ['src/data/trappings.json', ['[]', 'consumable', 'steps', '[]', 'test']],
  ['src/data/trappings.json', ['[]', 'consumable', 'test']],
  ['src/data/trappings.json', ['[]', 'onHitEffects', '[]', 'flow', 'then', 'test']],
  ['src/data/trappings.json', ['[]', 'passive', '[]']],
  ['src/data/traumas.json', ['[]', 'ops', '[]']],
  ['src/scenes/arene/arene-projet.json', ['scenes', '[]', 'dialogues', '[]', 'nodes', '[]', 'choices', '[]', 'flow', 'test']],
  ['src/scenes/arene/arene-projet.json', ['scenes', '[]', 'entities', '[]', 'interact', 'flow', 'test']],
  ['src/scenes/arene/arene-projet.json', ['scenes', '[]', 'triggers', '[]', 'flow', 'steps', '[]', 'effect']],
  ['src/scenes/arene/arene-projet.json', ['scenes', '[]', 'triggers', '[]', 'flow', 'test']],
  ['src/scenes/loup-et-saumure/loup-et-saumure-projet.json', ['scenes', '[]', 'dialogues', '[]', 'nodes', '[]', 'choices', '[]', 'flow', 'steps', '[]', 'effect']],
  ['src/scenes/loup-et-saumure/loup-et-saumure-projet.json', ['scenes', '[]', 'dialogues', '[]', 'nodes', '[]', 'choices', '[]', 'flow', 'test']],
].map(([fichier, chemin]) => ({ fichier, chemin }));

/** SPÉCIALISATIONS EN LIBELLÉ corrigées dans le geste — `libellé → id de pool`, liste FERMÉE et
 *  NOMINATIVE : une valeur non listée reste telle quelle (le contrat `spec-pool-contrat` la nomme). */
const SPEC_LIBELLE_VERS_ID = new Map([['savoir\u0000Art de la Guerre', 'guerre']]);

/** FORMES d'écriture ADMISES, constatées fichier par fichier avant toute écriture et réécrites à
 *  l'identique : les datasets de `src/data` sont indentés à 2, les documents de scène à 1 + saut final. */
const FORMES = [
  { nom: 'indent 2', rendu: (d) => JSON.stringify(d, null, 2) },
  { nom: 'indent 1 + saut final', rendu: (d) => `${JSON.stringify(d, null, 1)}\n` },
];

const FICHIERS = [...new Set(CHEMINS.map((c) => c.fichier))].sort();

/** Un nœud PORTE-T-IL une référence de Compétence encore à plat ? (`skill` chaîne, ou tableau de
 *  chaînes). Le `skill` NOMBRE / `null` / déjà emboîté n'en est pas une. */
function estPorteur(n) {
  if (!estObjet(n) || !Object.hasOwn(n, 'skill')) return false;
  const v = n.skill;
  return typeof v === 'string' || (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string'));
}

/** Visite les nœuds au bout de `chemin` et rend le COUPLE (conteneur, clé) du nœud terminal. */
function* parents(noeud, chemin, conteneur = null, cle = null) {
  if (chemin.length === 0) {
    if (conteneur != null) yield { conteneur, cle };
    return;
  }
  if (noeud == null || typeof noeud !== 'object') return;
  const [tete, ...reste] = chemin;
  if (tete === '[]') {
    if (!Array.isArray(noeud)) return;
    for (let i = 0; i < noeud.length; i++) yield* parents(noeud[i], reste, noeud, i);
  } else if (tete === '{}') {
    if (Array.isArray(noeud)) return;
    for (const k of Object.keys(noeud)) yield* parents(noeud[k], reste, noeud, k);
  } else {
    if (Array.isArray(noeud)) return;
    yield* parents(noeud[tete], reste, noeud, tete);
  }
}

/** Tous les porteurs du document, où qu'ils soient (contrôle d'exhaustivité). */
function* partout(noeud) {
  if (Array.isArray(noeud)) { for (const e of noeud) yield* partout(e); return; }
  if (noeud == null || typeof noeud !== 'object') return;
  if (estPorteur(noeud)) yield noeud;
  for (const v of Object.values(noeud)) yield* partout(v);
}

/** `{…, skill: "x", spec?: "y", …}` → `{…, skill: {id:"x", spec?:"y"}, …}` : la référence prend la
 *  place du champ plat, `spec` la rejoint et disparaît du porteur. L'op `castPenalty` `skill:"all"`
 *  perd son slot (l'absence dit « toute magie »). */
function emboite(o) {
  const sortie = {};
  const specPlate = Object.hasOwn(o, 'spec') ? o.spec : undefined;
  for (const [k, v] of Object.entries(o)) {
    if (k === 'skill') {
      if (Array.isArray(v)) { sortie.skill = v.map((id) => ({ id })); continue; }
      if (o.op === 'castPenalty' && v === 'all') continue;
      if (specPlate === undefined) { sortie.skill = { id: v }; continue; }
      const corrige = SPEC_LIBELLE_VERS_ID.get(`${v}\u0000${specPlate}`);
      sortie.skill = { id: v, spec: corrige ?? specPlate };
    } else if (k !== 'spec' || specPlate === undefined) sortie[k] = v;
  }
  return sortie;
}

/** Inverse — sert à PROUVER que seule la graphie a bougé (les corrections de libellé déclarées sont
 *  ré-appliquées à l'artefact d'ENTRÉE, jamais masquées : la preuve porte sur la GRAPHIE). */
function versPlat(noeud) {
  if (Array.isArray(noeud)) return noeud.map(versPlat);
  if (noeud == null || typeof noeud !== 'object') return noeud;
  const sortie = {};
  for (const [k, v] of Object.entries(noeud)) {
    if (k === 'skill' && Array.isArray(v) && v.every((x) => x && typeof x === 'object' && typeof x.id === 'string')) {
      sortie.skill = v.map((x) => x.id);
    } else if (k === 'skill' && estObjet(v) && typeof v.id === 'string') {
      sortie.skill = v.id;
      if (Object.hasOwn(v, 'spec')) sortie.spec = v.spec;
    } else if (k === 'skill' && typeof v === 'string' && Object.hasOwn(noeud, 'spec')) {
      const corrige = SPEC_LIBELLE_VERS_ID.get(`${v}\u0000${noeud.spec}`);
      sortie.skill = v;
      if (corrige !== undefined) sortie.specCorrigee = corrige;
    } else sortie[k] = versPlat(v);
  }
  if (Object.hasOwn(sortie, 'specCorrigee')) { sortie.spec = sortie.specCorrigee; delete sortie.specCorrigee; }
  if (sortie.op === 'castPenalty' && !Object.hasOwn(sortie, 'skill')) sortie.skill = 'all';
  return sortie;
}

const anomalies = [];
const documents = new Map();

for (const f of FICHIERS) {
  const abs = path.join(ROOT, f);
  const brut = fs.readFileSync(abs, 'utf8');
  const data = JSON.parse(brut);
  const forme = FORMES.find((fm) => fm.rendu(data) === brut);
  if (!forme) {
    console.error(`FORME NON CANONIQUE — ${f} n’est aucune des formes déclarées (${FORMES.map((fm) => fm.nom).join(', ')}) ; AUCUNE écriture.`);
    process.exit(1);
  }
  documents.set(f, { abs, brut, data, forme });
}

// EXHAUSTIVITÉ : chaque porteur du document doit être atteint par un chemin déclaré.
for (const [f, { data }] of documents) {
  const cibles = new Set();
  for (const c of CHEMINS.filter((c) => c.fichier === f)) {
    for (const { conteneur, cle } of parents(data, c.chemin)) if (estPorteur(conteneur[cle])) cibles.add(conteneur[cle]);
  }
  for (const n of partout(data)) {
    if (!cibles.has(n)) anomalies.push(`${f} : réf de Compétence à plat HORS chemin déclaré — ${JSON.stringify(n).slice(0, 160)}`);
  }
}
if (anomalies.length) {
  console.error(`ARBITRAGE REQUIS — ${anomalies.length} anomalie(s), AUCUNE écriture :`);
  for (const a of new Set(anomalies)) console.error(`  ${a}`);
  process.exit(1);
}

const comptes = new Map();
for (const c of CHEMINS) {
  const { data } = documents.get(c.fichier);
  for (const { conteneur, cle } of parents(data, c.chemin)) {
    if (!estPorteur(conteneur[cle])) continue;
    conteneur[cle] = emboite(conteneur[cle]);
    comptes.set(c.fichier, (comptes.get(c.fichier) ?? 0) + 1);
  }
}

let ecrits = 0;
let total = 0;
for (const [f, { abs, brut, data, forme }] of documents) {
  const out = forme.rendu(data);
  try {
    assert.deepEqual(versPlat(JSON.parse(out)), versPlat(JSON.parse(brut)));
    assert.equal(out.includes('\r'), false, `${f} : le texte réécrit contient un \`\\r\``);
  } catch (e) {
    console.error(`VÉRIFICATION PRÉ-ÉCRITURE ROUGE : ${e.message}`);
    process.exit(1);
  }
  if (out !== brut) { fs.writeFileSync(abs, out, 'utf8'); ecrits++; }
  const n = comptes.get(f) ?? 0;
  total += n;
  console.log(`${f} — ${n} référence(s) migrée(s) ; ${out !== brut ? 'réécrit' : 'INCHANGÉ (no-op byte-identique)'}.`);
}

console.log(`TOTAL : ${total} référence(s) de Compétence emboîtée(s) sur ${FICHIERS.length} documents ; ${ecrits} fichier(s) réécrit(s).`);
console.log('PREUVE deep-equal : les deux artefacts ramenés à la graphie PLATE sont IDENTIQUES — OK ; `\\r` : 0.');
