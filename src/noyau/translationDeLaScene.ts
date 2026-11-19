/**
 * TRANSLATION D'UNE SCÈNE sur sa grille (#4392) : tout ce que le schéma de scène positionne en cases suit le même
 * décalage, par la co-descente de la scène avec `sceneSchema` (`coDescendre`). Un objet de donnée se déplace quand un
 * de ses nœuds de schéma est, par identité, une position de case déclarée (`POSITIONS_DE_CASE`).
 */
import { coDescendre, estConteneur } from '../data/schemas/grammaire/descente';
import { architectureEdgeRefSchema, rectSchema, sceneSchema, wallSegSchema, zoneAreaSchema } from '../data/schemas/defs-scenes/scene';
import { ptSchema } from '../data/schemas/defs-scenes/communs';
import { setDoorSchema } from '../data/schemas/defs-scenes/effets';
import { cell2Schema, pointDuPlanSchema, rectDeCasesSchema } from '../data/schemas/grammaire/valeurs';
import type { Scene } from './monde/scene';

/** Une paire de clés (abscisse, ordonnée) en cases de la grille. */
type PaireDeCase = readonly [string, string];

const XY: readonly PaireDeCase[] = [['x', 'y']];
const [zoneRectangle, zoneDisque] = zoneAreaSchema.options;

/** Les nœuds du schéma de scène qui posent une case de la grille, chacun avec les paires de clés qu'il porte. */
export const POSITIONS_DE_CASE: ReadonlyMap<unknown, readonly PaireDeCase[]> = new Map<unknown, readonly PaireDeCase[]>([
  [ptSchema, XY],
  [cell2Schema, XY],
  [rectDeCasesSchema, XY],
  [rectSchema, XY],
  [architectureEdgeRefSchema, XY],
  [wallSegSchema, XY],
  [setDoorSchema, XY],
  [zoneRectangle, XY],
  [zoneDisque, [['cx', 'cy']]],
]);

/** Les nœuds du schéma de scène à paire de coordonnées qui ne sont pas des cases de la grille, chacun avec sa raison. */
export const HORS_GRILLE: ReadonlyMap<unknown, string> = new Map<unknown, string>([
  [pointDuPlanSchema, 'calage d’un décor dans sa case, de -1 à +1'],
]);

/** La scène `scene` dont chaque case posée (`POSITIONS_DE_CASE`) est décalée de `(dx, dy)`. PUR. */
export function translaterLaScene(scene: Scene, dx: number, dy: number): Scene {
  if (!dx && !dy) return scene;
  const copie = structuredClone(scene);
  coDescendre(sceneSchema, copie, (p) => {
    const paires = p.noeuds.map((n) => POSITIONS_DE_CASE.get(n)).find((v) => v !== undefined);
    if (!paires || !estConteneur(p.valeur)) return;
    const o = p.valeur as Record<string, number>;
    for (const [a, b] of paires) {
      o[a] += dx;
      o[b] += dy;
    }
    return 'elaguer';
  });
  return copie;
}
