/** JETABLE — QC #736 refonte des 3 pieds (FOOT/CLAWFOOT/PLAINFOOT).
 *  Rend front + profile en ZOOM serré sur le pied, dans public/qc/736-pieds/.
 *  Usage: npx tsx _tmp-render-736pieds.mts <avant|apres> */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import type { ResolvedBone } from '../../src/gameIso/rig/composeRig';
import { resolveRig } from '../../src/gameIso/rig/composeRig';
import { DEFS } from '../../src/gameIso/sprites';
import type { Appearance, RigSpeciesId } from '../../src/gameIso/rig/appearance';
import type { View } from '../../src/gameIso/rig/facing';
import type { EquipCtx } from '../../src/gameIso/rig/parts/equipment';

const phase = process.argv[2] === 'apres' ? 'apres' : 'avant';
const OUT = resolve(process.cwd(), 'public/qc/736-pieds');
mkdirSync(OUT, { recursive: true });

const EQUIP: EquipCtx = { weapons: [], armour: [] };

// Un perso par TYPE de pied (footStyle résolu par la tenue).
const CASES: { name: string; tenue: string; species: RigSpeciesId }[] = [
  { name: 'botte', tenue: 'soldat', species: 'Humain' as RigSpeciesId }, // boot
  { name: 'plainfoot', tenue: 'nu', species: 'Humain' as RigSpeciesId }, // plain
  { name: 'clawfoot', tenue: 'squelette', species: 'Humain' as RigSpeciesId }, // claw
];

const boneInner = (b: ResolvedBone): string => {
  const inner = b.parts.map((p) => (p.mirror ? `<g transform="scale(-1,1)">${p.svg}</g>` : p.svg)).join('');
  return `<g transform="scale(${b.scale[0].toFixed(4)},${b.scale[1].toFixed(4)})">${inner}</g>`;
};
const mat = (m: number[]) => `matrix(${m.map((v) => +v.toFixed(3)).join(',')})`;
const staticSvg = (bones: ResolvedBone[]): string =>
  [...bones].sort((a, z) => a.z - z.z).map((b) => `<g transform="${mat(b.matrix)}">${boneInner(b)}</g>`).join('');

// resvg panique sur un PETIT viewBox (bbox de gradient dégénéré, geom.rs). On garde donc un
// viewBox PLEIN 120x150 (sûr) et on ZOOME le contenu par scale centré sur les pieds.
const VW = 120;
const VH = 150;
const ZOOM = 2.8;
function feetCenter(bones: ResolvedBone[]): { fx: number; fy: number } {
  const feet = bones.filter((b) => b.id.startsWith('pied'));
  const xs = feet.map((b) => b.matrix[4]);
  const ys = feet.map((b) => b.matrix[5]);
  const fx = xs.reduce((a, v) => a + v, 0) / (xs.length || 1);
  const fy = Math.max(...ys) - 3; // léger décalage vers le haut (pied s'étend vers le sol)
  return { fx, fy };
}

function png(name: string, bones: ResolvedBone[], bg = '#1d2230') {
  const { fx, fy } = feetCenter(bones);
  const t = `translate(${(VW / 2).toFixed(3)},${(VH / 2).toFixed(3)}) scale(${ZOOM}) translate(${(-fx).toFixed(3)},${(-fy).toFixed(3)})`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}"><defs>${DEFS}</defs><rect x="0" y="0" width="${VW}" height="${VH}" fill="${bg}"/><g transform="${t}">${staticSvg(bones)}</g></svg>`;
  const r = new Resvg(svg, { background: bg, fitTo: { mode: 'width', value: 640 }, font: { loadSystemFonts: true } });
  writeFileSync(`${OUT}/${name}.png`, r.render().asPng());
  console.log('OK:', `${OUT}/${name}.png`);
}

for (const c of CASES) {
  const REF: Appearance = {
    species: c.species,
    sex: 'M',
    build: 0.5,
    seed: 4,
    hairstyle: 'cheveux-courts-soignes-raie-sur-le-cote-m',
  };
  for (const view of ['front', 'profile'] as View[]) {
    const bones = resolveRig(REF, EQUIP, {}, c.tenue, view, [], false);
    png(`${c.name}-${phase}-${view}`, bones);
  }
}
console.log('DONE', phase);
