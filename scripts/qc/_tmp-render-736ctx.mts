/** JETABLE — QC #736 Lot 3 CONTEXTE : humain en plaque COMPLÈTE (toutes zones) + sanguinaire NU
 *  (repli griffu d'espèce), front/profile, rig ENTIER avec marge (cornes non tronquées).
 *  Sortie : public/qc/736-lot3-ctx/. Usage : npx tsx scripts/qc/_tmp-render-736ctx.mts */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { resolveRig } from '../../src/gameIso/rig/composeRig';
import { bonesToSvg } from '../../src/gameIso/rig/renderBones';
import { entityRigProfile } from '../../src/gameIso/rig/enemyProfile';
import { DEFS } from '../../src/gameIso/sprites';
import type { Appearance, RigSpeciesId } from '../../src/gameIso/rig/appearance';
import type { View } from '../../src/gameIso/rig/facing';
import type { EquipCtx } from '../../src/gameIso/rig/parts/equipment';
import type { ItemInstance } from '../../src/engine/types';

const OUT = resolve(process.cwd(), 'public/qc/736-lot3-ctx');
mkdirSync(OUT, { recursive: true });

const BG = '#1d2230';
// Cadrage LARGE : corps 0..120 × sol 150, marge verticale généreuse (cornes du sanguinaire
// au-dessus du crâne) + marge latérale (armes/coudes).
const VB = '-25 -55 170 215';
function png(name: string, body: string) {
  const [vx, vy, vw, vh] = VB.split(' ').map(Number);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB}"><defs>${DEFS}</defs><rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${BG}"/>${body}</svg>`;
  const r = new Resvg(svg, { background: BG, fitTo: { mode: 'width', value: 520 }, font: { loadSystemFonts: true } });
  writeFileSync(`${OUT}/${name}.png`, r.render().asPng());
  console.log('OK:', `${OUT}/${name}.png`);
}

// 1. Humain en armure de plaque COMPLÈTE : un harnois couvrant TOUTES les locs → chaque slot
// (tete/torse/bras/jambes + dérivés pied/main/cou) prend l'art `plaque` de ARMOUR.
const REF: Appearance = { species: 'Humain' as RigSpeciesId, sex: 'M', build: 0.5, seed: 4 };
const harnois = {
  kind: 'armor', equipped: true, label: 'Harnois de plaque', pa: 5,
  locs: ['tete', 'corps', 'brasG', 'brasD', 'jambeG', 'jambeD'],
} as unknown as ItemInstance;
const EQUIP: EquipCtx = { weapons: [], armour: [harnois] };
for (const view of ['front', 'profile'] as View[])
  png(`plaque-contexte-${view}`, bonesToSvg(resolveRig(REF, EQUIP, {}, undefined, view, [])));

// 2. Sanguinaire de Khorne NU (aucune tenue/équipement) → repli griffu de l'ESPÈCE (mains+pieds).
const p = entityRigProfile('sanguinaire-de-khorne', 7);
if (!p) throw new Error('entityRigProfile(sanguinaire-de-khorne) introuvable');
const NU: EquipCtx = { weapons: [], armour: [] };
for (const view of ['front', 'profile'] as View[])
  png(`sanguinaire-de-khorne-griffu-${view}`, bonesToSvg(resolveRig(p.appearance, NU, {}, undefined, view, [])));

console.log('DONE');
