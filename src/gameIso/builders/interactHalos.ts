/**
 * BUILDER des HALOS D'INTERACTION (#1176, P3-0g ; régime de révélation #1687) — ce qui dit « il y a
 * quelque chose ici ». Rien n'est allumé en permanence : un halo se peint au SURVOL de son entité, ou
 * sous la RÉVÉLATION (Alt maintenu, `store.reveler`), et le décor qui n'offre rien reste muet.
 * Frère de `builders/dynamicMarks` et de `builders/tokenChrome`, et même frontière : PUR et camera-free.
 *
 * Ce que cette dérivation rend, ce sont des IDENTITÉS, des cases et des gabarits en fraction de case —
 * jamais une position à l'écran ni une classe CSS. Le rendu en tire ses anneaux plats et son étincelle
 * (`stage/interactHaloPose`), et la plaque de nom en tire son porteur et son texte
 * (`stage/PlaquesDeNom`) : UNE liste, deux peintres.
 *
 * UNE ENTITÉ UTILISABLE EST UNE ENTITÉ UTILISABLE : aucun `kind` ne se lit ici, et l'appartenance se
 * tranche au dériveur UNIQUE `state/usable.estUtilisable` — celui-là même que le curseur et le clic
 * consultent. Un décor fouillable, un meuble à s'asseoir et un marchand à qui parler y entrent par la
 * même porte, et par les DEUX corps que le champ leur donne : un décor (`PropEl`) ou un jeton
 * (`TokenEl`). Même couple d'entrées que les pastilles de gestes (`tokenChrome.tokenGesteMarks`) : ce
 * qui n'est pas POSTÉ n'a rien à porter.
 */
import type { Scene, SceneEntity } from '../../state/scene';
import { decorFootGeometry } from '../../state/footprint';
import { estUtilisable } from '../../state/usable';
import { RING_A_PX } from './dynamicMarks';
import { ancrageDuDecor, ancrageDuJeton, type Ancrage } from './tokenChrome';
import type { PropEl, TokenEl } from './types';

/** GABARIT des halos en PIXELS de la projection iso (`geometry/iso`) — l'échelle de référence dont le
 *  monde volumique tire ses rayons monde (`haloRadiusK`). Le demi-axe ry y vaut la moitié de rx :
 *  c'est la projection LOSANGE d'un cercle monde (`RING_A_PX / RING_B_PX`,
 *  cf. `builders/dynamicMarks`). */
export const HALO_RX_PX = 17;
export const HALO_STROKE_PX = 2;
/** Trait de l'onde « sonar » — plus fin que le contour du halo. */
export const PING_STROKE_PX = 1.6;
/** Opacités des deux ellipses du halo (disque translucide, contour doré). UNE matière pour tous les
 *  utilisables : le halo dit qu'il y a quelque chose, pas ce que c'est. */
export const HALO_FILL_OPACITY = 0.26;
export const HALO_STROKE_OPACITY = 0.9;
/** ÉTINCELLE : décalage écran depuis le centre de case (droite, hauteur) et demi-taille du glyphe. */
export const SPARK_DX_PX = 9;
export const SPARK_DY_PX = 26;
export const SPARK_R_PX = 6;
/** GLYPHE de l'étincelle : une étoile à QUATRE branches — pointes sur les axes de l'écran (rayon
 *  `SPARK_R_PX`), creux sur les diagonales. Le rayon des creux est la demi-diagonale du carré `1,7`
 *  qu'inscrit le tracé. Le rendu le dessine par le gabarit `unitStarGeometry`
 *  (`backends/webgl/interactHaloMeshes`) — un glyphe décrit deux fois divergerait au premier retouchage. */
export const SPARK_BRANCHES = 4;
export const SPARK_INNER_R_PX = 1.7 * Math.SQRT2;

/** Épaisseur du contour sous la variante SURVOL. */
export const HALO_HOVER_STROKE_PX = 3.4;
/** Agrandissement de la variante SURVOL : il porte sur le halo ENTIER, donc sur le rayon ET sur
 *  l'épaisseur du trait (`stage/interactHaloPose.poseInteractHalos`) — c'est ce qui garde le survolé
 *  discernable de tous les autres quand la révélation les allume tous. */
export const HALO_HOVER_SCALE = 1.32;

/** Rayon MONDE (fraction de case) d'un halo de demi-axe écran `rxPx` : le cercle de ce rayon a POUR
 *  projection l'ellipse de demi-axe `rxPx` — mêmes demi-axes, même rapport (`teamRingRadiusK`, même loi). */
export function haloRadiusK(rxPx: number): number {
  return rxPx / RING_A_PX;
}

/** Ce que la frame montre d'un utilisable. `muet` = rien de peint ; `revele` = la matière de base ;
 *  `survole` = la même, agrandie. Un état N+1 s'ajoute ici et à son mapping de pose. */
export type HaloEtat = 'muet' | 'survole' | 'revele';

/** Halo d'un utilisable du champ. Il EST un ancrage (`builders/tokenChrome.Ancrage`, cell/n/scaleK/
 *  bodyTopFrac) : la plaque de nom se pose donc à la hauteur de tête que la pastille de gestes utilise
 *  déjà, sans un second calcul. */
export interface InteractHalo extends Ancrage {
  /** Id de l'ENTITÉ de scène (`PropEl.entId`) — la clé des drapeaux d'épuisement (`cleActionJouee`). */
  id: string;
  /** Nom du porteur à l'écran (la plaque de nom l'affiche) — la donnée de l'entité, jamais un id. */
  label?: string;
  /** Empreinte du décor, en cases (profondeur au coin le plus proche caméra). */
  span: { w: number; h: number };
  /** Centre de l'empreinte (décalages de `foot` appliqués) : le halo est aux PIEDS du décor. */
  centre: { x: number; y: number };
  /** ÉTENDUE du halo en cases, AXE PAR AXE (`decorFootGeometry` : `sx`/`sy` de l'empreinte) — le halo
   *  grandit avec le décor, et seulement dans les axes où le décor grandit. Isotrope pour un 1×1
   *  (`{ x: 1, y: 1 }`) ; `{ x: 1, y: 2 }` pour une table murale au cap E, dont le halo reste ainsi
   *  DANS ses deux cases au lieu de traverser le mur qu'elle longe. */
  echelle: { x: number; y: number };
  /** Ce que la frame en montre. */
  etat: HaloEtat;
  /** Le décor est EN VUE (au-dessus du voile de brouillard, `ElStates.visible`). */
  visible: boolean;
}

/** Aucun halo — la valeur d'une voie qui n'en reçoit pas. GELÉE (partagée par toutes les voies). */
export const NO_INTERACTION_HALOS: readonly InteractHalo[] = Object.freeze([]);

/** LE RÉGIME de la frame : ce qui décide, pour chaque utilisable, ce qu'on en montre. */
export interface HaloRegime {
  /** Id de l'entité SOUS LE CURSEUR, déjà résolue par l'hôte (le même résolveur que le curseur). */
  survol: string | null;
  /** RÉVÉLATION tenue (`store.reveler`, Alt maintenu) : tous les utilisables VISIBLES s'allument. */
  reveler: boolean;
}

/** L'état d'un utilisable sous ce régime. Le survolé garde sa variante même sous révélation, et ce que
 *  le brouillard cache reste MUET : on ne révèle que ce qui est EN VUE (une seule source de
 *  visibilité, `ElStates.visible`).
 *
 *  CE QUE L'ÉTAT NE DIT PAS : si le geste PASSERA. Un meuble dont toutes les places sont prises reste
 *  un utilisable — halo, plaque et main au survol — et c'est sa PASTILLE qui porte la raison du refus
 *  au survol (`state/offresUtilisables:porteDOffre`, arbitrage 2026-08-24). */
function etatDe(regime: HaloRegime, entId: string, visible: boolean): HaloEtat {
  if (!visible) return 'muet';
  if (regime.survol === entId) return 'survole';
  return regime.reveler ? 'revele' : 'muet';
}

/** Le CORPS posté d'une entité de scène : de quoi la reconnaître, la poser et savoir si on la voit.
 *  C'est tout ce que la dérivation demande à un élément de rendu — d'où il vient ne l'intéresse pas. */
interface CorpsPoste {
  entId: string;
  ancrage: Ancrage;
  /** Empreinte en cases : le halo l'épouse axe par axe, et la plaque s'en déduit le centre. */
  span: { w: number; h: number };
  /** EN VUE, par le seul champ de vérité de rendu (`ElStates.visible`). */
  visible: boolean;
}

/** L'entité de SCÈNE qu'un jeton représente, ou `null` : un combattant est une unité de bataille, pas
 *  une entité du document — rien à chercher dans la scène pour lui. */
function entiteDuJeton(tk: TokenEl): string | null {
  return tk.subject.kind === 'figurant' ? tk.subject.ent.id : null;
}

/** Les corps postés de la frame, jetons puis décors. Un jeton ÉMIS est en vue par construction (les
 *  hors-vue sont COUPÉS en amont, `builders/tokens.buildTokens`) et le dit par le même champ que le
 *  décor : une seule vérité de visibilité pour les deux familles. */
function corpsPostes(tokenEls: readonly TokenEl[], propEls: readonly PropEl[]): CorpsPoste[] {
  const out: CorpsPoste[] = [];
  for (const tk of tokenEls) {
    const entId = entiteDuJeton(tk);
    const a = entId ? ancrageDuJeton(tk) : null;
    if (!entId || !a) continue;
    out.push({ entId, ancrage: a, span: { w: a.n, h: a.n }, visible: tk.states.visible });
  }
  for (const el of propEls) {
    if (el.source !== 'entity') continue;
    out.push({
      entId: el.entId,
      ancrage: ancrageDuDecor(el),
      span: el.span,
      visible: el.states.visible,
    });
  }
  return out;
}

/**
 * Les halos d'interaction de l'instant : UN par entité utilisable POSTÉE dans le champ, qu'elle y soit
 * par un jeton ou par un décor. `flags` = les drapeaux de jeu (une action authorée `unique` déjà jouée
 * porte `__action_<entId>_<actionId>` et n'appelle plus), `regime` = ce que la frame en montre.
 */
export function interactionHalos(
  tokenEls: readonly TokenEl[],
  propEls: readonly PropEl[],
  scene: Scene,
  flags: Record<string, boolean | undefined>,
  regime: HaloRegime,
): readonly InteractHalo[] {
  // L'entité de scène par son id, INDEXÉE une fois : la boucle ci-dessous en réclame une par élément de
  // rendu, et un `find` par élément rendrait le relevé quadratique en nombre d'entités.
  const parId = new Map<string, SceneEntity>();
  for (const e of scene.entities) if (!parId.has(e.id)) parId.set(e.id, e);
  const out: InteractHalo[] = [];
  for (const corps of corpsPostes(tokenEls, propEls)) {
    const ent = parId.get(corps.entId);
    if (!ent || !estUtilisable(scene, ent, flags)) continue;
    const foot = decorFootGeometry(corps.span);
    out.push({
      ...corps.ancrage,
      id: corps.entId,
      ...(ent.label ? { label: ent.label } : {}),
      span: corps.span,
      centre: { x: corps.ancrage.cell.x + foot.offX, y: corps.ancrage.cell.y + foot.offY },
      echelle: { x: foot.sx, y: foot.sy },
      etat: etatDe(regime, corps.entId, corps.visible),
      visible: corps.visible,
    });
  }
  return out;
}
