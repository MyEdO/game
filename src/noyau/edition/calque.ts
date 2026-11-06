/**
 * LE CALQUE DE RÉFÉRENCE D'UNE COUCHE (#830, #3508) : une planche de livre que l'auteur pose sur le plan d'une couche de
 * la scène éditée pour la décalquer, un plan pour chaque niveau (retour user 2026-07-25). Aide d'auteur, jamais une
 * donnée de scène : aucun export ne la porte, l'hôte la garde chez lui (`CalquesStockes`). Son calage envoie un pixel de
 * l'image sur un point de la carte, en cases continues (une case centrée sur l'entier, `PointDeCarte.f`) : la planche
 * reste sur ses cases quand la vue tourne.
 */
import { z } from 'zod';
import '../../lib/zodEnFrancais';
import type { Scene } from '../monde/scene';
import { FORMAT_CALQUES } from '../persistance/formats.generated';
import { advanceCalibration, nearestNode, pointDeLImage, type CalibPoint, type CalibProgress } from './calage';

const calqueSchema = z.strictObject({
  /** La largeur et la hauteur de l'image, en pixels. */
  largeur: z.number().positive(),
  hauteur: z.number().positive(),
  /** De 0 à 1. */
  opacite: z.number().min(0).max(1),
  visible: z.boolean(),
  /** Au-dessus de la scène construite, pour décalquer et comparer ; sinon dessous, vu là où rien n'est bâti. */
  dessus: z.boolean(),
  /** Le calage déduit une rotation : une planche scannée de travers. */
  rotation: z.boolean(),
  /** D'un pixel de l'image à un point de la carte (`TraceTransform`). */
  calage: z.strictObject({ tx: z.number(), ty: z.number(), scale: z.number().positive(), rotateDeg: z.number() }),
});

/** Les calques d'un projet tels que l'hôte les garde : `version` vaut `FORMAT_CALQUES`, puis, par id de scène et par
 *  couche (`String(z)`), le calque. */
const calquesStockesSchema = z.strictObject({
  version: z.string(),
  calques: z.record(z.string(), z.record(z.string().regex(/^-?\d+$/), calqueSchema)),
});

export type CalqueDeCouche = z.infer<typeof calqueSchema>;
export type CalquesStockes = z.infer<typeof calquesStockesSchema>;
export type CalquesDuProjet = CalquesStockes['calques'];

/** Ce que l'auteur règle sur un calque posé. */
export type ReglageDuCalque = Partial<Pick<CalqueDeCouche, 'opacite' | 'visible' | 'dessus' | 'rotation'>>;

/** L'opacité d'un calque neuf. */
const OPACITE_NEUVE = 0.6;

/** Le calque neuf d'une image de `largeur` × `hauteur` pixels sur la scène `scene` : l'image entière sur la carte, son
 *  coin haut-gauche au coin de la case (0, 0), visible, au-dessus, sans rotation. */
export function calqueNeuf(scene: Scene, largeur: number, hauteur: number): CalqueDeCouche {
  const scale = Math.min(scene.dimensions.w / largeur, scene.dimensions.h / hauteur);
  return { largeur, hauteur, opacite: OPACITE_NEUVE, visible: true, dessus: true, rotation: false, calage: { tx: -0.5, ty: -0.5, scale, rotateDeg: 0 } };
}

/** Les quatre coins du calque `c` sur la carte, dans l'ordre haut-gauche, haut-droit, bas-droit, bas-gauche de l'image. */
export function coinsDuCalque(c: CalqueDeCouche): CalibPoint[] {
  return ([[0, 0], [c.largeur, 0], [c.largeur, c.hauteur], [0, c.hauteur]] as const).map(([px, py]) => pointDeLImage(c.calage, px, py));
}

/** Le plan du calque de la couche `z` de la scène `scene` : la hauteur la plus fréquente de ses cases, en mètres, la
 *  plus basse à égalité. */
export function planDuCalque(scene: Scene, z: number): number {
  const compte = new Map<number, number>();
  for (const h of scene.layers.find((l) => l.z === z)?.height ?? [0]) compte.set(h, (compte.get(h) ?? 0) + 1);
  return [...compte].sort(([h1, n1], [h2, n2]) => n2 - n1 || h1 - h2)[0][0];
}

/** Le calage `calage` avancé d'un clic au point `f` de la carte sur le calque `c` (`advanceCalibration`) : le repère
 *  d'arrivée est la carte, un nœud y est le coin de case le plus proche. */
export const caler = (calage: CalibProgress, c: CalqueDeCouche, f: CalibPoint) =>
  advanceCalibration(calage, f, c.calage, nearestNode, (x, y) => ({ cx: x, cy: y }), c.rotation);

/** Les calques que l'hôte a gardés, `lu`, s'ils sont du format courant et entiers ; `null` sinon. */
export function calquesLus(lu: unknown): CalquesDuProjet | null {
  const passe = calquesStockesSchema.safeParse(lu);
  return passe.success && passe.data.version === FORMAT_CALQUES ? passe.data.calques : null;
}

/** Les calques `calques` dans la forme que l'hôte garde. */
export const calquesAStocker = (calques: CalquesDuProjet): CalquesStockes => ({ version: FORMAT_CALQUES, calques });
