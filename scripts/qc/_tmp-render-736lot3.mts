/** JETABLE — QC #736 Lot 3 : 4 pièces neuves rendues ISOLÉES (câblage resolve.ts = lot suivant,
 *  donc pas de compo — on rend la part seule, comme le crâne-solo d'un lot précédent).
 *  Sortie : public/qc/736-lot3/. Usage : npx tsx scripts/qc/_tmp-render-736lot3.mts */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { buildTokenMap, applyTokenMap } from '../../src/gameIso/rig/palette';
import { pickView, type PartArt } from '../../src/gameIso/rig/parts/types';
import type { View } from '../../src/gameIso/rig/facing';
import { HAND, MAIN_GRIFFUE, CLAWFOOT, NECK } from '../../src/gameIso/rig/parts/bodies/extremites';
import { armour as plaque } from '../../src/gameIso/rig/parts/armour/defs/Plaque';

const OUT = resolve(process.cwd(), 'public/qc/736-lot3');
mkdirSync(OUT, { recursive: true });

// Tables token→hex EXACTES du rendu : chair (peau paysan + griffe système career.ts) / acier (palette Plaque).
const SKIN = buildTokenMap({ griffe: '#241a12' }, { peau: '#e2b48c' });
const STEEL = buildTokenMap(plaque.palette ?? {}, {});

const BG = '#1d2230';
function png(name: string, art: PartArt | undefined, view: View, map: Record<string, string>, vb: string) {
  const frag = applyTokenMap(pickView(art, view), map);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"><rect x="-100" y="-100" width="200" height="200" fill="${BG}"/>${frag}</svg>`;
  const r = new Resvg(svg, { background: BG, fitTo: { mode: 'width', value: 520 }, font: { loadSystemFonts: true } });
  writeFileSync(`${OUT}/${name}.png`, r.render().asPng());
  console.log('OK:', `${OUT}/${name}.png`);
}

// viewBox par empreinte (marge autour du repère local de l'os).
const VB_HAND = '-8 -6 16 22';   // poignet -2..doigts/griffes +10
const VB_FOOT = '-6 -4 18 16';   // cheville -1..sol/pointe +8 (profil pointe +x)
const VB_NECK = '-9 -14 18 26';  // colonne cou -16.4..+6

// 1. MAIN_GRIFFUE (repli de main des griffues) + repères de distinction HAND/CLAWFOOT.
for (const v of ['front', 'profile', 'back'] as View[]) png(`main-griffue-${v}`, MAIN_GRIFFUE, v, SKIN, VB_HAND);
png('ref-hand-front', HAND, 'front', SKIN, VB_HAND);
png('ref-clawfoot-front', CLAWFOOT, 'front', SKIN, VB_FOOT);
png('ref-neck-front', NECK, 'front', SKIN, VB_NECK);

// 2/3/4. Plaque : soleret (pied), gantelet (main), gorgerin (cou).
for (const v of ['front', 'profile', 'back'] as View[]) png(`plaque-soleret-${v}`, plaque.set.pied, v, STEEL, VB_FOOT);
for (const v of ['front', 'profile', 'back'] as View[]) png(`plaque-gantelet-${v}`, plaque.set.main, v, STEEL, VB_HAND);
for (const v of ['front', 'profile', 'back'] as View[]) png(`plaque-gorgerin-${v}`, plaque.set.cou, v, STEEL, VB_NECK);

console.log('DONE');
