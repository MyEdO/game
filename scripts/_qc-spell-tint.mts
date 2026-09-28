/**
 * QC du tintage arcane/divin (Jalon 8) : rend pour chaque école son halo diffus (dégradé fixe),
 * son projectile (cœur dense) et la couleur de cœur, depuis la SOURCE DE VÉRITÉ `spellFx`.
 * → public/qc/spell-tint.png. Usage : npx tsx scripts/_qc-spell-tint.mts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { defsGlobaux } from '../src/gameIso/sprites';
import { spellFx, type SpellSchool } from '../src/gameIso/rig/anim/spellClips';

const SCHOOLS: Array<[SpellSchool, string]> = [
  ['arcane', 'Arcane (Vents de magie) — projectile offensif'],
  ['divine', 'Divin (Miracle/prière) — bénédiction'],
];
const CW = 360, CH = 120;
const rows = SCHOOLS.map(([school, label], r) => {
  const fx = spellFx(school);
  const y = r * CH;
  // halo de canalisation (lanceur) · halo de bénédiction (cible) · projectile · cœur
  return (
    `<g transform="translate(0,${y})">` +
    `<rect width="${CW}" height="${CH}" fill="${r % 2 ? '#181c28' : '#1d2230'}"/>` +
    `<circle cx="70" cy="54" r="34" fill="url(#${fx.gradient})"/>` +
    `<circle cx="160" cy="54" r="22" fill="url(#${fx.gradient})"/>` +
    `<circle cx="240" cy="54" r="6" fill="url(#${fx.gradient})"/>` +
    `<circle cx="300" cy="54" r="4" fill="${fx.core}"/>` +
    `<text x="70" y="102" text-anchor="middle" font-size="8" fill="#9aa">halo lanceur</text>` +
    `<text x="160" y="102" text-anchor="middle" font-size="8" fill="#9aa">halo cible</text>` +
    `<text x="240" y="102" text-anchor="middle" font-size="8" fill="#9aa">projectile</text>` +
    `<text x="300" y="102" text-anchor="middle" font-size="8" fill="#9aa">cœur</text>` +
    `<text x="8" y="16" font-size="10" fill="#d8a93b" font-family="sans-serif">${label}</text>` +
    `</g>`
  );
});
mkdirSync('public/qc', { recursive: true });
const H = SCHOOLS.length * CH;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CW} ${H}"><defs>${defsGlobaux()}</defs><rect width="${CW}" height="${H}" fill="#0c0e14"/>${rows.join('')}</svg>`;
writeFileSync('public/qc/spell-tint.png', new Resvg(svg, { background: '#0c0e14', fitTo: { mode: 'width', value: CW * 3 } }).render().asPng());
console.log('OK → public/qc/spell-tint.png');
