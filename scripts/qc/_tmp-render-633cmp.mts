/** JETABLE — AVANT/APRÈS du CONTOUR de JAMBE_PROFILE, jambe droite isolée, zoom serré. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { DEFS } from '../../src/gameIso/sprites';

const OUT = resolve(process.cwd(), 'public/qc/633-jambe');
mkdirSync(OUT, { recursive: true });

// Contour SEUL (le fill @peau + stroke), ancien vs nouveau — bord arrière = gauche (−x).
const OLD = '<path d="M-3.4 0.6 Q-3 12 -2.4 22 Q-4.3 28 -4.4 33 Q-3.3 42 -2.6 50 L2.9 50 Q3.2 42 3.1 33 Q4.7 27 4.4 22 Q4.6 10 3.8 0.6 Q0 -0.9 -3.4 0.6 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>';
const NEW = '<path d="M-3.4 0.6 Q-3.6 12 -3.3 22 Q-4.3 32 -3.9 38 Q-3.3 45 -2.6 50 L2.9 50 Q3.2 42 3.1 33 Q4.5 27 4.4 22 Q4.6 10 3.8 0.6 Q0 -0.9 -3.4 0.6 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>';

function png(name: string, body: string) {
  // knee guide y22, calf-old y33, calf-new y34
  const guides = '<line x1="-8" y1="22" x2="8" y2="22" stroke="#5cf" stroke-width="0.15" opacity="0.7"/>'
    + '<line x1="-8" y1="50" x2="8" y2="50" stroke="#f96" stroke-width="0.15" opacity="0.5"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -2 16 56"><defs>${DEFS}</defs><rect x="-8" y="-2" width="16" height="56" fill="#1d2230"/>${guides}<g transform="scale(2,2)">${body}</g></svg>`;
  const r = new Resvg(svg, { background: '#1d2230', fitTo: { mode: 'width', value: 400 }, font: { loadSystemFonts: true } });
  writeFileSync(`${OUT}/${name}.png`, r.render().asPng());
  console.log('OK:', `${OUT}/${name}.png`);
}
png('contour-AVANT', OLD);
png('contour-APRES', NEW);
console.log('DONE');
