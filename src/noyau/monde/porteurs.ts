/**
 * PORTEURS de Groupes qu'un personnage rencontre : les combattants en Ligne de Vue, la scène et les objets
 * portés en vue. Lecture pure de la scène et du combat, sans store. #1463 #3045
 */
import type { Combatant } from '../../engine/types';
import { libelleOuAbsence } from '../../data';
import { nomDe } from '../../engine/nom';
import type { PlayerText } from '../../i18n/playerText';
import { estIdDEtiquetteDObjet, idDEtiquetteDObjet } from '../../lib/entityId';
import { ficheDObjetPorte, isWearable, itemLabel, type TrappingResolver } from '../../engine/items';
import { isWeaponActive } from '../../engine/weaponLoad';
import { sourceCombattant, type SourceEnVue } from '../../engine/psychology';
import type { BattleState } from '../etat';
import type { Scene } from './scene';
import { losClear } from './lineOfSight';
import { smokeOf } from './combatGeometry';
import { inBattleId } from './combatants';

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
 *  l'étiquette de la scène et celles des objets qu'ils portent. #3045 */
export function sourcesPsyEnVue(
  battle: BattleState, scene: Scene, porteur: Combatant, retenu: (s: Combatant) => boolean, resolveTrapping: TrappingResolver,
): SourceEnVue[] {
  const combattants = [...sourcesEnVue(battle, scene, porteur, retenu)];
  return [
    ...combattants.map(sourceCombattant),
    ...etiquetteDeScene(scene),
    ...combattants.flatMap((c) => etiquettesDesObjetsPortes(c, resolveTrapping)),
  ];
}

/** #3045 Q4 ; EDOC 12 l.170-197 */
export function etiquettesDesObjetsPortes(porteur: Combatant, resolveTrapping: TrappingResolver): Extract<SourceEnVue, { genre: 'etiquette' }>[] {
  if (porteur.dead || porteur.outOfRencontre) return [];
  return (porteur.items ?? []).flatMap((objet) => {
    if (objet.inside || objet.destroyed) return [];
    const expose = isWeaponActive(porteur, objet.uid) || (!!objet.equipped && isWearable(objet));
    if (!expose) return [];
    const groups = ficheDObjetPorte(objet, resolveTrapping)?.groups;
    return groups?.length ? [{ genre: 'etiquette', id: idDEtiquetteDObjet(porteur.id, objet.uid), label: itemLabel(objet), groups }] : [];
  });
}

interface SourcePsyAuCombat {
  id: string;
  genre: 'combattant' | 'objet';
  nom: PlayerText;
  ancre?: Combatant;
}

/** #3045 Q4 ; LDB 21 l.27 */
export function sourcePsyAuCombat(battle: BattleState, id: string): SourcePsyAuCombat {
  if (estIdDEtiquetteDObjet(id)) {
    for (const porteur of battle.combatants) {
      const objet = porteur.items?.find((item) => idDEtiquetteDObjet(porteur.id, item.uid) === id);
      if (objet) return { id, genre: 'objet', nom: libelleOuAbsence({ label: itemLabel(objet) }, 'objet', id), ancre: porteur };
    }
    return { id, genre: 'objet', nom: libelleOuAbsence(undefined, 'objet', id) };
  }
  const ancre = inBattleId(battle, id);
  return { id, genre: 'combattant', nom: ancre ? nomDe(ancre) : libelleOuAbsence(undefined, 'combattant', id), ancre };
}

/** L'étiquette de `scene` : la source psychologique des Groupes qu'elle porte (`Scene.groups`), en vue partout
 *  dans la scène, en combat comme hors combat ; aucune sans Groupe. #3045 */
export function etiquetteDeScene(scene: Scene): SourceEnVue[] {
  return scene.groups?.length ? [{ genre: 'etiquette', id: 'scene', label: scene.label, groups: scene.groups }] : [];
}
