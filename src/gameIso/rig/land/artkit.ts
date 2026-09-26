/**
 * Boîte à outils PARTAGÉE des arts de VÉHICULE TERRESTRE (EDOC 07 « Chargement ») — MÊME pattern que
 * `engin/artkit`/`ship/artkit` : un art terrestre = 1 fichier `land/defs/<id>.ts` (registre auto-chargé
 * par `scripts/gen-registry.mjs`), routé par ID de véhicule (`vehicles.json`, `hull.propulsion ===
 * 'terrestre'`) dans `composeLand`. Coords LOCALES : origine = contact sol au centre, l'objet monte en
 * y NÉGATIF (cf. `groundedBody`). RÉUTILISE les roues et la palette de la boîte à outils d'engin (bois/
 * fer communs aux véhicules à roues) + un jeton `bache` propre à la bâche de toile.
 */
import type { PaletteDeclaree } from '../palette';
import type { ViewArt } from '../viewArt';
import { wheelFace, wheelEdge, ENGIN_DEFAULT } from '../engin/artkit';

/** Def d'ART terrestre = id de VÉHICULE (`vehicles.json`, `hull.propulsion === 'terrestre'`) + son art
 *  ORIENTÉ (contrat PARTAGÉ `ViewArt`). Silhouette de BROADSIDE → seule `profile` est déclarée pour
 *  l'instant (couverture honnête) ; face/dos REPLIENT dessus jusqu'aux vagues d'art suivantes. */
export interface LandArtDef extends ViewArt {
  id: string;
}

/** Palette par défaut d'un véhicule terrestre : bases de l'engin (bois/fer) + toile de bâche. */
export const LAND_DEFAULT: PaletteDeclaree = { ...ENGIN_DEFAULT, bache: '#8c7a54' };

export { wheelFace, wheelEdge };
