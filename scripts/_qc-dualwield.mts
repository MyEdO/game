/** QC dual-wield — profondeur mirror-aware : main gauche (bouclier) derrière face-à-droite, devant face-à-gauche.
 *  → public/qc/dualwield.png */
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
assertWardrobeId(MANNEQUIN, 'qc-dualwield');

const W_ = (name: string, hand: 'main' | 'off', q: { id: string; value?: number }[] = []): Weapon =>
  ({ label: name, type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: q, hand, hands: 1 } as Weapon);

type Cfg = { label: string; weapons: Weapon[]; shield?: Weapon };
const sword = W_('Épée', 'main');
const shield = W_('Bouclier', 'off', [{ id: 'protectrice', value: 1 }]);
const CFGS: Cfg[] = [
  { label: 'Épée + Bouclier', weapons: [sword, shield], shield },
  { label: 'Épée + Dague (off)', weapons: [sword, W_('Dague', 'off')] },
];
const COLUMNS: { view: View; mirror: boolean; label: string }[] = [
  { view: 'front', mirror: false, label: VIEW_LABEL.front },
  { view: 'profile', mirror: false, label: 'va à droite (gauche=fond)' },
  { view: 'profile', mirror: true, label: 'va à gauche (gauche=devant)' },
];

const CW = 200, CH = 270, BW = CW - 6, BH = CH - 22;
const cells: string[] = [];
CFGS.forEach((cfg, r) => {
  cells.push(`<text x="6" y="${34 + r * CH + CH / 2}" font-size="12" fill="#9fb0c8" font-family="sans-serif">${cfg.label}</text>`);
  COLUMNS.forEach((col, c) => {
    const inner = renderToStaticMarkup(
      React.createElement(RigSprite, {
        appearance: { species: asRigSpeciesId('humain'), sex: 'M', build: 0.5, seed: 4 },
        equip: { weapons: cfg.weapons, armour: [], shield: cfg.shield },
        career: MANNEQUIN, view: col.view, pose: weaponRest(cfg.weapons[0]), mirror: col.mirror,
      }),
    );
    const scaled = `<g transform="translate(${BW / 2 - 60 * 1.6},20) scale(1.6)">${inner}</g>`;
    const body = col.mirror ? `<g transform="translate(${BW},0) scale(-1,1)">${scaled}</g>` : scaled;
    const x = 200 + c * CW, y = 34 + r * CH;
    cells.push(`<g transform="translate(${x},${y})"><rect width="${BW}" height="${BH}" fill="#262d3b"/><line x1="0" y1="${20 + 150 * 1.6}" x2="${BW}" y2="${20 + 150 * 1.6}" stroke="#e06a4a" stroke-width="0.8"/>${body}<text x="${BW / 2}" y="${CH - 4}" text-anchor="middle" font-size="9" fill="#cdd" font-family="sans-serif">${col.label}</text></g>`);
  });
});
const W = 200 + COLUMNS.length * CW, H = 34 + CFGS.length * CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${defsGlobaux()}</defs><rect width="${W}" height="${H}" fill="#11141c"/><text x="12" y="22" font-size="15" fill="#d8a93b" font-family="sans-serif">Dual-wield — main gauche (bouclier) : derrière à droite, devant à gauche</text>${cells.join('')}</svg>`;
writeFileSync('public/qc/dualwield.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W * 2 } }).render().asPng());
console.log('OK → public/qc/dualwield.png');
