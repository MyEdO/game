/**
 * Migration #1342 — `spec` de Compétence : LIBELLÉ d'affichage → **id STABLE** du catalogue de
 * spécialisations de la Compétence (`skills.json#specs[]`, ou pool `specsSource` via `weaponGroups`/
 * `domains`). Motif : `testValue`/`actorHasSkill` (`src/engine/skills.ts:57,76,169`) comparent
 * `s.spec === spec` et les consommateurs interrogent par id (`savoirVoiesFluvialesBonus`,
 * `src/engine/riverNavigation.ts:130` ; `savoirOceansBonus`, `src/engine/seaNavigation.ts:79`).
 *
 * REJOUABLE et FAIL-FAST : la résolution est une correspondance de LIBELLÉ EXACTE (insensible à la
 * casse, aux accents, aux apostrophes typographiques et aux espaces multiples) contre le catalogue.
 * Ce que le catalogue ne connaît pas n'est ni inventé, ni supprimé, ni deviné : la migration écrit ce
 * qu'elle résout, LISTE le reste et sort en 1.
 *
 * Marqueur « au choix » (`CHOICE_RE` ci-dessous) : laissé tel quel, la spécialisation reste un
 * EMPLACEMENT.
 *
 * Entrées : `src/data/skills.json`, `src/data/weaponGroups.json`, `src/data/domains.json`
 * (catalogues de résolution) + `src/data/*.json` (tous les datasets, `readdirSync`) +
 * `src/scenes/**.json` (marche récursive) + l'authoring TS `src/scenes/test-scenarios/96-presets-edo.ts`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA_DIR = path.join(ROOT, 'src/data');
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

/** Reflet de `src/data/serialize.ts#serializeDataset` (pas d'import TS depuis ce script .mjs). */
const serializeDataset = (value) => JSON.stringify(value, null, 2);

/** Fichiers d'AUTHORING TypeScript porteurs de `skills: [{ id, spec, value }]`. */
const TS_AUTHORING = ['src/scenes/test-scenarios/96-presets-edo.ts'];

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

// ── Catalogue de spécialisations, par Compétence ─────────────────────────────────────────────────
const skills = J(path.join(DATA_DIR, 'skills.json'));
const weaponGroups = J(path.join(DATA_DIR, 'weaponGroups.json'));
const domains = J(path.join(DATA_DIR, 'domains.json'));
/** Reflet de `SPEC_SOURCES` (`src/data/index.ts:3134`) pour les sources RENCONTRÉES sur `skills.json`.
 *  `resolves` ⊇ `pool` : la VALIDITÉ d'une donnée est le registre entier, pas le pool joueur. */
const SPEC_SOURCES = { weaponGroupsMelee: weaponGroups, weaponGroupsRanged: weaponGroups, winds: domains };

const CATALOGUE = new Map();
for (const def of skills) {
  if (def.specsSource && !SPEC_SOURCES[def.specsSource]) {
    console.error(`ARRÊT — source de spécialisations non reflétée par ce script : ${def.id} → ${def.specsSource}`);
    process.exit(1);
  }
  const entries = def.specsSource ? SPEC_SOURCES[def.specsSource] : (def.specs ?? []);
  const byLabel = new Map();
  for (const e of entries) {
    for (const label of [e.label, e.wind].filter(Boolean)) {
      const k = norm(label);
      if (!byLabel.has(k)) byLabel.set(k, e.id);
    }
  }
  CATALOGUE.set(def.id, { ids: new Set(entries.map((e) => e.id)), byLabel });
}

/** Marqueur « au choix » des spécialisations saisies. */
const CHOICE_RE = /^(au choix|une? au choix)$/i;

const resolus = [];
const nonResolus = [];
const ouverts = [];

/** id du catalogue, marqueur canonique, ou libellé résolu — sinon `null` (à arbitrer). */
function resolve(skillId, spec, where) {
  const cat = CATALOGUE.get(skillId);
  if (!cat) { nonResolus.push({ skillId, spec, where, motif: 'Compétence hors catalogue' }); return null; }
  if (cat.ids.has(spec)) return spec;
  if (CHOICE_RE.test(spec)) { ouverts.push({ skillId, spec, where }); return spec; }
  const id = cat.byLabel.get(norm(spec));
  if (id) { resolus.push({ skillId, spec, id, where }); return id; }
  nonResolus.push({ skillId, spec, where, motif: 'spécialisation absente du catalogue' });
  return null;
}

// ── JSON : tout objet `{ id, spec }` sous un tableau `skills` (directement ou via son `ref`) ──────
function migrateJson(rel) {
  const full = path.join(ROOT, rel);
  const raw = fs.readFileSync(full, 'utf8');
  const data = JSON.parse(raw);
  let reecrites = 0;
  const walk = (node, arrKey) => {
    if (Array.isArray(node)) return node.forEach((x) => walk(x, arrKey));
    if (!node || typeof node !== 'object') return;
    if (typeof node.spec === 'string' && typeof node.id === 'string' && arrKey === 'skills') {
      const id = resolve(node.id, node.spec, rel);
      if (id !== null && id !== node.spec) { node.spec = id; reecrites++; }
    }
    for (const [k, v] of Object.entries(node)) walk(v, Array.isArray(v) ? k : (k === 'ref' ? arrKey : null));
  };
  walk(data, null);
  // Écriture SEULEMENT si une spec a bougé : re-sérialiser un fichier intact reformaterait les
  // documents de scène, qui ont leur propre sérialiseur.
  if (!reecrites) return false;
  fs.writeFileSync(full, serializeDataset(data), 'utf8');
  return true;
}

// ── TypeScript d'authoring : la LIGNE `{ id: 'x', spec: 'y', … }` d'un tableau `skills` ──────────
const TS_LINE = /\{\s*id:\s*'([a-z0-9-]+)',\s*spec:\s*'([^']*)'/;
function migrateTs(rel) {
  const full = path.join(ROOT, rel);
  const raw = fs.readFileSync(full, 'utf8');
  let inSkills = false;
  const lines = raw.split('\n').map((line) => {
    if (/^\s*skills:\s*\[/.test(line)) inSkills = true;
    else if (inSkills && /^\s*\],?\s*$/.test(line)) inSkills = false;
    if (!inSkills) return line;
    const m = TS_LINE.exec(line);
    if (!m) return line;
    const id = resolve(m[1], m[2], rel);
    return id === null || id === m[2] ? line : line.replace(`spec: '${m[2]}'`, `spec: '${id}'`);
  });
  const out = lines.join('\n');
  if (out === raw) return false;
  fs.writeFileSync(full, out, 'utf8');
  return true;
}

const cibles = [
  ...fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json')).map((f) => `src/data/${f}`),
];
(function collectScenes(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collectScenes(p);
    else if (e.name.endsWith('.json')) cibles.push(path.relative(ROOT, p).replace(/\\/g, '/'));
  }
})(path.join(ROOT, 'src/scenes'));

const touches = [];
for (const rel of cibles) if (migrateJson(rel)) touches.push(rel);
for (const rel of TS_AUTHORING) if (migrateTs(rel)) touches.push(rel);

console.log(`Fichiers réécrits : ${touches.length}`);
for (const f of touches) console.log(`  - ${f}`);
console.log(`\nSpecs résolues LIBELLÉ → id : ${resolus.length}`);
for (const r of resolus) console.log(`  ${r.where}  ${r.skillId}/"${r.spec}" → ${r.id}`);
console.log(`\nMarqueur « au choix » (forme canonique, inchangé) : ${ouverts.length}`);

if (nonResolus.length) {
  const uniq = new Map();
  for (const r of nonResolus) {
    const k = `${r.skillId}\u0000${r.spec}`;
    if (!uniq.has(k)) uniq.set(k, { ...r, n: 0, files: new Set() });
    uniq.get(k).n++; uniq.get(k).files.add(r.where);
  }
  console.error(`\nARBITRAGE REQUIS — ${nonResolus.length} occurrences / ${uniq.size} specs distinctes hors catalogue :`);
  for (const r of [...uniq.values()].sort((a, b) => a.skillId.localeCompare(b.skillId) || b.n - a.n)) {
    console.error(`  ${String(r.n).padStart(4)}  ${r.skillId}/"${r.spec}"  (${r.motif})  [${[...r.files].join(', ')}]`);
  }
  process.exit(1);
}
