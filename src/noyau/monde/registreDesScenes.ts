/**
 * Registre des scènes (pour les transitions de campagne) : les scènes d'une campagne y entrent
 * quand elle se lance (`loadProject`) ou se recharge (`reposerPaquetDeCampagne`), jamais à l'import.
 */
import type { Scene } from './scene';
import type { NarratifBlock } from './campaignNarratif';

const sceneRegistry: Record<string, Scene> = {};

export function registerScene(s: Scene): void {
  sceneRegistry[s.id] = s;
}

/** Document AUTHORED de la scène `id`, `undefined` si aucun paquet ne l'a enregistrée. */
export function sceneDuRegistre(id: string): Scene | undefined {
  return sceneRegistry[id];
}

/** TEST-ONLY (#777) : vide le `sceneRegistry` — simule un « registre reparti de zéro » (reload) SANS
 *  `vi.resetModules()`, incompatible avec la suite sous `isolate:false` (fuite de registre de modules
 *  entre fichiers du worker partagé). */
export function resetSceneRegistry(): void {
  for (const k of Object.keys(sceneRegistry)) delete sceneRegistry[k];
}

/** TEST-ONLY (#2097) : les scènes du registre, sources de donnée de la garde de partage. */
export function scenesDuRegistre(): Scene[] {
  return Object.values(sceneRegistry);
}

/** Paquet de campagne snapshotté (#766) : RÉ-ENREGISTRE toutes ses scènes (le `sceneRegistry` en mémoire
 *  module ne connaît sinon que la scène courante → transitions/portes vers les AUTRES scènes du
 *  paquet échoueraient en silence) et RE-DÉRIVE la couche narrative runtime (`HORS_SAVE`, `saves.ts`).
 *  Lue par la reprise de save et par le snapshot coop de l'invité (`netFlow.applyNetSnapshot`). */
export function reposerPaquetDeCampagne(
  doc: { scenes: readonly Scene[]; narratif: NarratifBlock } | null | undefined,
): { campaignNarratif?: NarratifBlock } {
  if (!doc) return {};
  for (const s of doc.scenes) registerScene(s);
  return { campaignNarratif: doc.narratif };
}
