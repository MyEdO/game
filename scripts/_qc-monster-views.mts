/** QC : têtes monstrueuses en 3 vues (front/back/profile) → 8-dir. → public/qc/monster-views.png */
import { VIEWS } from '../src/gameIso/rig/facing';
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { defsGlobaux } from '../src/gameIso/sprites';
import type { MonsterParts } from '../src/gameIso/rig/parts/monstrous';
import { asRigSpeciesId } from '../src/gameIso/rig/appearance';
import { assertWardrobeId } from './_lib-wardrobe';

// Mannequin : ID de garde-robe (carrière ∪ classe ∪ tenue), validé fail-fast — un id qui retombe
// sur « nu » déshabillerait la planche en silence (#1338).
const MANNEQUIN = 'mendiant';
assertWardrobeId(MANNEQUIN, 'qc-monster-views');

const HEADS: [string, MonsterParts][] = [
  ['chien', { tete: 'chien' }],
  ['lézard', { tete: 'lezard' }],
  ['ogive', { tete: 'ogive' }],
  ['crétin', { tete: 'minuscule' }],
];
const cells: string[] = [];
HEADS.forEach(([label, monster], r) => {
  VIEWS.forEach((view, c) => {
    const svg = renderToStaticMarkup(
      React.createElement(RigSprite, { appearance: { species: asRigSpeciesId('humain'), sex: 'M', build: 0.5, seed: 4, monster }, equip: { weapons: [], armour: [] }, career: MANNEQUIN, view }),
    );
    cells.push(`<g transform="translate(${c * 124},${r * 168})"><rect width="120" height="150" fill="#1d2230"/>${svg}<text x="60" y="164" text-anchor="middle" font-size="10" fill="#cdd">${label} / ${view}</text></g>`);
  });
});
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${3 * 124} ${4 * 168}"><defs>${defsGlobaux()}</defs>${cells.join('')}</svg>`;
const r = new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: 3 * 240 } });
writeFileSync('public/qc/monster-views.png', r.render().asPng());
console.log('OK → public/qc/monster-views.png');
