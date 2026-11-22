/**
 * Le gabarit d'écran commun à la fiche et aux services : la scène fixe des maquettes (1280 × 720, `CADRES`), ses
 * cadres posés, le socle des cartes de héros, la croix. La scène tient l'écran, réduite d'un bloc et centrée ; sous
 * 900 px de large, ses cadres s'empilent et défilent.
 */
import * as J from '../jeu';
import { cadreA, carteDeHeros, esc } from './pieces';

/** Les rectangles des cadres, ceux des maquettes. */
export const CADRES = {
  cartouche: [26, 20, 340, 110], lieu: [26, 148, 340, 408], service: [384, 20, 872, 536],
  identite: [26, 20, 340, 536], bande: [384, 20, 800, 96], gauche: [384, 136, 470, 420], droite: [872, 136, 384, 420],
  socle: [160, 560, 960, 152],
} satisfies Record<string, [number, number, number, number]>;

/** Le socle : la compagnie en cartes ; `geste` dit ce qu'un clic fait, `choisi` et `ferme` l'état de chacune. */
export interface Socle { heros: J.Heros[]; geste: string; choisi: (h: J.Heros) => boolean; ferme?: (h: J.Heros) => boolean }

export function ecran(o: { nom: string; cadres: string; socle: Socle }): string {
  const cartes = o.socle.heros.map((h) => carteDeHeros(h, o.socle.choisi(h), o.socle.geste, o.socle.ferme?.(h) ?? false)).join('');
  return `<div class="ecran-plein" role="dialog" aria-label="${esc(o.nom)}"><div class="scene-fixe">
    ${o.cadres}
    ${cadreA(CADRES.socle, `<div class="rang-heros">${cartes}</div>`, { fond: '', classe: 'socle' })}
    <button type="button" class="croix-ecran" data-a="fermer-panneau" aria-label="Fermer">×</button>
  </div></div>`;
}

/** Met la scène fixe à l'échelle de l'écran ; sous 900 px, les cadres s'empilent. */
export function ajusterLaScene(): void {
  const s = document.querySelector<HTMLElement>('.scene-fixe');
  if (!s) return;
  if (window.innerWidth < 900) return void (s.style.transform = '');
  const k = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  s.style.transform = `translate(${(window.innerWidth - 1280 * k) / 2}px, ${(window.innerHeight - 720 * k) / 2}px) scale(${k})`;
}
