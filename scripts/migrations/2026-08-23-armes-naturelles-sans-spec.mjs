/**
 * Migration #1342 — `spec` de Corps à corps / Projectiles : retrait des descripteurs d'attaque
 * NATURELLE (« Griffes », « Crocs », « Toile », « Souffle », « sans spécialisation »…) posés là où
 * seul un **Groupe d'armes** est admis (LDB 62 l.138 ; LDB 85 l.33).
 *
 * L'armement de la créature est porté par son TRAIT (`weaponFromTrait`, `src/engine/creatureEquip.ts:68`) ;
 * une `spec` hors `weaponGroups.json` n'est lue par personne (`acceptableSpecs`, `src/engine/combat.ts:137`,
 * rend `[]` sans Groupe ; `combatSkillPick`, `src/engine/combat.ts:200`, retombe spec-aveugle).
 *
 * REJOUABLE et FAIL-FAST : ne retire que ce que le registre `weaponGroups.json` ne résout PAS
 * (`SPEC_SOURCES.weaponGroupsMelee/Ranged.resolves`, `src/data/index.ts:3135`) ; la valeur retirée est
 * journalisée. Un second passage ne réécrit rien. Arrêt en 1 si `weaponGroups.json` est vide.
 *
 * Entrées : `src/data/weaponGroups.json` (registre des Groupes d'armes) + `src/data/*.json` (tous
 * les datasets, `readdirSync`) + `src/scenes/**.json` (marche récursive).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA_DIR = path.join(ROOT, 'src/data');
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

/** Compétences GROUPÉES par Groupe d'armes (LDB 62 l.138) — `specsSource` weaponGroupsMelee/Ranged. */
const GROUPED_COMBAT_SKILLS = new Set(['corps-a-corps', 'projectiles']);

const weaponGroups = J(path.join(DATA_DIR, 'weaponGroups.json'));
if (!Array.isArray(weaponGroups) || weaponGroups.length === 0) {
  console.error('ARRÊT — weaponGroups.json vide ou illisible : aucune référence pour trancher.');
  process.exit(1);
}
const GROUP_IDS = new Set(weaponGroups.map((g) => g.id));

const retires = [];

/** Tout objet `{ id: 'corps-a-corps'|'projectiles', spec }` d'un tableau `skills` (ou de son `ref`). */
function migrateJson(rel) {
  const full = path.join(ROOT, rel);
  const data = JSON.parse(fs.readFileSync(full, 'utf8'));
  let reecrites = 0;
  const walk = (node, arrKey, owner) => {
    if (Array.isArray(node)) return node.forEach((x) => walk(x, arrKey, owner));
    if (!node || typeof node !== 'object') return;
    const nextOwner = typeof node.id === 'string' && (node.label != null || node.characteristics != null) ? node.id : owner;
    if (arrKey === 'skills' && typeof node.spec === 'string' && GROUPED_COMBAT_SKILLS.has(node.id) && !GROUP_IDS.has(node.spec)) {
      retires.push({ where: rel, owner: nextOwner ?? '?', skillId: node.id, spec: node.spec });
      delete node.spec;
      reecrites++;
    }
    for (const [k, v] of Object.entries(node)) walk(v, Array.isArray(v) ? k : (k === 'ref' ? arrKey : null), nextOwner);
  };
  walk(data, null, undefined);
  if (!reecrites) return false;
  fs.writeFileSync(full, serializeDataset(data), 'utf8');
  return true;
}

const cibles = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json')).map((f) => `src/data/${f}`);
(function collectScenes(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collectScenes(p);
    else if (e.name.endsWith('.json')) cibles.push(path.relative(ROOT, p).replace(/\\/g, '/'));
  }
})(path.join(ROOT, 'src/scenes'));

const touches = [];
for (const rel of cibles) if (migrateJson(rel)) touches.push(rel);

console.log(`Fichiers réécrits : ${touches.length}`);
for (const f of touches) console.log(`  - ${f}`);
console.log(`\nSpecs retirées (hors weaponGroups) : ${retires.length}`);
for (const r of retires) console.log(`  ${r.where}  ${r.owner}  ${r.skillId}/"${r.spec}"`);
