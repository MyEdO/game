/** Rend chaque (espèce × vue) du gabarit quadrupède en PNG INDIVIDUEL, grand et SANS label
 *  (id opaque c01..cNN), pour une reconnaissance aveugle honnête par agents. Clé privée
 *  (id → espèce/vue) dans map.json (NON donnée aux agents — sert au scoring). Headless.
 *  → public/qc/quad-cells/cNN.png + map.json. Lancer : npx tsx scripts/_qc-quad-cells.mts */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { defsGlobaux } from '../src/gameIso/sprites';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { resolveQuad } from '../src/gameIso/rig/quadruped/composeQuad';
import { quadWalkPose } from '../src/gameIso/rig/quadruped/quadPose';
import { quadSpeciesNames } from '../src/gameIso/rig/quadruped/quadSkeleton';
import { VIEWS, type View } from '../src/gameIso/rig/facing';

type Cell = { species: string; view: View; pose: string };
const cells: Cell[] = [];
for (const species of quadSpeciesNames()) {
  for (const view of VIEWS) cells.push({ species, view, pose: 'repos' });
  cells.push({ species, view: 'profile', pose: 'marche' }); // 1 pose dynamique / espèce (défauts de membres)
}

mkdirSync('public/qc/quad-cells', { recursive: true });
const map: Record<string, Cell> = {};
cells.forEach((c, i) => {
  const id = `c${String(i + 1).padStart(2, '0')}`;
  map[id] = c;
  const pose = c.pose === 'marche' ? quadWalkPose(0.25) : {};
  const inner = bonesToSvg(resolveQuad(c.species, c.view, pose));
  const W = 124, H = 156;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${defsGlobaux()}</defs><rect width="${W}" height="${H}" fill="#3a4150"/><line x1="0" y1="150" x2="${W}" y2="150" stroke="#5a6276" stroke-width="0.5"/><g transform="translate(2,3)">${inner}</g></svg>`;
  writeFileSync(`public/qc/quad-cells/${id}.png`, new Resvg(svg, { background: '#3a4150', fitTo: { mode: 'width', value: 300 } }).render().asPng());
});
writeFileSync('public/qc/quad-cells/map.json', JSON.stringify(map, null, 1));
console.log(`OK → ${cells.length} cellules (public/qc/quad-cells/cNN.png) + map.json (clé privée)`);
