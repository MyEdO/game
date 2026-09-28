/** QC : pieds orientés (front/back/profile) sur 2 tenues. → public/qc/feet.png */
import { VIEWS } from '../src/gameIso/rig/facing';
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { defsGlobaux } from '../src/gameIso/sprites';
import { asRigSpeciesId } from '../src/gameIso/rig/appearance';
import { tenueLabel } from '../src/gameIso/rig/parts/career';
import { assertWardrobeId } from './_lib-wardrobe';

// Tenues sondées par ID de garde-robe (carrière ∪ classe ∪ tenue) ; le libellé vient du catalogue.
// Garde fail-fast : un id qui retombe sur « nu » rendrait des pieds nus au lieu des bottes (#1338).
const CASES = ['soldat', 'mendiant'].map((career) => ({ career, label: tenueLabel(career) }));
for (const c of CASES)
  assertWardrobeId(c.career, 'qc-feet');
const cells: string[] = [];
CASES.forEach((cse, r) => {
  VIEWS.forEach((view, c) => {
    const svg = renderToStaticMarkup(
      React.createElement(RigSprite, { appearance: { species: asRigSpeciesId('humain'), sex: 'M', build: 0.5, seed: 4 }, equip: { weapons: [], armour: [] }, career: cse.career, view }),
    );
    cells.push(`<g transform="translate(${c * 124},${r * 168})"><rect width="120" height="150" fill="#1d2230"/>${svg}<text x="60" y="164" text-anchor="middle" font-size="10" fill="#cdd">${cse.label} / ${view}</text></g>`);
  });
});
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${3 * 124} ${2 * 168}"><defs>${defsGlobaux()}</defs>${cells.join('')}</svg>`;
// Gros zoom sur le bas (pieds) en plus.
const r = new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: 3 * 300 } });
writeFileSync('public/qc/feet.png', r.render().asPng());
console.log('OK → public/qc/feet.png');
