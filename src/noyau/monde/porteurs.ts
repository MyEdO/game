/**
 * PORTEURS de Groupes qu'un personnage rencontre : les combattants en Ligne de Vue, sources psychologiques et
 * adversaires vus, et l'étiquette de la scène. Lecture pure de la scène et du combat, sans store. #1463
 */
import type { Combatant } from '../../engine/types';
import { sourceCombattant, type SourceEnVue } from '../../engine/psychology';
import type { BattleState } from '../etat';
import type { Scene } from './scene';
import { losClear } from './lineOfSight';
import { smokeOf } from './combatGeometry';

/** Les combattants en Ligne de Vue de `porteur` (lui exclu) que `retenu` garde, jugé AVANT la Ligne de Vue :
 *  chaque lecteur dit lesquels comptent (un déclencheur écarte les hors d'action, la fin d'une affliction garde
 *  l'Inconscient). Paresseux : un lecteur qui cherche le premier s'arrête au premier. Sans position, rien n'est
 *  en vue. */
export function* sourcesEnVue(battle: BattleState, scene: Scene, porteur: Combatant, retenu: (s: Combatant) => boolean = () => true): Generator<Combatant, void, undefined> {
  const depuis = porteur.pos;
  if (!depuis) return;
  const fumees = smokeOf(battle);
  for (const s of battle.combatants) if (s.id !== porteur.id && s.pos && retenu(s) && losClear(scene, depuis, s.pos, fumees)) yield s;
}

/** Les sources psychologiques en vue de `porteur` : les combattants de `sourcesEnVue` que `retenu` garde, puis
 *  l'étiquette de la scène (`etiquetteDeScene`). #3045 */
export function sourcesPsyEnVue(battle: BattleState, scene: Scene, porteur: Combatant, retenu: (s: Combatant) => boolean): SourceEnVue[] {
  return [...[...sourcesEnVue(battle, scene, porteur, retenu)].map(sourceCombattant), ...etiquetteDeScene(scene)];
}

/** L'étiquette de `scene` : la source psychologique des Groupes qu'elle porte (`Scene.groups`), en vue partout
 *  dans la scène, en combat comme hors combat ; aucune sans Groupe. #3045 */
export function etiquetteDeScene(scene: Scene): SourceEnVue[] {
  return scene.groups?.length ? [{ genre: 'etiquette', id: 'scene', label: scene.label, groups: scene.groups }] : [];
}
