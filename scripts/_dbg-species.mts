import { writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite, rigComposition } from '../src/gameIso/rig/composeRig';
import { defsGlobaux } from '../src/gameIso/sprites';
import type { Appearance } from '../src/gameIso/rig/appearance';
import { asRigSpeciesId } from '../src/gameIso/rig/appearance';
import type { Weapon } from '../src/engine/types';
import { raceAppearance } from '../src/data';
import { assertWardrobeId } from './_lib-wardrobe';

// Mannequin de la planche : ID de garde-robe (carrière ∪ classe ∪ tenue), validé fail-fast —
// un id qui retombe sur « nu » fausserait l'ancrage mesuré ici (#1338).
const MANNEQUIN = 'soldat';
assertWardrobeId(MANNEQUIN, 'dbg-species');

const wep = (name: string, type: 'melee' | 'ranged' = 'melee'): Weapon => ({ label: name, type, damage: { plusBF: false, flat: 4 }, qualities: [] } as Weapon);

function cell(label: string, app: Appearance, w?: Weapon) {
  const svg = renderToStaticMarkup(
    React.createElement('svg', { viewBox: '0 0 120 150', width: 130, height: 162 },
      React.createElement('defs', { dangerouslySetInnerHTML: { __html: defsGlobaux() } }),
      React.createElement('rect', { x: 0, y: 0, width: 120, height: 150, fill: '#1b1f2b' }),
      React.createElement('line', { x1: 0, y1: 150, x2: 120, y2: 150, stroke: '#2ecc71', strokeWidth: 1, strokeDasharray: '3 3' }),
      React.createElement('line', { x1: 0, y1: 0, x2: 120, y2: 0, stroke: '#e74c3c', strokeWidth: 1 }),
      React.createElement(RigSprite, { comp: rigComposition(app, { weapons: w ? [w] : [], armour: [] }, MANNEQUIN) }),
    ),
  );
  return `<figure style="margin:0;text-align:center"><div>${svg}</div><figcaption style="color:#cdd;font:11px sans-serif">${label}</figcaption></figure>`;
}

const cells: string[] = [];
// Ligne 1 : espèces avec épée — vérifie ancrage au sol (ligne verte = y150) + tenue d'arme
for (const sp of raceAppearance) {
  cells.push(cell(`${sp.label} +épée`, { species: asRigSpeciesId(sp.id), sex: 'M', build: 0.5, seed: 4 }, wep('Arme simple')));
}
cells.push('<div style="flex-basis:100%;height:0"></div>');
// Ligne 2 : Humain avec chaque famille d'arme — qualité de l'art + grip
for (const [lab, nm, ty] of [
  ['épée', 'Arme simple', 'melee'], ['hache', 'Grande hache', 'melee'], ['masse', 'Marteau de guerre', 'melee'],
  ['dague', 'Dague', 'melee'], ['lance', 'Lance', 'melee'], ['bâton', 'Bâton de combat', 'melee'],
  ['rapière', 'Rapière', 'melee'], ['arc', 'Arc long', 'ranged'], ['arbalète', 'Arbalète', 'ranged'],
  ['pistolet', 'Pistolet', 'ranged'], ['fronde', 'Fronde', 'ranged'], ['fouet', 'Fouet', 'ranged'],
  ['bombe', 'Bombe', 'ranged'], ['javelot', 'Javelot', 'ranged'],
] as [string, string, 'melee' | 'ranged'][]) {
  cells.push(cell(lab, { species: asRigSpeciesId('humain'), sex: 'M', build: 0.5, seed: 4 }, wep(nm, ty)));
}

writeFileSync('public/dbg-species.html', `<!doctype html><body style="background:#11141c;padding:16px"><h2 style="color:#eee;font:14px sans-serif">L1 ancrage espèces · L2 armes (Humain). Vert=sol(y150) Rouge=haut(y0)</h2><div style="display:flex;flex-wrap:wrap;gap:8px">${cells.join('')}</div></body>`);
console.log('OK: public/dbg-species.html');
