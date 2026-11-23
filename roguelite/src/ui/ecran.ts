/**
 * Le gabarit d'écran commun aux lieux et à la fiche : la scène fixe des maquettes (1280 × 720, `CADRES`), ses
 * cadres posés, le socle des cartes de héros, la croix. La scène tient l'écran, réduite d'un bloc et centrée ; sous
 * 900 px de large, ses cadres s'empilent et défilent.
 */
import * as J from '../jeu';
import { vignetteDeSalle, type Vignette } from '../vignettes';
import { cadreA, carteDeHeros, esc, place } from './pieces';

type Rect = [number, number, number, number];

/** Les rectangles des cadres, tels quels de la table `CADRES` des maquettes (`rendu.js`) : un rôle, un rectangle. */
export const CADRES = {
  cartouche: [24, 20, 372, 96], recit: [32, 136, 340, 112], 'colonne-gauche': [24, 136, 372, 304], note: [24, 456, 372, 100],
  page: [776, 20, 480, 480], 'colonne-droite': [896, 20, 360, 420], vignette: [896, 20, 360, 180], frise: [180, 508, 920, 44],
  coins: [1198, 579, 52, 118], 'action-de-coin': [1120, 603, 136, 89], identite: [26, 20, 340, 536], bande: [384, 20, 800, 96],
  socle: [160, 560, 960, 152], fermer: [1214, 18, 44, 44], carton: [160, 222, 960, 278],
  gauche: [384, 136, 470, 420], droite: [872, 136, 384, 420],
} satisfies Record<string, Rect>;

/** Les rectangles propres à l'hôte, faute de rôle dans les maquettes : un bâtiment s'ouvre sur toute la largeur
 *  au-dessus du socle, à la manière de Darkest Dungeon, sans rien cacher qu'on doive voir en même temps ; étiré
 *  (`data-etire`), il descend jusqu'au socle. Au hameau, la chronique et les réglages montent au coin haut-droit
 *  (place du système des maquettes), le coin bas-droit étant à l'action de partir ; le carnet (bourse, but, dernière
 *  ligne de la chronique) pend sous le cartouche, à sa largeur. */
export const CADRES_DE_L_HOTE = {
  batiment: [24, 20, 1232, 524], 'coins-du-hameau': [1150, 18, 108, 52], 'carnet-du-hameau': [30, 124, 360, 112],
} satisfies Record<string, Rect>;
/** Ce qu'un cadre étiré gagne au plus en largeur sur son rectangle. */
const ETIREMENT_EN_LARGEUR = 240;


/** Les places du carton, relatives à son fond (`carton/*` de `rendu.js`). Sans sceau à droite, le texte prend la
 *  largeur du titre ; les gestes, au pied, se centrent sur toute la largeur du carton. */
const PLACES_DU_CARTON = { vignette: [20, 24, 140, 140], tete: [184, 22, 734, 34], texte: [184, 60, 734, 154], gestes: [20, 218, 902, 40] };

/** Un carton : récit, confirmation. Il s'ouvre au-dessus du socle, qui reste ; la scène du lieu ne garde que son
 *  cartouche. `texte` défile entre le titre et les gestes, qui restent au pied. */
export interface Carton { ruban: string; vignette: Vignette; titre: string; surTitre: string; texte: string; gestes: string }
export function carton(o: Carton): string {
  const ici = (nom: keyof typeof PLACES_DU_CARTON, contenu: string) => {
    const [x, y, l, h] = PLACES_DU_CARTON[nom];
    return `<div class="place-carton" data-place="${nom}" style="left:${x}px;top:${y}px;width:${l}px;height:${h}px">${contenu}</div>`;
  };
  return cadreA(CADRES.carton, ici('vignette', vignetteDeSalle(o.vignette))
    + ici('tete', `<span class="nom-propre grand gothique">${esc(o.titre)}</span><span class="sous-titre">${esc(o.surTitre)}</span>`)
    + ici('texte', o.texte) + ici('gestes', `<div class="gestes">${o.gestes}</div>`), { ruban: o.ruban, classe: 'carton' });
}

/** Le socle : la compagnie en cartes, seul endroit où l'on choisit un héros ; `geste` dit ce qu'un clic fait,
 *  `choisi` l'état de chacune, `refus` pourquoi une carte est fermée à ce geste, `progresse` si le héros peut acheter
 *  un avancement ; `consigne` : l'écran attend qu'on y choisisse, et le dit sur le ruban du socle. */
export interface Socle { heros: J.Heros[]; geste: string; choisi: (h: J.Heros) => boolean; refus?: (h: J.Heros) => string | null; progresse?: (h: J.Heros) => boolean; consigne?: string }

/** `classe` : `lieu` est la scène même du hameau ou de
 *  l'expédition, posée sur leur décor, sans croix. `vide` : ce que dit le socle sans personne. */
export function ecran(o: { nom: string; classe?: 'lieu'; cadres: string; socle: Socle; vide?: string }): string {
  // Les héros disponibles d'abord ; puis les hors de combat ; puis ceux qui séjournent à un bâtiment.
  const rang = (h: J.Heros) => (h.sejour ? 2 : J.valide(h) ? 0 : 1);
  const cartes = [...o.socle.heros].sort((a, b) => rang(a) - rang(b)).map((h) => carteDeHeros(h, o.socle.choisi(h), o.socle.geste, { refus: o.socle.refus?.(h), progresse: o.socle.progresse?.(h) })).join('');
  const lieu = o.classe === 'lieu';
  return `<div class="ecran-plein ${o.classe ?? ''}"${lieu ? '' : ` role="dialog" aria-label="${esc(o.nom)}"`}><div class="scene-fixe">
    ${o.cadres}
    ${cadreA(CADRES.socle, cartes ? `<div class="rang-heros${o.socle.heros.length > 4 ? ' serre' : ''}" style="--n:${Math.min(6, Math.max(4, o.socle.heros.length))}">${cartes}</div>` : `<p class="glose courante vide">${esc(o.vide ?? '')}</p>`, { fond: '', classe: `socle-compagnie${o.socle.consigne ? ' a-choisir' : ''}`, ruban: o.socle.consigne ? esc(o.socle.consigne) : '' })}
    ${o.classe ? '' : `<button type="button" class="croix-ecran" ${place(CADRES.fermer)} data-a="fermer-panneau" aria-label="Fermer">×</button>`}
  </div></div>`;
}

/** La taille de l'interface, réglage du joueur : la hauteur de vue, en pixels logiques, que l'écran montre (les
 *  maquettes visent 720). Gardée hors de la sauvegarde, que Recommencer n'efface pas. */
export const TAILLES = { petite: 960, moyenne: 840, grande: 720 } as const;
export type Taille = keyof typeof TAILLES;
const CLE_DE_TAILLE = 'grisefosse-taille';
let taille: Taille = (() => {
  try {
    const t = localStorage.getItem(CLE_DE_TAILLE);
    return t && t in TAILLES ? (t as Taille) : 'moyenne';
  } catch { return 'moyenne'; }
})();
export const tailleChoisie = (): Taille => taille;
export function choisirLaTaille(t: Taille): void {
  taille = t;
  try { localStorage.setItem(CLE_DE_TAILLE, t); } catch { /* stockage refusé : le réglage ne survit pas au rechargement */ }
}

/** Pose la scène fixe sur l'écran, à l'échelle de la taille choisie (sans jamais dépasser la vue de référence
 *  1280 × 720). La scène prend toute la vue ; chaque pièce à `data-rect` s'ancre en hauteur au bord le plus proche de
 *  son centre (le socle en bas partout). En largeur, un lieu ancre chaque pièce au bord le plus proche,
 *  ou la centre si elle l'est, et le décor prend la place gagnée (`dispositions.md`, « Vue de référence et ancrages » ;
 *  `placeDe` de `rendu.js`) ; la fiche garde ses cadres groupés au centre. Une pièce à `data-etire` prend en plus la
 *  hauteur et la largeur que la vue gagne sur 1280 × 720. Sous 900 px de large, les cadres s'empilent. */
export function ajusterLaScene(): void {
  document.querySelectorAll<HTMLElement>('.scene-fixe').forEach(ajuster);
  // Le décor des lieux s'arrête au haut du socle (`--bas`, en pixels de l'écran).
  document.documentElement.style.setProperty('--bas', `${window.innerWidth < 900 ? 0 : Math.round((720 - CADRES.socle[1]) * echelleDeLaScene())}px`);
  // Les survols de bois, posés hors de la scène, se lisent à son échelle (`--echelle`).
  document.documentElement.style.setProperty('--echelle', String(echelleDeLaScene()));
}

/** L'échelle de la scène fixe sur l'écran (1 sous 900 px de large, où les cadres s'empilent). */
const echelleDeLaScene = (): number => (window.innerWidth < 900 ? 1 : Math.min(window.innerWidth / 1280, window.innerHeight / 720, window.innerHeight / TAILLES[tailleChoisie()]));

function ajuster(s: HTMLElement): void {
  if (window.innerWidth < 900) return void Object.assign(s.style, { transform: '', width: '', height: '' });
  const k = echelleDeLaScene();
  const largeur = window.innerWidth / k;
  const hauteur = window.innerHeight / k;
  const ancreLaLargeur = !!s.closest('.lieu');
  Object.assign(s.style, { transform: `scale(${k})`, width: `${largeur}px`, height: `${hauteur}px` });
  s.querySelectorAll<HTMLElement>('[data-rect]').forEach((el) => {
    const [x, y, l = 0, h = 0] = (el.dataset.rect ?? '').split(' ').map(Number);
    const cx = x + l / 2;
    const gain = el.dataset.etire == null ? 0 : Math.min(largeur - 1280, ETIREMENT_EN_LARGEUR);
    if (el.dataset.etire != null) Object.assign(el.style, { width: `${l + gain}px`, height: `${h + hauteur - 720}px` });
    el.style.left = `${!ancreLaLargeur || cx === 640 ? x + (largeur - 1280 - gain) / 2 : cx > 640 ? x + largeur - 1280 : x}px`;
    el.style.top = `${y + h / 2 > 360 ? y + hauteur - 720 : y}px`;
  });
}
