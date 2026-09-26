/** JETABLE — QC #633 jambe Lot 1 : rend les 6 tenues migrées (front + profil) APRÈS migration.
 *  Sortie : public/qc/633-jambe1/<id>-apres-{front,profile}.png */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import type { ResolvedBone } from '../../src/gameIso/rig/composeRig';
import { resolveRig } from '../../src/gameIso/rig/composeRig';
import { DEFS } from '../../src/gameIso/sprites';
import type { Appearance, RigSpeciesId } from '../../src/gameIso/rig/appearance';
import type { View } from '../../src/gameIso/rig/facing';
import type { EquipCtx } from '../../src/gameIso/rig/parts/equipment';

const ROOT = 'C:/Users/gauch/PhpstormProjects/Foundry/Game/.claude/worktrees/agent-af77c27a0632ab874';
const OUT = resolve(ROOT, 'public/qc/633-jambe1');
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
  const r = new Resvg(svg, { background: bg, fitTo: { mode: 'width', value: 560 }, font: { loadSystemFonts: true } });
  writeFileSync(`${OUT}/${name}.png`, r.render().asPng());
  console.log('OK:', `${OUT}/${name}.png`);
}

const IDS = ['soldat', 'sorcier', 'chevaucheur-de-blaireau', 'charlatan', 'chevalier', 'villageois'];
for (const id of IDS) {
  for (const view of ['front', 'profile'] as View[]) {
    const bones = resolveRig(REF, EQUIP, {}, id, view, [], false);
    png(`${id}-apres-${view}`, bones);
  }
}
console.log('DONE');
