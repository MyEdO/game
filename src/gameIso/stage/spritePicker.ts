/**
 * Couture de picking du décor : le lanceur WebGL inscrit répond en coordonnées client ; sans lanceur,
 * rien n'est visé.
 * Le cadre rendu est publié par l'hôte ; pointeur et sonde partagent sa projection,
 * sa caméra, son zoom et ses arêtes projetées.
 */
import type { Dims } from '../../geometry/iso';
import type { AreteProjetee } from './aretesProjetees';
import type { PickResult } from '../backends/webgl/spriteRaycast';

/** Répondeur de la voie volumique : coordonnées CLIENT (celles d'un `PointerEvent`) → ce qui est visé. */
export type SpritePicker = (clientX: number, clientY: number) => PickResult;

let _picker: SpritePicker | null = null;

export function setSpritePicker(picker: SpritePicker | null): void {
  _picker = picker;
}

/** Une voie volumique répond-elle au hit-test ? (Le montage de `GameStage3D` en est la seule cause.) */
export function hasSpritePicker(): boolean {
  return _picker !== null;
}

/** Le décor volumique que le rayon nomme sous ce point, ou `null`. */
export function targetUnderPointer(clientX: number, clientY: number): PickResult {
  return _picker ? _picker(clientX, clientY) : null;
}

/** Ce que l'écran REND, et donc tout ce qu'il faut pour inverser un pixel jusqu'à sa case
 *  (`pickResolve.ts:pointStageSousPixel`). */
export interface CadreRendu {
  /** Projection COMMISE : celle du dernier rendu de l'hôte. */
  dims: Dims;
  /** Caméra du rendu courant, LUE À L'APPEL — un LECTEUR, jamais une copie : la boucle d'images la
   *  réécrit hors de React (focal, approche, glisser-caméra), et le geste lit lui aussi cette
   *  valeur-là à l'instant de l'événement (`useStagePointer`, `camRef.current`). */
  camRendue: () => { x: number; y: number };
  /** Zoom que le geste inverse (`useStagePointer`, prop `zoom`). */
  zoom: number;
  /** ARÊTES utilisables projetées que la chaîne consulte AVANT le rayon (`stage/aretesProjetees.ts`),
   *  en LECTEUR comme la caméra : l'offre change à chaque pas du groupe, la sonde doit lire celle de
   *  l'INSTANT. Elles sont publiées parce que l'hôte seul connaît le brouillard et le contrôleur qui
   *  les filtrent — une sonde qui les rebâtirait résoudrait sur une autre offre que le clic. */
  aretes: () => readonly AreteProjetee[];
}

let _cadre: CadreRendu | null = null;

/** L'hôte de rendu PUBLIE le cadre qu'il vient de commettre (`null` à son démontage). */
export function setStageFrame(cadre: CadreRendu | null): void {
  _cadre = cadre;
}

/** Le cadre que l'écran REND en ce moment, ou `null` si aucun hôte n'est monté. */
export function getStageFrame(): CadreRendu | null {
  return _cadre;
}
