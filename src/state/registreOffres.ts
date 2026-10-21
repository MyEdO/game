/**
 * LES OFFRES DU REGISTRE À L'ÉCRAN (#1411 P2-C) : la projection d'une offre (`offresDuRegistre`,
 * `noyau/actionRegistry.ts`) dans l'invariant d'affichage de la pastille, et les pastilles d'entité de l'instant.
 */
import type { GameState } from './store';
import { useGame } from './store';
import { activeCombatant } from '../noyau/combatFlow';
import { actorIn } from '../noyau/monde/combatants';
import { nomDEntite } from '../noyau/monde/sceneNpc';
import { presetPnjById } from './campaignData';
import { controlsActive } from '../noyau/netOwnership';
import type { OffreRendue, OffresRenduesParPorteur } from './offreRendue';
import { offresDuRegistre, runAction, type Offre } from '../noyau/actionRegistry';

/** PROJECTION d'une offre du registre dans l'invariant d'affichage de la pastille (`OffreRendue`) :
 *  la surface n'y lit plus ni `ActionDef` ni arguments de dispatch, et l'engagement est refermé sur
 *  la porte UNIQUE du registre (`runAction`). Clé stable : l'action et ce qui distingue son candidat. */
export function rendreOffre(o: Offre): OffreRendue {
  return {
    id: `${o.actionId}|${Object.values(o.args).join('|')}`,
    label: o.label,
    icon: o.icon,
    cost: o.cost,
    candidat: o.candidat,
    gate: o.gate,
    onSelect: () => runAction(o.actionId, useGame.getState, o.args),
  };
}

/** Les PASTILLES D'ENTITÉ de l'instant : les offres de la surface du champ, par entité qui les porte.
 *  Vide hors combat, hors de son tour, ou quand le siège local ne contrôle pas l'actif (coop : les
 *  gestes du héros d'un autre joueur ne s'offrent pas ici). */
export function entityGestes(state: GameState): OffresRenduesParPorteur[] {
  const battle = state.battle;
  if (!battle || battle.over || !controlsActive(state)) return [];
  const active = activeCombatant(battle);
  if (!active) return [];
  return offresDuRegistre('pastille-entite', { active, battle, netMode: state.net.mode, state }).map((g) => ({
    porteurId: g.porteurId,
    // Le nom du porteur à l'écran : le combattant qui le porte, ou l'entité de scène (un tas au sol).
    porteurLabel: actorIn(state, g.porteurId)?.label ?? state.scene?.entities.filter((e) => e.id === g.porteurId).map((e) => nomDEntite(e, presetPnjById))[0],
    offres: g.offres.map(rendreOffre),
  }));
}
