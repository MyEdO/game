/** Rend la POSE DE PORT (weaponRest, = pose de combat au repos) par arme. → public/qc/stance.png
 *  Contrairement aux autres planches, applique weaponRest (ce que le RigToken montre en combat). */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { defsGlobaux } from '../src/gameIso/sprites';
import { weaponRest } from '../src/gameIso/rig/anim/weaponClips';
import type { Weapon } from '../src/engine/types';
import { VIEW_LABEL, type View } from '../src/gameIso/rig/facing';
import { asRigSpeciesId } from '../src/gameIso/rig/appearance';
import { assertWardrobeId } from './_lib-wardrobe';

// Mannequin : ID de garde-robe (carrière ∪ classe ∪ tenue), validé fail-fast — un id qui retombe
// sur « nu » déshabillerait la planche en silence (#1338).
const MANNEQUIN = 'soldat';
assertWardrobeId(MANNEQUIN, 'qc-combat-stance');

const WEAPONS = ['Épée', 'Hache', 'Masse', 'Lance', 'Hallebarde', 'Bâton de combat', 'Arc', 'Arbalète'];
const COLUMNS: { view: View; mirror: boolean; label: string }[] = [
  { view: 'front', mirror: false, label: VIEW_LABEL.front }, { view: 'profile', mirror: false, label: VIEW_LABEL.profile },
];
const wpn = (name: string): Weapon => ({ label: name, type: name === 'Arc' || name === 'Arbalète' ? 'ranged' : 'melee', damage: { plusBF: false, flat: 0 }, qualities: [] });

const CW = 120, CH = 168;
const cells: string[] = [];
WEAPONS.forEach((name, r) => {
  cells.push(`<text x="6" y="${28 + r * CH + CH / 2}" font-size="10" fill="#9fb0c8" font-family="sans-serif">${name}</text>`);
  COLUMNS.forEach((col, c) => {
    const w = wpn(name);
    const inner = renderToStaticMarkup(React.createElement(RigSprite, { appearance: { species: asRigSpeciesId('humain'), sex: 'M', build: 0.5, seed: 4 }, equip: { weapons: [w], armour: [] }, career: MANNEQUIN, view: col.view, pose: weaponRest(w) }));
    const body = col.mirror ? `<g transform="translate(120,0) scale(-1,1)">${inner}</g>` : inner;
    const x = 84 + c * CW, y = 28 + r * CH;
    cells.push(`<g transform="translate(${x},${y})"><rect width="${CW - 4}" height="${CH - 14}" fill="#262d3b"/><line x1="0" y1="150" x2="${CW - 4}" y2="150" stroke="#e06a4a" stroke-width="0.6"/>${body}<text x="${(CW - 4) / 2}" y="${CH - 3}" text-anchor="middle" font-size="8" fill="#cdd" font-family="sans-serif">${col.label}</text></g>`);
  });
});
const W = 84 + 2 * CW, H = 28 + WEAPONS.length * CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${defsGlobaux()}</defs><rect width="${W}" height="${H}" fill="#11141c"/><text x="12" y="18" font-size="14" fill="#d8a93b" font-family="sans-serif">Pose de combat (weaponRest) par arme</text>${cells.join('')}</svg>`;
writeFileSync('public/qc/stance.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W * 2 } }).render().asPng());
console.log('OK → public/qc/stance.png');
