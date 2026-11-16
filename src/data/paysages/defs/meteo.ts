import type { FamilleDeCouches } from '../types';
import { alea, n } from '../formes';

/** `nombre` traits de pluie penchés du même sens, semés sur tout le cadre, de `longueur` et d'opacité `opacite` variables. */
function pluie(nombre: number, graine: number, longueur: number, opacite: number): string {
  const r = alea(graine);
  return `<g stroke="var(--lune)" stroke-linecap="round">${Array.from({ length: nombre }, () => {
    const [x, y, l] = [r() * 1700 - 50, r() * 900 - 20, longueur * (0.6 + r() * 0.8)];
    return `<path d="M${n(x)} ${n(y)}l${n(-l * 0.24)} ${n(l)}" stroke-width="${n(0.6 + r() * 0.8)}" opacity="${n(opacite * (0.3 + r() * 0.7))}"/>`;
  }).join('')}</g>`;
}

/** `nombre` flocons de taille variable, semés sur tout le cadre. */
function neige(nombre: number, graine: number, opacite: number): string {
  const r = alea(graine);
  return Array.from({ length: nombre }, () => `<circle cx="${n(r() * 1600)}" cy="${n(r() * 900)}" r="${n(1 + r() * r() * 4)}" fill="var(--parchment)" opacity="${n(opacite * (0.4 + r() * 0.6))}"/>`).join('');
}

/* La météo du jour (`weather.json`), par-dessus tout le paysage ; le temps sec et le beau temps n'en posent aucune. */
export const couches: FamilleDeCouches = [
  {
    id: 'meteo-pluie',
    label: 'Pluie',
    svg: pluie(420, 71, 26, 0.3) },
  {
    id: 'meteo-pluie-diluvienne',
    label: 'Pluie diluvienne',
    svg: `<rect x="0" y="0" width="1600" height="900" fill="var(--ciel-nuit-haut)" opacity="0.3"/>${pluie(900, 11, 40, 0.42)}` },
  {
    id: 'meteo-neige',
    label: 'Neige',
    svg: `<path d="M-10 640 C400 618 1100 626 1610 610 L1610 900 L-10 900 Z" fill="var(--parchment)" opacity="0.08"/>${neige(380, 5, 0.75)}` },
  {
    id: 'meteo-blizzard',
    label: 'Blizzard',
    svg: `<rect x="0" y="0" width="1600" height="900" fill="var(--parchment)" opacity="0.14"/>${neige(800, 13, 0.85)}${pluie(260, 17, 50, 0.24)}` },
];
