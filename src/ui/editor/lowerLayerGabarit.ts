/**
 * Traitement des couches INFÉRIEURES (`z < currentLayer`) dans le canevas d'éditeur — réglages
 * UTILISATEUR persistés (`persistedAtom`, primitive partagée `ui/persistedAtom.ts`) :
 *  - MODE : `gabarit` (les couches du dessous restent dessinées, voilées) ou `isolee` (SEULE la
 *    couche active est émise). Le bon mode dépend du moment : aligner sur l'existant, vs lire son
 *    propre tracé sur une couche presque vide où le dessous fournit l'essentiel des traits visibles.
 *  - OPACITÉ du gabarit : le bon niveau dépend de la carte/du moment (repère net pour aligner vs
 *    quasi éteint pour lire son propre tracé), jamais une constante. Défaut nettement plus effacé
 *    que le voile (opaque) du jeu.
 */
import { persistedAtom } from '../persistedAtom';

/** Traitement des couches du dessous — id STABLE porté par la logique, le libellé restant de l'affichage. */
export type LowerLayerMode = 'gabarit' | 'isolee';

/** Défaut : le gabarit reste identifiable (matériaux/tracé) sans concurrencer la couche active. */
export const DEFAULT_LOWER_LAYER_OPACITY = 0.22;
/** Défaut : le dessous reste visible — l'isolation est un geste d'auteur, jamais un état subi. */
export const DEFAULT_LOWER_LAYER_MODE: LowerLayerMode = 'gabarit';

/**
 * PRÉDICAT UNIQUE de visibilité d'une couche dans le canevas d'éditeur — la SEULE loi, lue par les
 * deux voies : les 14 familles de surcouches SVG et, depuis le lot P3-3 (#1176), les canaux du monde
 * volumique (dégagement `keepEl`, teinte `tintAt`, éléments à billboarder). Le DESSUS est masqué dans
 * les deux modes (on n'édite pas ce qui flotte au-dessus de sa tête) ; le DESSOUS ne l'est qu'en mode
 * isolé. PURE.
 */
export function layerHidden(z: number, currentLayer: number, mode: LowerLayerMode): boolean {
  return z > currentLayer || (mode === 'isolee' && z < currentLayer);
}

/**
 * SEUIL de bascule du gabarit en ISOLATION, pour le MONDE VOLUMIQUE seul.
 *
 * Le voile de gabarit du SVG est un filtre CSS `saturate() brightness() opacity(curseur)` — une VRAIE
 * opacité, qui EFFACE (cf. `editorLowerLayerFilterCss`). Le volume, lui, n'a pas ce canal : la teinte
 * de visibilité (`applyVisibilityTint`) est un SCALAIRE sur la couleur de sommet, donc un curseur à
 * zéro y rendrait la couche NOIRE — l'exact contraire d'un gabarit effacé, et bien plus gênant qu'un
 * étage absent. Sous ce seuil, le canevas bascule donc sur le canal qui, lui, sait faire disparaître :
 * le DÉGAGEMENT (`applyCutawayMask`). Le SVG, qui a l'opacité, garde son voile aux mêmes réglages.
 *
 * DIVERGENCE DÉCLARÉE sous le seuil : le canevas isole, les 14 surcouches SVG d'authoring restent
 * peintes au mode de l'AUTEUR (`layerHidden` sur son mode, pas sur celui du monde) — le toit en plan,
 * les zones, les triggers, les entrées d'une couche inférieure continuent donc de flotter au-dessus
 * d'un sol qui n'est plus dessiné. C'est VOULU : ces surcouches SONT ce qu'on édite (une zone se
 * déplace sans son plancher), et l'auteur qui éteint son gabarit demande à ne plus voir la MATIÈRE du
 * dessous, pas à perdre ses annotations. Une bascule des deux voies à la fois ferait disparaître le
 * calque qu'il est en train de régler.
 */
export const LOWER_LAYER_ISOLATE_BELOW = 0.15;

/** MODE EFFECTIF du monde volumique : le mode d'auteur, sauf sous le seuil ci-dessus où le gabarit
 *  n'est plus tenable en teinte et bascule en isolation. PURE. */
export function effectiveLowerLayerMode(mode: LowerLayerMode, opacity: number): LowerLayerMode {
  return mode === 'gabarit' && opacity < LOWER_LAYER_ISOLATE_BELOW ? 'isolee' : mode;
}

/**
 * TEINTE de visibilité pour le monde volumique de l'éditeur (le champ que `TintAt` échantillonne) : le
 * gabarit des couches du DESSOUS, en un scalaire. Elle ne dépend QUE de l'étage `z` — le gabarit est
 * un réglage de couche, pas une carte.
 * UN SEUL canal pour deux matières : `applyVisibilityTint` la porte aux FACES, et `collectBillboards`
 * la pose sur chaque sujet (`tint`) — donc les CORPS des figurants et des décors d'une couche basse
 * s'assombrissent du même geste que leur case. PURE.
 */
export function gabaritTint(z: number, currentLayer: number, opacity: number): number {
  return z < currentLayer ? opacity : 1;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

const opacityAtom = persistedAtom(
  'wfrp4.editor.lowerLayerOpacity',
  DEFAULT_LOWER_LAYER_OPACITY,
  (raw) => {
    const parsed = Number(raw);
    return raw !== '' && parsed >= 0 && parsed <= 1 ? parsed : DEFAULT_LOWER_LAYER_OPACITY;
  },
  String,
);

const modeAtom = persistedAtom<LowerLayerMode>(
  'wfrp4.editor.lowerLayerMode',
  DEFAULT_LOWER_LAYER_MODE,
  (raw) => (raw === 'isolee' ? 'isolee' : 'gabarit'),
  (v) => v,
);

export function lowerLayerOpacity(): number {
  return opacityAtom.get();
}

export function setLowerLayerOpacity(v: number): void {
  opacityAtom.set(clamp01(v));
}

export function useLowerLayerOpacity(): number {
  return opacityAtom.use();
}

export function lowerLayerMode(): LowerLayerMode {
  return modeAtom.get();
}

export function setLowerLayerMode(m: LowerLayerMode): void {
  modeAtom.set(m);
}

export function useLowerLayerMode(): LowerLayerMode {
  return modeAtom.use();
}
