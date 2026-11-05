/**
 * QC — MEUBLES d'intérieur du plan de l'Opéra : rend chaque NOUVEAU prop (chaise, tabouret, armoire,
 * bureau, établi, lit, miroir) dans une grille pour juger la lisibilité à taille de jeu.
 *   npx tsx scripts/qc/render-furniture.mts
 * Sortie : public/qc/furniture.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { propSvg } from '../../src/gameIso/catalog/decor';
import { findPropById } from '../../src/data';
import { defsGlobaux } from '../../src/gameIso/sprites';

const NEW = ['chaise', 'tabouret', 'armoire', 'bureau', 'etabli', 'lit', 'miroir', 'table'];

const CELL_W = 150, CELL_H = 190;
const COLS = 4;
const rows = Math.ceil(NEW.length / COLS);
const W = COLS * CELL_W, H = rows * CELL_H;

const cells = NEW.map((id, i) => {
  const cx = (i % COLS) * CELL_W;
  const cy = Math.floor(i / COLS) * CELL_H;
  // boîte 120×150 du prop centrée dans la cellule
  const inner = propSvg(id);
  const label = findPropById(id)?.label ?? id;
  const ox = cx + (CELL_W - 120) / 2;
  const oy = cy + 14;
  return (
    `<g transform="translate(${ox},${oy})">${inner}</g>` +
    `<rect x="${cx + 4}" y="${cy + 4}" width="${CELL_W - 8}" height="${CELL_H - 8}" fill="none" stroke="#2a2f3a" stroke-width="1"/>` +
    `<text x="${cx + CELL_W / 2}" y="${cy + CELL_H - 8}" fill="#e8e2d2" font-family="sans-serif" font-size="13" text-anchor="middle">${label}</text>`
  );
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${defsGlobaux()}</defs><rect width="${W}" height="${H}" fill="#1b1f29"/>${cells.join('')}</svg>`;
const png = new Resvg(svg, { fitTo: { mode: 'width', value: W * 2 }, font: { loadSystemFonts: true } }).render().asPng();
mkdirSync('public/qc', { recursive: true });
writeFileSync('public/qc/furniture.png', png);
console.log('OK: public/qc/furniture.png');
