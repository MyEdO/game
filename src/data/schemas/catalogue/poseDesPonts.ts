/**
 * La POSE des ponts d'un navire dans une scène, lue sous le catalogue passé (#5070) : la fiche de sa coque
 * (`vehicles.json › ponts`, `hull.footprint`) se lit dans `cat`.
 */
import { estCardinal, type Dir8 } from '../../../geometry/dir8';
import { sceneMetresPerTile } from '../../../geometry/grid';
import { dimensionsDesPonts } from '../grammaire/carte-ascii';
import { entreeDe, type Catalogue } from './catalogue';

type SupportDesPonts = { metresPerTile?: number };
type GrilleDesPonts = SupportDesPonts & { dimensions: { w: number; h: number } };
type AncreDesPonts = { vehicule?: { id: string }; pos: { x: number; y: number }; facing?: Dir8 };

/** Le véhicule `id` d'un PERSONNAGE (sa clé `vehicule`) est-il, sous `cat`, un navire à ponts (`vehicles.json › ponts`,
 *  #3686) ? Ses ponts ne se posent qu'à un cap cardinal : le schéma de scène refuse les autres (`refusDeLEntite`),
 *  l'éditeur ne les offre pas (`capsOfferts`). */
export const estUnNavireAPonts = (id: string | undefined, cat: Catalogue): boolean =>
  id !== undefined && entreeDe('vehicles', id, cat)?.ponts !== undefined;

/** Les ponts de scène et la carte à pied ont la même échelle de cases. */
export const aLEchelleDesPonts = (scene: SupportDesPonts): boolean =>
  sceneMetresPerTile(scene) === sceneMetresPerTile(undefined);

/** Le rectangle de flottaison tourné, centré sur l'empreinte carrée de la coque, ou absent sans ponts à cette échelle. */
export function rectangleDesPonts(scene: SupportDesPonts, entite: AncreDesPonts, cat: Catalogue) {
  if (!aLEchelleDesPonts(scene) || !entite.vehicule) return null;
  const fiche = entreeDe('vehicles', entite.vehicule.id, cat);
  if (!fiche?.ponts) return null;
  const cap = entite.facing ?? 'N';
  if (!estCardinal(cap)) return null;
  const dimensions = dimensionsDesPonts(fiche.ponts[0]);
  const horizontal = cap === 'E' || cap === 'O';
  const [w, h] = horizontal ? [dimensions.w, dimensions.h] : [dimensions.h, dimensions.w];
  const cote = fiche.hull?.footprint ?? 1;
  const coin = (ancre: number, longueur: number) => Math.floor(ancre + (cote - longueur) / 2 + 0.5);
  return { x: coin(entite.pos.x, w), y: coin(entite.pos.y, h), w, h, cap };
}

/** Refus d'une pose de ponts qui déborde de la grille. */
export function refusDePoseDesPonts(scene: GrilleDesPonts, entite: AncreDesPonts, cat: Catalogue): string | undefined {
  const r = rectangleDesPonts(scene, entite, cat);
  if (!r || rectangleDansLaGrille(scene.dimensions, r)) return undefined;
  const { w, h } = scene.dimensions;
  return `ponts du navire hors de la carte : rectangle ${r.w}×${r.h} en (${r.x},${r.y}), carte ${w}×${h} — déplace le navire ou agrandis la carte`;
}

/** Les bornes hautes sont exclusives : le rectangle peut toucher les quatre bords. */
const rectangleDansLaGrille = (grille: GrilleDesPonts['dimensions'], r: NonNullable<ReturnType<typeof rectangleDesPonts>>): boolean =>
  r.x >= 0 && r.y >= 0 && r.x + r.w <= grille.w && r.y + r.h <= grille.h;

/** Le rectangle des ponts que la scène pose pour `entite` : ses ponts à l'échelle, contenus dans la carte, sinon `null`. */
export function rectangleDesPontsPoses(scene: GrilleDesPonts, entite: AncreDesPonts, cat: Catalogue) {
  const r = rectangleDesPonts(scene, entite, cat);
  return r && rectangleDansLaGrille(scene.dimensions, r) ? r : null;
}
