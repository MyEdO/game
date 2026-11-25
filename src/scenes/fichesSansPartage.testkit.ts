/** #2097 : les fiches de combattant nées d'une scène ne partagent rien avec la scène mémorisée, le catalogue ni le
 *  narratif ; joué par le commun (`fiche-sans-partage.hors-store.test.ts`) et par chaque projet sur ses campagnes. */
import { ficheDEntite, sceneNpc } from '../noyau/monde/sceneNpc';
import { memoByRef } from '../noyau/monde/sceneMemo';
import { presetDuNarratif } from '../noyau/monde/resolveursDuNarratif';
import type { Scene } from '../noyau/monde/scene';
import type { NarratifBlock } from '../data/schemas/defs-scenes/narratif';
import { atteignables, objetsDuCatalogue } from './partage.testkit';

/** Un lot de scènes et le narratif qui résout ses presets. */
export type LotDeScenes = { nom: string; scenes: readonly Scene[]; narratif: NarratifBlock | null };

/** #2097 : chaque fiche de combattant née d'une scène des `lots` (`ficheDEntite`, `sceneNpc`), et ses chemins qui
 *  atteignent la scène mémorisée (gelée par `memoByRef`), le catalogue ou le narratif. */
export function partagesDesFiches(lots: readonly LotDeScenes[]): { fiches: number; fautes: string[] } {
  const geler = memoByRef((s: Scene) => s);
  const catalogue = objetsDuCatalogue();
  const fautes: string[] = [];
  let fiches = 0;
  for (const lot of lots) {
    const presetPnjById = presetDuNarratif(lot.narratif);
    const narratif = new Set(atteignables(lot.narratif, 'narratif').keys());
    for (const original of lot.scenes) {
      const scene = structuredClone(original);
      geler(scene);
      if (!Object.isFrozen(scene)) fautes.push(`${lot.nom} / ${scene.id} : non gelée par memoByRef`);
      for (const ent of scene.entities.filter((e) => e.kind === 'personnage')) {
        for (const [porte, c] of [['ficheDEntite', ficheDEntite(ent, presetPnjById)], ['sceneNpc', sceneNpc(scene, ent.id, presetPnjById)]] as const) {
          fiches++;
          for (const [o, chemin] of atteignables(c, ent.id)) {
            const ou = Object.isFrozen(o) ? 'scène gelée' : catalogue.has(o) ? 'catalogue' : narratif.has(o) ? 'narratif' : null;
            if (ou) fautes.push(`${lot.nom} / ${scene.id} / ${porte} : ${chemin} → ${ou}`);
          }
        }
      }
    }
  }
  return { fiches, fautes };
}
