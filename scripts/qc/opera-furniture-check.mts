/**
 * QC (assertions) — vérifie le placement du MOBILIER de `opera/furnished` (`scenarioEntities`) contre la
 * géométrie `opera/floorplan` : aucun prop
 * (z=0) ne doit tomber DANS un mur (case non marchable), sur le PARTERRE (sièges, hors props 'siege'),
 * ni hors de la grille. Liste les anomalies. Exit 0 si propre.  npx tsx scripts/qc/opera-furniture-check.mts
 */
import { buildOperaFloorplan, parterreSeatCells } from '../../src/scenes/opera/floorplan';
import { scenarioEntities } from '../../src/scenes/opera/furnished';
import { sceneMetresPerTile, tileAt } from '../../src/state/scene';
import { propFootTiles } from '../../src/state/footprint';
import { terrainWalkable } from '../../src/state/terrain';

const scene = buildOperaFloorplan();
const W = scene.dimensions.w, H = scene.dimensions.h;
const seatSet = new Set(parterreSeatCells().map((c) => `${c.x},${c.y}`));
const bad: string[] = [];

// Les lustres FLOTTENT au-dessus du vide central / du foyer (suspendus) — exemptés du contrôle de sol.
const FLOATING = new Set(['lustre-opera']);

const entites = scenarioEntities();
for (const e of entites) {
  if (e.kind !== 'prop' || !e.ref || FLOATING.has(e.ref)) continue;
  const z = e.z ?? 0;
  for (const { x, y } of propFootTiles(e.ref, e.pos, e.facing, sceneMetresPerTile(scene))) {
    if (x < 0 || y < 0 || x >= W || y >= H) { bad.push(`${e.id} HORS-GRILLE (${x},${y})`); continue; }
    const t = tileAt(scene, x, y, z);
    if (!terrainWalkable(t)) bad.push(`${e.id} DANS UN MUR/vide (${x},${y}) tile=${t} z=${z}`);
    // le parterre (cellules de siège) est réservé aux 'siege' ; tout autre prop dessus = collision
    if (z === 0 && e.ref !== 'siege' && seatSet.has(`${x},${y}`)) bad.push(`${e.id} SUR LE PARTERRE (${x},${y})`);
  }
}

if (bad.length) {
  console.error(`KO: ${bad.length} anomalies de placement :`);
  for (const b of bad) console.error('  - ' + b);
  process.exit(1);
}
const props = entites.filter((e) => e.kind === 'prop' && e.ref).length;
console.log(`OK: ${props} props placés, 0 anomalie (aucun dans un mur / sur le parterre / hors grille).`);
