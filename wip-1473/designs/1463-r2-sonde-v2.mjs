// Sonde R2 #1473 — lecture seule. Joue depuis la racine de l'arbre jugé.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = '/home/claude/game/.wt-1473-r1';
process.chdir(ROOT);
const { idsDuDataset } = await import(join(ROOT, 'scripts/gen-registry.mjs'));
const J = (f) => JSON.parse(readFileSync(join(ROOT, 'src/data', f), 'utf8'));
const DEFS = join(ROOT, 'src/data/schemas/defs');
const fautes = [];
const check = (nom, ok, detail) => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${nom}${detail ? ' — ' + detail : ''}`); if (!ok) fautes.push(nom); };

// A. Comptes config / listes à id (premier niveau et imbriquées)
const configs = [];
for (const f of readdirSync(DEFS).filter((f) => f.endsWith('.ts') && !f.startsWith('_') && !f.endsWith('.test.ts'))) {
  const s = readFileSync(join(DEFS, f), 'utf8');
  const file = s.match(/^export const file = '([^']+)';$/m)?.[1];
  const fam = s.match(/^export const famille = '([^']+)';$/m)?.[1];
  const niche = s.match(/niche:\s*\{\s*categories:\s*\[([^\]]*)\]/)?.[1];
  if (fam === 'config') configs.push({ def: f, file, niche });
}
const listesAId = (o, p = []) => {
  const out = [];
  if (Array.isArray(o)) {
    if (o.some((e) => e && typeof e === 'object' && !Array.isArray(e) && typeof e.id === 'string')) out.push({ p: p.join('.'), entrees: o, ids: o.filter((e) => e && typeof e.id === 'string').map((e) => e.id) });
    o.forEach((e, i) => out.push(...listesAId(e, [...p, '[]'])));
  } else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) out.push(...listesAId(v, [...p, k]));
  return out;
};
let nDocListes = 0, nListes = 0, nPremier = 0, rejetLibelle = [], nulRacine = 0;
const collisionsIntraDoc = [];
for (const c of configs) {
  let r; try { r = J(c.file); } catch { console.log('  (json illisible)', c.file); continue; }
  if (idsDuDataset(r, 'config') === null) nulRacine++;
  const ls = listesAId(r);
  const dedup = new Map(); for (const l of ls) if (!dedup.has(l.p)) dedup.set(l.p, l);
  if (dedup.size) nDocListes++;
  nListes += dedup.size;
  for (const l of dedup.values()) {
    if (!l.p.includes('[]')) nPremier++;
    if (idsDuDataset(l.entrees, 'entite') === null) rejetLibelle.push(`${c.file}›${l.p}`);
  }
  const vu = new Map();
  for (const l of dedup.values()) for (const id of new Set(l.ids)) { if (vu.has(id) && vu.get(id) !== l.p) collisionsIntraDoc.push(`${c.file}: « ${id} » dans ${vu.get(id)} ET ${l.p}`); else vu.set(id, l.p); }
}
console.log(`A. config=${configs.length} idsDuDataset(racine)=null:${nulRacine} docsAvecListesAId=${nDocListes} listes=${nListes} dontPremierNiveau=${nPremier}`);
console.log(`A. listes que idsDuDataset REFUSE (id=libellé): ${rejetLibelle.length} ${JSON.stringify(rejetLibelle)}`);
console.log(`A. collisions d'id ENTRE listes d'un même config: ${collisionsIntraDoc.length}`); collisionsIntraDoc.slice(0, 12).forEach((x) => console.log('   ', x));
console.log(`A. configs à niche déclarée: ${configs.filter((c) => c.niche).map((c) => c.file + '[' + c.niche + ']').join(' ; ')}`);

// B. Désignateurs du D4
const deep = (o, cb) => { if (Array.isArray(o)) o.forEach((x) => deep(x, cb)); else if (o && typeof o === 'object') { cb(o); Object.values(o).forEach((v) => deep(v, cb)); } };
const ctt = J('crew-test-types.json').types.map((t) => t.id);
const tt = []; deep(J('naval-traits.json'), (o) => { if (o.op === 'skillDRBonus' && o.testType) tt.push(o.testType); });
check('B1 naval-traits skillDRBonus.testType ⊂ crew-test-types.types', tt.every((v) => ctt.includes(v)), JSON.stringify(tt));
const roles = J('crew-roles.json'); const rids = (Array.isArray(roles) ? roles : roles.entries ?? []).map((r) => r.id);
const des = J('crew-test-types.json').types.flatMap((t) => [...t.roles, t.essential]);
check('B2 crew-test-types roles/essential ⊂ crew-roles', des.every((v) => rids.includes(v)), `hors: ${JSON.stringify([...new Set(des.filter((v) => !rids.includes(v)))])}`);
const sc = J('sea-cargo.json').cargoes; const scIds = sc.map((c) => c.id);
const marqueurs = sc.filter((c) => c.echangeable === false).map((c) => c.id);
console.log(`B. sea-cargo.cargoes: ${scIds.length} ids, dont marqueurs (echangeable:false): ${JSON.stringify(marqueurs)}`);
const ports = J('naval-ports.json');
const prod = ports.flatMap((p) => p.production ?? []);
check('B3 naval-ports.production ⊂ sea-cargo.cargoes', prod.every((v) => scIds.includes(v)), `hors: ${JSON.stringify([...new Set(prod.filter((v) => !scIds.includes(v)))])}`);
const cles = ports.flatMap((p) => [...Object.keys(p.surplus ?? {}), ...Object.keys(p.demande ?? {})]);
console.log(`B4 naval-ports surplus/demande: ${cles.length} CLÉS désignatrices (absentes de D4), ${new Set(cles).size} distinctes`);
check('B4 surplus/demande clés ⊂ sea-cargo.cargoes', cles.every((v) => scIds.includes(v)), `hors: ${JSON.stringify([...new Set(cles.filter((v) => !scIds.includes(v)))])}`);
check('B4b surplus/demande ne désignent aucun marqueur', !cles.some((v) => marqueurs.includes(v)), JSON.stringify(cles.filter((v) => marqueurs.includes(v))));
const wm = J('mass-battle.json').warMachines.map((w) => w.id);
const rigs = []; deep(J('trappings.json'), (o) => { if (typeof o.siegeRig === 'string') rigs.push(o.siegeRig); });
check('B5 trappings.siegeRig ⊂ mass-battle.warMachines', rigs.every((v) => wm.includes(v)), `siegeRig distincts: ${JSON.stringify([...new Set(rigs)])} ; hors: ${JSON.stringify([...new Set(rigs.filter((v) => !wm.includes(v)))])}`);
const lc = J('land-cargo.json').cargoes.map((c) => c.id);
console.log(`B. land-cargo.cargoes: ${lc.length} ids`);

// C. Source vivante : les listes nichées sont-elles exclues ?
const ov = readFileSync(join(ROOT, 'src/data/overrides.ts'), 'utf8');
check('C1 ENTREES_VIVES exclut les niches (état courant)', /if \(fichier === undefined \|\| NESTED_ARRAY_ROOT\[cle\]\) continue;/.test(ov));
for (const k of ['crewTestTypes', 'seaCargo', 'landCargo', 'massBattleWarMachines']) check(`C2 binding vivant ${k} existe dans ARRAYS`, new RegExp(`\\b${k}\\b`).test(ov.slice(0, ov.indexOf('export type DatasetKey'))));
const sw = readFileSync(join(DEFS, 'sea-weather.ts'), 'utf8').match(/edit:\s*\{[^}]*\}/)?.[0];
console.log(`C3 sea-weather.ts exposition.edit = ${sw}`);
console.log(`FAUTES=${fautes.length} ${JSON.stringify(fautes)}`);
process.exitCode = fautes.length ? 1 : 0;
