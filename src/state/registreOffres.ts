/**
 * CE QUE LE REGISTRE OFFRE, PAR PORTEUR (#1411 P2-C) — lecture UNIQUE du motif « entrée × sélecteur ×
 * candidat » du registre des actions, pour TOUTE surface qui offre PAR CANDIDAT :
 *  • `pastille-entite` — les gestes qu'une chose du champ ouvre (monter sur la MONTURE, servir/pousser
 *    la PIÈCE, ramasser le TAS), hors console : le geste vit sur ce qui l'offre (spec HUD zone 4) ;
 *  • `geste-secondaire` — le geste que l'alvéole d'une AUTRE entrée ouvre sur SON candidat (clic droit,
 *    appui long), rendu par la console.
 *
 * UNE seule lecture pour les deux : elles posaient la même question (« quelles entrées de cette surface
 * couvrent CE candidat, et avec quels arguments ? »), et la console y répondait en DEVINANT l'identité
 * du candidat (`o?.id ?? o?.uid`). Ici l'identité est DÉCLARÉE par l'enveloppe de sélecteur
 * (`ACTION_PORTEURS`) : aucune forme de candidat n'est reniflée, aucun id d'action n'est cité.
 *
 * Le verdict d'offre est celui du registre, évalué sur les ARGUMENTS mêmes du dispatch — une offre
 * refusée reste une offre (`gate.ok === false`), et sa surface la montre avec sa raison plutôt que de
 * l'escamoter (loi du refus visible, arbitrage 2026-08-19).
 */
import type { GameState } from './store';
import { activeCombatant, useGame } from './store';
import { actorIn } from './combatants';
import { controlsActive } from './netOwnership';
import type { OffreRendue, OffresRenduesParPorteur } from './offreRendue';
import { ACTIONS, type ActionDef } from '../data/index';
import {
  ACTION_CANDIDATES,
  ACTION_PORTEURS,
  actionCostLabel,
  actionGate,
  runAction,
  type ActionGate,
  type ActionRunCtx,
  type ActionSelectorCtx,
} from './actionRegistry';

/** UNE offre : de quoi la peindre (libellé, icône, coût), la refuser avec sa raison (`gate`), et la
 *  commettre par la porte unique du registre (`actionId` + `args`). */
export interface Offre {
  actionId: string;
  /** L'entrée elle-même — la surface y lit ce dont elle a besoin (`hote`, `armed`…) sans re-chercher. */
  def: ActionDef;
  /** Libellé de l'ACTION (« Monter », « Ramasser ») — ce que le joueur lit. */
  label: string;
  /** Nom du CANDIDAT quand un même porteur en offre plusieurs (une pièce parmi deux, un objet d'un tas). */
  candidat?: string;
  icon: string;
  /** Coût dans l'économie du tour, en toutes lettres — `null` quand l'acte n'en prend aucun. */
  cost: string | null;
  args: ActionRunCtx;
  gate: ActionGate;
}

/** Les offres d'une SURFACE, groupées par PORTEUR (l'identité déclarée du candidat). */
export interface OffresParPorteur {
  porteurId: string;
  offres: Offre[];
}

/** Les offres de la surface `surface` dans le contexte `ctx`, groupées par porteur. Une entrée sans
 *  sélecteur, ou dont le sélecteur n'a pas de porteur déclaré, n'offre rien : elle ne peut désigner
 *  personne, et la garde `action-atteignabilite` refuse déjà ce cas. */
export function offresDuRegistre(surface: ActionDef['surface'], ctx: ActionSelectorCtx): OffresParPorteur[] {
  const parPorteur = new Map<string, OffresParPorteur>();
  for (const def of ACTIONS) {
    if (def.surface !== surface || !def.candidates) continue;
    const selecteur = ACTION_CANDIDATES[def.candidates];
    const porteur = ACTION_PORTEURS[def.candidates];
    if (!selecteur || !porteur) continue;
    for (const candidat of selecteur(ctx)) {
      const p = porteur(candidat);
      if (!p) continue;
      const groupe = parPorteur.get(p.porteurId) ?? { porteurId: p.porteurId, offres: [] };
      groupe.offres.push({
        actionId: def.id,
        def,
        label: def.label,
        candidat: p.label,
        icon: def.icon,
        cost: actionCostLabel(def),
        // Le verdict porte sur CE candidat, sur les MÊMES arguments que le dispatcher recevra.
        gate: actionGate(def.id, { ...ctx, args: p.args }),
        args: p.args,
      });
      parPorteur.set(p.porteurId, groupe);
    }
  }
  return [...parPorteur.values()];
}

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
  return offresDuRegistre('pastille-entite', { active, battle, netMode: state.net.mode, gameTime: state.gameTime, state }).map((g) => ({
    porteurId: g.porteurId,
    // Le nom du porteur à l'écran : le combattant qui le porte, ou l'entité de scène (un tas au sol).
    porteurLabel: actorIn(state, g.porteurId)?.label ?? state.scene?.entities.find((e) => e.id === g.porteurId)?.label,
    offres: g.offres.map(rendreOffre),
  }));
}
