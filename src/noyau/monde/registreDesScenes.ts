/**
 * Registre des scènes (pour les transitions de campagne) : les scènes d'une campagne y entrent
 * quand elle se lance (`chargerLeProjet`) ou se recharge (`reposerPaquetDeCampagne`), jamais à l'import, avec les ponts
 * de ses navires posés (`poserLesNavires`, #3686).
 */
import type { Scene } from './scene';
import { poserLesNavires } from '../planDeNavire';
import type { NarratifBlock } from '../../data/schemas/defs-scenes/narratif';

const sceneRegistry: Record<string, Scene> = {};

/** Enregistre la scène `s`, les ponts de ses navires posés, et la rend telle qu'elle entre en jeu. */
export function registerScene(s: Scene): Scene {
  return (sceneRegistry[s.id] = poserLesNavires(s));
}

/** Document AUTHORED de la scène `id`, ses navires posés, `undefined` si aucun paquet ne l'a enregistrée. */
export function sceneDuRegistre(id: string): Scene | undefined {
  return sceneRegistry[id];
}

/** Vide le `sceneRegistry` : le retrait d'une partie suspendue (`retirerLeRegistre`) ; en test (#777), un « registre
 *  reparti de zéro » (reload) SANS `vi.resetModules()`, incompatible avec la suite sous `isolate:false` (fuite de
 *  registre de modules entre fichiers du worker partagé). */
export function resetSceneRegistry(): void {
  for (const k of Object.keys(sceneRegistry)) delete sceneRegistry[k];
}

/** Retire les scènes du registre et les rend, pour qu'on les repose (`poserLeRegistre`) : le registre d'une partie
 *  suspendue (`ouvrirLeProprietaire`, #4862). */
export function retirerLeRegistre(): Record<string, Scene> {
  const scenes = { ...sceneRegistry };
  resetSceneRegistry();
  return scenes;
}

/** Remplace le registre par les scènes `scenes`, rendues par `retirerLeRegistre` : celles d'une partie qui se rebranche. */
export function poserLeRegistre(scenes: Readonly<Record<string, Scene>>): void {
  resetSceneRegistry();
  Object.assign(sceneRegistry, scenes);
}

/** Les scènes du registre : celles qu'une transition rejoint (`sceneDuRegistre`), la désignation d'une scène
 *  (`DESIGNATIONS`, `designations.ts`) et la garde de partage (#2097). */
export function scenesDuRegistre(): Scene[] {
  return Object.values(sceneRegistry);
}

type PaquetSnapshotte = { scenes: readonly Scene[]; narratif: NarratifBlock } | null | undefined;

/** La couche narrative runtime (`HORS_SAVE`, `persistance/save.ts`) que RE-DÉRIVE le paquet de campagne `doc`. Lue par
 *  le chargement d'une save (`chargerLaSave`), qui n'enregistre aucune scène : la partie qui s'ouvre sur l'état chargé
 *  les enregistre (`ouvrirLeProprietaire`, #4862). */
export function narratifDuPaquet(doc: PaquetSnapshotte): { campaignNarratif?: NarratifBlock } {
  return doc ? { campaignNarratif: doc.narratif } : {};
}

/** Paquet de campagne snapshotté (#766) : RÉ-ENREGISTRE toutes ses scènes (le `sceneRegistry` en mémoire
 *  module ne connaît sinon que la scène courante → transitions/portes vers les AUTRES scènes du
 *  paquet échoueraient en silence) et rend sa couche narrative (`narratifDuPaquet`). Lue par l'ouverture d'une partie
 *  sur un état gardé (`ouvrirLeProprietaire`) et par l'instantané coop appliqué chez l'invité (`coop.appliquerLInstantane`). */
export function reposerPaquetDeCampagne(doc: PaquetSnapshotte): { campaignNarratif?: NarratifBlock } {
  for (const s of doc?.scenes ?? []) registerScene(s);
  return narratifDuPaquet(doc);
}
