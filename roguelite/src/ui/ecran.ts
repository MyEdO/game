/**
 * Le gabarit d'écran commun à la fiche et aux services : la scène fixe des maquettes (1280 × 720, `CADRES`), ses
 * cadres posés, le socle des cartes de héros, la croix. La scène tient l'écran, réduite d'un bloc et centrée ; sous
 * 900 px de large, ses cadres s'empilent et défilent.
 */
import * as J from '../jeu';
import { cadreA, carteDeHeros, esc } from './pieces';

/** Les rectangles des cadres, ceux des maquettes. */
export const CADRES = {
  cartouche: [24, 20, 372, 96], recit: [32, 136, 340, 112], 'colonne-gauche': [24, 136, 372, 304], note: [24, 456, 372, 100],
  hote: [412, 20, 340, 300], page: [776, 20, 480, 520], 'colonne-droite': [896, 20, 360, 420], frise: [180, 480, 920, 70], coins: [1198, 470, 56, 230],
  identite: [26, 20, 340, 536], bande: [384, 20, 800, 96], gauche: [384, 136, 470, 420], droite: [872, 136, 384, 420],
  socle: [160, 560, 960, 152],
} satisfies Record<string, [number, number, number, number]>;

/** Le socle : la compagnie en cartes ; `geste` dit ce qu'un clic fait, `choisi` et `ferme` l'état de chacune. */
export interface Socle { heros: J.Heros[]; geste: string; choisi: (h: J.Heros) => boolean; ferme?: (h: J.Heros) => boolean }

/** `classe` : `service` laisse voir le décor du hameau derrière la scène ; `lieu` est la scène même du hameau ou de
 *  l'expédition, posée sur leur décor, sans croix. `vide` : ce que dit le socle sans personne. */
export function ecran(o: { nom: string; classe?: 'service' | 'lieu'; cadres: string; socle: Socle; vide?: string }): string {
  const cartes = o.socle.heros.map((h) => carteDeHeros(h, o.socle.choisi(h), o.socle.geste, o.socle.ferme?.(h) ?? false)).join('');
  const lieu = o.classe === 'lieu';
  return `<div class="ecran-plein ${o.classe ?? ''}"${lieu ? '' : ` role="dialog" aria-label="${esc(o.nom)}"`}><div class="scene-fixe">
    ${o.cadres}
    ${cadreA(CADRES.socle, cartes ? `<div class="rang-heros">${cartes}</div>` : `<p class="glose courante vide">${esc(o.vide ?? '')}</p>`, { fond: '', classe: 'socle-compagnie' })}
    ${lieu ? '' : '<button type="button" class="croix-ecran" data-a="fermer-panneau" aria-label="Fermer">×</button>'}
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
