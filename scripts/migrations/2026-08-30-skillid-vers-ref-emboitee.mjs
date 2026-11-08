/**
 * Migration L2 #1548 — la graphie `skillId` MEURT dans les données : une référence de Compétence
 * s'écrit `{ id, spec? }`.
 *
 * DEUX FORMES CIBLES, selon ce que le porteur EST (frontière jugée du lot) :
 *  - COMPOSITION à plat — l'entrée d'une LISTE DE COMPÉTENCES EST la référence ; ses autres champs
 *    sont des extras de porteur (`ref('skill', extra)` / `specRef('skill', extra)`) :
 *    `activities.skills[]`, `axes.skills[]`, `crewRoles.skills[]`, `creatures.optionals[].grant[]`.
 *  - RÉFÉRENCE EMBOÎTÉE `skill: { id, spec? }` — le porteur DÉCRIT un jet (`difficulty`, `totalDR`,
 *    `extendedDR`, `maxAttempts`, `onFail`, `fallM`…) ou est un `GameOp` : la référence s'y emboîte
 *    au lieu de redire ses champs à plat : `incidents-monture.mount.riderTest`,
 *    `river-criticals`/`ship-criticals` `crewTest`, `sea-cargo.opportunite.test`,
 *    `sea-perils` `freeTest`/`tourbillonSwim`, `steam-breakdown.restart[]`, `water-exposure.test`,
 *    op `grantCareerSkill` de `talents.passive[]`.
 *
 * ENTRÉES : les 12 datasets de `src/data` qui portent la graphie ; aucun autre fichier.
 *
 * TRANSFORMATION PAR CHEMIN DE SCHÉMA (jamais un remplacement de texte) : chaque chemin est
 * énuméré ci-dessous et visité par un marcheur ; un `skillId` rencontré HORS de ces chemins est une
 * anomalie → rien n'est écrit, sortie 1.
 * RENAME/REGROUPEMENT PUR : aucune valeur ne change, la clé porteuse garde sa position.
 * PREUVE : les deux artefacts (avant, après) ramenés à la graphie `skillId` sont deep-equal.
 * IDEMPOTENT : rejouée sur l'état final, elle n'écrit rien et sort 0.
 * FORMATAGE PRÉSERVÉ : chaque fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT
 * toute écriture, et réécrit tel quel (LF, aucun `\r`).
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { estObjet } from '../../src/lib/objet.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Chemins PORTEURS, par fichier : `forme` = `plat` (composition) ou `emboitee` (`skill: {...}`).
 *  Un chemin est la suite des clés depuis la racine, `[]` traversant un tableau. */
const CHEMINS = [
  { fichier: 'activities.json', chemin: ['[]', 'skills', '[]'], forme: 'plat' },
  { fichier: 'axes.json', chemin: ['[]', 'skills', '[]'], forme: 'plat' },
  { fichier: 'crew-roles.json', chemin: ['[]', 'skills', '[]'], forme: 'plat' },
  { fichier: 'creatures.json', chemin: ['[]', 'optionals', '[]', 'grant', '[]'], forme: 'plat' },
  { fichier: 'incidents-monture.json', chemin: ['entries', '[]', 'mount', 'riderTest'], forme: 'emboitee' },
  { fichier: 'river-criticals.json', chemin: ['tables', '{}', '[]', 'crewTest'], forme: 'emboitee' },
  { fichier: 'ship-criticals.json', chemin: ['tables', '{}', '[]', 'crewTest'], forme: 'emboitee' },
  { fichier: 'sea-cargo.json', chemin: ['opportunite', 'test'], forme: 'emboitee' },
  { fichier: 'sea-perils.json', chemin: ['hazards', '[]', 'freeTest'], forme: 'emboitee' },
  { fichier: 'sea-perils.json', chemin: ['tourbillonSwim'], forme: 'emboitee' },
  { fichier: 'steam-breakdown.json', chemin: ['[]', 'restart', '[]'], forme: 'emboitee' },
  { fichier: 'talents.json', chemin: ['[]', 'passive', '[]'], forme: 'emboitee' },
  { fichier: 'water-exposure.json', chemin: ['test'], forme: 'emboitee' },
];

const FICHIERS = [...new Set(CHEMINS.map((c) => c.fichier))].sort();

/** Visite les nœuds situés au bout de `chemin`, et rend ceux qui portent encore `skillId`. */
function* auChemin(noeud, chemin) {
  if (noeud == null || typeof noeud !== 'object') return;
  if (chemin.length === 0) {
    if (!Array.isArray(noeud) && Object.hasOwn(noeud, 'skillId')) yield noeud;
    return;
  }
  const [tete, ...reste] = chemin;
  if (tete === '[]') {
    if (!Array.isArray(noeud)) return;
    for (const e of noeud) yield* auChemin(e, reste);
  } else if (tete === '{}') {
    if (Array.isArray(noeud)) return;
    for (const v of Object.values(noeud)) yield* auChemin(v, reste);
  } else {
    yield* auChemin(noeud[tete], reste);
  }
}

/** Tous les objets du document qui portent `skillId`, où qu'ils soient (contrôle d'exhaustivité). */
function* partout(noeud) {
  if (Array.isArray(noeud)) { for (const e of noeud) yield* partout(e); return; }
  if (noeud == null || typeof noeud !== 'object') return;
  if (Object.hasOwn(noeud, 'skillId')) yield noeud;
  for (const v of Object.values(noeud)) yield* partout(v);
}

/** `{…, skillId, spec?, …}` → `{…, id, spec?, …}` (COMPOSITION) : `skillId` devient `id` EN PLACE. */
const versPlat = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k === 'skillId' ? 'id' : k, v]));

/** `{…, skillId, spec?, …}` → `{…, skill: {id, spec?}, …}` (EMBOÎTÉE) : la référence prend la place
 *  de `skillId`, `spec` la rejoint et disparaît du porteur. */
function versEmboitee(o) {
  const sortie = {};
  for (const [k, v] of Object.entries(o)) {
    if (k === 'skillId') sortie.skill = Object.hasOwn(o, 'spec') ? { id: v, spec: o.spec } : { id: v };
    else if (k !== 'spec') sortie[k] = v;
  }
  return sortie;
}

/** Inverse des deux formes — sert à PROUVER que seule la graphie a bougé. */
function versSkillId(noeud) {
  if (Array.isArray(noeud)) return noeud.map(versSkillId);
  if (noeud == null || typeof noeud !== 'object') return noeud;
  const sortie = {};
  for (const [k, v] of Object.entries(noeud)) {
    if (k === 'skill' && estObjet(v) && Object.hasOwn(v, 'id')) {
      sortie.skillId = v.id;
      if (Object.hasOwn(v, 'spec')) sortie.spec = v.spec;
    } else if (k === 'id' && typeof v === 'string') sortie.skillId = v;
    else sortie[k] = versSkillId(v);
  }
  return sortie;
}

const anomalies = [];
const documents = new Map();

for (const f of FICHIERS) {
  const abs = path.join(ROOT, 'src/data', f);
  const brut = fs.readFileSync(abs, 'utf8');
  const data = JSON.parse(brut);
  if (JSON.stringify(data, null, 2) !== brut) {
    console.error(`FORME NON CANONIQUE — src/data/${f} n’est pas \`JSON.stringify(doc, null, 2)\` ; AUCUNE écriture.`);
    process.exit(1);
  }
  documents.set(f, { abs, brut, data });
}

// EXHAUSTIVITÉ : chaque porteur de `skillId` du document doit être atteint par un chemin déclaré.
for (const [f, { data }] of documents) {
  const cibles = new Set();
  for (const c of CHEMINS.filter((c) => c.fichier === f)) for (const n of auChemin(data, c.chemin)) cibles.add(n);
  for (const n of partout(data)) {
    if (!cibles.has(n)) anomalies.push(`src/data/${f} : \`skillId\` HORS chemin déclaré — ${JSON.stringify(n).slice(0, 160)}`);
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
  // Le porteur est REMPLACÉ dans son parent : on repasse par le parent pour poser l'objet réécrit.
  for (const parent of parents(data, c.chemin)) {
    const { conteneur, cle } = parent;
    const o = conteneur[cle];
    if (!estObjet(o) || !Object.hasOwn(o, 'skillId')) continue;
    conteneur[cle] = c.forme === 'plat' ? versPlat(o) : versEmboitee(o);
    comptes.set(c.fichier, (comptes.get(c.fichier) ?? 0) + 1);
  }
}

/** Comme `auChemin`, mais rend le COUPLE (conteneur, clé/index) du nœud terminal. */
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

let ecrits = 0;
let total = 0;
for (const [f, { abs, brut, data }] of documents) {
  const out = JSON.stringify(data, null, 2);
  try {
    assert.deepEqual(versSkillId(JSON.parse(out)), versSkillId(JSON.parse(brut)));
    assert.equal(out.includes('\r'), false, `src/data/${f} : le texte réécrit contient un \`\\r\``);
    assert.equal(out.includes('"skillId"'), false, `src/data/${f} : la graphie \`skillId\` survit`);
  } catch (e) {
    console.error(`VÉRIFICATION PRÉ-ÉCRITURE ROUGE : ${e.message}`);
    process.exit(1);
  }
  if (out !== brut) { fs.writeFileSync(abs, out, 'utf8'); ecrits++; }
  const n = comptes.get(f) ?? 0;
  total += n;
  console.log(`src/data/${f} — ${n} référence(s) migrée(s) ; ${out !== brut ? 'réécrit' : 'INCHANGÉ (no-op byte-identique)'}.`);
}

console.log(`TOTAL : ${total} référence(s) de Compétence migrée(s) sur ${FICHIERS.length} datasets ; ${ecrits} fichier(s) réécrit(s).`);
console.log('PREUVE deep-equal : les deux artefacts ramenés à la graphie `skillId` sont IDENTIQUES — OK ; `skillId` restants : 0 ; `\\r` : 0.');
