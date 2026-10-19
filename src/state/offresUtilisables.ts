/**
 * LES PASTILLES D'EXPLORATION (#1687 lot 3-I-b) — second producteur de l'invariant `OffreRendue`.
 *
 * Hors combat, ce qu'une chose du champ offre est dit par le dériveur UNIQUE `actionsDe` et joué par
 * l'exécuteur UNIQUE `jouerAction` : ce module n'en est que la PROJECTION vers la pastille, pas une
 * seconde source d'offre. Aucun `ActionDef`, aucune entrée au registre des actions de combat (dont
 * les gates exigent un combat ouvert et un actif contrôlé).
 *
 * RÉGIME — celui du COMBAT, à la lettre : les pastilles se montrent sur TOUS les porteurs à PORTÉE
 * du groupe, sans rien devoir au survol (`registreOffres.entityGestes`, qui rend les porteurs à
 * portée du combattant actif). Un hôte, un régime.
 *
 * Le survol ne PEUT pas porter ce régime : le bouton flotte au-dessus de la tête du porteur, donc le
 * viser fait quitter sa case — la pastille se démontait sous le curseur au bout de ~19 px de trajet
 * (recette 2026-09-11), et le panneau borné était inatteignable à la souris. Au tactile il n'y a pas
 * de survol du tout (`gameIso/stage/pointerCaps.ts`), donc pas de pastille. Le survol sert le HALO,
 * pas l'offre.
 *
 * COÛT : `null`. L'économie du tour est celle du combat ; hors combat, un geste ne prend pas d'Action.
 */
import { aPorteeDe } from './exploreNav';
import { actionsDe } from '../noyau/monde/usable';
import { nomDEntite } from './sceneNpc';
import { presetPnjById } from './campaignData';
import { placesJouables } from '../noyau/monde/seating';
import { t } from '../i18n';
import type { GameState } from './store';
import type { OffreRendue, OffresRenduesParPorteur } from './offreRendue';
import type { Scene, SceneEntity } from '../noyau/monde/scene';

/** Verdict d'une offre d'exploration — SOURCE UNIQUE : la pastille le peint, et le CLIC s'en sert pour
 *  savoir ce qu'il peut jouer sans rien demander (une offre refusée n'est pas « la » offre d'un clic). La porte est OUVERTE par défaut — `actionsDe` a déjà retiré ce
 *  qui n'est plus jouable (action épuisée) ; ne se refusent que les cas NOMMÉS, dont la raison se lit
 *  au survol (arbitrage 2026-08-24 : la raison au survol, jamais en texte inline). */
export function porteDOffre(scene: Scene, ent: SceneEntity, origine: string): OffreRendue['gate'] {
  if (origine !== 'assise') return { ok: true };
  const prises = scene.seatAssignments?.[ent.id] ?? {};
  const libre = placesJouables(scene, ent.id).some((s) => !prises[s.slotId]);
  return libre ? { ok: true } : { ok: false, reason: t('seating.occupied') };
}

/** Un porteur par entité utilisable À PORTÉE du groupe, dans la forme que la pastille peint. La
 *  portée est celle du clic « adjacent » (`store.interactEntity`, qui joue le geste sur place), lue au
 *  MÊME prédicat qu'eux (`exploreNav.aPorteeDe`) : ce que la pastille promet, le clic le sert.
 *  Hors de portée, le clic MARCHE — la pastille, elle, ne promet rien d'immédiat.
 *
 *  « Utilisable » n'est pas un champ : une entité l'est parce qu'elle OFFRE quelque chose
 *  (`estUtilisable` = `actionsDe(...).length > 0`, modèle unique de `noyau/monde/usable`) — on dérive donc
 *  les offres une fois et on garde les porteurs non vides. */
export function offresUtilisables(state: GameState): OffresRenduesParPorteur[] {
  const scene = state.scene;
  if (!scene || state.dialogue) return [];
  const porteurs: OffresRenduesParPorteur[] = [];
  for (const ent of scene.entities) {
    if (ent.combat?.hiddenUntilCombat) continue; // un ennemi d'embuscade n'offre rien en exploration
    if (!aPorteeDe(state.partyPos, ent)) continue;
    const offres = actionsDe(scene, ent, state.flags).map<OffreRendue>((o) => ({
      id: o.id,
      label: o.label,
      cost: null,
      gate: porteDOffre(scene, ent, o.origine),
      onSelect: () => state.jouerAction(ent.id, o.id),
    }));
    if (offres.length) porteurs.push({ porteurId: ent.id, porteurLabel: nomDEntite(ent, presetPnjById), offres });
  }
  return porteurs;
}
