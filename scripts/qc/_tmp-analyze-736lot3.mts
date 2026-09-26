/** JETABLE — analyse pixel objective des rendus #736 Lot 3 (le harnais canonique mesure une tenueId,
 *  pas une part isolée non câblée). Substitut PARTIEL à l'inspection visuelle (aucun outil vision ici). */
import { Resvg } from '@resvg/resvg-js';
import { buildTokenMap, applyTokenMap } from '../../src/gameIso/rig/palette';
import { pickView, type PartArt } from '../../src/gameIso/rig/parts/types';
import type { View } from '../../src/gameIso/rig/facing';
import { HAND, MAIN_GRIFFUE, CLAWFOOT } from '../../src/gameIso/rig/parts/bodies/extremites';
import { armour as plaque } from '../../src/gameIso/rig/parts/armour/defs/Plaque';

const SKIN = buildTokenMap({ griffe: '#241a12' }, { peau: '#e2b48c' });
const STEEL = buildTokenMap(plaque.palette ?? {}, {});
const BG = { r: 0x1d, g: 0x22, b: 0x30 };

function analyze(label: string, art: PartArt | undefined, view: View, map: Record<string, string>, vb: string) {
  const frag = applyTokenMap(pickView(art, view), map);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"><rect x="-100" y="-100" width="200" height="200" fill="rgb(29,34,48)"/>${frag}</svg>`;
  const img = new Resvg(svg, { background: 'rgb(29,34,48)', fitTo: { mode: 'width', value: 520 } }).render();
  const W = img.width, H = img.height;
  const px = img.pixels;
  let n = 0, minx = W, maxx = 0, miny = H, maxy = 0, light = 0;
  const lums: number[] = [];
  let darkMass = 0, darkSumY = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const r = px[i], g = px[i + 1], b = px[i + 2];
    if (Math.abs(r - BG.r) < 10 && Math.abs(g - BG.g) < 10 && Math.abs(b - BG.b) < 10) continue;
    n++; minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y);
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    lums.push(L);
    if (L > 150) light++;
    if (r < 70 && g < 70 && b < 70) { darkMass++; darkSumY += y; }
  }
  lums.sort((a, b) => a - b);
  const p = (q: number) => lums.length ? lums[Math.floor(q * (lums.length - 1))] : 0;
  console.log(
    `${label.padEnd(22)} px=${String(n).padStart(6)} bbox=[${minx}-${maxx},${miny}-${maxy}] ` +
    `light%=${(100 * light / n).toFixed(1).padStart(5)} spread=${(p(0.9) - p(0.1)).toFixed(0).padStart(3)} ` +
    `L10/50/90=${p(0.1).toFixed(0)}/${p(0.5).toFixed(0)}/${p(0.9).toFixed(0)} ` +
    `darkMass=${String(darkMass).padStart(5)} darkCY=${darkMass ? (darkSumY / darkMass).toFixed(0) : '-'}/${H}`,
  );
}

const VB_HAND = '-8 -6 16 22', VB_FOOT = '-6 -4 18 16', VB_NECK = '-9 -14 18 26';
console.log('--- MAIN_GRIFFUE vs HAND/CLAWFOOT (chair, darkCY bas = griffes en bas de la main) ---');
analyze('main-griffue front', MAIN_GRIFFUE, 'front', SKIN, VB_HAND);
analyze('main-griffue profile', MAIN_GRIFFUE, 'profile', SKIN, VB_HAND);
analyze('main-griffue back', MAIN_GRIFFUE, 'back', SKIN, VB_HAND);
analyze('ref HAND front', HAND, 'front', SKIN, VB_HAND);
analyze('ref CLAWFOOT front', CLAWFOOT, 'front', SKIN, VB_FOOT);
console.log('--- Plaque acier (light% = part de surface claire @metal) ---');
for (const v of ['front', 'profile', 'back'] as View[]) analyze(`soleret ${v}`, plaque.set.pied, v, STEEL, VB_FOOT);
for (const v of ['front', 'profile', 'back'] as View[]) analyze(`gantelet ${v}`, plaque.set.main, v, STEEL, VB_HAND);
for (const v of ['front', 'profile', 'back'] as View[]) analyze(`gorgerin ${v}`, plaque.set.cou, v, STEEL, VB_NECK);
