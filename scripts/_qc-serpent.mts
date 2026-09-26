/** QC du gabarit serpentin : vues + poses (repos/sway/lunge/mort) + recolor. */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { defsGlobaux } from '../src/gameIso/sprites';
import { serpentSvg, SERPENT_DEFAULT, serpentStrike } from '../src/gameIso/rig/serpentine/composeSerpent';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { resolveSerpentFromProps } from '../src/gameIso/rig/serpentine/composeSerpent';

const sangsue = { ...SERPENT_DEFAULT, hood: false, girth: 1.15, palette: { corps: '#6a3a3a', corpsO: '#421f1f', corpsH: '#8a5050', cheveux: '#2a1414', cheveuxO: '#160a0a', cuir: '#7a5a2a' } };
const cells: { label: string; svg: string }[] = [
  { label: 'Serpent profil', svg: serpentSvg(SERPENT_DEFAULT, 'profile') },
  { label: 'Serpent face', svg: serpentSvg(SERPENT_DEFAULT, 'front') },
  { label: 'Serpent dos', svg: serpentSvg(SERPENT_DEFAULT, 'back') },
  { label: 'lunge (attaque)', svg: bonesToSvg(resolveSerpentFromProps(SERPENT_DEFAULT, 'profile', serpentStrike(0.5))) },
  { label: 'mort', svg: serpentSvg(SERPENT_DEFAULT, 'profile', { dead: true }) },
  { label: 'recolor rouge', svg: serpentSvg(SERPENT_DEFAULT, 'profile', { colors: { corps: '#7a2a8a' } }) },
  { label: 'Sangsue profil', svg: serpentSvg(sangsue, 'profile') },
  { label: 'Sangsue face', svg: serpentSvg(sangsue, 'front') },
  { label: 'Sangsue mort', svg: serpentSvg(sangsue, 'profile', { dead: true }) },
];
const CW = 300, CH = 320, FEET = 290, COLS = 3;
const out = cells.map((c, i) => {
  const SC = 1.6, col = i % COLS, row = Math.floor(i / COLS);
  const ox = 10 + col * CW, oy = 10 + row * CH, cx = (CW - 8) / 2;
  return `<g transform="translate(${ox},${oy})"><rect width="${CW - 8}" height="${CH - 10}" fill="#2b3142"/><g transform="translate(${cx - 60 * SC},${FEET - 150 * SC}) scale(${SC})">${c.svg}</g><text x="${cx}" y="${CH - 16}" text-anchor="middle" font-size="14" fill="#cdd" font-family="sans-serif">${c.label}</text></g>`;
});
const W = 10 + COLS * CW, H = 10 + Math.ceil(cells.length / COLS) * CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${defsGlobaux()}</defs><rect width="${W}" height="${H}" fill="#11141c"/>${out.join('')}</svg>`;
writeFileSync('public/qc/_qc-serpent.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W } }).render().asPng());
console.log('OK public/qc/_qc-serpent.png');
