/**
 * Migration #1466 — effet `giveTrapping`, DEUX volets de la MÊME classe (une donnée d'authoring
 * porte un **LIBELLÉ** d'affichage là où le lecteur attend un **id STABLE** de catalogue) :
 *   1. champ `trapping` → champ `trappingId` (catalogue `src/data/trappings.json`) ;
 *   2. éléments de `qualities: [...]` → ids de qualité (catalogue `src/data/qualities.json`).
 *
 * MOTIF MESURÉ : `giveTrappingSchema` (`src/data/schemas/defs-scenes/effets.ts:135`) est un
 * `z.strictObject` dont les seuls canaux d'objet sont `trappingId` et `custom` ; AUCUN lecteur du
 * dépôt ne lit `.trapping` (`applyOps` case `giveTrapping`, `src/engine/ops.ts:2451` ;
 * `giveTrappingLabel`, `src/engine/items.ts:351` ; `gearFromEffects`,
 * `src/state/combatEffects.ts:228` ; `createCombatSlice`, `src/state/combatSlice.ts:2341`). Les
 * nœuds à `trapping` ne donnent donc RIEN au runtime.
 *
 * MOTIF MESURÉ (volet 2) : `withGiveQualities` (`src/engine/items.ts:338`) fait
 * `give.qualities.map((id) => ({ id }))` — l'élément est posé TEL QUEL comme `QualityRef.id` sur
 * l'`ItemInstance`. Un élément en libellé produit un `{ id: 'Magique' }` absent du registre des
 * qualités : aucune mécanique ne s'applique, aucune erreur n'est levée.
 *
 * ENTRÉES (les trois strates de la MÊME donnée — l'artefact SEUL serait réécrit à la prochaine
 * passe d'auteur, `scripts/arene/generate.mjs` régénérant `arene-projet.json`) :
 *   - `src/data/**.json`               (racine de données)
 *   - `src/scenes/**.json`             (racine de scènes — dont l'artefact `arene/arene-projet.json`)
 *   - `scripts/arene/*.mjs`            (AUTHORING qui produit l'artefact ci-dessus)
 *
 * RÉSOLUTION : par les CATALOGUES, jamais par une table figée dans ce script — `label` exact
 * (comparaison normalisée : accents, casse, apostrophes typographiques, espaces multiples).
 * FAIL-FAST : 0 candidat ou 2+ candidats pour un libellé → rien n'est écrit, sortie 1.
 * IDEMPOTENT : un second passage ne trouve plus aucun `trapping`, et tout élément de `qualities`
 * déjà porteur d'un id du registre est laissé intact — aucun fichier n'est réécrit.
 *
 * FORMATAGE PRÉSERVÉ : la réécriture est TEXTUELLE et ancrée sur le couple clé/valeur exact ; le
 * compte textuel est confronté au compte STRUCTUREL (nœuds `type:'giveTrapping'` parcourus sur
 * l'objet parsé) — divergence = sortie 1. Aucun document n'est re-sérialisé (les scènes ont leur
 * propre sérialiseur, `JSON.stringify(doc, null, 1)`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { echapperRegex } from '../../src/lib/regex.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const abs = (rel) => path.join(ROOT, rel);
const rel = (full) => path.relative(ROOT, full).replace(/\\/g, '/');

const norm = (s) =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

// ── Catalogue ────────────────────────────────────────────────────────────────────────────────────
// `src/data/trappings.json` EST le catalogue : `src/data/index.ts:2448` l'expose tel quel
// (`export const trappings = trappingsJson as TrappingData[]`), sans transformation.
const catalogue = JSON.parse(fs.readFileSync(abs('src/data/trappings.json'), 'utf8'));
const parLabel = new Map();
for (const t of catalogue) {
  if (typeof t?.label !== 'string' || typeof t?.id !== 'string') continue;
  const k = norm(t.label);
  parLabel.set(k, [...(parLabel.get(k) ?? []), t.id]);
}

// `src/data/qualities.json` EST le registre des qualités : `src/data/index.ts:2394` l'expose tel
// quel (`export const qualities = qualitiesJson as QualityData[]`), sans transformation.
const registreQualites = JSON.parse(fs.readFileSync(abs('src/data/qualities.json'), 'utf8'));
const qualiteParLabel = new Map();
const qualiteIds = new Set();
for (const q of registreQualites) {
  if (typeof q?.label !== 'string' || typeof q?.id !== 'string') continue;
  qualiteIds.add(q.id);
  const k = norm(q.label);
  qualiteParLabel.set(k, [...(qualiteParLabel.get(k) ?? []), q.id]);
}

const echecs = [];
/** id du catalogue, ou `null` (échec consigné : 0 ou 2+ candidats). */
function resolve(label, where) {
  const ids = parLabel.get(norm(label)) ?? [];
  if (ids.length === 1) return ids[0];
  echecs.push({ label, where, motif: ids.length === 0 ? 'aucun objet de catalogue à ce libellé' : `${ids.length} candidats : ${ids.join(', ')}` });
  return null;
}

/** `null` = déjà un id du registre (rien à faire) ; id = à migrer ; `false` = échec consigné. */
function resolveQualite(valeur, where) {
  if (qualiteIds.has(valeur)) return null;
  const ids = qualiteParLabel.get(norm(valeur)) ?? [];
  if (ids.length === 1) return ids[0];
  echecs.push({ label: valeur, where, motif: ids.length === 0 ? 'aucune qualité de registre à ce libellé' : `${ids.length} candidats : ${ids.join(', ')}` });
  return false;
}

// ── Relevé STRUCTUREL : les nœuds `{ type:'giveTrapping', trapping }` d'un document parsé ─────────
function noeuds(data) {
  const out = [];
  const walk = (n, chemin) => {
    if (Array.isArray(n)) return n.forEach((x, i) => walk(x, `${chemin}[${i}]`));
    if (!n || typeof n !== 'object') return;
    if ((n.type === 'giveTrapping' || n.op === 'giveTrapping') && typeof n.trapping === 'string') {
      out.push({ chemin, label: n.trapping });
    }
    for (const [k, v] of Object.entries(n)) walk(v, `${chemin}.${k}`);
  };
  walk(data, '$');
  return out;
}

const resolus = [];
const touches = [];

// ── JSON : réécriture TEXTUELLE ancrée, compte confronté au relevé structurel ─────────────────────
function migrateJson(full) {
  const brut = fs.readFileSync(full, 'utf8');
  if (!brut.includes('"trapping"')) return;
  let data;
  try { data = JSON.parse(brut); } catch { return; }
  const cibles = noeuds(data);
  const orphelins = (brut.match(/"trapping"\s*:/g) ?? []).length - cibles.length;
  if (orphelins !== 0) {
    echecs.push({ label: '—', where: rel(full), motif: `${orphelins} occurrence(s) textuelle(s) de "trapping" hors d'un nœud giveTrapping` });
    return;
  }
  let out = brut;
  for (const { chemin, label } of cibles) {
    const id = resolve(label, `${rel(full)} ${chemin}`);
    if (id === null) continue;
    const jsonLabel = JSON.stringify(label);
    const ancre = new RegExp(`"trapping"(\\s*:\\s*)${echapperRegex(jsonLabel)}`);
    if (!ancre.test(out)) {
      echecs.push({ label, where: `${rel(full)} ${chemin}`, motif: 'ancre textuelle introuvable' });
      continue;
    }
    out = out.replace(ancre, `"trappingId"$1${JSON.stringify(id)}`);
    resolus.push({ where: `${rel(full)} ${chemin}`, label, id });
  }
  if (out !== brut) { fs.writeFileSync(full, out, 'utf8'); touches.push(rel(full)); }
}

// ── AUTHORING .mjs : `trapping: '<libellé>'` dans un littéral `{ type: 'giveTrapping', … }` ───────
const TS_LINE = /\{\s*type:\s*'giveTrapping',\s*trapping:\s*'((?:[^'\\]|\\.)*)'/g;
function migrateMjs(full) {
  const brut = fs.readFileSync(full, 'utf8');
  if (!TS_LINE.test(brut)) return;
  TS_LINE.lastIndex = 0;
  const out = brut.replace(TS_LINE, (m, label) => {
    const decode = label.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    const id = resolve(decode, rel(full));
    if (id === null) return m;
    resolus.push({ where: rel(full), label: decode, id });
    return m.replace(`trapping: '${label}'`, `trappingId: '${id}'`);
  });
  if (out !== brut) { fs.writeFileSync(full, out, 'utf8'); touches.push(rel(full)); }
}

// ── VOLET 2 — `qualities: [...]` d'un nœud `giveTrapping` : LIBELLÉ → id du registre ───────────
const resolusQualites = [];

/** Nœuds `type:'giveTrapping'` portant un tableau `qualities` non vide, sur l'objet parsé. */
function noeudsQualites(data) {
  const out = [];
  const walk = (n, chemin) => {
    if (Array.isArray(n)) return n.forEach((x, i) => walk(x, `${chemin}[${i}]`));
    if (!n || typeof n !== 'object') return;
    if ((n.type === 'giveTrapping' || n.op === 'giveTrapping') && Array.isArray(n.qualities) && n.qualities.length > 0) {
      out.push({ chemin, valeurs: n.qualities });
    }
    for (const [k, v] of Object.entries(n)) walk(v, `${chemin}.${k}`);
  };
  walk(data, '$');
  return out;
}

// Ancre TEXTUELLE : le tableau `qualities` d'un nœud `giveTrapping`, l'intervalle ne pouvant
// traverser une autre clé `"type"` (donc un autre nœud). Compte confronté au relevé structurel.
const ANCRE_QUAL_JSON = /("type"\s*:\s*"giveTrapping"(?:(?!"type")[\s\S])*?"qualities"\s*:\s*\[)([^\]]*)\]/g;

function migrateJsonQualites(full) {
  const brut = fs.readFileSync(full, 'utf8');
  if (!brut.includes('"giveTrapping"') || !brut.includes('"qualities"')) return;
  let data;
  try { data = JSON.parse(brut); } catch { return; }
  const cibles = noeudsQualites(data);
  if (cibles.length === 0) return;
  ANCRE_QUAL_JSON.lastIndex = 0;
  const trouves = (brut.match(ANCRE_QUAL_JSON) ?? []).length;
  if (trouves !== cibles.length) {
    echecs.push({ label: '—', where: rel(full), motif: `${trouves} ancre(s) textuelle(s) de qualités pour ${cibles.length} nœud(s) giveTrapping à qualités` });
    return;
  }
  let i = 0;
  ANCRE_QUAL_JSON.lastIndex = 0;
  const out = brut.replace(ANCRE_QUAL_JSON, (m, tete, corps) => {
    const { chemin } = cibles[i++];
    const neuf = corps.replace(/"(?:[^"\\]|\\.)*"/g, (q) => {
      const decode = JSON.parse(q);
      const id = resolveQualite(decode, `${rel(full)} ${chemin}`);
      if (id === null || id === false) return q;
      resolusQualites.push({ where: `${rel(full)} ${chemin}`, label: decode, id });
      return JSON.stringify(id);
    });
    return `${tete}${neuf}]`;
  });
  if (out !== brut) { fs.writeFileSync(full, out, 'utf8'); if (!touches.includes(rel(full))) touches.push(rel(full)); }
}

// AUTHORING .mjs : `qualities: [ '<libellé>', … ]` dans un littéral `{ type: 'giveTrapping', … }`
// (l'intervalle ne traverse ni accolade ni crochet : il reste DANS le nœud).
const ANCRE_QUAL_MJS = /(\{\s*type:\s*'giveTrapping',[^}[\]]*qualities:\s*\[)([^\]]*)\]/g;

function migrateMjsQualites(full) {
  const brut = fs.readFileSync(full, 'utf8');
  ANCRE_QUAL_MJS.lastIndex = 0;
  if (!ANCRE_QUAL_MJS.test(brut)) return;
  ANCRE_QUAL_MJS.lastIndex = 0;
  const out = brut.replace(ANCRE_QUAL_MJS, (m, tete, corps) => {
    const neuf = corps.replace(/'((?:[^'\\]|\\.)*)'/g, (q, brute) => {
      const decode = brute.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
      const id = resolveQualite(decode, rel(full));
      if (id === null || id === false) return q;
      resolusQualites.push({ where: rel(full), label: decode, id });
      return `'${id}'`;
    });
    return `${tete}${neuf}]`;
  });
  if (out !== brut) { fs.writeFileSync(full, out, 'utf8'); if (!touches.includes(rel(full))) touches.push(rel(full)); }
}

// ── Parcours des entrées ─────────────────────────────────────────────────────────────────────────
function* fichiers(dir, ext) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* fichiers(p, ext);
    else if (e.name.endsWith(ext)) yield p;
  }
}

for (const f of fichiers(abs('src/data'), '.json')) migrateJson(f);
for (const f of fichiers(abs('src/scenes'), '.json')) migrateJson(f);
for (const f of fichiers(abs('scripts/arene'), '.mjs')) migrateMjs(f);

for (const f of fichiers(abs('src/data'), '.json')) migrateJsonQualites(f);
for (const f of fichiers(abs('src/scenes'), '.json')) migrateJsonQualites(f);
for (const f of fichiers(abs('scripts/arene'), '.mjs')) migrateMjsQualites(f);

// ── Bilan ────────────────────────────────────────────────────────────────────────────────────────
console.log(`Fichiers réécrits : ${touches.length}`);
for (const f of touches) console.log(`  - ${f}`);
console.log(`\nDons migrés LIBELLÉ → trappingId : ${resolus.length}`);
for (const r of resolus) console.log(`  ${r.where}  "${r.label}" → ${r.id}`);

console.log(`\nQualités migrées LIBELLÉ → id : ${resolusQualites.length}`);
for (const r of resolusQualites) console.log(`  ${r.where}  "${r.label}" → ${r.id}`);

if (echecs.length) {
  console.error(`\nARBITRAGE REQUIS — ${echecs.length} libellé(s) non résolu(s) :`);
  for (const e of echecs) console.error(`  ${e.where}  "${e.label}"  (${e.motif})`);
  process.exit(1);
}
