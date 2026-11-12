import type { FamilleDeCouches } from '../types';

/** Une suite de nombres de 0 à 1, la même à chaque lecture (générateur congruentiel de graine `graine`). */
function suite(graine: number): () => number {
  let etat = graine;
  return () => (etat = (etat * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

/** `n` traits de pluie penchés, semés sur tout le cadre. */
function pluie(n: number, graine: number, longueur: number, opacite: number): string {
  const tire = suite(graine);
  return Array.from({ length: n }, () => {
    const [x, y, l] = [Math.round(tire() * 1000) - 20, Math.round(tire() * 380) - 20, longueur * (0.7 + tire() * 0.6)];
    return `<path d="M${x} ${y} l${(-l * 0.32).toFixed(1)} ${l.toFixed(1)}" stroke="var(--parchment)" stroke-width="1" stroke-linecap="round" opacity="${(opacite * (0.6 + tire() * 0.4)).toFixed(2)}"/>`;
  }).join('');
}

/** `n` flocons semés sur tout le cadre. */
function neige(n: number, graine: number, opacite: number): string {
  const tire = suite(graine);
  return Array.from({ length: n }, () => `<circle cx="${Math.round(tire() * 960)}" cy="${Math.round(tire() * 360)}" r="${(0.8 + tire() * 1.4).toFixed(1)}" fill="var(--parchment)" opacity="${(opacite * (0.5 + tire() * 0.5)).toFixed(2)}"/>`).join('');
}

/* La météo du jour (`weather.json`), par-dessus tout le paysage ; le temps sec et le beau temps n'en posent aucune. */
export const couches: FamilleDeCouches = [
  {
    id: 'meteo-pluie',
    label: 'Pluie',
    svg: pluie(150, 7, 20, 0.3) },
  {
    id: 'meteo-pluie-diluvienne',
    label: 'Pluie diluvienne',
    svg: `<rect x="0" y="0" width="960" height="360" fill="var(--ciel-nuit-haut)" opacity="0.3"/>${pluie(320, 11, 28, 0.38)}` },
  {
    id: 'meteo-neige',
    label: 'Neige',
    svg: `<path d="M0 260 C240 232 520 240 960 198 L960 360 L0 360 Z" fill="var(--parchment)" opacity="0.07"/>${neige(170, 5, 0.75)}` },
  {
    id: 'meteo-blizzard',
    label: 'Blizzard',
    svg: `<rect x="0" y="0" width="960" height="360" fill="var(--parchment)" opacity="0.12"/>${neige(340, 13, 0.85)}${pluie(120, 17, 34, 0.22)}` },
];
