/**
 * Le gabarit d'écran commun à la fiche et aux services : la scène fixe des maquettes (1280 × 720, `CADRES`), ses
 * cadres posés, le socle des cartes de héros, la croix. La scène tient l'écran, réduite d'un bloc et centrée ; sous
 * 900 px de large, ses cadres s'empilent et défilent.
 */
import * as J from '../jeu';
import { medaillon } from '../kit';
import { cadreA, carteDeHeros, esc, place } from './pieces';

/** Les rectangles des cadres, ceux des maquettes. */
export const CADRES = {
  cartouche: [24, 20, 372, 96], recit: [32, 136, 340, 112], 'colonne-gauche': [24, 136, 372, 304], note: [24, 456, 372, 100],
  hote: [412, 20, 340, 300], page: [776, 20, 480, 520], 'colonne-droite': [896, 20, 360, 420], frise: [180, 480, 920, 70], coins: [1160, 470, 100, 230],
  identite: [26, 20, 340, 536], bande: [384, 20, 800, 96], gauche: [384, 136, 470, 420], droite: [872, 136, 384, 420],
  socle: [160, 560, 960, 152], fermer: [1214, 18, 44, 44], retour: [30, 592, 124, 94], carton: [160, 222, 960, 278],
  issue: [360, 190, 560, 150], round: [22, 16, 214, 66], ordre: [22, 96, 134, 616], 'fin-du-tour': [1133, 582, 104, 116],
  journal: [956, 316, 300, 132], 'journal-entier': [856, 70, 400, 236], 'outils-du-tour': [1072, 604, 52, 88],
} satisfies Record<string, [number, number, number, number]>;

/** Les places du carton, relatives à son fond (`carton/*` de `rendu.js`). Sans sceau à droite, le texte prend la
 *  largeur du titre ; les gestes, au pied, se centrent sur toute la largeur du carton. */
const PLACES_DU_CARTON = { vignette: [20, 24, 140, 140], tete: [184, 22, 734, 34], texte: [184, 60, 734, 154], gestes: [20, 218, 902, 40] };

/** Un carton : récit, confirmation. Il s'ouvre au-dessus du socle, qui reste ; la scène du lieu ne garde que son
 *  cartouche. `texte` défile entre le titre et les gestes, qui restent au pied. */
export interface Carton { ruban: string; picto: string; titre: string; surTitre: string; texte: string; gestes: string }
export function carton(o: Carton): string {
  const ici = (nom: keyof typeof PLACES_DU_CARTON, contenu: string) => {
    const [x, y, l, h] = PLACES_DU_CARTON[nom];
    return `<div class="place-carton" data-place="${nom}" style="left:${x}px;top:${y}px;width:${l}px;height:${h}px">${contenu}</div>`;
  };
  return cadreA(CADRES.carton, ici('vignette', medaillon(o.picto, 'grand'))
    + ici('tete', `<span class="nom-propre grand gothique">${esc(o.titre)}</span><span class="sous-titre">${esc(o.surTitre)}</span>`)
    + ici('texte', o.texte) + ici('gestes', `<div class="gestes">${o.gestes}</div>`), { ruban: o.ruban, classe: 'carton' });
}

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
    ${o.classe ? '' : `<button type="button" class="croix-ecran" ${place(CADRES.fermer)} data-a="fermer-panneau" aria-label="Fermer">×</button>`}
  </div></div>`;
}

/** La hauteur de vue, en pixels logiques, que l'écran montre : un écran plus haut agrandit la scène, un plus bas la
 *  réduit. Valeur de l'hôte : les maquettes visent 720, où la densité des écrans lite paraît trop grosse. */
const HAUTEUR_DE_VUE = 840;

/** Pose la scène fixe sur l'écran, à l'échelle de `HAUTEUR_DE_VUE` (sans jamais dépasser la vue de référence
 *  1280 × 720). La scène prend toute la vue ; chaque pièce à `data-rect` s'ancre en hauteur au bord le plus proche de
 *  son centre (le socle en bas partout). En largeur, un lieu ou un service ancre chaque pièce au bord le plus proche,
 *  ou la centre si elle l'est, et le décor prend la place gagnée (`dispositions.md`, « Vue de référence et ancrages » ;
 *  `placeDe` de `rendu.js`) ; la fiche garde ses cadres groupés au centre. Sous 900 px de large, les cadres s'empilent. */
export function ajusterLaScene(): void {
  document.querySelectorAll<HTMLElement>('.scene-fixe').forEach(ajuster);
}

/** L'échelle de la scène fixe sur l'écran (1 sous 900 px de large, où les cadres s'empilent). */
export const echelleDeLaScene = (): number => (window.innerWidth < 900 ? 1 : Math.min(window.innerWidth / 1280, window.innerHeight / 720, window.innerHeight / HAUTEUR_DE_VUE));

function ajuster(s: HTMLElement): void {
  if (window.innerWidth < 900) return void Object.assign(s.style, { transform: '', width: '', height: '' });
  const k = echelleDeLaScene();
  const largeur = window.innerWidth / k;
  const hauteur = window.innerHeight / k;
  const ancreLaLargeur = !!s.closest('.service, .lieu, .rejeu');
  Object.assign(s.style, { transform: `scale(${k})`, width: `${largeur}px`, height: `${hauteur}px` });
  s.querySelectorAll<HTMLElement>('[data-rect]').forEach((el) => {
    const [x, y, l = 0, h = 0] = (el.dataset.rect ?? '').split(' ').map(Number);
    const cx = x + l / 2;
    el.style.left = `${!ancreLaLargeur || cx === 640 ? x + (largeur - 1280) / 2 : cx > 640 ? x + largeur - 1280 : x}px`;
    el.style.top = `${y + h / 2 > 360 ? y + hauteur - 720 : y}px`;
  });
}
