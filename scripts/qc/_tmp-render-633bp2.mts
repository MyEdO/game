/** JETABLE — images-clés #633 B-P2 (coude). Rend 4 PNG dans public/qc/633-B-P2/. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import type { ResolvedBone } from '../../src/gameIso/rig/composeRig';
import { resolveRig } from '../../src/gameIso/rig/composeRig';
import { DEFS } from '../../src/gameIso/sprites';
import { addPose } from '../../src/gameIso/rig/poses';
import { CLIPS, sampleClip, clipDuration } from '../../src/gameIso/rig/anim/clips';
import { weaponRest, mountedAttackClip, weaponParryClip } from '../../src/gameIso/rig/anim/weaponClips';
import { seatRiderOnMount, mountedRest, mountTackBones } from '../../src/gameIso/rig/mountedRig';
import { planById, resolveSpecies } from '../../src/gameIso/rig/bodyPlan';
import { sizeTokenScale } from '../../src/gameIso/sizeScale';
import type { Appearance, RigSpeciesId } from '../../src/gameIso/rig/appearance';
import type { Weapon } from '../../src/engine/types';
import type { EquipCtx } from '../../src/gameIso/rig/parts/equipment';

const OUT = 'public/qc/633-B-P2';
mkdirSync(OUT, { recursive: true });

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
  const r = new Resvg(svg, { background: bg, fitTo: { mode: 'width', value: 480 } });
  writeFileSync(`${OUT}/${name}.png`, r.render().asPng());
  console.log('WROTE', `${OUT}/${name}.png`);
}

const soldat: Appearance = { species: 'Humain' as RigSpeciesId, sex: 'M', build: 0.55, seed: 4 };
const wm = (name: string, type: 'melee' | 'ranged' = 'melee'): Weapon =>
  ({ label: name, type, damage: { plusBF: false, flat: 4 }, qualities: [] } as Weapon);

// 1) STAFF_BLOCK — fantassin bâton, profil, apex de parade (deltas sur le repos bâton).
const baton = wm('Bâton de combat');
const staffApex = addPose(weaponRest(baton), weaponParryClip(baton).steps[0].pose as Record<string, number>);
png('staff-block', resolveRig(soldat, { weapons: [baton], armour: [] }, staffApex, 'Soldat', 'profile', [], false));

// 3) walk-mid — fantassin, frame de marche à mi-course, profil.
const epee = wm('Épée');
const walkMid = addPose(weaponRest(epee), sampleClip(CLIPS.walk, clipDuration(CLIPS.walk) * 0.5).pose);
png('walk-mid', resolveRig(soldat, { weapons: [epee], armour: [] }, walkMid, 'Soldat', 'profile', [], false));

// Composition cavalier-sur-monture (profil), calquée sur gen-clip-anim-gallery.
const quad = planById('quadruped');
const horse = resolveSpecies('cheval').species;
function mounted(name: string, weapon: Weapon, riderPose: Record<string, number>) {
  const equip: EquipCtx = { weapons: [weapon], armour: [] };
  const mountBones = quad.resolve(horse, 'profile', quad.restPose(), {});
  const riderBones = resolveRig(soldat, equip, riderPose, 'Soldat', 'profile', [], false);
  const rideK = 1 / (resolveSpecies(horse).scale * sizeTokenScale('grande'));
  const bones = seatRiderOnMount(
    [...mountBones, ...mountTackBones(mountBones, 'profile')], riderBones,
    { view: 'profile', mountScale: 1, riderScale: rideK },
  ).map((b, i) => ({ ...b, id: `${b.id}_${i}` }));
  png(name, bones, '#1d2230', '0 -80 120 230'); // remonte le cadre : le buste du cavalier est au-dessus de la selle
}

// 2) mounted-gun-recoil — cavalier arme à feu, apex du recul (step[1] du clip monté).
const pistolet = wm('Pistolet', 'ranged');
const gunClip = mountedAttackClip(pistolet);
const gunApex = addPose(mountedRest('profile', pistolet), gunClip.steps[1].pose as Record<string, number>);
mounted('mounted-gun-recoil', pistolet, gunApex);

// 4) seated-rest — cavalier au repos assis (mountedRest sans clip).
mounted('seated-rest', epee, mountedRest('profile', epee) as Record<string, number>);

console.log('DONE');
