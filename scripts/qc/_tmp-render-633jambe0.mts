/** JETABLE — QC #633 Lot 0 : corps NU 3 vues après migration jambe→gabarit (`jambeVetue`).
 *  Rend front/back/profile dans public/qc/633-jambe0/ (preuve : identique au Nu d'avant). */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import type { ResolvedBone } from '../../src/gameIso/rig/composeRig';
import { resolveRig } from '../../src/gameIso/rig/composeRig';
import { DEFS } from '../../src/gameIso/sprites';
import type { Appearance, RigSpeciesId } from '../../src/gameIso/rig/appearance';
import type { View } from '../../src/gameIso/rig/facing';
import type { EquipCtx } from '../../src/gameIso/rig/parts/equipment';

const OUT = resolve(process.cwd(), 'public/qc/633-jambe0');
mkdirSync(OUT, { recursive: true });

const REF: Appearance = {
  species: 'Humain' as RigSpeciesId,
  sex: 'M',
  build: 0.5,
  seed: 4,
  hairstyle: 'cheveux-courts-soignes-raie-sur-le-cote-m',
};
const EQUIP: EquipCtx = { weapons: [], armour: [] };

const boneInner = (b: ResolvedBone): string => {
  const inner = b.parts.map((p) => (p.mirror ? `<g transform="scale(-1,1)">${p.svg}</g>` : p.svg)).join('');
  return `<g transform="scale(${b.scale[0].toFixed(4)},${b.scale[1].toFixed(4)})">${inner}</g>`;
};
const mat = (m: number[]) => `matrix(${m.map((v) => +v.toFixed(3)).join(',')})`;
const staticSvg = (bones: ResolvedBone[]): string =>
  [...bones].sort((a, z) => a.z - z.z).map((b) => `<g transform="${mat(b.matrix)}">${boneInner(b)}</g>`).join('');

function png(name: string, bones: ResolvedBone[], bg = '#1d2230', vb = '0 0 120 150') {
  const [vx, vy, vw, vh] = vb.split(' ').map(Number);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"><defs>${DEFS}</defs><rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${bg}"/>${staticSvg(bones)}</svg>`;
  const r = new Resvg(svg, { background: bg, fitTo: { mode: 'width', value: 480 }, font: { loadSystemFonts: true } });
  writeFileSync(`${OUT}/${name}.png`, r.render().asPng());
  console.log('OK:', `${OUT}/${name}.png`);
}

for (const view of ['front', 'back', 'profile'] as View[]) {
  png(`nu-${view}`, resolveRig(REF, EQUIP, {}, 'nu', view, [], false));
}
console.log('DONE');
