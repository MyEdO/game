/**
 * Migration #1686 LOT 2 — les trois catalogues de matières du monde FUSIONNENT en un dataset unique
 * `src/data/materials.json`, et le domaine devient une DONNÉE de l'entrée.
 *
 * `propMaterials.json`, `roofMaterials.json` et `reliefMaterials.json` portaient la même chose — une
 * matière de rendu — sous trois documents, trois schémas et trois accesseurs. Le domaine qui les
 * séparait est celui que le pivot du rendu déclare déjà sur chaque Face (`MaterialRef.domain`) :
 * il descend donc dans l'entrée (`domain`), et les trois documents
 * n'ont plus de raison d'être. L'identité d'une matière reste le couple (domaine, id), et l'id reste
 * unique sur tout le périmètre (les homonymes ont été composés au lot 1).
 *
 * Le RENDU est INCHANGÉ : chaque entrée garde toutes ses clés, dans leur ordre, et ne reçoit que son
 * `domain` — plus le `type` d'enveloppe du document d'accueil.
 * ORDRE DES CLÉS de l'entrée fusionnée : `id, type, label, domain, <reste dans son ordre>`
 * (`id,type` en tête = le contrat d'enveloppe gardé par `src/data/migrations-type-enveloppe.test.ts`).
 *
 * Entrées : `src/data/propMaterials.json`, `src/data/roofMaterials.json`,
 * `src/data/reliefMaterials.json` (lus puis SUPPRIMÉS) et `src/data/materials.json` (écrit).
 *
 * PORTE DE FORME, jamais de CARDINAL (#1812) : ce qui protège d'un rejeu sur une donnée d'une AUTRE
 * époque est la FORME des entrées — `id`/`label` de chaîne, `domain` posé (forme CIBLE) ou absent
 * (forme SOURCE), `type` du document d'accueil, ids uniques sur tout le périmètre — et JAMAIS leur
 * nombre : un catalogue de matières croît légitimement, et un compte gelé ferait payer un recalage à
 * chaque matière neuve.
 * MARQUEUR D'IDEMPOTENCE : l'existence des fichiers. Trois sources présentes et pas de `materials.json`
 * = migration ; trois sources absentes et `materials.json` présent = rejeu, aucune écriture, sortie 0
 * (la FORME du RÉSULTAT y est revérifiée). Tout état MIXTE est une anomalie nommée, sortie 1.
 * FAIL-FAST : état mixte, racine non-tableau, dataset vide, entrée sans `id`/`label` de chaîne,
 * entrée portant déjà un `domain`, id répété entre domaines, clé de charge partagée par deux
 * domaines, formatage non canonique → rien n'est écrit, rien n'est supprimé. Les mêmes verdicts sont
 * REJOUÉS après écriture sur le document relu ; aucun n'attend cette relecture pour mordre.
 * FORMATAGE PRÉSERVÉ : `src/data/*.json` est `JSON.stringify(doc, null, 2)` (sans saut final),
 * vérifié AVANT écriture et reproduit en sortie.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const NOM = '2026-09-05-1686-materials';
const TYPE = 'materials';
const CIBLE_REL = 'src/data/materials.json';

/** Fichier SOURCE → domaine de ses entrées. L'ordre est celui de la sortie. */
const SOURCES = [
  { rel: 'src/data/propMaterials.json', domain: 'prop' },
  { rel: 'src/data/roofMaterials.json', domain: 'roof' },
  { rel: 'src/data/reliefMaterials.json', domain: 'relief' },
];

const echec = (m) => {
  console.error(`[${NOM}] ${m}`);
  process.exit(1);
};

const abs = (rel) => path.join(ROOT, rel);
const existe = (rel) => fs.existsSync(abs(rel));

/** Lit un JSON de `src/data` en exigeant sa forme canonique (2 espaces, sans saut final). */
function lire(rel) {
  const brut = fs.readFileSync(abs(rel), 'utf8');
  const doc = JSON.parse(brut);
  if (brut !== JSON.stringify(doc, null, 2)) echec(`${rel} : formatage non canonique en entrée`);
  return doc;
}

/**
 * La FORME CIBLE d'un document fusionné, entrée par entrée : `id`/`label`/`domain` de chaîne, `type`
 * du document d'accueil, ids uniques. REND le compte par domaine — pour le RAPPORT, jamais pour une
 * porte (#1812).
 */
function formeCible(doc, quoi) {
  if (!Array.isArray(doc)) echec(`${quoi} : racine non-TABLEAU`);
  if (!doc.length) echec(`${quoi} : 0 entrée — périmètre vidé`);
  const parDomaine = {};
  const vus = new Map();
  for (const e of doc) {
    if (!e || typeof e !== 'object') echec(`${quoi} : entrée non-objet`);
    if (typeof e.id !== 'string' || !e.id) echec(`${quoi} : entrée sans \`id\` de chaîne non vide`);
    if (typeof e.label !== 'string' || !e.label) echec(`${quoi} : ${e.id} sans \`label\` de chaîne non vide`);
    if (e.type !== TYPE) echec(`${quoi} : ${e.id} porte \`type\` ${JSON.stringify(e.type)} ≠ ${JSON.stringify(TYPE)} — ce document n'est pas celui que cette migration rend`);
    if (typeof e.domain !== 'string' || !e.domain) echec(`${quoi} : ${e.id} sans \`domain\``);
    parDomaine[e.domain] = (parDomaine[e.domain] ?? 0) + 1;
    vus.set(e.id, (vus.get(e.id) ?? 0) + 1);
  }
  const repetes = [...vus].filter(([, n]) => n > 1).map(([id, n]) => `${id} ×${n}`);
  if (repetes.length) echec(`${quoi} : id(s) répété(s) — ${repetes.join(', ')} ; un homonyme se COMPOSE (patron \`toit-ardoise\`/\`prop-ardoise\`)`);
  return parDomaine;
}

/** Le compte par domaine, rendu lisible pour le rapport — `prop 8, roof 4, relief 3`. */
const compte = (parDomaine) => Object.entries(parDomaine).map(([d, n]) => `${d} ${n}`).join(', ');

/** Clés d'ENVELOPPE du document, communes aux trois domaines par construction. */
const ENVELOPPE = ['id', 'type', 'label', 'domain'];
/** `detail` est la SEULE clé de charge que deux domaines partagent (mesuré : `roof` et `relief`). */
const PARTAGEES = ['detail'];

/** Clés de CHARGE par domaine, dérivées des entrées elles-mêmes — jamais récitées. */
function chargeParDomaine(entrees) {
  const par = {};
  for (const e of entrees) {
    (par[e.domain] ??= new Set());
    for (const k of Object.keys(e)) if (!ENVELOPPE.includes(k) && !PARTAGEES.includes(k)) par[e.domain].add(k);
  }
  return par;
}

/** Aucune clé de charge ne doit apparaître sous DEUX domaines — les entrées porteuses sont nommées. */
function ecartsDeClesEtrangeres(entrees) {
  const par = chargeParDomaine(entrees);
  const ecarts = [];
  for (const [domaine, cles] of Object.entries(par)) {
    for (const [autre, siennes] of Object.entries(par)) {
      if (autre <= domaine) continue;
      for (const k of [...cles].sort()) {
        if (!siennes.has(k)) continue;
        const porteuses = entrees.filter((e) => (e.domain === domaine || e.domain === autre) && k in e).map((e) => `${e.domain}/${e.id}`);
        ecarts.push(`la clé \`${k}\` apparaît sous « ${domaine} » ET « ${autre} » — ${porteuses.join(', ')}`);
      }
    }
  }
  return ecarts;
}

// ── PORTE D'ÉTAT — l'arbre est-il AVANT, APRÈS, ou mixte ? Lecture seule. ────────────────────────
const sourcesPresentes = SOURCES.filter((s) => existe(s.rel));
const cible = existe(CIBLE_REL);

if (sourcesPresentes.length === 0 && cible) {
  const doc = lire(CIBLE_REL);
  const parDomaine = formeCible(doc, CIBLE_REL);
  console.log(`[${NOM}] déjà migrée — ${doc.length} matière(s) dans ${CIBLE_REL} (${compte(parDomaine)}), rien à écrire`);
  process.exit(0);
}
if (sourcesPresentes.length !== SOURCES.length || cible) {
  echec(
    `état MIXTE — source(s) présente(s) : ${sourcesPresentes.map((s) => s.rel).join(', ') || '(aucune)'} ; ` +
      `${CIBLE_REL} ${cible ? 'présent' : 'absent'}. La fusion est tout ou rien.`,
  );
}

// ── LECTURE ET PORTES, avant toute écriture ─────────────────────────────────────────────────────
const fusion = [];
for (const s of SOURCES) {
  const doc = lire(s.rel);
  if (!Array.isArray(doc)) echec(`${s.rel} : racine non-TABLEAU`);
  if (!doc.length) echec(`${s.rel} : 0 entrée — périmètre vidé`);
  for (const e of doc) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) echec(`${s.rel} : entrée non-objet`);
    if (typeof e.id !== 'string' || !e.id) echec(`${s.rel} : entrée sans \`id\` de chaîne non vide`);
    if (typeof e.label !== 'string' || !e.label) echec(`${s.rel} : ${e.id} sans \`label\` de chaîne non vide`);
    if ('domain' in e) echec(`${s.rel} : ${e.id} porte déjà un \`domain\` — le domaine est ce que cette migration POSE`);
    const { id, type: _type, label, ...reste } = e;
    fusion.push({ id, type: TYPE, label, domain: s.domain, ...reste });
  }
}
const parDomaine = formeCible(fusion, 'fusion');
const etrangeres = ecartsDeClesEtrangeres(fusion);
if (etrangeres.length) echec(`fusion : ${etrangeres.join(' ; ')}`);

// ── ÉCRITURE ────────────────────────────────────────────────────────────────────────────────────
fs.writeFileSync(abs(CIBLE_REL), JSON.stringify(fusion, null, 2), 'utf8');
for (const s of SOURCES) fs.rmSync(abs(s.rel));

// ── PREUVE POST-ÉCRITURE ────────────────────────────────────────────────────────────────────────
const relu = JSON.parse(fs.readFileSync(abs(CIBLE_REL), 'utf8'));
const echecs = [];
if (SOURCES.some((s) => existe(s.rel))) echecs.push(`fichier(s) source encore présent(s) : ${SOURCES.filter((s) => existe(s.rel)).map((s) => s.rel).join(', ')}`);
formeCible(relu, `POST ${CIBLE_REL}`);
for (const [i, e] of relu.entries()) {
  const attendu = fusion[i];
  if (JSON.stringify(e) !== JSON.stringify(attendu)) echecs.push(`POST ${e.id} : la charge utile relue diffère de la fusion`);
  if (Object.keys(e).slice(0, 4).join(',') !== 'id,type,label,domain') echecs.push(`POST ${e.id} : tête ${Object.keys(e).slice(0, 4).join(',')} ≠ id,type,label,domain`);
  if (e.type !== TYPE) echecs.push(`POST ${e.id} : \`type\` ${JSON.stringify(e.type)} ≠ ${JSON.stringify(TYPE)}`);
}
for (const m of ecartsDeClesEtrangeres(relu)) echecs.push(`POST : ${m}`);
if (echecs.length) {
  console.error(`[${NOM}] ÉCHEC POST-ÉCRITURE : ${[...new Set(echecs)].join(' ; ')}`);
  process.exit(1);
}

console.log(
  `[${NOM}] migré — ${relu.length} matière(s) dans ${CIBLE_REL} (${compte(parDomaine)}), ` +
    `${SOURCES.length} document(s) source supprimé(s)`,
);
